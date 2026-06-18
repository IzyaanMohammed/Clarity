import { useMemo, useState } from 'react';
import { FileText, Calculator, Sparkles, Info, SlidersHorizontal } from 'lucide-react';
import toast from 'react-hot-toast';
import { Navbar } from '../components/layout/Navbar';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { MarkdownContent } from '../components/ui/MarkdownContent';
import { getUser, saveStudyMaterialIfNew, type StudyMaterialItem } from '../utils/storage';
import { extractMarkdownSection, formatQuickRecallBlock, parseMarkdownTable } from '../utils/markdown';
import { generateChapterSummaryStream, generateFormulaSheetStream, saveMaterialToDatabase } from '../api';
import { useCurriculumCatalog } from '../hooks/useCurriculumCatalog';

export const Summary = () => {
    const user = getUser();
    const classKey = (user?.class || '10').toString();
    const subjects = user?.subjects?.length ? user.subjects : ['Science'];
    const { subjectsForClass, chaptersForSubject } = useCurriculumCatalog(classKey);

    const [selectedSubject, setSelectedSubject] = useState(subjects[0] || subjectsForClass[0] || 'Science');
    const chapters = useMemo(
        () => chaptersForSubject(selectedSubject),
        [chaptersForSubject, selectedSubject]
    );
    const [selectedChapter, setSelectedChapter] = useState(chapters[0] || '');
    const [mode, setMode] = useState<'summary' | 'formula'>('summary');
    const [summaryDetail, setSummaryDetail] = useState<'short' | 'standard' | 'deep'>('standard');
    const [summaryPoints, setSummaryPoints] = useState(6);
    const [formulaCount, setFormulaCount] = useState(12);
    const [includeExamples, setIncludeExamples] = useState(true);
    const [isLoading, setIsLoading] = useState(false);
    const [content, setContent] = useState('');

    const renderTableSection = (section: string, nextSections: string[]) => {
        const block = extractMarkdownSection(content, section, nextSections);
        const table = parseMarkdownTable(block);
        if (!table) return null;

        return (
            <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-[#FCFAF8] ">
                <table className="min-w-full text-left text-sm">
                    <thead className="bg-[#F2EFE9] ">
                        <tr>
                            {table.headers.map((header) => (
                                <th key={header} className="px-4 py-3 font-black text-stone-700 whitespace-nowrap">
                                    {header}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {table.rows.map((row, rowIndex) => (
                            <tr key={rowIndex} className="border-t border-stone-100 ">
                                {row.map((cell, cellIndex) => (
                                    <td key={`${rowIndex}-${cellIndex}`} className="px-4 py-3 text-stone-700 align-top">
                                        {cell}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        );
    };

    const copyMarkdown = async () => {
        if (!content.trim()) return;
        await navigator.clipboard.writeText(content);
        toast.success('Summary copied.');
    };

    const downloadMarkdown = () => {
        if (!content.trim()) return;
        const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `summary_${classKey}_${selectedSubject}_${selectedChapter.replace(/\s+/g, '_')}.md`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
    };

    const handleGenerate = async () => {
        if (!selectedSubject || !selectedSubject.trim()) {
            toast.error('Please select a subject.');
            return;
        }
        if (!selectedChapter || !selectedChapter.trim()) {
            toast.error('Please select a chapter.');
            return;
        }

        setIsLoading(true);
        try {
            let generatedContent = '';
            const payload = {
                class_num: classKey,
                subject: selectedSubject,
                chapter: selectedChapter,
                learner_profile: {
                    learning_style: user?.learningStyle || '',
                    goal: user?.goal || '',
                    study_hours: user?.studyHours || '',
                    focus_areas: user?.focusAreas || '',
                    focus_chapters: JSON.stringify(user?.focusChapters || {}),
                    exam_board: user?.examBoard || 'CBSE',
                    preferred_language: user?.preferredLanguage || 'English',
                    preferred_pace: user?.preferredPace || 'Balanced',
                    confidence_level: user?.confidenceLevel || 'Average confidence',
                    revision_frequency: user?.revisionFrequency || 'Alternate days',
                },
            };

            setContent('');
            if (mode === 'summary') {
                await generateChapterSummaryStream(
                    {
                        ...payload,
                        detail_level: summaryDetail,
                        max_points: summaryPoints,
                    },
                    (token) => {
                        generatedContent += token;
                        setContent(generatedContent);
                    }
                );
            } else {
                await generateFormulaSheetStream(
                    {
                        ...payload,
                        formula_count: formulaCount,
                        include_examples: includeExamples,
                    },
                    (token) => {
                        generatedContent += token;
                        setContent(generatedContent);
                    }
                );
            }

            if (generatedContent.trim()) {
                const material: StudyMaterialItem = {
                    id: `${mode}_${Date.now()}`,
                    type: mode === 'summary' ? 'summary' : 'formula',
                    title: `${mode === 'summary' ? 'Summary' : 'Formula Sheet'}: ${selectedChapter}`,
                    subject: selectedSubject,
                    chapter: selectedChapter,
                    content: generatedContent,
                    createdAt: Date.now(),
                };
                saveStudyMaterialIfNew(material);
                try {
                    await saveMaterialToDatabase(material);
                } catch {
                    // Keep local save if backend sync is unavailable.
                }
            }
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : 'Generation failed. Please retry.';
            toast.error(msg);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#f8fafc] transition-colors duration-300">
            <Navbar />
            <main className="max-w-7xl mx-auto px-6 py-10">
                <div className="mb-8">
                    <h1 className="text-3xl md:text-4xl font-black text-[#2C241B] ">
                        Smart Notes Studio
                    </h1>
                    <p className="text-stone-500 mt-2 font-medium">
                        Generate streaming summaries and formula sheets with custom depth controls.
                    </p>
                </div>

                <Card className="p-5 mb-8 bg-gradient-to-r from-indigo-50 to-cyan-50 border border-indigo-100 rounded-3xl">
                    <div className="flex items-start gap-3">
                        <Info className="text-indigo-600 mt-0.5" size={18} />
                        <div className="text-sm text-stone-700 ">
                            <p className="font-bold">How to use:</p>
                            <p className="mt-1">Choose a subject and chapter first. Use Chapter Summary for quick revision before class tests and Formula Sheet for last-minute exam recall.</p>
                        </div>
                    </div>
                </Card>

                <Card className="p-6 md:p-8 bg-[#FCFAF8] border-none shadow-xl rounded-3xl mb-8">
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                        <div>
                            <label className="block text-xs font-black uppercase tracking-wider text-stone-500 mb-2">Subject</label>
                            <select
                                value={selectedSubject}
                                onChange={(e) => {
                                    const nextSubject = e.target.value;
                                    setSelectedSubject(nextSubject);
                                    const nextChapters = chaptersForSubject(nextSubject);
                                    setSelectedChapter(nextChapters[0] || '');
                                }}
                                className="w-full px-4 py-3 rounded-xl bg-[#FCFAF8] text-[#2C241B] font-semibold border border-stone-200 "
                            >
                                {(subjects.length ? subjects : subjectsForClass).map((subject) => (
                                    <option key={subject} value={subject}>
                                        {subject}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="md:col-span-2">
                            <label className="block text-xs font-black uppercase tracking-wider text-stone-500 mb-2">Chapter</label>
                            <select
                                value={selectedChapter}
                                onChange={(e) => setSelectedChapter(e.target.value)}
                                className="w-full px-4 py-3 rounded-xl bg-[#FCFAF8] text-[#2C241B] font-semibold border border-stone-200 "
                            >
                                {chapters.map((chapter) => (
                                    <option key={chapter} value={chapter}>
                                        {chapter}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {mode === 'summary' ? (
                            <div>
                                <label className="block text-xs font-black uppercase tracking-wider text-stone-500 mb-2">Detail</label>
                                <select
                                    value={summaryDetail}
                                    onChange={(e) => setSummaryDetail(e.target.value as 'short' | 'standard' | 'deep')}
                                    className="w-full px-4 py-3 rounded-xl bg-[#FCFAF8] text-[#2C241B] font-semibold border border-stone-200 "
                                >
                                    <option value="short">Short</option>
                                    <option value="standard">Standard</option>
                                    <option value="deep">Deep</option>
                                </select>
                            </div>
                        ) : (
                            <div>
                                <label className="block text-xs font-black uppercase tracking-wider text-stone-500 mb-2">Formula Count</label>
                                <input
                                    type="number"
                                    min={4}
                                    max={30}
                                    value={formulaCount}
                                    onChange={(e) => setFormulaCount(Math.max(4, Math.min(30, Number(e.target.value) || 4)))}
                                    className="w-full px-4 py-3 rounded-xl bg-[#FCFAF8] text-[#2C241B] font-semibold border border-stone-200 "
                                />
                            </div>
                        )}

                        <Button
                            onClick={handleGenerate}
                            disabled={isLoading}
                            className="w-full bg-[#8C5A35] hover:bg-[#70482B] rounded-xl font-bold"
                        >
                            {isLoading ? 'Streaming...' : 'Generate'}
                        </Button>
                    </div>

                    <div className="mt-5 flex flex-wrap gap-3">
                        <Button
                            variant={mode === 'summary' ? 'primary' : 'outline'}
                            onClick={() => setMode('summary')}
                            className="rounded-xl"
                        >
                            <FileText size={16} className="mr-2" />
                            Chapter Summary
                        </Button>
                        <Button
                            variant={mode === 'formula' ? 'primary' : 'outline'}
                            onClick={() => setMode('formula')}
                            className="rounded-xl"
                        >
                            <Calculator size={16} className="mr-2" />
                            Formula Sheet
                        </Button>

                        {mode === 'summary' ? (
                            <div className="ml-auto min-w-[260px] px-4 py-2 rounded-xl border border-stone-200 bg-[#FCFAF8] ">
                                <p className="text-[10px] font-black uppercase tracking-wider text-stone-500 mb-1 flex items-center gap-1">
                                    <SlidersHorizontal size={12} /> Core Idea Count
                                </p>
                                <input
                                    type="range"
                                    min={4}
                                    max={10}
                                    value={summaryPoints}
                                    onChange={(e) => setSummaryPoints(Number(e.target.value))}
                                    className="w-full accent-[#8C5A35]"
                                />
                                <p className="text-xs font-bold text-stone-500">{summaryPoints} bullet points</p>
                            </div>
                        ) : (
                            <label className="ml-auto flex items-center gap-2 text-sm font-bold text-stone-600 ">
                                <input
                                    type="checkbox"
                                    checked={includeExamples}
                                    onChange={(e) => setIncludeExamples(e.target.checked)}
                                    className="accent-[#8C5A35]"
                                />
                                Include mini examples
                            </label>
                        )}
                    </div>
                </Card>

                <Card className="p-6 md:p-8 bg-[#FCFAF8] border-none shadow-xl rounded-3xl min-h-[420px]">
                    {content ? (
                        <>
                            <div className="flex justify-end gap-2 mb-4">
                                <Button variant="outline" className="rounded-xl" onClick={copyMarkdown}>Copy</Button>
                                <Button variant="outline" className="rounded-xl" onClick={downloadMarkdown}>Download .md</Button>
                            </div>
                            <div className="space-y-6">
                                {mode === 'summary' ? (
                                    <>
                                        <section className="space-y-3">
                                            <h3 className="text-lg font-black text-[#2C241B] ">Core Ideas</h3>
                                            {renderTableSection('Core Ideas', ['Key Terms', 'Board Focus', 'Quick Recall', 'Exam Tip'])}
                                        </section>
                                        <section className="space-y-3">
                                            <h3 className="text-lg font-black text-[#2C241B] ">Key Terms</h3>
                                            {renderTableSection('Key Terms', ['Board Focus', 'Quick Recall', 'Exam Tip'])}
                                        </section>
                                        <section className="space-y-3">
                                            <h3 className="text-lg font-black text-[#2C241B] ">Board Focus</h3>
                                            {renderTableSection('Board Focus', ['Quick Recall', 'Exam Tip'])}
                                        </section>
                                        <section className="space-y-3">
                                            <h3 className="text-lg font-black text-[#2C241B] ">Quick Recall</h3>
                                            <div className="rounded-2xl border border-stone-200 bg-[#FCFAF8] p-5 text-stone-700 ">
                                                <MarkdownContent
                                                    content={formatQuickRecallBlock(extractMarkdownSection(content, 'Quick Recall', ['Exam Tip']))}
                                                    className="prose-p:my-2 prose-ul:my-2 prose-li:my-1"
                                                />
                                            </div>
                                        </section>
                                        <section className="space-y-3">
                                            <h3 className="text-lg font-black text-[#2C241B] ">Exam Tip</h3>
                                            <div className="rounded-2xl border border-stone-200 bg-[#FCFAF8] p-5 text-stone-700 ">
                                                <MarkdownContent content={extractMarkdownSection(content, 'Exam Tip', [])} className="leading-7" />
                                            </div>
                                        </section>
                                    </>
                                ) : (
                                    <>
                                        <section className="space-y-3">
                                            <h3 className="text-lg font-black text-[#2C241B] ">Formulas</h3>
                                            {renderTableSection('Formulas', ['Definitions', 'Units', 'Common Mistakes', 'Exam Tip'])}
                                        </section>
                                        <section className="space-y-3">
                                            <h3 className="text-lg font-black text-[#2C241B] ">Definitions</h3>
                                            {renderTableSection('Definitions', ['Units', 'Common Mistakes', 'Exam Tip'])}
                                        </section>
                                        <section className="space-y-3">
                                            <h3 className="text-lg font-black text-[#2C241B] ">Units</h3>
                                            {renderTableSection('Units', ['Common Mistakes', 'Exam Tip'])}
                                        </section>
                                        <section className="space-y-3">
                                            <h3 className="text-lg font-black text-[#2C241B] ">Common Mistakes</h3>
                                            {renderTableSection('Common Mistakes', ['Exam Tip'])}
                                        </section>
                                        <section className="space-y-3">
                                            <h3 className="text-lg font-black text-[#2C241B] ">Exam Tip</h3>
                                            <div className="rounded-2xl border border-stone-200 bg-[#FCFAF8] p-5 text-stone-700 ">
                                                <MarkdownContent content={extractMarkdownSection(content, 'Exam Tip', [])} className="leading-7" />
                                            </div>
                                        </section>
                                    </>
                                )}
                                <details className="rounded-2xl border border-stone-200 p-4">
                                    <summary className="cursor-pointer text-xs font-black uppercase tracking-wider text-stone-500">View Raw Markdown</summary>
                                    <div className="mt-3">
                                        <MarkdownContent content={content} />
                                    </div>
                                </details>
                            </div>
                        </>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-center text-stone-500">
                            <Sparkles size={32} className="mb-3 text-[#8C5A35]" />
                            <p className="font-semibold">No notes generated yet.</p>
                            <p className="text-sm mt-1 max-w-md">Select a chapter and click Generate. Your result will be structured for quick revision with exam-friendly wording.</p>
                        </div>
                    )}
                </Card>
            </main>
        </div>
    );
};
