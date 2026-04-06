import { useEffect, useMemo, useState, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
    BookOpen,
    ExternalLink,
    Sparkles,
    Brain,
    ClipboardCheck,
    Library,
    Rocket,
    FileText,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Navbar } from '../components/layout/Navbar';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { getUser } from '../utils/storage';
import { type NcertBook } from '../constants/books';
import {
    buildNcertChapterUrl,
    getNcertBundleZipUrl,
    getReadableMirrorUrl,
    getStudyResources,
} from '../utils/studyResources';
import { askQuestionStream } from '../api';

// Coach cache key format: `class_subject_chapter`
const coachCache = new Map<string, { content: string; timestamp: number }>();
const COACH_CACHE_TTL = 1800000; // 30 minutes

export const TextbookHub = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const user = getUser();
    const coachAbortRef = useRef<AbortController | null>(null);

    const selectedBookFromState = (location.state?.selectedBook as NcertBook | undefined) || undefined;
    const chapterFromState = (location.state?.chapter as string | undefined) || '';
    const initialClass = selectedBookFromState?.class || String(user?.class || '10');

    const [classFilter, setClassFilter] = useState(initialClass);
    const [subjectFilter, setSubjectFilter] = useState(selectedBookFromState?.subject || user?.subjects?.[0] || 'Science');
    const resources = getStudyResources(classFilter, subjectFilter);

    const [selectedBook, setSelectedBook] = useState<NcertBook | null>(selectedBookFromState || resources.textbooks[0] || null);
    const [selectedChapter, setSelectedChapter] = useState('');

    const [coachPlan, setCoachPlan] = useState('');
    const [coachLoading, setCoachLoading] = useState(false);
    const [coachCached, setCoachCached] = useState(false);

    useEffect(() => {
        if (!resources.textbooks.length) {
            setSelectedBook(null);
            return;
        }

        if (!selectedBook || selectedBook.class !== classFilter || selectedBook.subject !== resources.subject) {
            setSelectedBook(resources.textbooks[0]);
        }
    }, [resources.textbooks, resources.subject, classFilter, selectedBook]);

    useEffect(() => {
        if (chapterFromState && resources.chapters.includes(chapterFromState)) {
            setSelectedChapter(chapterFromState);
            return;
        }

        if (!resources.chapters.includes(selectedChapter)) {
            setSelectedChapter(resources.chapters[0] || '');
        }
    }, [chapterFromState, resources.chapters, selectedChapter]);

    const chapterIndex = useMemo(
        () => Math.max(1, resources.chapters.findIndex((chapter) => chapter === selectedChapter) + 1),
        [resources.chapters, selectedChapter]
    );

    const chapterUrl = selectedBook ? buildNcertChapterUrl(selectedBook.url, chapterIndex) : '';
    const chapterMirrorUrl = chapterUrl ? getReadableMirrorUrl(chapterUrl) : '';
    const bundleZipUrl = selectedBook ? getNcertBundleZipUrl(selectedBook.url) : null;

    const generateAutoCoach = async () => {
        if (!selectedBook || !selectedChapter) {
            toast.error('Select a chapter first.');
            return;
        }

        const cacheKey = `${classFilter}_${resources.subject}_${selectedChapter}`;
        const cached = coachCache.get(cacheKey);
        const now = Date.now();

        // Return cached if still valid
        if (cached && now - cached.timestamp < COACH_CACHE_TTL) {
            setCoachPlan(cached.content);
            setCoachCached(true);
            setCoachLoading(false);
            return;
        }

        setCoachLoading(true);
        setCoachCached(false);
        setCoachPlan('');

        // Cancel any previous request
        if (coachAbortRef.current) {
            coachAbortRef.current.abort();
        }
        coachAbortRef.current = new AbortController();

        const timeout = setTimeout(() => {
            if (coachAbortRef.current) {
                coachAbortRef.current.abort();
            }
        }, 22000); // Hard timeout after 22 seconds

        try {
            let plan = '';
            await askQuestionStream(
                {
                    class_num: String(selectedBook.class || classFilter),
                    subject: resources.subject,
                    chapter: selectedChapter,
                    question: `Create a compact autonomous study mission for this NCERT chapter in markdown.\nUse exactly these headings: Mission Focus, Must Know Points, Mistake Alerts, 30-Minute Plan, Self Test.\nClass: ${classFilter}, Subject: ${resources.subject}, Chapter: ${selectedChapter}`,
                },
                (token) => {
                    plan += token;
                    setCoachPlan(plan);
                }
            );

            // Cache the result
            coachCache.set(cacheKey, { content: plan, timestamp: now });
            setCoachCached(false);
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'Coach generation failed';

            // Fallback: provide a structured template
            const fallback = `### Mission Focus\nMaster chapter core concepts and exam language.\n\n### Must Know Points\n• Learn all key definitions from this chapter\n• Memorize one formula/rule per concept block\n• Track two high-frequency board asks\n\n### Mistake Alerts\n• Skipping chapter keywords in definitions\n• Writing steps without final conclusion\n• Not linking answers to chapter examples\n\n### 30-Minute Plan\n• 10 min: read chapter examples from NCERT\n• 12 min: ask AI for explanations and doubts\n• 8 min: solve 5 mixed practice questions\n\n### Self Test\nWrite 3 short answers and grade with Clarity Practice.`;

            setCoachPlan(fallback);
            coachCache.set(cacheKey, { content: fallback, timestamp: now });

            // Only show toast if it's a real error, not a user interrupt
            if (!errorMsg.includes('abort')) {
                toast.error('Coach loaded fallback mission (cache ready for next time)');
            }
        } finally {
            clearTimeout(timeout);
            setCoachLoading(false);
        }
    };

    const goAsk = () => {
        navigate('/ask', {
            state: {
                subject: resources.subject,
                chapter: selectedChapter,
            },
        });
    };

    const goPractice = () => {
        navigate('/practice', {
            state: {
                subject: resources.subject,
                chapter: selectedChapter,
                questionType: 'past-paper',
                numQuestions: 5,
            },
        });
    };

    const goLibrary = () => {
        navigate('/library', {
            state: {
                subject: resources.subject,
                chapter: selectedChapter,
            },
        });
    };

    return (
        <div className="min-h-screen bg-[#f8fafc] dark:bg-[#020617] transition-colors duration-300">
            <Navbar />
            <main className="max-w-7xl mx-auto px-6 py-10">
                <div className="mb-8">
                    <h1 className="text-4xl font-black text-slate-900 dark:text-white">Textbook Mission Hub</h1>
                    <p className="text-slate-500 mt-2 font-medium">
                        Reliable NCERT chapter access with autonomous study missions.
                    </p>
                </div>

                <div className="flex gap-2 bg-white dark:bg-slate-800 p-2 rounded-2xl border border-slate-100 dark:border-slate-700 mb-8">
                    {['9', '10', '11', '12'].map((cls) => (
                        <button
                            key={cls}
                            onClick={() => {
                                setClassFilter(cls);
                                const next = getStudyResources(cls, '');
                                setSubjectFilter(next.subject);
                                setCoachPlan('');
                            }}
                            className={`px-5 py-2.5 rounded-xl text-sm font-black transition-all ${classFilter === cls
                                ? 'bg-[#1D9E75] text-white shadow-lg shadow-[#1D9E75]/20'
                                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                                }`}
                        >
                            Class {cls}
                        </button>
                    ))}
                </div>

                <div className="flex flex-wrap gap-2 mb-8">
                    {resources.subjects.map((subject) => (
                        <button
                            key={subject}
                            onClick={() => {
                                setSubjectFilter(subject);
                                setCoachPlan('');
                            }}
                            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${resources.subject === subject
                                ? 'bg-[#1D9E75] text-white'
                                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-100 dark:border-slate-700'
                                }`}
                        >
                            {subject}
                        </button>
                    ))}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                    {/* Books Sidebar */}
                    <Card className="p-5 bg-white dark:bg-[#0f172a] border-none shadow-xl rounded-3xl lg:col-span-1">
                        <h3 className="text-sm font-black uppercase tracking-wider text-slate-500 mb-4">Textbooks</h3>
                        <div className="space-y-2 max-h-[62vh] overflow-y-auto pr-1">
                            {resources.textbooks.map((book) => (
                                <button
                                    key={`${book.class}-${book.subject}-${book.title}`}
                                    onClick={() => {
                                        setSelectedBook(book);
                                        setCoachPlan('');
                                    }}
                                    className={`w-full text-left p-3 rounded-2xl border transition-all ${selectedBook?.title === book.title && selectedBook?.subject === book.subject
                                        ? 'border-[#1D9E75] bg-emerald-50 dark:bg-emerald-900/20'
                                        : 'border-slate-100 dark:border-slate-700 hover:border-[#1D9E75]/40'
                                        }`}
                                >
                                    <p className="font-bold text-slate-900 dark:text-white text-sm">{book.title}</p>
                                    <p className="text-xs text-slate-500">{book.subject}</p>
                                </button>
                            ))}
                        </div>
                    </Card>

                    {/* Main Content */}
                    <div className="lg:col-span-3 space-y-6">
                        {/* Chapter Selection */}
                        <Card className="p-6 bg-white dark:bg-[#0f172a] border-none shadow-xl rounded-3xl">
                            <div className="mb-4">
                                <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2 mb-1">
                                    <BookOpen size={20} className="text-[#1D9E75]" />
                                    {selectedBook?.title || 'Select a textbook'}
                                </h2>
                                <p className="text-sm text-slate-500">
                                    Class {classFilter} • {resources.subject}
                                </p>
                            </div>

                            <div className="flex flex-wrap gap-2 mb-4">
                                {resources.chapters.slice(0, 24).map((chapter) => (
                                    <button
                                        key={chapter}
                                        onClick={() => {
                                            setSelectedChapter(chapter);
                                            setCoachPlan('');
                                        }}
                                        className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all text-center ${selectedChapter === chapter
                                            ? 'bg-[#1D9E75] text-white'
                                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                                            }`}
                                    >
                                        {chapter}
                                    </button>
                                ))}
                            </div>

                            {/* Action Buttons */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                <Button
                                    className="h-12 rounded-2xl bg-[#1D9E75] hover:bg-[#16805d] font-bold"
                                    onClick={() => chapterMirrorUrl && window.open(chapterMirrorUrl, '_blank')}
                                    disabled={!chapterMirrorUrl}
                                >
                                    <FileText size={16} className="mr-2" aria-hidden="true" />
                                    Open Readable Mirror
                                </Button>
                                <Button
                                    className="h-12 rounded-2xl bg-[#1D9E75] hover:bg-[#16805d] font-bold"
                                    onClick={goAsk}
                                >
                                    <Brain size={16} className="mr-2" aria-hidden="true" />
                                    Ask AI This Chapter
                                </Button>
                                <Button
                                    className="h-12 rounded-2xl bg-[#1D9E75] hover:bg-[#16805d] font-bold"
                                    onClick={goPractice}
                                >
                                    <ClipboardCheck size={16} className="mr-2" aria-hidden="true" />
                                    Practice This Chapter
                                </Button>
                            </div>

                            {bundleZipUrl && (
                                <Button
                                    variant="outline"
                                    className="mt-3 h-10 rounded-2xl"
                                    onClick={() => window.open(bundleZipUrl, '_blank')}
                                >
                                    <ExternalLink size={14} className="mr-2" />
                                    Full PDF Bundle
                                </Button>
                            )}
                        </Card>

                        {/* Autonomous Coach */}
                        <Card className="p-6 bg-white dark:bg-[#0f172a] border-none shadow-xl rounded-3xl">
                            <div className="flex items-center justify-between gap-3 mb-4">
                                <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                                    <Sparkles size={18} className="text-[#1D9E75]" />
                                    Autonomous Coach
                                </h3>
                                <Button
                                    className="h-10 px-4 rounded-xl bg-[#1D9E75] hover:bg-[#16805d] font-bold text-sm"
                                    onClick={generateAutoCoach}
                                    disabled={coachLoading || !selectedChapter}
                                >
                                    {coachLoading ? 'Generating...' : 'Generate Mission'}
                                </Button>
                            </div>

                            {coachCached && (
                                <div className="mb-3 p-2 px-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg text-xs font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                                    <Sparkles size={12} />
                                    Loaded from cache (30 min TTL)
                                </div>
                            )}

                            {!coachPlan && !coachLoading && (
                                <p className="text-sm text-slate-500">Select a chapter and generate a focused 30-minute study mission with key points, mistakes to avoid, and a self test.</p>
                            )}

                            {coachLoading && (
                                <div className="flex items-center gap-2 text-sm text-slate-500">
                                    <div className="animate-spin h-4 w-4 border-2 border-[#1D9E75] border-t-transparent rounded-full"></div>
                                    Building your study mission—please wait...
                                </div>
                            )}

                            {coachPlan && (
                                <article className="whitespace-pre-wrap text-sm leading-6 text-slate-700 dark:text-slate-200 max-h-[400px] overflow-y-auto pr-2">
                                    {coachPlan}
                                </article>
                            )}
                        </Card>

                        {/* Quick Launch Footer */}
                        <Card className="p-6 bg-gradient-to-r from-slate-900 to-slate-800 text-white border-none shadow-xl rounded-3xl">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div>
                                    <h3 className="text-lg font-black flex items-center gap-2 mb-1">
                                        <Rocket size={18} />
                                        Quick Launch
                                    </h3>
                                    <p className="text-sm text-slate-300">Jump straight into any mode with chapter context.</p>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    <Button className="rounded-xl bg-[#1D9E75] hover:bg-[#16805d] font-bold" onClick={goAsk}>
                                        Ask AI
                                    </Button>
                                    <Button className="rounded-xl bg-[#1D9E75] hover:bg-[#16805d] font-bold" onClick={goPractice}>
                                        Practice
                                    </Button>
                                    <Button className="rounded-xl bg-[#1D9E75] hover:bg-[#16805d] font-bold" onClick={goLibrary}>
                                        <Library size={16} className="mr-2" />
                                        Library
                                    </Button>
                                </div>
                            </div>
                        </Card>
                    </div>
                </div>
            </main>
        </div>
    );
};
