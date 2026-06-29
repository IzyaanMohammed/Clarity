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
    Trash2,
    Upload,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Navbar } from '../components/layout/Navbar';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { getUser, getAuthToken } from '../utils/storage';
import { type NcertBook } from '../constants/books';
import {
    buildNcertChapterUrl,
    getNcertBundleZipUrl,
    getReadableMirrorUrl,
    getStudyResources,
} from '../utils/studyResources';
import {
    askQuestionStream,
    uploadCustomTextbook,
    getCustomTextbooks,
    deleteCustomTextbook,
    getCustomTextbookContent,
    getTextbookContent,
    getBaseUrl,
    type CustomTextbookItem
} from '../api';
import { MarkdownContent } from '../components/ui/MarkdownContent';

// Helper to format raw text extracted from PDF
const formatRawTextbookText = (text: string): string => {
    if (!text) return '';
    if (/#+\s/.test(text) || /\*\*/.test(text) || /^\s*[-*+•]\s/m.test(text)) {
        return text;
    }
    
    let rawLines = text.replace(/\r\n/g, '\n').split('\n');
    let formattedLines: string[] = [];
    let currentParagraph: string[] = [];
    
    const isGarbageLine = (line: string): boolean => {
        const t = line.trim();
        if (!t) return false;
        // Page numbers
        if (/^\d+$/.test(t)) return true;
        // NCERT rationalization text e.g., "Rationalised 2023-24"
        if (/rationalised/i.test(t) && /\d{4}/.test(t)) return true;
        // NCERT site links
        if (/ncert/i.test(t) && /nic\.in/i.test(t)) return true;
        // Repetitive textbook header/footers
        const lower = t.toLowerCase();
        if (lower === 'science' || lower === 'mathematics' || lower === 'social science') return true;
        if (/^chapter\s+\d+$/i.test(t)) return true;
        return false;
    };

    for (let i = 0; i < rawLines.length; i++) {
        let line = rawLines[i].trim();
        
        if (isGarbageLine(line)) {
            if (currentParagraph.length > 0) {
                formattedLines.push(currentParagraph.join(' '));
                currentParagraph = [];
            }
            continue;
        }
        
        if (!line) {
            if (currentParagraph.length > 0) {
                formattedLines.push(currentParagraph.join(' '));
                currentParagraph = [];
            }
            continue;
        }

        // Check if it's a header
        const isHeader = (
            /^\d+(\.\d+)+\s+/u.test(line) ||  // Section numbers like 1.1, 2.3.4
            (/^\d+\.?\s+[\p{L}\p{N}]/u.test(line) && line.length < 65) || // Section numbers like 1. Introduction
            (/^[A-Z\u0B80-\u0BFF\s\-:\(\),]{5,65}$/u.test(line) && line.length > 5)
        );

        // Check if it's a list item
        const isListItem = /^\s*([-*+•]|\d+\.\s|\([a-z0-9\u0B80-\u0BFF]+\)\s)/ui.test(rawLines[i]);

        if (isHeader) {
            if (currentParagraph.length > 0) {
                formattedLines.push(currentParagraph.join(' '));
                currentParagraph = [];
            }
            formattedLines.push(`\n## ${line}\n`);
        } else if (isListItem) {
            if (currentParagraph.length > 0) {
                formattedLines.push(currentParagraph.join(' '));
                currentParagraph = [];
            }
            formattedLines.push(rawLines[i]);
        } else {
            // Normal text line. De-hyphenate if last word ends with a hyphen
            if (currentParagraph.length > 0) {
                let lastIdx = currentParagraph.length - 1;
                let lastWord = currentParagraph[lastIdx];
                if (lastWord.endsWith('-')) {
                    const firstWord = line.split(/\s+/)[0];
                    currentParagraph[lastIdx] = lastWord.slice(0, -1) + firstWord;
                    const rest = line.split(/\s+/).slice(1).join(' ');
                    if (rest) {
                        currentParagraph.push(rest);
                    }
                } else {
                    currentParagraph.push(line);
                }
            } else {
                currentParagraph.push(line);
            }
        }
    }
    
    if (currentParagraph.length > 0) {
        formattedLines.push(currentParagraph.join(' '));
    }
    
    return formattedLines.join('\n\n').replace(/\n{3,}/g, '\n\n');
};

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

    const [customBooks, setCustomBooks] = useState<CustomTextbookItem[]>([]);
    const [loadingCustom, setLoadingCustom] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [uploadFiles, setUploadFiles] = useState<File[]>([]);
    const [fileTopics, setFileTopics] = useState<Record<string, string>>({});
    const [isDragOver, setIsDragOver] = useState(false);

    // Textbook Viewer States
    const [viewerOpen, setViewerOpen] = useState(false);
    const [viewerTitle, setViewerTitle] = useState('');
    const [layoutMode, setLayoutMode] = useState<'split' | 'pdf' | 'text'>('split');
    const [viewerPdfUrl, setViewerPdfUrl] = useState('');          // blob: URL or empty
    const [viewerPdfLoading, setViewerPdfLoading] = useState(false);
    const [viewerPdfError, setViewerPdfError] = useState('');
    const [viewerText, setViewerText] = useState('');
    const [loadingViewerText, setLoadingViewerText] = useState(false);
    const [selectedText, setSelectedText] = useState('');
    const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
    const [showContextMenu, setShowContextMenu] = useState(false);
    const [aiResponse, setAiResponse] = useState('');
    const [aiLoading, setAiLoading] = useState(false);
    const [aiActionName, setAiActionName] = useState('');

    /**
     * Fetch a PDF from the backend with auth, create a blob: URL.
     * Blob URLs bypass X-Frame-Options completely — the browser never applies
     * same-origin or frame restrictions to blob: URLs created in the same document.
     */
    const fetchPdfBlob = async (apiPath: string): Promise<string> => {
        const token = getAuthToken();
        const res = await fetch(apiPath, {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) throw new Error(`PDF fetch failed: ${res.status} ${res.statusText}`);
        const blob = await res.blob();
        return URL.createObjectURL(blob);
    };

    /** Revoke old blob URL and reset PDF viewer state */
    const resetPdfViewer = () => {
        if (viewerPdfUrl.startsWith('blob:')) URL.revokeObjectURL(viewerPdfUrl);
        setViewerPdfUrl('');
        setViewerPdfError('');
        setViewerPdfLoading(false);
    };

    const closeViewer = () => {
        resetPdfViewer();
        setViewerOpen(false);
        setViewerText('');
        setAiResponse('');
        setAiActionName('');
        setShowContextMenu(false);
    };

    const getBookCode = (url: string): string => {
        const match = url.match(/[?&]([a-z0-9]+)=/i);
        return match ? match[1] : '';
    };

    const getCorrectTextbook = (books: NcertBook[], chapterIdx: number): NcertBook | null => {
        if (!books.length) return null;
        let currentOffset = 0;
        for (const book of books) {
            const match = book.url.match(/[?&]([a-z0-9]+)=([0-9]+)-([0-9]+)/i);
            if (match) {
                const maxChapters = Number(match[3]);
                if (chapterIdx <= currentOffset + maxChapters) {
                    return book;
                }
                currentOffset += maxChapters;
            }
        }
        return books[books.length - 1];
    };

    const getFirstChapterIndexForBook = (books: NcertBook[], targetBook: NcertBook): number => {
        let currentOffset = 0;
        for (const b of books) {
            if (b.title === targetBook.title && b.url === targetBook.url) {
                return currentOffset + 1;
            }
            const match = b.url.match(/[?&]([a-z0-9]+)=([0-9]+)-([0-9]+)/i);
            if (match) {
                const maxChapters = Number(match[3]);
                currentOffset += maxChapters;
            }
        }
        return 1;
    };

    const openNcertViewer = async () => {
        if (!selectedBook || !selectedChapter) return;
        resetPdfViewer();
        setViewerOpen(true);
        setViewerTitle(`${selectedBook.title} - ${selectedChapter}`);
        setLayoutMode('split');  // Split view defaults so PDF is always shown alongside text
        setViewerText('');
        setAiResponse('');
        setAiActionName('');
        setShowContextMenu(false);

        // chapterIndex is 1-based; clamp to at least 1 in case of lookup miss
        const safeChapterNum = Math.max(1, chapterIndex);
        const bookCode = getBookCode(selectedBook.url);

        // Point iframe directly to proxy endpoint — enables native incremental streaming
        const apiPath = `${getBaseUrl()}/api/v1/upload/ncert-pdf-proxy?book_code=${bookCode}&chapter_num=${safeChapterNum}`;
        setViewerPdfUrl(apiPath);
        setViewerPdfLoading(true);

        // Load text in background — extracted from the actual NCERT PDF
        // Use a large limit so full chapter text is included
        setLoadingViewerText(true);
        try {
            const res = await getTextbookContent(selectedBook.url, 100000, safeChapterNum);
            setViewerText(formatRawTextbookText(res.content));
        } catch (err) {
            setViewerText('');
        } finally {
            setLoadingViewerText(false);
        }
    };


    const openCustomViewer = async (book: CustomTextbookItem) => {
        resetPdfViewer();
        setViewerOpen(true);
        setViewerTitle(book.filename);
        setLayoutMode('split');  // Split view defaults so PDF is always shown alongside text
        setViewerText('');
        setAiResponse('');
        setAiActionName('');
        setShowContextMenu(false);

        // Serve PDF using token query param directly in iframe for instant streaming
        const token = getAuthToken();
        const fallbackUrl = `${getBaseUrl()}/api/v1/upload/custom-textbook/${book.id}/pdf?token=${token}`;
        setViewerPdfUrl(fallbackUrl);
        setViewerPdfLoading(true);

        setLoadingViewerText(true);
        try {
            const res = await getCustomTextbookContent(book.id);
            setViewerText(formatRawTextbookText(res.content));
        } catch (err) {
            toast.error('Failed to load textbook text');
        } finally {
            setLoadingViewerText(false);
        }
    };

    const handleMouseUp = (e: React.MouseEvent) => {
        const selection = window.getSelection();
        if (!selection) return;
        const text = selection.toString().trim();
        if (text) {
            setSelectedText(text);
            setMenuPosition({ x: e.clientX, y: e.clientY });
            setShowContextMenu(true);
        } else {
            setShowContextMenu(false);
        }
    };

    const runAiAction = async (action: string, prompt: string) => {
        setAiActionName(action);
        setAiResponse('');
        setAiLoading(true);
        setShowContextMenu(false);
        
        try {
            let fullText = '';
            await askQuestionStream(
                {
                    class_num: classFilter,
                    subject: resources.subject,
                    chapter: selectedChapter || 'General',
                    question: `${prompt}\n\nExcerpt from textbook: "${selectedText}"`,
                },
                (token) => {
                    fullText += token;
                    setAiResponse(fullText);
                }
            );
        } catch (err) {
            toast.error('AI action failed');
        } finally {
            setAiLoading(false);
        }
    };

    const loadCustomBooks = async () => {
        setLoadingCustom(true);
        try {
            const baseClassNum = parseInt(classFilter.split('_')[0], 10) || 10;
            const res = await getCustomTextbooks({
                class_num: baseClassNum,
                subject: subjectFilter
            });
            setCustomBooks(res.textbooks || []);
        } catch (err) {
            console.error('Failed to load custom textbooks', err);
        } finally {
            setLoadingCustom(false);
        }
    };

    useEffect(() => {
        loadCustomBooks();
    }, [classFilter, subjectFilter]);

    useEffect(() => {
        const handleJump = (e: Event) => {
            const pageNum = (e as CustomEvent).detail.page;
            setViewerPdfUrl(prev => {
                const baseUrl = prev.split('#')[0];
                return `${baseUrl}#page=${pageNum}`;
            });
        };
        window.addEventListener('jump-to-pdf-page', handleJump);
        return () => window.removeEventListener('jump-to-pdf-page', handleJump);
    }, []);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const filesArray = Array.from(e.target.files);
            setUploadFiles(prev => [...prev, ...filesArray]);
            
            const newTopics = { ...fileTopics };
            filesArray.forEach(file => {
                const nameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
                const cleanName = nameWithoutExt
                    .replace(/[_-]/g, " ")
                    .replace(/\b\w/g, c => c.toUpperCase());
                newTopics[file.name] = cleanName;
            });
            setFileTopics(newTopics);
        }
    };

    const handleUploadAll = async () => {
        if (uploadFiles.length === 0) return;
        setUploading(true);
        const toastId = toast.loading(`Uploading ${uploadFiles.length} file(s)...`);
        
        try {
            for (const file of uploadFiles) {
                const topic = fileTopics[file.name] || selectedChapter || 'General';
                const formData = new FormData();
                formData.append('file', file);
                const baseClassNum = classFilter.split('_')[0];
                formData.append('class_num', baseClassNum);
                formData.append('subject', subjectFilter);
                formData.append('chapter', topic);
                
                await uploadCustomTextbook(formData);
            }
            toast.success('All files uploaded successfully!', { id: toastId });
            setUploadFiles([]);
            setFileTopics({});
            loadCustomBooks();
        } catch (err: any) {
            toast.error(err?.response?.data?.detail || 'Failed to upload custom files.', { id: toastId });
        } finally {
            setUploading(false);
        }
    };

    const handleDeleteCustom = async (id: number) => {
        try {
            await deleteCustomTextbook(id);
            toast.success('Custom textbook deleted');
            loadCustomBooks();
        } catch (err) {
            toast.error('Failed to delete custom textbook');
        }
    };

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

    useEffect(() => {
        if (resources.textbooks.length > 1 && chapterIndex > 0) {
            const correctBook = getCorrectTextbook(resources.textbooks, chapterIndex);
            if (correctBook && (!selectedBook || selectedBook.title !== correctBook.title)) {
                setSelectedBook(correctBook);
            }
        }
    }, [chapterIndex, resources.textbooks, selectedBook]);

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
    };    const isTamilNadu = user?.examBoard === 'Tamil Nadu State Board' || String(user?.class).includes('_TN_');

    if (isTamilNadu) {
        return (
            <div className="min-h-screen bg-[#f8fafc] transition-colors duration-300">
                <Navbar />
                <main className="max-w-3xl mx-auto px-6 py-20 text-center">
                    <Card className="p-12 bg-[#FCFAF8] border-none shadow-2xl rounded-[32px] space-y-6 transform hover:scale-[1.01] transition-all duration-300">
                        <div className="w-20 h-20 mx-auto bg-amber-50 rounded-full flex items-center justify-center text-amber-500 animate-pulse">
                            <Sparkles size={40} />
                        </div>
                        <h2 className="text-3xl font-black text-[#2C241B] ">Tamil Nadu Board Support Coming Soon!</h2>
                        <p className="text-stone-600 text-lg leading-relaxed max-w-xl mx-auto font-medium">
                            Tamil Nadu State Board support is coming in a very, very soon update! Currently, CBSE / NCERT is fully supported.
                        </p>
                        <div className="p-6 bg-[#FCFAF8] rounded-2xl border-3 border-[#2C241B] shadow-neo text-left space-y-3">
                            <h4 className="font-bold text-[#3E352B] ">How to get started right now:</h4>
                            <ol className="list-decimal list-inside space-y-2 text-sm text-stone-600 font-medium">
                                <li>Go to your <span className="text-[#8C5A35] cursor-pointer hover:underline font-bold" onClick={() => navigate('/profile')}>Profile Settings</span></li>
                                <li>Select a CBSE class and click <span className="text-[#3E352B] font-bold">Save</span></li>
                                <li>Start practicing and exploring Clarity's premium features!</li>
                            </ol>
                        </div>
                        <Button 
                            variant="primary" 
                            size="lg" 
                            className="px-8 py-4 rounded-2xl font-black  /25"
                            onClick={() => navigate('/profile')}
                        >
                            Go to Profile Settings
                        </Button>
                    </Card>
                </main>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#f8fafc] transition-colors duration-300">
            <Navbar />
            <main className="max-w-7xl mx-auto px-6 py-10">
                <div className="mb-8">
                    <h1 className="text-4xl font-black text-[#2C241B] ">Textbook Mission Hub</h1>
                    <p className="text-stone-500 mt-2 font-medium">
                        Reliable NCERT chapter access with autonomous study missions.
                    </p>
                </div>

                <div className="flex gap-2 bg-[#FCFAF8] p-2 rounded-2xl border-3 border-[#2C241B] shadow-neo mb-8">
                    {['8', '9', '10', '11', '12'].map((cls) => {
                        const isEnrolled = user?.class ? String(user.class).startsWith(cls) : cls === '10';
                        const targetClass = (user?.class && String(user.class).startsWith(cls)) ? user.class : cls;
                        return (
                            <button
                                key={cls}
                                disabled={!isEnrolled}
                                onClick={() => {
                                    if (!isEnrolled) return;
                                    setClassFilter(targetClass);
                                    const next = getStudyResources(targetClass, '');
                                    setSubjectFilter(next.subject);
                                    setCoachPlan('');
                                }}
                                className={`px-5 py-2.5 rounded-xl text-sm font-black transition-all ${
                                    classFilter.startsWith(cls)
                                        ? 'bg-[#8C5A35] text-white  /20'
                                        : isEnrolled
                                        ? 'text-stone-600 hover:bg-[#F2EFE9] :bg-stone-700'
                                        : 'text-stone-300 cursor-not-allowed opacity-50'
                                }`}
                            >
                                Class {cls}
                                {user?.class && String(user.class).startsWith(cls) && String(user.class).includes('_TN_EN') && ' (TN Eng)'}
                                {user?.class && String(user.class).startsWith(cls) && String(user.class).includes('_TN_TM') && ' (TN Tamil)'}
                            </button>
                        );
                    })}
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
                                ? 'bg-[#8C5A35] text-white'
                                : 'bg-[#FCFAF8] text-stone-600 border-3 border-[#2C241B] shadow-neo '
                                }`}
                        >
                            {subject}
                        </button>
                    ))}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                    {/* Books Sidebar */}
                    <Card className="p-5 bg-[#FCFAF8] border-none shadow-xl rounded-3xl lg:col-span-1">
                        <h3 className="text-sm font-black uppercase tracking-wider text-stone-500 mb-4">Textbooks</h3>
                        <div className="space-y-2 max-h-[62vh] overflow-y-auto pr-1">
                            {resources.textbooks.map((book) => (
                                <button
                                    key={`${book.class}-${book.subject}-${book.title}`}
                                    onClick={() => {
                                        setSelectedBook(book);
                                        setCoachPlan('');
                                        const firstChapterIdx = getFirstChapterIndexForBook(resources.textbooks, book);
                                        const chapterName = resources.chapters[firstChapterIdx - 1];
                                        if (chapterName) {
                                            setSelectedChapter(chapterName);
                                        }
                                    }}
                                    className={`w-full text-left p-3 rounded-2xl border transition-all ${selectedBook?.title === book.title && selectedBook?.subject === book.subject
                                        ? 'border-[#8C5A35] bg-amber-50 '
                                        : 'border-stone-100 hover:border-[#8C5A35]/40'
                                        }`}
                                >
                                    <p className="font-bold text-[#2C241B] text-sm">{book.title}</p>
                                    <p className="text-xs text-stone-500">{book.subject}</p>
                                </button>
                            ))}
                        </div>
                    </Card>

                    {/* Main Content */}
                    <div className="lg:col-span-3 space-y-6">
                        {/* Chapter Selection */}
                        <Card className="p-6 bg-[#FCFAF8] border-none shadow-xl rounded-3xl">
                            <div className="mb-4">
                                <h2 className="text-xl font-black text-[#2C241B] flex items-center gap-2 mb-1">
                                    <BookOpen size={20} className="text-[#8C5A35]" />
                                    {selectedBook?.title || 'Select a textbook'}
                                </h2>
                                <p className="text-sm text-stone-500">
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
                                            ? 'bg-[#8C5A35] text-white'
                                            : 'bg-[#F2EFE9] text-stone-600 hover:bg-[#E8E4DB] :bg-stone-700'
                                            }`}
                                    >
                                        {chapter}
                                    </button>
                                ))}
                            </div>

                            {/* Action Buttons */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                <Button
                                    className="h-12 rounded-2xl bg-[#8C5A35] hover:bg-[#70482B] border-3 border-[#2C241B] shadow-neo hover:translate-y-[2px] hover:translate-x-[2px] hover:shadow-neo-sm active:translate-x-[4px] active:translate-y-[4px] active:shadow-none transition-all font-bold"
                                    onClick={openNcertViewer}
                                    disabled={!selectedChapter}
                                >
                                    <BookOpen size={16} className="mr-2" aria-hidden="true" />
                                    Open Textbook Viewer
                                </Button>
                                <Button
                                    className="h-12 rounded-2xl bg-[#8C5A35] hover:bg-[#70482B] border-3 border-[#2C241B] shadow-neo hover:translate-y-[2px] hover:translate-x-[2px] hover:shadow-neo-sm active:translate-x-[4px] active:translate-y-[4px] active:shadow-none transition-all font-bold"
                                    onClick={goAsk}
                                >
                                    <Brain size={16} className="mr-2" aria-hidden="true" />
                                    Ask AI This Chapter
                                </Button>
                                <Button
                                    className="h-12 rounded-2xl bg-[#8C5A35] hover:bg-[#70482B] border-3 border-[#2C241B] shadow-neo hover:translate-y-[2px] hover:translate-x-[2px] hover:shadow-neo-sm active:translate-x-[4px] active:translate-y-[4px] active:shadow-none transition-all font-bold"
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
                        <Card className="p-6 bg-[#FCFAF8] border-none shadow-xl rounded-3xl">
                            <div className="flex items-center justify-between gap-3 mb-4">
                                <h3 className="text-lg font-black text-[#2C241B] flex items-center gap-2">
                                    <Sparkles size={18} className="text-[#8C5A35]" />
                                    Autonomous Coach
                                </h3>
                                <Button
                                    className="h-10 px-4 rounded-xl bg-[#8C5A35] hover:bg-[#70482B] border-3 border-[#2C241B] shadow-neo hover:translate-y-[2px] hover:translate-x-[2px] hover:shadow-neo-sm active:translate-x-[4px] active:translate-y-[4px] active:shadow-none transition-all font-bold text-sm"
                                    onClick={generateAutoCoach}
                                    disabled={coachLoading || !selectedChapter}
                                >
                                    {coachLoading ? 'Generating...' : 'Generate Mission'}
                                </Button>
                            </div>

                            {coachCached && (
                                <div className="mb-3 p-2 px-3 bg-amber-50 border-3 border-[#2C241B] shadow-neo rounded-lg text-xs font-bold text-amber-700 flex items-center gap-2">
                                    <Sparkles size={12} />
                                    Loaded from cache (30 min TTL)
                                </div>
                            )}

                            {!coachPlan && !coachLoading && (
                                <p className="text-sm text-stone-500">Select a chapter and generate a focused 30-minute study mission with key points, mistakes to avoid, and a self test.</p>
                            )}

                            {coachLoading && (
                                <div className="flex items-center gap-2 text-sm text-stone-500">
                                    <div className="animate-spin h-4 w-4 border-2 border-[#8C5A35] border-t-transparent rounded-full"></div>
                                    Building your study mission—please wait...
                                </div>
                            )}

                            {coachPlan && (
                                <article className="whitespace-pre-wrap text-sm leading-6 text-stone-700 max-h-[400px] overflow-y-auto pr-2">
                                    {coachPlan}
                                </article>
                            )}
                        </Card>

                        {/* Custom Textbooks Manager */}
                        <Card className="p-6 bg-[#FCFAF8] border-none shadow-xl rounded-3xl">
                            <h3 className="text-lg font-black text-[#2C241B] flex items-center gap-2 mb-4">
                                <Upload size={18} className="text-[#8C5A35]" />
                                Student Custom Textbooks
                            </h3>
                            <p className="text-sm text-stone-500 mb-6">
                                Upload your own textbook PDFs for <strong>Class {classFilter} {resources.subject}</strong>. These custom books will override default chapter search resources when you practice or ask AI questions.
                            </p>

                            {/* Drag and Drop Zone */}
                            <div
                                onDragOver={(e) => {
                                    e.preventDefault();
                                    setIsDragOver(true);
                                }}
                                onDragLeave={() => setIsDragOver(false)}
                                onDrop={(e) => {
                                    e.preventDefault();
                                    setIsDragOver(false);
                                    if (e.dataTransfer.files) {
                                        const filesArray = Array.from(e.dataTransfer.files).filter(f => f.type === 'application/pdf');
                                        if (filesArray.length > 0) {
                                            setUploadFiles(prev => [...prev, ...filesArray]);
                                            const newTopics = { ...fileTopics };
                                            filesArray.forEach(file => {
                                                const nameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
                                                const cleanName = nameWithoutExt
                                                    .replace(/[_-]/g, " ")
                                                    .replace(/\b\w/g, c => c.toUpperCase());
                                                newTopics[file.name] = cleanName;
                                            });
                                            setFileTopics(newTopics);
                                        } else {
                                            toast.error('Only PDF files are supported.');
                                        }
                                    }
                                }}
                                className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all ${
                                    isDragOver
                                        ? 'border-[#8C5A35] bg-amber-50/50 '
                                        : 'border-stone-200 hover:border-[#8C5A35]/50'
                                }`}
                            >
                                <Upload size={32} className="mx-auto text-stone-400 mb-2" />
                                <p className="text-sm font-bold text-stone-700 ">
                                    Drag & Drop custom textbook PDFs here, or{' '}
                                    <label className="text-[#8C5A35] hover:underline cursor-pointer">
                                        browse files
                                        <input
                                            type="file"
                                            multiple
                                            accept=".pdf"
                                            onChange={handleFileChange}
                                            className="hidden"
                                        />
                                    </label>
                                </p>
                                <p className="text-xs text-stone-400 mt-1">Supports multiple PDF uploads (up to 10-11 at once)</p>
                            </div>

                            {/* Files to Upload List */}
                            {uploadFiles.length > 0 && (
                                <div className="mt-6 space-y-4 p-4 bg-[#FCFAF8] border-3 border-[#2C241B] shadow-neo rounded-2xl">
                                    <p className="text-xs font-black uppercase tracking-wider text-stone-400 mb-2">Files Selected for Upload</p>
                                    {uploadFiles.map((file, idx) => (
                                        <div key={file.name} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-[#FCFAF8] rounded-xl border-3 border-[#2C241B] shadow-neo ">
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-bold text-[#2C241B] truncate">{file.name}</p>
                                                <p className="text-[10px] text-stone-500">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
                                            </div>
                                            <div className="flex-1 min-w-[200px]">
                                                <label className="block text-[10px] font-black text-stone-400 uppercase mb-1">Assign Topic/Chapter Name:</label>
                                                <input
                                                    type="text"
                                                    value={fileTopics[file.name] || ''}
                                                    onChange={(e) => setFileTopics(prev => ({ ...prev, [file.name]: e.target.value }))}
                                                    placeholder="e.g. Life Processes"
                                                    className="w-full px-3 py-1.5 bg-[#FCFAF8] border-3 border-[#2C241B] shadow-neo rounded-lg text-xs font-bold focus:ring-1 focus:ring-[#8C5A35] outline-none text-[#2C241B] "
                                                />
                                            </div>
                                            <Button
                                                variant="outline"
                                                className="h-8 w-8 p-0 rounded-lg border-red-200 hover:bg-red-50 text-red-500 :bg-red-950/20"
                                                onClick={() => setUploadFiles(prev => prev.filter((_, i) => i !== idx))}
                                            >
                                                <Trash2 size={14} />
                                            </Button>
                                        </div>
                                    ))}
                                    <div className="flex justify-end gap-2 pt-2">
                                        <Button
                                            variant="outline"
                                            className="rounded-xl text-xs h-9"
                                            onClick={() => setUploadFiles([])}
                                        >
                                            Cancel
                                        </Button>
                                        <Button
                                            className="bg-[#8C5A35] hover:bg-[#70482B] border-3 border-[#2C241B] shadow-neo hover:translate-y-[2px] hover:translate-x-[2px] hover:shadow-neo-sm active:translate-x-[4px] active:translate-y-[4px] active:shadow-none transition-all text-white rounded-xl text-xs font-bold h-9"
                                            onClick={handleUploadAll}
                                            disabled={uploading}
                                        >
                                            {uploading ? 'Uploading...' : `Upload ${uploadFiles.length} Books`}
                                        </Button>
                                    </div>
                                </div>
                            )}

                            {/* Already Uploaded Textbooks */}
                            <div className="mt-8 space-y-3">
                                <h4 className="text-xs font-black uppercase tracking-wider text-stone-400">Uploaded Custom Books</h4>
                                {loadingCustom ? (
                                    <p className="text-sm text-stone-500">Loading custom textbooks...</p>
                                ) : customBooks.length === 0 ? (
                                    <p className="text-sm text-stone-500 italic">No custom textbooks uploaded yet for Class {classFilter} {resources.subject}.</p>
                                ) : (
                                    <div className="space-y-3">
                                        {customBooks.map((book) => (
                                            <div
                                                key={book.id}
                                                className="flex items-center justify-between p-4 bg-[#FCFAF8] border-3 border-[#2C241B] shadow-neo rounded-2xl hover:border-amber-200 :border-amber-900/40 transition-colors"
                                            >
                                                <div className="min-w-0 pr-2">
                                                    <p className="font-bold text-sm text-[#2C241B] truncate">{book.filename}</p>
                                                    <p className="text-xs text-amber-600 font-semibold">Topic: {book.chapter}</p>
                                                    <p className="text-[10px] text-stone-400">Uploaded {new Date(book.created_at + 'Z').toLocaleDateString()}</p>
                                                </div>
                                                <div className="flex gap-2 items-center flex-shrink-0">
                                                    <Button
                                                        variant="outline"
                                                        className="h-9 px-3 rounded-xl border-amber-100 text-amber-600 hover:bg-amber-50 :bg-amber-950/20 text-xs font-bold"
                                                        onClick={() => openCustomViewer(book)}
                                                    >
                                                        Read
                                                    </Button>
                                                    <Button
                                                        variant="outline"
                                                        className="h-9 w-9 p-0 rounded-xl border-red-100 text-red-500 hover:bg-red-50 :bg-red-950/20 flex-shrink-0"
                                                        onClick={() => handleDeleteCustom(book.id)}
                                                    >
                                                        <Trash2 size={15} />
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </Card>

                        {/* Quick Launch Footer */}
                        <Card className="p-6 bg-gradient-to-r from-stone-900 to-stone-800 text-white border-none shadow-xl rounded-3xl">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div>
                                    <h3 className="text-lg font-black flex items-center gap-2 mb-1">
                                        <Rocket size={18} />
                                        Quick Launch
                                    </h3>
                                    <p className="text-sm text-stone-300">Jump straight into any mode with chapter context.</p>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    <Button className="rounded-xl bg-[#8C5A35] hover:bg-[#70482B] border-3 border-[#2C241B] shadow-neo hover:translate-y-[2px] hover:translate-x-[2px] hover:shadow-neo-sm active:translate-x-[4px] active:translate-y-[4px] active:shadow-none transition-all font-bold" onClick={goAsk}>
                                        Ask AI
                                    </Button>
                                    <Button className="rounded-xl bg-[#8C5A35] hover:bg-[#70482B] border-3 border-[#2C241B] shadow-neo hover:translate-y-[2px] hover:translate-x-[2px] hover:shadow-neo-sm active:translate-x-[4px] active:translate-y-[4px] active:shadow-none transition-all font-bold" onClick={goPractice}>
                                        Practice
                                    </Button>
                                    <Button className="rounded-xl bg-[#8C5A35] hover:bg-[#70482B] border-3 border-[#2C241B] shadow-neo hover:translate-y-[2px] hover:translate-x-[2px] hover:shadow-neo-sm active:translate-x-[4px] active:translate-y-[4px] active:shadow-none transition-all font-bold" onClick={goLibrary}>
                                        <Library size={16} className="mr-2" />
                                        Library
                                    </Button>
                                </div>
                            </div>
                        </Card>
                    </div>
                </div>
            </main>

            {/* Textbook Viewer Modal */}
            {viewerOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-0 transition-all animate-fadeIn">
                    <div className="bg-[#FCFAF8] w-full h-full flex flex-col overflow-hidden shadow-2xl relative">
                        {/* Header */}
                        <div className="p-6 border-b border-stone-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#FCFAF8]/50 ">
                            <div>
                                <h3 className="text-lg font-black text-[#2C241B] truncate max-w-lg">
                                    {viewerTitle}
                                </h3>
                                <p className="text-xs text-stone-500 font-medium">
                                    Class {classFilter} • {resources.subject}
                                </p>
                            </div>
                            
                            <div className="flex items-center gap-3">
                                {/* Page Sync Navigator */}
                                <div className="flex items-center gap-2 bg-[#F2EFE9] px-3 py-1.5 rounded-xl">
                                    <span className="text-[10px] font-black text-stone-500 uppercase tracking-wider">Sync Page:</span>
                                    <input
                                        type="number"
                                        min="1"
                                        placeholder="Page #"
                                        className="w-12 bg-[#FCFAF8] border-3 border-[#2C241B] shadow-neo outline-none rounded-lg text-xs font-bold text-center py-0.5 text-[#3E352B] "
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                const pageNum = e.currentTarget.value;
                                                if (pageNum) {
                                                    setViewerPdfUrl(prev => {
                                                        const baseUrl = prev.split('#')[0];
                                                        return `${baseUrl}#page=${pageNum}`;
                                                    });
                                                    const el = document.getElementById(`page-anchor-${pageNum}`);
                                                    if (el) {
                                                        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                                    }
                                                }
                                            }
                                        }}
                                    />
                                </div>

                                {/* Layout Mode Toggles */}
                                <div className="flex bg-[#F2EFE9] p-1 rounded-xl">
                                    <button
                                        onClick={() => setLayoutMode('split')}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                                            layoutMode === 'split'
                                                ? 'bg-[#8C5A35] text-white '
                                                : 'text-stone-600 hover:bg-[#E8E4DB] :bg-stone-700'
                                        }`}
                                    >
                                        Split View
                                    </button>
                                    <button
                                        onClick={() => setLayoutMode('pdf')}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                                            layoutMode === 'pdf'
                                                ? 'bg-[#8C5A35] text-white '
                                                : 'text-stone-600 hover:bg-[#E8E4DB] :bg-stone-700'
                                        }`}
                                    >
                                        Original PDF
                                    </button>
                                    <button
                                        onClick={() => setLayoutMode('text')}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                                            layoutMode === 'text'
                                                ? 'bg-[#8C5A35] text-white '
                                                : 'text-stone-600 hover:bg-[#E8E4DB] :bg-stone-700'
                                        }`}
                                    >
                                        Interactive Text
                                    </button>
                                </div>
                                
                                <button
                                    onClick={closeViewer}
                                    className="p-2 hover:bg-[#F2EFE9] :bg-stone-800 rounded-xl text-stone-500 hover:text-[#3E352B] :text-white transition-all font-bold"
                                >
                                    ✕
                                </button>
                            </div>
                        </div>

                        {/* Body */}
                        <div className="flex-1 overflow-hidden flex flex-col md:flex-row bg-[#FCFAF8] ">
                            {/* Left Panel: PDF Viewer (shown if layoutMode !== 'text') */}
                            <div className={`flex flex-col relative border-r border-stone-200 transition-all duration-300 ${
                                layoutMode === 'split' ? 'w-full h-1/2 md:h-full md:w-1/2' : layoutMode === 'pdf' ? 'w-full h-full' : 'hidden'
                            }`}>
                                {viewerPdfError ? (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-stone-500 px-8 bg-[#FCFAF8] z-20">
                                        <FileText size={40} className="opacity-30" />
                                        <p className="font-bold text-sm">PDF could not be loaded</p>
                                        <p className="text-xs text-center text-stone-400">{viewerPdfError}</p>
                                    </div>
                                ) : viewerPdfUrl ? (
                                    <>
                                        {viewerPdfLoading && (
                                            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-stone-500 bg-[#FCFAF8] z-20">
                                                <div className="animate-spin h-10 w-10 border-4 border-[#8C5A35] border-t-transparent rounded-full" />
                                                <p className="font-bold text-sm">Loading PDF...</p>
                                                <p className="text-xs text-stone-400">Fetching securely from the server</p>
                                            </div>
                                        )}
                                        <iframe
                                            src={viewerPdfUrl}
                                            className="w-full h-full border-none z-10 relative"
                                            title="Textbook PDF Viewer"
                                            onLoad={() => setViewerPdfLoading(false)}
                                        />
                                    </>
                                ) : (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-stone-400 bg-[#FCFAF8] ">
                                        <FileText size={40} className="opacity-30" />
                                        <p className="text-sm font-bold">No PDF available</p>
                                    </div>
                                )}
                            </div>

                            {/* Right Panel: Interactive Text & AI Coach (shown if layoutMode !== 'pdf') */}
                            <div className={`flex flex-col md:flex-row overflow-hidden transition-all duration-300 ${
                                layoutMode === 'split' ? 'w-full h-1/2 md:h-full md:w-1/2' : layoutMode === 'text' ? 'w-full h-full' : 'hidden'
                            }`}>
                                {/* Left Text Column */}
                                <div 
                                    onMouseUp={handleMouseUp}
                                    className="flex-1 overflow-y-auto p-6 md:p-8 select-text bg-[#FCFAF8] border-r border-stone-100 "
                                >
                                    {/* Diagram-awareness banner */}
                                    {!loadingViewerText && viewerText && viewerText.includes('[Diagram / Figure') && (
                                        <div className="mb-5 p-3 bg-indigo-50 border border-indigo-100 rounded-2xl flex items-start gap-2.5">
                                            <span className="text-indigo-600 text-base mt-0.5">🔬</span>
                                            <div>
                                                <p className="text-xs font-black text-indigo-700 uppercase tracking-wider">AI Diagram Descriptions Included</p>
                                                <p className="text-[11px] text-indigo-600 mt-0.5">Diagrams, figures, chemical structures &amp; math formulas from image-heavy pages were described by AI vision and are shown inline below. Switch to <strong>Original PDF</strong> mode or view the left panel to see the actual graphics.</p>
                                            </div>
                                        </div>
                                    )}
                                    {loadingViewerText ? (
                                        <div className="flex flex-col items-center justify-center h-full gap-3 text-stone-500">
                                            <div className="animate-spin h-8 w-8 border-4 border-[#8C5A35] border-t-transparent rounded-full"></div>
                                            <p className="font-bold text-sm">Extracting text from NCERT PDF...</p>
                                            <p className="text-xs text-stone-400">The Original PDF is already loaded and ready to read</p>
                                        </div>
                                    ) : !viewerText ? (
                                        <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-6">
                                            <FileText size={44} className="text-stone-300 " />
                                            <div>
                                                <p className="font-black text-sm text-stone-700 mb-1">Text extraction not available</p>
                                                <p className="text-xs text-stone-500 leading-relaxed max-w-xs">
                                                    This chapter's text could not be extracted from the PDF (may be image-based or not yet cached).
                                                    Please refer to the <strong>Original PDF</strong> panel on the left.
                                                </p>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="prose max-w-none">
                                            <MarkdownContent content={viewerText} />
                                        </div>
                                    )}
                                </div>

                                {/* Right AI Panel */}
                                <div className="w-full md:w-80 h-full bg-[#FCFAF8]/50 p-5 flex flex-col overflow-y-auto">
                                    <div className="flex items-center gap-2 mb-4">
                                        <Sparkles size={16} className="text-[#8C5A35]" />
                                        <h4 className="font-black text-sm text-[#2C241B] uppercase tracking-wider">AI Study Coach</h4>
                                    </div>

                                    {aiActionName ? (
                                        <div className="space-y-3 flex-1 flex flex-col">
                                            <div className="p-3 bg-amber-50 border-3 border-[#2C241B] shadow-neo rounded-2xl">
                                                <p className="text-[10px] font-black uppercase text-[#8C5A35] mb-1">Selected Excerpt:</p>
                                                <p className="text-xs text-stone-600 italic line-clamp-3">"{selectedText}"</p>
                                            </div>
                                            
                                            <div className="p-4 bg-[#FCFAF8] border-3 border-[#2C241B] shadow-neo rounded-2xl  flex-1 overflow-y-auto min-h-[200px] space-y-4">
                                                <div className="p-3 bg-amber-50 border-3 border-[#2C241B] shadow-neo/30 rounded-xl text-[10px] text-amber-700 flex items-start gap-2">
                                                    <span className="text-amber-500">💡</span>
                                                    <span><strong>Tip:</strong> Highlight any text inside this explanation and right-click (or left-click) to ask the AI coach further questions!</span>
                                                </div>
                                                <div>
                                                    <p className="text-xs font-black uppercase tracking-wider text-stone-400 mb-2">{aiActionName}</p>
                                                    {aiLoading && !aiResponse ? (
                                                        <div className="flex items-center gap-2 text-xs text-stone-500">
                                                            <div className="animate-spin h-3.5 w-3.5 border-2 border-[#8C5A35] border-t-transparent rounded-full"></div>
                                                            Thinking...
                                                        </div>
                                                    ) : (
                                                        <MarkdownContent className="text-xs leading-relaxed" content={aiResponse} />
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
                                            <Brain size={36} className="text-stone-350 mb-3" />
                                            <p className="text-xs font-bold text-stone-700 mb-1">Interactive Reader</p>
                                            <p className="text-[11px] text-stone-500 leading-relaxed">
                                                Highlight any sentence or paragraph in the textbook to trigger AI explanations, summaries, or memory tricks.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Floating Context Tooltip */}
                    {showContextMenu && (
                        <div
                            onMouseDown={(e) => e.preventDefault()}
                            className="fixed bg-[#FCFAF8] border-3 border-[#2C241B] shadow-neo rounded-2xl shadow-2xl z-[60] p-1.5 flex flex-col w-48 text-xs font-semibold animate-scaleIn"
                            style={{
                                top: `${menuPosition.y + 10}px`,
                                left: `${menuPosition.x}px`,
                                transform: 'translateX(-50%)',
                            }}
                        >
                            <button
                                onClick={() => runAiAction('Meaning & Context', 'Explain the meaning, key terms, and context of this textbook excerpt clearly.')}
                                className="w-full text-left px-3 py-2 hover:bg-[#F2EFE9] :bg-stone-700 rounded-xl flex items-center gap-2 text-stone-700 "
                            >
                                <Sparkles size={12} className="text-[#8C5A35]" />
                                Ask Meaning
                            </button>
                            <button
                                onClick={() => runAiAction('Summary', 'Provide a concise summary of this textbook excerpt.')}
                                className="w-full text-left px-3 py-2 hover:bg-[#F2EFE9] :bg-stone-700 rounded-xl flex items-center gap-2 text-stone-700 "
                            >
                                <Sparkles size={12} className="text-[#8C5A35]" />
                                Summarize
                            </button>
                            <button
                                onClick={() => runAiAction('Key Points', 'Extract the key values, points, and takeaways from this textbook excerpt as a bulleted list.')}
                                className="w-full text-left px-3 py-2 hover:bg-[#F2EFE9] :bg-stone-700 rounded-xl flex items-center gap-2 text-stone-700 "
                            >
                                <Sparkles size={12} className="text-[#8C5A35]" />
                                Convert to Points
                            </button>
                            <button
                                onClick={() => runAiAction('Memory Tricks', 'Provide fun mnemonics, associations, or tricks to easily memorize this textbook excerpt.')}
                                className="w-full text-left px-3 py-2 hover:bg-[#F2EFE9] :bg-stone-700 rounded-xl flex items-center gap-2 text-stone-700 "
                            >
                                <Sparkles size={12} className="text-[#8C5A35]" />
                                Tricks to Memorize
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
