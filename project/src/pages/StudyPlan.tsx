import { useState } from 'react';
import { Info, Target, Clock3, ListChecks, Sparkles } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import toast from 'react-hot-toast';
import { Navbar } from '../components/layout/Navbar';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { getUser, saveStudyMaterialIfNew, type StudyMaterialItem } from '../utils/storage';
import { extractMarkdownSection, parseMarkdownTable } from '../utils/markdown';
import { generateDailyPlanStream, saveMaterialToDatabase } from '../api';
import { useCurriculumCatalog } from '../hooks/useCurriculumCatalog';

export const StudyPlan = () => {
    const user = getUser();
    const classKey = (user?.class || '10').toString();
    const { subjectsForClass } = useCurriculumCatalog(classKey);

    const [examDate, setExamDate] = useState('');
    const [weakTopicsInput, setWeakTopicsInput] = useState('');
    const [taskCount, setTaskCount] = useState(7);
    const [planDepth, setPlanDepth] = useState<'lite' | 'balanced' | 'intensive'>('balanced');
    const [isLoading, setIsLoading] = useState(false);
    const [plan, setPlan] = useState('');

    const renderTableSection = (section: string, nextSections: string[]) => {
        const block = extractMarkdownSection(plan, section, nextSections);
        const table = parseMarkdownTable(block);
        if (!table) return null;

        return (
            <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
                <table className="min-w-full text-left text-sm">
                    <thead className="bg-slate-100 dark:bg-slate-800">
                        <tr>
                            {table.headers.map((header) => (
                                <th key={header} className="px-4 py-3 font-black text-slate-700 dark:text-slate-200 whitespace-nowrap">
                                    {header}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {table.rows.map((row, rowIndex) => (
                            <tr key={rowIndex} className="border-t border-slate-100 dark:border-slate-800">
                                {row.map((cell, cellIndex) => (
                                    <td key={`${rowIndex}-${cellIndex}`} className="px-4 py-3 text-slate-700 dark:text-slate-200 align-top">
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

    const copyPlan = async () => {
        if (!plan.trim()) return;
        await navigator.clipboard.writeText(plan);
        toast.success('Plan copied.');
    };

    const downloadPlan = () => {
        if (!plan.trim()) return;
        const blob = new Blob([plan], { type: 'text/markdown;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `study_plan_class_${classKey}_${new Date().toISOString().slice(0, 10)}.md`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
    };

    const handleGenerate = async () => {
        const catalogSubjects = subjectsForClass.length ? subjectsForClass : (user?.subjects || []);
        if (!catalogSubjects.length) {
            toast.error('Please add subjects in settings first.');
            return;
        }

        setIsLoading(true);
        try {
            let generatedPlan = '';
            const weakTopics = weakTopicsInput
                .split(',')
                .map((t) => t.trim())
                .filter(Boolean);

            setPlan('');
            await generateDailyPlanStream(
                {
                    class_num: classKey,
                    subjects: catalogSubjects,
                    weak_topics: weakTopics,
                    exam_date: examDate || undefined,
                    task_count: taskCount,
                    plan_depth: planDepth,
                    learner_profile: {
                        learning_style: user?.learningStyle || '',
                        goal: user?.goal || '',
                        study_hours: user?.studyHours || '',
                        focus_areas: user?.focusAreas || '',
                        exam_board: user?.examBoard || 'CBSE',
                        preferred_language: user?.preferredLanguage || 'English',
                        preferred_pace: user?.preferredPace || 'Balanced',
                        confidence_level: user?.confidenceLevel || 'Average confidence',
                        revision_frequency: user?.revisionFrequency || 'Alternate days',
                    },
                },
                (token) => {
                    generatedPlan += token;
                    setPlan(generatedPlan);
                }
            );

            if (generatedPlan.trim()) {
                const material: StudyMaterialItem = {
                    id: `plan_${Date.now()}`,
                    type: 'plan',
                    title: `Study Plan: ${new Date().toLocaleDateString()}`,
                    subject: catalogSubjects[0] || 'General',
                    chapter: 'Daily Plan',
                    content: generatedPlan,
                    createdAt: Date.now(),
                };
                saveStudyMaterialIfNew(material);
                try {
                    await saveMaterialToDatabase(material);
                } catch {
                    // Keep local save if sync fails.
                }
            }
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : 'Could not generate study plan.';
            toast.error(msg);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#f8fafc] dark:bg-[#020617] transition-colors duration-300">
            <Navbar />
            <main className="max-w-7xl mx-auto px-6 py-10">
                <div className="mb-8">
                    <h1 className="text-3xl md:text-4xl font-black text-slate-900 dark:text-white">
                        Adaptive Study Planner
                    </h1>
                    <p className="text-slate-500 mt-2 font-medium">
                        Build a realistic, exam-ready day with streaming AI guidance.
                    </p>
                </div>

                <Card className="p-5 mb-8 bg-gradient-to-r from-cyan-50 to-emerald-50 dark:from-slate-800 dark:to-slate-900 border border-cyan-100 dark:border-slate-700 rounded-3xl">
                    <div className="flex items-start gap-3">
                        <Info className="text-cyan-600 mt-0.5" size={18} />
                        <div className="text-sm text-slate-700 dark:text-slate-200">
                            <p className="font-bold">Planner tips:</p>
                            <p className="mt-1">Choose your task count and intensity. Add weak topics to force targeted fixes. Plan streams live so you can read while it generates.</p>
                        </div>
                    </div>
                </Card>

                <Card className="p-6 md:p-8 bg-white dark:bg-[#0f172a] border-none shadow-xl rounded-3xl mb-8">
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                        <div>
                            <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-2">Exam Date</label>
                            <input
                                type="date"
                                value={examDate}
                                onChange={(e) => setExamDate(e.target.value)}
                                className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-semibold border border-slate-200 dark:border-slate-700"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-2">Weak Topics</label>
                            <input
                                type="text"
                                value={weakTopicsInput}
                                onChange={(e) => setWeakTopicsInput(e.target.value)}
                                placeholder="Light, Trigonometry, Electricity"
                                className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-semibold border border-slate-200 dark:border-slate-700"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-2">Task Count</label>
                            <div className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                                <input
                                    type="range"
                                    min={4}
                                    max={10}
                                    value={taskCount}
                                    onChange={(e) => setTaskCount(Number(e.target.value))}
                                    className="w-full accent-[#1D9E75]"
                                />
                                <p className="text-xs font-bold text-slate-500 mt-1">{taskCount} tasks</p>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-2">Intensity</label>
                            <select
                                value={planDepth}
                                onChange={(e) => setPlanDepth(e.target.value as 'lite' | 'balanced' | 'intensive')}
                                className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-semibold border border-slate-200 dark:border-slate-700"
                            >
                                <option value="lite">Lite</option>
                                <option value="balanced">Balanced</option>
                                <option value="intensive">Intensive</option>
                            </select>
                        </div>

                        <Button
                            onClick={handleGenerate}
                            disabled={isLoading}
                            className="w-full bg-[#1D9E75] hover:bg-[#16805d] rounded-xl font-bold"
                        >
                            {isLoading ? 'Streaming Plan...' : 'Generate Plan'}
                        </Button>
                    </div>
                </Card>

                <Card className="p-6 md:p-10 bg-white dark:bg-[#0f172a] border-none shadow-xl rounded-3xl min-h-[420px]">
                    {plan ? (
                        <div className="space-y-6">
                            <div className="flex justify-end gap-2">
                                <Button variant="outline" className="rounded-xl" onClick={copyPlan}>Copy</Button>
                                <Button variant="outline" className="rounded-xl" onClick={downloadPlan}>Download .md</Button>
                            </div>
                            <div className="space-y-5">
                                <Card className="p-5 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800">
                                    <p className="text-xs font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-300 mb-2 flex items-center gap-2">
                                        <Clock3 size={14} /> Morning Sprint
                                    </p>
                                    {renderTableSection('Morning Sprint', ['Afternoon Deep Work', 'Evening Review', 'Priority Fixes', 'Exam Tip'])}
                                </Card>
                                <Card className="p-5 rounded-2xl bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-100 dark:border-cyan-800">
                                    <p className="text-xs font-black uppercase tracking-wider text-cyan-700 dark:text-cyan-300 mb-2 flex items-center gap-2">
                                        <ListChecks size={14} /> Afternoon Deep Work
                                    </p>
                                    {renderTableSection('Afternoon Deep Work', ['Evening Review', 'Priority Fixes', 'Exam Tip'])}
                                </Card>
                                <Card className="p-5 rounded-2xl bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800">
                                    <p className="text-xs font-black uppercase tracking-wider text-amber-700 dark:text-amber-300 mb-2 flex items-center gap-2">
                                        <Target size={14} /> Evening Review
                                    </p>
                                    {renderTableSection('Evening Review', ['Priority Fixes', 'Exam Tip'])}
                                </Card>
                                <Card className="p-5 rounded-2xl bg-rose-50 dark:bg-rose-900/20 border border-rose-100 dark:border-rose-800">
                                    <p className="text-xs font-black uppercase tracking-wider text-rose-700 dark:text-rose-300 mb-2">Priority Fixes</p>
                                    {renderTableSection('Priority Fixes', ['Exam Tip'])}
                                </Card>
                                <Card className="p-5 rounded-2xl bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800">
                                    <p className="text-xs font-black uppercase tracking-wider text-indigo-700 dark:text-indigo-300 mb-2 flex items-center gap-2">
                                        <Sparkles size={14} /> Exam Tip
                                    </p>
                                    <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 whitespace-pre-wrap leading-6 text-slate-700 dark:text-slate-200">
                                        {extractMarkdownSection(plan, 'Exam Tip', [])}
                                    </div>
                                </Card>
                            </div>

                            <details className="rounded-2xl border border-slate-200 dark:border-slate-700 p-4">
                                <summary className="cursor-pointer text-xs font-black uppercase tracking-wider text-slate-500">View Raw Markdown</summary>
                                <div className="prose prose-slate dark:prose-invert max-w-none mt-3">
                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{plan}</ReactMarkdown>
                                </div>
                            </details>
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-center text-slate-500">
                            <Target size={34} className="mb-3 text-[#1D9E75]" />
                            <p className="font-semibold">No plan generated yet.</p>
                            <p className="text-sm mt-1 max-w-md">Set exam date and weak topics, then click Generate Plan. You will receive a morning, afternoon, and evening action plan with revision and test tasks.</p>
                        </div>
                    )}
                </Card>
            </main>
        </div>
    );
};
