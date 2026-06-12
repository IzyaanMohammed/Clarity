import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Send, Bot, Sparkles, User, ArrowLeft, Flame, Target, BookOpen, Clock, Zap, Info, Clock3, ListChecks, Calendar, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { Navbar } from '../components/layout/Navbar';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { MarkdownContent } from '../components/ui/MarkdownContent';
import { getUser, saveStudyMaterialIfNew, type StudyMaterialItem } from '../utils/storage';
import { getStats, askTutorStream, generateDailyPlanStream, saveMaterialToDatabase, type StatsResponse } from '../api';
import { extractMarkdownSection, parseMarkdownTable } from '../utils/markdown';
import { useCurriculumCatalog } from '../hooks/useCurriculumCatalog';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export const AITutor = ({ initialTab = 'chat' }: { initialTab?: 'chat' | 'planner' }) => {
  const navigate = useNavigate();
  const user = getUser();
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  const [activeTab, setActiveTab] = useState<'chat' | 'planner'>(initialTab);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  // Planner States
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
  const [weakTopicsInput, setWeakTopicsInput] = useState('');
  const [taskCount, setTaskCount] = useState(7);
  const [planDepth, setPlanDepth] = useState<'lite' | 'balanced' | 'intensive'>('balanced');
  const [isPlannerLoading, setIsPlannerLoading] = useState(false);
  const [plan, setPlan] = useState('');

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

  const handleGeneratePlan = async () => {
      const catalogSubjects = subjectsForClass.length ? subjectsForClass : (user?.subjects || []);
      if (!catalogSubjects.length) {
          toast.error('Please add subjects in settings first.');
          return;
      }

      setIsPlannerLoading(true);
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
          setIsPlannerLoading(false);
      }
  };

  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>(() => {
    try {
      const saved = localStorage.getItem('clarity_ai_tutor_messages');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error(e);
    }
    return [
      {
        role: 'assistant',
        content: `Hello ${user?.name || 'there'}! I am your Clarity AI Study Advisor & Exam Coach. I have analyzed your study history, diagnostic scores, and chapter practice performance. Ask me anything to design a custom study schedule, clarify difficult concepts, or identify exact gaps in your board exam prep!`,
      },
    ];
  });

  useEffect(() => {
    localStorage.setItem('clarity_ai_tutor_messages', JSON.stringify(messages));
  }, [messages]);
  const [inputMessage, setInputMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [streamingResponse, setStreamingResponse] = useState('');

  const fetchStats = async () => {
    if (!user?.name) return;
    setStatsLoading(true);
    try {
      const data = await getStats();
      setStats(data);
    } catch (error) {
      console.error('Failed to fetch stats for AI Tutor page', error);
    } finally {
      setStatsLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.name]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingResponse]);

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputMessage.trim() || isSending) return;

    const userMsg = inputMessage.trim();
    setInputMessage('');
    const newMessages = [...messages, { role: 'user', content: userMsg } as Message];
    setMessages(newMessages);
    setIsSending(true);
    setStreamingResponse('');

    try {
      let fullResponse = '';
      const conversationHistory = newMessages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      await askTutorStream(
        {
          question: userMsg,
          conversation_history: conversationHistory,
        },
        (token) => {
          fullResponse += token;
          setStreamingResponse(fullResponse);
        }
      );

      setMessages((prev) => [...prev, { role: 'assistant', content: fullResponse }]);
    } catch (err: any) {
      const detail = err?.message || 'I had trouble connecting. Please try again.';
      toast.error(detail);
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `Sorry, I encountered an error: ${detail}` },
      ]);
    } finally {
      setIsSending(false);
      setStreamingResponse('');
    }
  };

  const handleQuickQuestion = (question: string) => {
    setInputMessage(question);
  };

  if (!user) {
    navigate('/onboarding');
    return null;
  }

  const weakTopicsList = stats?.weak_topics || [];
  const suggestionPrompts = [
    'How should I revise my weak topics?',
    'Create a 3-day board revision plan.',
    'Explain the top scoring strategies for CBSE Science.',
    'Test me on a hard board question.',
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-[#020617] dark:to-slate-900 transition-colors duration-300">
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-8">
        {/* Header with back button */}
        <div className="mb-8">
          <button
            onClick={() => navigate(-1)}
            className="mb-4 flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:text-[#1D9E75] transition-colors font-bold"
          >
            <ArrowLeft size={20} />
            Back
            <span className="hidden sm:inline">to Dashboard</span>
          </button>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="p-4 bg-gradient-to-br from-[#1D9E75] to-emerald-600 rounded-3xl text-white shadow-lg">
                <Bot size={36} />
              </div>
              <div>
                <h1 className="text-3xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                  AI Study Tutor & Exam Advisor
                  <Sparkles className="text-yellow-500 animate-pulse" size={20} />
                </h1>
                <p className="text-slate-500 dark:text-slate-400 font-bold text-sm">
                  Personalized advice based on your diagnostic and practice performance
                </p>
              </div>
            </div>
            {/* Real-time streak box */}
            <div className="flex items-center gap-3 bg-white dark:bg-slate-800 p-3 px-5 rounded-2xl border-2 border-slate-100 dark:border-slate-700 shadow-sm max-w-fit">
              <Flame className="text-orange-500 fill-orange-500" size={24} />
              <div>
                <p className="text-[10px] uppercase font-black text-slate-400 tracking-wider">Streak</p>
                <p className="text-lg font-black text-slate-900 dark:text-white leading-tight">
                  {stats?.streak_days || 1} Days
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Tab Toggle Bar */}
        <div className="flex bg-white dark:bg-slate-800 p-1.5 rounded-2xl border-2 border-slate-100 dark:border-slate-700 shadow-sm max-w-md mb-8">
          <button
            onClick={() => setActiveTab('chat')}
            className={`flex-1 py-3 rounded-xl text-sm font-black transition-all ${
              activeTab === 'chat'
                ? 'bg-[#1D9E75] text-white shadow-lg shadow-[#1D9E75]/20'
                : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700'
            }`}
          >
            Conversational Coach
          </button>
          <button
            onClick={() => setActiveTab('planner')}
            className={`flex-1 py-3 rounded-xl text-sm font-black transition-all ${
              activeTab === 'planner'
                ? 'bg-[#1D9E75] text-white shadow-lg shadow-[#1D9E75]/20'
                : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700'
            }`}
          >
            Study Planner & Milestones
          </button>
        </div>

        {activeTab === 'chat' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Analytics Sidebar */}
          <div className="space-y-6 lg:col-span-1">
            {/* Quick Stats Card */}
            <Card className="p-6 bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-3xl shadow-sm space-y-5">
              <h3 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-wider border-b-2 pb-2">
                Your Prep Summary
              </h3>
              
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 rounded-xl text-emerald-600">
                    <Target size={20} />
                  </div>
                  <div className="flex-1">
                    <p className="text-[10px] uppercase font-bold text-slate-400">Accuracy Rate</p>
                    <p className="text-lg font-black text-slate-900 dark:text-white">
                      {stats?.accuracy_rate ?? 0}%
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-xl text-blue-600">
                    <Clock size={20} />
                  </div>
                  <div className="flex-1">
                    <p className="text-[10px] uppercase font-bold text-slate-400">Time Investigated</p>
                    <p className="text-lg font-black text-slate-900 dark:text-white">
                      {(((stats?.estimated_study_minutes || 0) / 60) || 0).toFixed(1)} Hours
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="p-3 bg-purple-50 dark:bg-purple-950/20 rounded-xl text-purple-600">
                    <BookOpen size={20} />
                  </div>
                  <div className="flex-1">
                    <p className="text-[10px] uppercase font-bold text-slate-400">Questions Solved</p>
                    <p className="text-lg font-black text-slate-900 dark:text-white">
                      {stats?.total_questions || 0} Questions
                    </p>
                  </div>
                </div>
              </div>
            </Card>

            {/* Weak Topics Card */}
            <Card className="p-6 bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-3xl shadow-sm">
              <h3 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-wider border-b-2 pb-2 mb-4">
                Weak Topics Focus
              </h3>
              {statsLoading ? (
                <p className="text-sm text-slate-500">Loading analysis...</p>
              ) : weakTopicsList.length === 0 ? (
                <p className="text-sm text-slate-500 italic">
                  No critical gaps identified yet. Keep practicing to build your diagnostic model!
                </p>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-rose-600 dark:text-rose-400 font-bold mb-2">
                    Priority revision recommended for:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {weakTopicsList.map((topic, i) => (
                      <span
                        key={i}
                        className="px-3 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 text-rose-800 dark:text-rose-200 text-xs font-bold"
                      >
                        ⚠️ {topic}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </Card>

            {/* AI Advisor Actions */}
            <Card className="p-6 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/10 dark:to-teal-950/10 border-2 border-emerald-200 dark:border-emerald-800/40 rounded-3xl space-y-4">
              <h4 className="text-sm font-black text-emerald-800 dark:text-emerald-300 uppercase tracking-widest flex items-center gap-2">
                <Zap size={16} />
                Smart Quick Advice
              </h4>
              <p className="text-xs text-emerald-800 dark:text-emerald-300 leading-relaxed font-semibold">
                Ask me to prepare a recovery plan for your weak topics or draft an hour-by-hour revision checklist.
              </p>
              <div className="space-y-2">
                {suggestionPrompts.map((prompt, i) => (
                  <button
                    key={i}
                    onClick={() => handleQuickQuestion(prompt)}
                    className="w-full text-left p-3 bg-white dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-slate-700 border border-slate-100 dark:border-slate-700 text-xs font-bold rounded-xl text-slate-700 dark:text-slate-300 transition-all truncate hover:translate-x-1"
                  >
                    💡 "{prompt}"
                  </button>
                ))}
              </div>
            </Card>
          </div>

          {/* Right Column: Conversational Chat OS */}
          <div className="lg:col-span-2 flex flex-col h-[92vh] bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-3xl shadow-lg overflow-hidden">
            {/* Conversational Screen Title */}
            <div className="p-4 bg-slate-50 dark:bg-slate-900/40 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-ping" />
                <span className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Clarity Board Coach Active
                </span>
              </div>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                Model: Llama/Qwen Pro Advisor
              </span>
            </div>

            {/* Chat History Box */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin">
              {messages.map((msg, index) => (
                <div
                  key={index}
                  className={`flex gap-4 max-w-4xl ${
                    msg.role === 'user' ? 'flex-row-reverse ml-auto' : 'mr-auto'
                  }`}
                >
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                      msg.role === 'user'
                        ? 'bg-slate-900 dark:bg-slate-700 text-white'
                        : 'bg-[#1D9E75] text-white'
                    }`}
                  >
                    {msg.role === 'user' ? <User size={18} /> : <Bot size={18} />}
                  </div>

                  <div
                    className={`p-5 rounded-3xl font-medium leading-relaxed text-sm ${
                      msg.role === 'user'
                        ? 'bg-slate-900 text-white dark:bg-slate-700 dark:text-white rounded-tr-none'
                        : 'bg-slate-50 dark:bg-slate-900/50 text-slate-800 dark:text-slate-200 border border-slate-100 dark:border-slate-800 rounded-tl-none'
                    }`}
                  >
                    <MarkdownContent content={msg.content} className="prose prose-sm dark:prose-invert" />
                  </div>
                </div>
              ))}

              {/* Streaming AI Output Bubble */}
              {streamingResponse && (
                <div className="flex gap-4 max-w-4xl mr-auto">
                  <div className="w-10 h-10 rounded-full bg-[#1D9E75] text-white flex items-center justify-center flex-shrink-0">
                    <Bot size={18} />
                  </div>
                  <div className="p-5 rounded-3xl rounded-tl-none bg-slate-50 dark:bg-slate-900/50 text-slate-800 dark:text-slate-200 border border-slate-100 dark:border-slate-800 font-medium leading-relaxed text-sm">
                    <MarkdownContent content={streamingResponse} className="prose prose-sm dark:prose-invert" />
                  </div>
                </div>
              )}

              {/* Sending / Loading Indicator */}
              {isSending && !streamingResponse && (
                <div className="flex gap-4 max-w-4xl mr-auto">
                  <div className="w-10 h-10 rounded-full bg-[#1D9E75] text-white flex items-center justify-center flex-shrink-0">
                    <Bot size={18} />
                  </div>
                  <div className="p-5 rounded-3xl rounded-tl-none bg-slate-50 dark:bg-slate-900/50 text-slate-800 dark:text-slate-200 border border-slate-100 dark:border-slate-800 flex items-center gap-2 text-sm font-semibold">
                    <div className="animate-spin h-4 w-4 border-2 border-[#1D9E75] border-t-transparent rounded-full" />
                    Analyzing metrics & drafting recommendations...
                  </div>
                </div>
              )}

              <div ref={chatEndRef} />
            </div>

            {/* Input Prompt Box */}
            <form
              onSubmit={handleSendMessage}
              className="p-4 bg-slate-50 dark:bg-slate-900/30 border-t border-slate-100 dark:border-slate-700 flex gap-3"
            >
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder="Ask your tutor coach anything... (e.g., 'What chapters should I review next?')"
                className="flex-1 px-5 py-3 rounded-2xl bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white outline-none font-bold text-sm focus:ring-2 focus:ring-[#1D9E75] focus:border-transparent transition-all"
                disabled={isSending}
              />
              <Button
                type="submit"
                className="p-3 bg-[#1D9E75] hover:bg-[#16805d] text-white rounded-2xl flex items-center justify-center shadow-md w-12 h-12 flex-shrink-0"
                disabled={isSending || !inputMessage.trim()}
              >
                <Send size={18} />
              </Button>
            </form>
          </div>
          </div>
        )}

        {activeTab === 'planner' && (
          <div className="space-y-8 animate-fadeIn">
            {/* Advice Card */}
            <Card className="p-5 bg-gradient-to-r from-cyan-50 to-emerald-50 dark:from-slate-800 dark:to-slate-900 border border-cyan-100 dark:border-slate-700 rounded-3xl">
              <div className="flex items-start gap-3">
                <Info className="text-cyan-600 mt-0.5" size={18} />
                <div className="text-sm text-slate-700 dark:text-slate-200">
                  <p className="font-bold">Planner tips:</p>
                  <p className="mt-1">Choose your task count and intensity. Add weak topics to force targeted fixes. Plan streams live so you can read while it generates.</p>
                </div>
              </div>
            </Card>

            {/* Inputs Config Card */}
            <Card className="p-6 md:p-8 bg-white dark:bg-slate-800 border-none shadow-xl rounded-3xl">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-2">Exam Date</label>
                  <input
                    type="date"
                    value={examDate}
                    onChange={(e) => handleExamDateChange(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-905 text-slate-900 dark:text-white font-semibold border border-slate-200 dark:border-slate-700 outline-none focus:ring-1 focus:ring-[#1D9E75]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-2">Weak Topics</label>
                  <input
                    type="text"
                    value={weakTopicsInput}
                    onChange={(e) => setWeakTopicsInput(e.target.value)}
                    placeholder="Light, Trigonometry, Electricity"
                    className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-905 text-slate-900 dark:text-white font-semibold border border-slate-200 dark:border-slate-700 outline-none focus:ring-1 focus:ring-[#1D9E75]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-2">Task Count</label>
                  <div className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-905 border border-slate-200 dark:border-slate-700">
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
                    className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-905 text-slate-900 dark:text-white font-semibold border border-slate-200 dark:border-slate-700 outline-none focus:ring-1 focus:ring-[#1D9E75]"
                  >
                    <option value="lite">Lite</option>
                    <option value="balanced">Balanced</option>
                    <option value="intensive">Intensive</option>
                  </select>
                </div>

                <Button
                  onClick={handleGeneratePlan}
                  disabled={isPlannerLoading}
                  className="w-full bg-[#1D9E75] hover:bg-[#16805d] rounded-xl font-bold h-[48px]"
                >
                  {isPlannerLoading ? 'Streaming Plan...' : 'Generate Plan'}
                </Button>
              </div>
            </Card>

            {/* Milestones Card */}
            <Card className="p-6 md:p-8 bg-white dark:bg-slate-800 border-none shadow-xl rounded-3xl">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl text-emerald-600">
                  <Calendar size={20} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white">Upcoming Exams & Deadlines</h2>
                  <p className="text-xs text-slate-500 font-medium">Keep track of key dates (monthly tests, chapter quizzes, practicals)</p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Add milestone form */}
                <div className="space-y-4 lg:col-span-1 p-5 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800">
                  <h3 className="text-sm font-black uppercase tracking-wider text-slate-400">Add New Milestone</h3>
                  
                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-1.5">Label</label>
                    <input
                      type="text"
                      value={newDateLabel}
                      onChange={(e) => setNewDateLabel(e.target.value)}
                      placeholder="e.g. Physics Chapter 3 Test"
                      className="w-full px-4 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-semibold text-sm focus:ring-1 focus:ring-[#1D9E75] outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-1.5">Date</label>
                    <input
                      type="date"
                      value={newDateValue}
                      onChange={(e) => setNewDateValue(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-semibold text-sm focus:ring-1 focus:ring-[#1D9E75] outline-none"
                    />
                  </div>

                  <Button
                    onClick={handleAddOtherDate}
                    className="w-full bg-[#1D9E75] hover:bg-[#16805d] rounded-xl font-bold text-sm h-11 flex items-center justify-center gap-2"
                  >
                    <Plus size={16} /> Add Milestone
                  </Button>
                </div>

                {/* List of milestones */}
                <div className="lg:col-span-2 space-y-3">
                  <h3 className="text-sm font-black uppercase tracking-wider text-slate-400 mb-3">Planned Milestones</h3>
                  
                  {otherDates.length === 0 ? (
                    <div className="h-[180px] flex flex-col items-center justify-center border border-dashed border-slate-200 dark:border-slate-700 rounded-2xl text-slate-400 dark:text-slate-500">
                      <Calendar size={32} className="mb-2 opacity-50" />
                      <p className="text-sm font-bold">No custom milestones added yet</p>
                      <p className="text-xs">Add exams, quizzes, or homework deadlines to see them here.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[220px] overflow-y-auto pr-1">
                      {otherDates.map((milestone) => (
                        <div
                          key={milestone.id}
                          className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800 rounded-2xl hover:border-slate-200 dark:hover:border-slate-700 transition-colors"
                        >
                          <div className="min-w-0 pr-2">
                            <p className="font-bold text-sm text-slate-900 dark:text-white truncate">{milestone.label}</p>
                            <p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1.5 mt-1">
                              <Calendar size={12} />
                              {new Date(milestone.date).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                            </p>
                          </div>
                          <Button
                            variant="outline"
                            className="h-9 w-9 p-0 rounded-xl border-red-100 hover:bg-red-50 text-red-500 dark:border-red-950/20 dark:hover:bg-red-950/20 flex-shrink-0"
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

            {/* Generated Plan Output */}
            <Card className="p-6 md:p-10 bg-white dark:bg-slate-800 border-none shadow-xl rounded-3xl min-h-[300px]">
              {plan ? (
                <div className="space-y-6">
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" className="rounded-xl" onClick={copyPlan}>Copy</Button>
                    <Button variant="outline" className="rounded-xl" onClick={downloadPlan}>Download .md</Button>
                  </div>
                  <div className="space-y-5">
                    <Card className="p-5 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-250 dark:border-emerald-800">
                      <p className="text-xs font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-350 mb-2 flex items-center gap-2">
                        <Clock3 size={14} /> Morning Sprint
                      </p>
                      {renderTableSection('Morning Sprint', ['Afternoon Deep Work', 'Evening Review', 'Priority Fixes', 'Exam Tip'])}
                    </Card>
                    
                    <Card className="p-5 rounded-2xl bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-250 dark:border-cyan-800">
                      <p className="text-xs font-black uppercase tracking-wider text-cyan-700 dark:text-cyan-350 mb-2 flex items-center gap-2">
                        <ListChecks size={14} /> Afternoon Deep Work
                      </p>
                      {renderTableSection('Afternoon Deep Work', ['Evening Review', 'Priority Fixes', 'Exam Tip'])}
                    </Card>
                    
                    <Card className="p-5 rounded-2xl bg-amber-50 dark:bg-amber-900/20 border border-amber-250 dark:border-amber-800">
                      <p className="text-xs font-black uppercase tracking-wider text-amber-700 dark:text-amber-350 mb-2 flex items-center gap-2">
                        <Target size={14} /> Evening Review
                      </p>
                      {renderTableSection('Evening Review', ['Priority Fixes', 'Exam Tip'])}
                    </Card>
                    
                    <Card className="p-5 rounded-2xl bg-rose-50 dark:bg-rose-900/20 border border-rose-250 dark:border-rose-800">
                      <p className="text-xs font-black uppercase tracking-wider text-rose-700 dark:text-rose-350 mb-2">Priority Fixes</p>
                      {renderTableSection('Priority Fixes', ['Exam Tip'])}
                    </Card>
                    
                    <Card className="p-5 rounded-2xl bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-250 dark:border-indigo-800">
                      <p className="text-xs font-black uppercase tracking-wider text-indigo-700 dark:text-indigo-350 mb-2 flex items-center gap-2">
                        <Sparkles size={14} /> Exam Tip
                      </p>
                      <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 text-slate-700 dark:text-slate-200">
                        <MarkdownContent content={extractMarkdownSection(plan, 'Exam Tip', [])} className="leading-6" />
                      </div>
                    </Card>
                  </div>

                  <details className="rounded-2xl border border-slate-200 dark:border-slate-700 p-4">
                    <summary className="cursor-pointer text-xs font-black uppercase tracking-wider text-slate-500">View Raw Markdown</summary>
                    <div className="max-w-none mt-3">
                      <MarkdownContent content={plan} />
                    </div>
                  </details>
                </div>
              ) : (
                <div className="h-full py-20 flex flex-col items-center justify-center text-center text-slate-500">
                  <Target size={34} className="mb-3 text-[#1D9E75]" />
                  <p className="font-semibold">No plan generated yet.</p>
                  <p className="text-sm mt-1 max-w-md">Set exam date and weak topics, then click Generate Plan. You will receive a morning, afternoon, and evening action plan with revision and test tasks.</p>
                </div>
              )}
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};
