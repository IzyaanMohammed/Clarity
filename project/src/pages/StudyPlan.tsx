import { useState } from 'react';
import { Info, Target, Clock3, ListChecks, Sparkles, Calendar, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { Navbar } from '../components/layout/Navbar';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { MarkdownContent } from '../components/ui/MarkdownContent';
import { getUser, saveStudyMaterialIfNew, type StudyMaterialItem } from '../utils/storage';
import { extractMarkdownSection, parseMarkdownTable } from '../utils/markdown';
import { generateDailyPlanStream, saveMaterialToDatabase } from '../api';
import { useCurriculumCatalog } from '../hooks/useCurriculumCatalog';

export const StudyPlan = () => {
    const user = getUser();
    const classKey = (user?.class || '10').toString();
    const { subjectsForClass } = useCurriculumCatalog(classKey);

    const [examDate, setExamDate] = useState(() => {
        const saved = localStorage.getItem('clarity_exam_date');
        if (saved) return saved;
        const now = new Date();
        const boardYear = now.getMonth() <= 2 ? now.getFullYear() : now.getFullYear() + 1;
        return `${boardYear}-02-15`;
    });

    const [otherDates, setOtherDates] = useState<Array<{ id: string; label: string; date: string }>>(() => {
        const saved = localStorage.getItem('clarity_other_dates');
        if (saved) {
            try {
                return JSON.parse(saved);
            } catch {
                return [];
            }
        }
        return [];
    });

    const [newDateLabel, setNewDateLabel] = useState('');
    const [newDateValue, setNewDateValue] = useState('');

    const handleExamDateChange = (val: string) => {
        setExamDate(val);
        localStorage.setItem('clarity_exam_date', val);
    };

    const handleAddOtherDate = () => {
        if (!newDateLabel.trim() || !newDateValue) {
            toast.error('Please enter both label and date');
            return;
        }
        const updated = [
            ...otherDates,
            {
                id: `date_${Date.now()}`,
                label: newDateLabel.trim(),
                date: newDateValue
            }
        ];
        updated.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        setOtherDates(updated);
        localStorage.setItem('clarity_other_dates', JSON.stringify(updated));
        setNewDateLabel('');
        setNewDateValue('');
        toast.success('Milestone added');
    };

    const handleRemoveOtherDate = (id: string) => {
        const updated = otherDates.filter(d => d.id !== id);
        setOtherDates(updated);
        localStorage.setItem('clarity_other_dates', JSON.stringify(updated));
        toast.success('Milestone removed');
    };

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
            <div className="overflow-x-auto rounded-2xl border-3 border-[#2C241B] shadow-neo bg-[#FCFAF8] ">
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
                        focus_chapters: JSON.stringify(user?.focusChapters || {}),
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
        <div className="min-h-screen bg-[#f8fafc] transition-colors duration-300">
            <Navbar />
            <main className="max-w-7xl mx-auto px-6 py-10">
                <div className="mb-8">
                    <h1 className="text-3xl md:text-4xl font-black text-[#2C241B] ">
                        Adaptive Study Planner
                    </h1>
                    <p className="text-stone-500 mt-2 font-medium">
                        Build a realistic, exam-ready day with streaming AI guidance.
                    </p>
                </div>

                <Card className="p-5 mb-8 bg-gradient-to-r from-cyan-50 to-amber-50 border border-cyan-100 rounded-3xl">
                    <div className="flex items-start gap-3">
                        <Info className="text-cyan-600 mt-0.5" size={18} />
                        <div className="text-sm text-stone-700 ">
                            <p className="font-bold">Planner tips:</p>
                            <p className="mt-1">Choose your task count and intensity. Add weak topics to force targeted fixes. Plan streams live so you can read while it generates.</p>
                        </div>
                    </div>
                </Card>

                <Card className="p-6 md:p-8 bg-[#FCFAF8] border-none shadow-xl rounded-3xl mb-8">
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                        <div>
                            <label className="block text-xs font-black uppercase tracking-wider text-stone-500 mb-2">Exam Date</label>
                            <input
                                type="date"
                                value={examDate}
                                onChange={(e) => handleExamDateChange(e.target.value)}
                                className="w-full px-4 py-3 rounded-xl bg-[#FCFAF8] text-[#2C241B] font-semibold border-3 border-[#2C241B] shadow-neo "
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-black uppercase tracking-wider text-stone-500 mb-2">Weak Topics</label>
                            <input
                                type="text"
                                value={weakTopicsInput}
                                onChange={(e) => setWeakTopicsInput(e.target.value)}
                                placeholder="Light, Trigonometry, Electricity"
                                className="w-full px-4 py-3 rounded-xl bg-[#FCFAF8] text-[#2C241B] font-semibold border-3 border-[#2C241B] shadow-neo "
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-black uppercase tracking-wider text-stone-500 mb-2">Task Count</label>
                            <div className="w-full px-4 py-3 rounded-xl bg-[#FCFAF8] border-3 border-[#2C241B] shadow-neo ">
                                <input
                                    type="range"
                                    min={4}
                                    max={10}
                                    value={taskCount}
                                    onChange={(e) => setTaskCount(Number(e.target.value))}
                                    className="w-full accent-[#8C5A35]"
                                />
                                <p className="text-xs font-bold text-stone-500 mt-1">{taskCount} tasks</p>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-black uppercase tracking-wider text-stone-500 mb-2">Intensity</label>
                            <select
                                value={planDepth}
                                onChange={(e) => setPlanDepth(e.target.value as 'lite' | 'balanced' | 'intensive')}
                                className="w-full px-4 py-3 rounded-xl bg-[#FCFAF8] text-[#2C241B] font-semibold border-3 border-[#2C241B] shadow-neo "
                            >
                                <option value="lite">Lite</option>
                                <option value="balanced">Balanced</option>
                                <option value="intensive">Intensive</option>
                            </select>
                        </div>

                        <Button
                            onClick={handleGenerate}
                            disabled={isLoading}
                            className="w-full bg-[#8C5A35] hover:bg-[#70482B] border-3 border-[#2C241B] shadow-neo hover:translate-y-[2px] hover:translate-x-[2px] hover:shadow-neo-sm active:translate-x-[4px] active:translate-y-[4px] active:shadow-none transition-all rounded-xl font-bold"
                        >
                            {isLoading ? 'Streaming Plan...' : 'Generate Plan'}
                        </Button>
                    </div>
                </Card>

                {/* Upcoming Exams & Deadlines Planner */}
                <Card className="p-6 md:p-8 bg-[#FCFAF8] border-none shadow-xl rounded-3xl mb-8">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2.5 bg-amber-50 rounded-xl text-amber-600">
                            <Calendar size={20} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-[#2C241B] ">Upcoming Exams & Deadlines</h2>
                            <p className="text-xs text-stone-500 font-medium">Keep track of key dates (monthly tests, chapter quizzes, practicals)</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Add milestone form */}
                        <div className="space-y-4 lg:col-span-1 p-5 rounded-2xl bg-[#FCFAF8] border-3 border-[#2C241B] shadow-neo ">
                            <h3 className="text-sm font-black uppercase tracking-wider text-stone-400">Add New Milestone</h3>
                            
                            <div>
                                <label className="block text-xs font-black uppercase tracking-wider text-stone-500 mb-1.5">Label</label>
                                <input
                                    type="text"
                                    value={newDateLabel}
                                    onChange={(e) => setNewDateLabel(e.target.value)}
                                    placeholder="e.g. Physics Chapter 3 Test"
                                    className="w-full px-4 py-2.5 rounded-xl bg-[#FCFAF8] text-[#2C241B] font-semibold border-3 border-[#2C241B] shadow-neo text-sm focus:ring-1 focus:ring-[#8C5A35] outline-none"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-black uppercase tracking-wider text-stone-500 mb-1.5">Date</label>
                                <input
                                    type="date"
                                    value={newDateValue}
                                    onChange={(e) => setNewDateValue(e.target.value)}
                                    className="w-full px-4 py-2.5 rounded-xl bg-[#FCFAF8] text-[#2C241B] font-semibold border-3 border-[#2C241B] shadow-neo text-sm focus:ring-1 focus:ring-[#8C5A35] outline-none"
                                />
                            </div>

                            <Button
                                onClick={handleAddOtherDate}
                                className="w-full bg-[#8C5A35] hover:bg-[#70482B] border-3 border-[#2C241B] shadow-neo hover:translate-y-[2px] hover:translate-x-[2px] hover:shadow-neo-sm active:translate-x-[4px] active:translate-y-[4px] active:shadow-none transition-all rounded-xl font-bold text-sm h-11 flex items-center justify-center gap-2"
                            >
                                <Plus size={16} /> Add Milestone
                            </Button>
                        </div>

                        {/* List of milestones */}
                        <div className="lg:col-span-2 space-y-3">
                            <h3 className="text-sm font-black uppercase tracking-wider text-stone-400 mb-3">Planned Milestones</h3>
                            
                            {otherDates.length === 0 ? (
                                <div className="h-[180px] flex flex-col items-center justify-center border border-dashed border-stone-200 rounded-2xl text-stone-400 ">
                                    <Calendar size={32} className="mb-2 opacity-50" />
                                    <p className="text-sm font-bold">No custom milestones added yet</p>
                                    <p className="text-xs">Add exams, quizzes, or homework deadlines to see them here.</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[220px] overflow-y-auto pr-1">
                                    {otherDates.map((milestone) => (
                                        <div
                                            key={milestone.id}
                                            className="flex items-center justify-between p-4 bg-[#FCFAF8] border-3 border-[#2C241B] shadow-neo rounded-2xl hover:border-stone-200 :border-stone-700 transition-colors"
                                        >
                                            <div className="min-w-0 pr-2">
                                                <p className="font-bold text-sm text-[#2C241B] truncate">{milestone.label}</p>
                                                <p className="text-xs text-amber-600 font-semibold flex items-center gap-1.5 mt-1">
                                                    <Calendar size={12} />
                                                    {new Date(milestone.date).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                                                </p>
                                            </div>
                                            <Button
                                                variant="outline"
                                                className="h-9 w-9 p-0 rounded-xl border-red-100 hover:bg-red-50 text-red-500 :bg-red-950/20 flex-shrink-0"
                                                onClick={() => handleRemoveOtherDate(milestone.id)}
                                            >
                                                <Trash2 size={15} />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </Card>

                <Card className="p-6 md:p-10 bg-[#FCFAF8] border-none shadow-xl rounded-3xl min-h-[420px]">
                    {plan ? (
                        <div className="space-y-6">
                            <div className="flex justify-end gap-2">
                                <Button variant="outline" className="rounded-xl" onClick={copyPlan}>Copy</Button>
                                <Button variant="outline" className="rounded-xl" onClick={downloadPlan}>Download .md</Button>
                            </div>
                            <div className="space-y-5">
                                <Card className="p-5 rounded-2xl bg-amber-50 border border-amber-100 ">
                                    <p className="text-xs font-black uppercase tracking-wider text-amber-700 mb-2 flex items-center gap-2">
                                        <Clock3 size={14} /> Morning Sprint
                                    </p>
                                    {renderTableSection('Morning Sprint', ['Afternoon Deep Work', 'Evening Review', 'Priority Fixes', 'Exam Tip'])}
                                </Card>
                                <Card className="p-5 rounded-2xl bg-cyan-50 border border-cyan-100 ">
                                    <p className="text-xs font-black uppercase tracking-wider text-cyan-700 mb-2 flex items-center gap-2">
                                        <ListChecks size={14} /> Afternoon Deep Work
                                    </p>
                                    {renderTableSection('Afternoon Deep Work', ['Evening Review', 'Priority Fixes', 'Exam Tip'])}
                                </Card>
                                <Card className="p-5 rounded-2xl bg-amber-50 border border-amber-100 ">
                                    <p className="text-xs font-black uppercase tracking-wider text-amber-700 mb-2 flex items-center gap-2">
                                        <Target size={14} /> Evening Review
                                    </p>
                                    {renderTableSection('Evening Review', ['Priority Fixes', 'Exam Tip'])}
                                </Card>
                                <Card className="p-5 rounded-2xl bg-rose-50 border border-rose-100 ">
                                    <p className="text-xs font-black uppercase tracking-wider text-rose-700 mb-2">Priority Fixes</p>
                                    {renderTableSection('Priority Fixes', ['Exam Tip'])}
                                </Card>
                                <Card className="p-5 rounded-2xl bg-indigo-50 border border-indigo-100 ">
                                    <p className="text-xs font-black uppercase tracking-wider text-indigo-700 mb-2 flex items-center gap-2">
                                        <Sparkles size={14} /> Exam Tip
                                    </p>
                                    <div className="rounded-2xl border-3 border-[#2C241B] shadow-neo bg-[#FCFAF8] p-4 text-stone-700 ">
                                        <MarkdownContent content={extractMarkdownSection(plan, 'Exam Tip', [])} className="leading-6" />
                                    </div>
                                </Card>
                            </div>

                            <details className="rounded-2xl border-3 border-[#2C241B] shadow-neo p-4">
                                <summary className="cursor-pointer text-xs font-black uppercase tracking-wider text-stone-500">View Raw Markdown</summary>
                                <div className="max-w-none mt-3">
                                    <MarkdownContent content={plan} />
                                </div>
                            </details>
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-center text-stone-500">
                            <Target size={34} className="mb-3 text-[#8C5A35]" />
                            <p className="font-semibold">No plan generated yet.</p>
                            <p className="text-sm mt-1 max-w-md">Set exam date and weak topics, then click Generate Plan. You will receive a morning, afternoon, and evening action plan with revision and test tasks.</p>
                        </div>
                    )}
                </Card>
            </main>
        </div>
    );
};
