import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Target, Flame, Clock, ArrowRight, Brain, History, Calendar, Zap, Award, Sparkles, RotateCcw, Trophy } from 'lucide-react';
import toast from 'react-hot-toast';
import { Navbar } from '../components/layout/Navbar';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { getActivities, getBookmarks, getChatHistory, getStudyMaterials, getSubjectStats, getUser } from '../utils/storage';
import { getStats, sendParentReport, getDailyMission, getStudyNotifications, getMockSchedule, getResourceStack, getChapterReadiness, saveMaterialToDatabase, syncUserSnapshot, type StatsResponse, type DailyMissionResponse, type StudyNotificationResponse, type MockScheduleResponse, type ResourceStackResponse, type ChapterReadinessResponse } from '../api';
import { getSmartRecommendations } from '../utils/analytics';

type MatchItem = {
  term: string;
  definition: string;
};

const BASE_MATCH_ITEMS: MatchItem[] = [
  { term: 'Mitochondria', definition: 'Powerhouse of the cell' },
  { term: 'Photosynthesis', definition: 'Conversion of light to chemical energy' },
  { term: 'Velocity', definition: 'Speed with direction' },
  { term: 'Refraction', definition: 'Bending of light across mediums' },
];

const shuffle = <T,>(items: T[]) => {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

export const Dashboard = () => {
  const navigate = useNavigate();
  const user = getUser();
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [dailyMission, setDailyMission] = useState<DailyMissionResponse | null>(null);
  const [missionLoading, setMissionLoading] = useState(false);
  const [daysToExam, setDaysToExam] = useState(0);
  const [reportLoading, setReportLoading] = useState(false);
  const [notifications, setNotifications] = useState<StudyNotificationResponse | null>(null);
  const [mockSchedule, setMockSchedule] = useState<MockScheduleResponse | null>(null);
  const [resourceStack, setResourceStack] = useState<ResourceStackResponse | null>(null);
  const [chapterReadiness, setChapterReadiness] = useState<ChapterReadinessResponse | null>(null);
  const [resourceLoading, setResourceLoading] = useState(false);
  const [assignedMatches, setAssignedMatches] = useState<Record<string, string>>({});
  const [definitionPool, setDefinitionPool] = useState<string[]>(() => shuffle(BASE_MATCH_ITEMS.map((item) => item.definition)));
  const smartRecommendations = getSmartRecommendations(4);
  const recentActivity = stats?.recent_activity ?? [];
  const weakTopics = stats?.weak_topics ?? [];
  const solvedMatches = Object.keys(assignedMatches).filter((term) => {
    const expected = BASE_MATCH_ITEMS.find((item) => item.term === term)?.definition;
    return expected && assignedMatches[term] === expected;
  }).length;
  const isMatchingComplete = solvedMatches === BASE_MATCH_ITEMS.length;

  useEffect(() => {
    const now = new Date();
    const boardYear = now.getMonth() <= 2 ? now.getFullYear() : now.getFullYear() + 1;
    const examDate = new Date(`${boardYear}-02-15`);
    const today = new Date();
    const diffTime = Math.abs(examDate.getTime() - today.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    setDaysToExam(diffDays);

    const fetchStats = async () => {
      if (user?.name) {
        try {
          const data = await getStats();
          setStats(data);
        } catch (error) {
          console.error("Failed to fetch stats", error);
        }
      }
    };

    const fetchDailyMission = async () => {
      if (!user?.name) return;
      setMissionLoading(true);
      try {
        const mission = await getDailyMission({
          class_num: String(user.class || '10'),
          subjects: user.subjects || ['Science'],
          available_minutes: 60,
        });
        setDailyMission(mission);
      } catch (error) {
        console.error('Failed to fetch daily mission', error);
        setDailyMission(null);
      } finally {
        setMissionLoading(false);
      }
    };

    const fetchProactiveCoaching = async () => {
      if (!user?.name) return;
      try {
        const [noteData, mockData] = await Promise.all([
          getStudyNotifications(),
          getMockSchedule(),
        ]);
        setNotifications(noteData);
        setMockSchedule(mockData);
      } catch (error) {
        console.error('Failed to fetch proactive coaching data', error);
      }
    };

    const fetchResourceStack = async () => {
      if (!user?.name) return;
      const topTask = dailyMission?.tasks?.[0];
      if (!topTask?.chapter || !topTask?.subject) return;
      setResourceLoading(true);
      try {
        const [stack, readiness] = await Promise.all([
          getResourceStack({
            subject: topTask.subject,
            chapter: topTask.chapter,
          }),
          getChapterReadiness({
            chapter: topTask.chapter,
          }),
        ]);
        setResourceStack(stack);
        setChapterReadiness(readiness);
      } catch (error) {
        console.error('Failed to fetch intelligent resource stack', error);
        setResourceStack(null);
        setChapterReadiness(null);
      } finally {
        setResourceLoading(false);
      }
    };

    fetchStats();
    fetchDailyMission();
    fetchProactiveCoaching();
    fetchResourceStack();

    const syncMaterials = async () => {
      if (!user?.name) return;
      const localMaterials = getStudyMaterials();
      for (const item of localMaterials.slice(0, 80)) {
        try {
          await saveMaterialToDatabase({
            id: item.id,
            type: item.type,
            title: item.title,
            subject: item.subject,
            chapter: item.chapter,
            content: item.content,
            url: item.url,
            imageDataUrl: item.imageDataUrl,
            createdAt: item.createdAt,
          });
        } catch {
          break;
        }
      }
    };

    const syncSnapshot = async () => {
      if (!user?.name) return;
      try {
        await syncUserSnapshot({
          user: user,
          activities: getActivities(),
          chatHistory: getChatHistory(),
          subjectStats: getSubjectStats(),
          bookmarks: getBookmarks(),
          materials: getStudyMaterials(),
        });
      } catch {
        // Keep dashboard resilient if snapshot sync fails.
      }
    };

    syncMaterials();
    syncSnapshot();
  }, [user?.name]);

  useEffect(() => {
    const loadStackForMission = async () => {
      if (!user?.name) return;
      const topTask = dailyMission?.tasks?.[0];
      if (!topTask?.chapter || !topTask?.subject) return;
      setResourceLoading(true);
      try {
        const [stack, readiness] = await Promise.all([
          getResourceStack({ subject: topTask.subject, chapter: topTask.chapter }),
          getChapterReadiness({ chapter: topTask.chapter }),
        ]);
        setResourceStack(stack);
        setChapterReadiness(readiness);
      } catch (error) {
        console.error('Failed to refresh resource stack for mission', error);
      } finally {
        setResourceLoading(false);
      }
    };
    loadStackForMission();
  }, [dailyMission?.mission_id, user?.name]);

  if (!user) {
    navigate('/onboarding');
    return null;
  }

  const handleParentReport = async () => {
    const parentEmail = prompt('Enter parent email address:')?.trim();
    if (!parentEmail) return;
    setReportLoading(true);
    try {
      const data = await sendParentReport({ parent_email: parentEmail });
      toast.success(data.message || 'Parent report processed.');
    } catch {
      toast.error('Report system offline. Try again in a moment!');
    } finally {
      setReportLoading(false);
    }
  };

  const handleDefinitionDrop = (term: string, droppedDefinition: string) => {
    const definitionAlreadyUsedBy = Object.entries(assignedMatches).find(([, definition]) => definition === droppedDefinition)?.[0];
    if (definitionAlreadyUsedBy) {
      setAssignedMatches((prev) => {
        const next = { ...prev };
        delete next[definitionAlreadyUsedBy];
        next[term] = droppedDefinition;
        return next;
      });
      return;
    }

    setAssignedMatches((prev) => ({ ...prev, [term]: droppedDefinition }));
  };

  const resetMatchingGame = () => {
    setAssignedMatches({});
    setDefinitionPool(shuffle(BASE_MATCH_ITEMS.map((item) => item.definition)));
  };

  const quickAccessTabs = [
    { label: 'Ask AI Tutor', hint: 'Instant doubt solving', action: () => navigate('/ask') },
    { label: 'Practice Zone', hint: 'Board-style tests', action: () => navigate('/practice') },
    { label: 'Flashcards', hint: 'Fast revision mode', action: () => navigate('/flashcards') },
    { label: 'Daily Plan', hint: 'Adaptive plan builder', action: () => navigate('/plan') },
    { label: 'Chapter Summary', hint: 'Smart notes + formulas', action: () => navigate('/summary') },
    { label: 'NCERT Library', hint: 'Books and worksheets', action: () => navigate('/library') },
    { label: 'Textbook Hub', hint: 'Stable chapter mission flow', action: () => navigate('/textbook-hub') },
    { label: 'File Upload', hint: 'Upload and analyze notes', action: () => navigate('/ask') },
  ];

  const openRecommendation = (rec: ReturnType<typeof getSmartRecommendations>[number]) => {
    const state = {
      subject: rec.subject || user.subjects?.[0] || 'Science',
      chapter: rec.chapter || '',
    };

    if (rec.action === 'practice') {
      navigate('/practice', { state: { ...state, questionType: 'past-paper', numQuestions: 5 } });
      return;
    }
    if (rec.action === 'library') {
      navigate('/library', { state });
      return;
    }
    navigate('/ask', { state });
  };

  const launchMissionTask = (task: DailyMissionResponse['tasks'][number]) => {
    if (task.route === '/practice') {
      navigate('/practice', { state: task.route_state });
      return;
    }
    if (task.route === '/library') {
      navigate('/library', { state: task.route_state });
      return;
    }
    navigate('/ask', { state: task.route_state });
  };

  const launchResourceStack = () => {
    if (!resourceStack) return;
    navigate('/practice', { state: resourceStack.test.state });
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-[#020617] transition-colors duration-300">
      <Navbar />
      <main className="max-w-7xl mx-auto px-6 py-10">
        {/* Hero Section with Glassmorphism */}
        <div className="relative overflow-hidden rounded-[32px] bg-gradient-to-br from-[#1D9E75] to-[#059669] p-10 mb-12 shadow-2xl shadow-[#1D9E75]/30">
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
            <div className="max-w-xl">
              <div className="inline-flex items-center px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-white text-xs font-bold mb-4 border border-white/30">
                <Zap size={14} className="mr-2" />
                {user.name.endsWith('_PRO') ? 'PRO STUDENT' : 'FREE TIER'}
              </div>
              <h1 className="text-4xl md:text-5xl font-black text-white mb-4 tracking-tight leading-tight">
                Hey {user.name}, ready to <span className="text-yellow-300">Ace Boards?</span>
              </h1>
              <p className="text-[#ecfdf5]/90 text-lg font-medium leading-relaxed">
                Class {user.class} • {user.school || 'CBSE Student'} • Gulf Board Prep Mode Active
              </p>
            </div>

            <div className="flex flex-col items-center bg-white/10 backdrop-blur-lg rounded-3xl p-6 border border-white/20 text-center min-w-[180px]">
              <Calendar className="text-yellow-300 mb-2" size={32} />
              <p className="text-xs uppercase font-bold text-white/70 tracking-widest mb-1">Board Countdown</p>
              <p className="text-4xl font-black text-white">{daysToExam}</p>
              <p className="text-[10px] text-white/50 mt-1 uppercase">Days Left</p>
            </div>
          </div>

          {/* Decorative shapes */}
          <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 w-96 h-96 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 translate-y-1/2 -translate-x-1/2 w-64 h-64 bg-black/10 rounded-full blur-2xl" />
        </div>

        {/* Action Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {[
            {
              label: 'Streak',
              value: (stats?.streak_days || 1) + ' Days',
              icon: <Flame className="text-orange-500" />,
              iconBg: 'bg-orange-50 dark:bg-orange-900/20',
              bubble: 'bg-orange-500/5',
            },
            {
              label: 'Q&A Solved',
              value: stats?.total_questions || 0,
              icon: <Brain className="text-pink-500" />,
              iconBg: 'bg-pink-50 dark:bg-pink-900/20',
              bubble: 'bg-pink-500/5',
            },
            {
              label: 'Accuracy',
              value: `${stats?.accuracy_rate ?? 0}%`,
              icon: <Target className="text-emerald-500" />,
              iconBg: 'bg-emerald-50 dark:bg-emerald-900/20',
              bubble: 'bg-emerald-500/5',
            },
            {
              label: 'Time Spent',
              value: `${(((stats?.estimated_study_minutes || 0) / 60) || 0).toFixed(1)} Hrs`,
              icon: <Clock className="text-blue-500" />,
              iconBg: 'bg-blue-50 dark:bg-blue-900/20',
              bubble: 'bg-blue-500/5',
            },
          ].map((stat, i) => (
            <Card key={i} className="group p-6 bg-white dark:bg-[#0f172a] border-none shadow-xl shadow-slate-200/50 dark:shadow-none hover:scale-[1.02] transition-all rounded-3xl overflow-hidden relative">
              <div className="relative z-10 flex items-center gap-5">
                <div className={`p-4 rounded-2xl ${stat.iconBg}`}>
                  {stat.icon}
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{stat.label}</p>
                  <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">{stat.value}</p>
                </div>
              </div>
              <div className={`absolute -right-4 -bottom-4 w-16 h-16 rounded-full group-hover:scale-150 transition-transform ${stat.bubble}`} />
            </Card>
          ))}
        </div>

        {(notifications?.notifications?.length || mockSchedule) && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-12">
            {mockSchedule && (
              <Card className="p-6 rounded-[28px] border-2 border-sky-200 dark:border-sky-800 bg-sky-50/80 dark:bg-sky-900/10">
                <p className="text-xs font-black uppercase tracking-widest text-sky-700 dark:text-sky-300 mb-2">Autonomous Mock Scheduler</p>
                <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-3">Next mock: {mockSchedule.next_mock_date}</h3>
                <p className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Difficulty: {mockSchedule.difficulty} • Readiness: {mockSchedule.readiness_score}/100</p>
                <div className="space-y-2 text-sm text-slate-700 dark:text-slate-300">
                  {mockSchedule.recovery_plan.map((item) => <p key={item}>• {item}</p>)}
                </div>
              </Card>
            )}
            {notifications && notifications.notifications.length > 0 && (
              <Card className="p-6 rounded-[28px] border-2 border-amber-200 dark:border-amber-800 bg-amber-50/80 dark:bg-amber-900/10">
                <p className="text-xs font-black uppercase tracking-widest text-amber-700 dark:text-amber-300 mb-2">Proactive Coach Notifications</p>
                <div className="space-y-4">
                  {notifications.notifications.map((note) => (
                    <div key={note.title} className="rounded-2xl bg-white/70 dark:bg-slate-900/40 p-4 border border-amber-200/60 dark:border-amber-800/60">
                      <p className="text-sm font-black text-slate-900 dark:text-white">{note.title}</p>
                      <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">{note.message}</p>
                      <p className="text-[10px] font-black uppercase tracking-widest text-amber-700 dark:text-amber-300 mt-2">{note.action}</p>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>
        )}

        <section className="mb-12">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Daily Auto Mission</h2>
            <span className="text-xs font-black text-slate-500 uppercase tracking-wider">Autonomous</span>
          </div>
          <Card className="p-6 bg-white dark:bg-[#0f172a] border-none shadow-xl rounded-3xl">
            {missionLoading && (
              <p className="text-sm text-slate-500">Building mission from your progress...</p>
            )}
            {!missionLoading && !dailyMission && (
              <p className="text-sm text-slate-500">Mission unavailable right now. Refresh dashboard in a moment.</p>
            )}
            {!missionLoading && dailyMission && (
              <>
                <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
                  <div>
                    <p className="text-lg font-black text-slate-900 dark:text-white">{dailyMission.headline}</p>
                    <p className="text-sm text-slate-500 mt-1">{dailyMission.summary}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-1 rounded-lg text-[10px] font-black uppercase bg-slate-100 text-slate-700">
                      {dailyMission.confidence}
                    </span>
                    <span className="px-2 py-1 rounded-lg text-[10px] font-black uppercase bg-emerald-100 text-emerald-700">
                      {dailyMission.estimated_total_minutes} min
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {dailyMission.tasks.map((task) => (
                    <div key={task.id} className="p-4 rounded-2xl border border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                      <p className="text-xs font-black uppercase tracking-wider text-[#1D9E75]">{task.kind}</p>
                      <p className="text-sm font-black text-slate-900 dark:text-white mt-1">{task.title}</p>
                      <p className="text-xs text-slate-500 mt-2">{task.reason}</p>
                      <p className="text-[11px] text-slate-400 mt-2">{task.subject} • {task.chapter} • {task.duration_minutes} min</p>
                      <div className="flex items-center gap-2 mt-2">
                        {typeof task.readiness_score === 'number' && (
                          <span className="px-2 py-1 rounded-lg text-[10px] font-black uppercase bg-sky-100 text-sky-700">Readiness {task.readiness_score}</span>
                        )}
                        {task.priority && (
                          <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase ${task.priority === 'high' ? 'bg-rose-100 text-rose-700' : task.priority === 'medium' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                            {task.priority}
                          </span>
                        )}
                      </div>
                      <Button className="mt-3 rounded-xl h-9 px-3 text-xs" onClick={() => launchMissionTask(task)}>
                        Start Task
                      </Button>
                    </div>
                  ))}
                </div>
                {dailyMission.chapter_ranking && dailyMission.chapter_ranking.length > 0 && (
                  <div className="mt-6 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                    <p className="text-xs font-black uppercase tracking-widest text-slate-500 mb-3">Chapter Readiness Ranking</p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {dailyMission.chapter_ranking.slice(0, 3).map((item) => (
                        <div key={item.chapter} className="rounded-xl p-3 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-700">
                          <p className="text-xs font-black text-slate-900 dark:text-white">{item.chapter}</p>
                          <p className="text-[11px] text-slate-500 mt-1">Readiness {item.readiness_score} • Accuracy {item.accuracy}%</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </Card>
        </section>

        <section className="mb-12">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Intelligent Resource Fetcher</h2>
            <span className="text-xs font-black text-slate-500 uppercase tracking-wider">One Start Button</span>
          </div>
          <Card className="p-6 bg-white dark:bg-[#0f172a] border-none shadow-xl rounded-3xl">
            {resourceLoading && <p className="text-sm text-slate-500">Preparing best stack for your weakest chapter...</p>}
            {!resourceLoading && !resourceStack && <p className="text-sm text-slate-500">No stack available yet. Complete one practice set to activate this.</p>}
            {!resourceLoading && resourceStack && (
              <>
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <p className="text-sm font-black text-slate-900 dark:text-white">{resourceStack.subject} • {resourceStack.chapter}</p>
                    <p className="text-xs text-slate-500 mt-1">{resourceStack.textbook_section}</p>
                  </div>
                  {chapterReadiness && (
                    <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase ${chapterReadiness.priority === 'high' ? 'bg-rose-100 text-rose-700' : chapterReadiness.priority === 'medium' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                      Readiness {chapterReadiness.readiness_score}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
                  <div className="p-3 rounded-xl border border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                    <p className="text-[11px] font-black uppercase tracking-wider text-slate-500">Explanation</p>
                    <p className="text-xs text-slate-700 dark:text-slate-300 mt-1">{resourceStack.explanation}</p>
                  </div>
                  <div className="p-3 rounded-xl border border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                    <p className="text-[11px] font-black uppercase tracking-wider text-slate-500">Worksheet</p>
                    <p className="text-xs text-slate-700 dark:text-slate-300 mt-1">{resourceStack.worksheet.title} • {resourceStack.worksheet.num_questions} Q</p>
                  </div>
                  <div className="p-3 rounded-xl border border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                    <p className="text-[11px] font-black uppercase tracking-wider text-slate-500">Test</p>
                    <p className="text-xs text-slate-700 dark:text-slate-300 mt-1">{resourceStack.test.title} • {resourceStack.test.num_questions} Q</p>
                  </div>
                </div>
                <Button className="mt-4 rounded-xl bg-[#1D9E75] hover:bg-[#16805d]" onClick={launchResourceStack}>
                  Start Full Stack
                </Button>
              </>
            )}
          </Card>
        </section>

        <section className="mb-12">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Study Control Center</h2>
            <span className="text-xs font-black text-slate-500 uppercase tracking-wider">One-tap actions</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Ask AI Tutor', desc: 'Clarify difficult concepts quickly', action: () => navigate('/ask'), tone: 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300' },
              { label: 'Practice Session', desc: 'Attempt graded board-style questions', action: () => navigate('/practice'), tone: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300' },
              { label: 'Flashcard Sprint', desc: 'Rapid recall and memory revision', action: () => navigate('/flashcards'), tone: 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300' },
              { label: 'Summary Builder', desc: 'Generate chapter summary sheets', action: () => navigate('/summary'), tone: 'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300' },
            ].map((item) => (
              <Card key={item.label} className="p-5 bg-white dark:bg-[#0f172a] border-none shadow-lg rounded-2xl">
                <p className="text-sm font-black text-slate-900 dark:text-white">{item.label}</p>
                <p className="text-xs text-slate-500 mt-2 mb-4">{item.desc}</p>
                <button
                  onClick={item.action}
                  className={`w-full py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-opacity hover:opacity-90 ${item.tone}`}
                >
                  Launch
                </button>
              </Card>
            ))}
          </div>
        </section>

        <section className="mb-12">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Smart Recommendations</h2>
            <span className="text-xs font-black text-slate-500 uppercase tracking-wider">Auto-prioritized</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {smartRecommendations.map((rec) => (
              <Card key={rec.id} className="p-5 bg-white dark:bg-[#0f172a] border-none shadow-lg rounded-2xl">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-black text-slate-900 dark:text-white">{rec.title}</p>
                    <p className="text-xs text-slate-500 mt-1">{rec.reason}</p>
                    {(rec.subject || rec.chapter) && (
                      <p className="text-[11px] text-slate-400 mt-2">{rec.subject || ''}{rec.subject && rec.chapter ? ' • ' : ''}{rec.chapter || ''}</p>
                    )}
                  </div>
                  <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase ${rec.priority === 'high' ? 'bg-rose-100 text-rose-700' : rec.priority === 'medium' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
                    {rec.priority}
                  </span>
                </div>
                <Button className="mt-4 rounded-xl" onClick={() => openRecommendation(rec)}>
                  Start Now
                </Button>
              </Card>
            ))}
          </div>
        </section>

        <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
          <aside className="xl:col-span-1 space-y-6">
            <Card className="p-5 bg-white dark:bg-[#0f172a] border-none shadow-xl rounded-3xl xl:sticky xl:top-24">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-black uppercase tracking-wider text-slate-500">Left Control Tabs</h3>
                <span className="text-[10px] font-black text-[#1D9E75] uppercase">Quick</span>
              </div>
              <div className="space-y-2">
                {quickAccessTabs.map((tab) => (
                  <button
                    key={tab.label}
                    onClick={tab.action}
                    className="w-full text-left px-3 py-3 rounded-xl border border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 hover:border-[#1D9E75]/40 hover:bg-[#1D9E75]/5 transition-all"
                  >
                    <p className="text-sm font-black text-slate-900 dark:text-white">{tab.label}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">{tab.hint}</p>
                  </button>
                ))}
              </div>
            </Card>
          </aside>

          <div className="xl:col-span-2 space-y-10">
            {/* Subjects Section */}
            <section>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center">
                  <BookOpen className="text-[#1D9E75] mr-3" size={24} />
                  My Subjects
                </h2>
                <Button variant="ghost" className="text-slate-500">Edit Subjects</Button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {user.subjects.map((subject: string) => (
                  <Card
                    key={subject}
                    className="p-6 bg-white dark:bg-[#0f172a] border-none shadow-lg hover:shadow-2xl hover:shadow-[#1D9E75]/20 cursor-pointer transition-all rounded-3xl group border-l-4 border-[#1D9E75]"
                    onClick={() => navigate('/ask', { state: { subject } })}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-5">
                        <div className="w-14 h-14 bg-slate-50 dark:bg-slate-800 rounded-2xl flex items-center justify-center text-2xl font-black text-[#1D9E75]">
                          {subject[0]}
                        </div>
                        <div>
                          <h3 className="font-bold text-lg text-slate-900 dark:text-white group-hover:text-[#1D9E75] transition-colors">{subject}</h3>
                          <p className="text-xs text-slate-500 font-medium">Class {user.class} • NCERT</p>
                        </div>
                      </div>
                      <div className="w-10 h-10 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center text-slate-400 group-hover:bg-[#1D9E75] group-hover:text-white transition-all">
                        <ArrowRight size={20} />
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </section>

            {/* Autonomous Recommendations */}
            <section>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center">
                  <Sparkles className="text-yellow-500 mr-3" size={24} />
                  AI Study Strategy
                </h2>
                <span className="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-500 text-[10px] font-black rounded-full uppercase tracking-tighter">Updated Live</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="p-8 bg-white dark:bg-[#0f172a] border-none shadow-xl rounded-[32px] relative overflow-hidden group">
                  <div className="relative z-10">
                    <div className="flex items-center justify-between mb-6">
                      <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl text-[#1D9E75]">
                        <Calendar size={24} />
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Next Exam</p>
                        <p className="text-sm font-bold text-slate-900 dark:text-white">Science • 12 Days</p>
                      </div>
                    </div>
                    <h3 className="text-xl font-black text-slate-900 dark:text-white mb-2">Autonomous Study Plan</h3>
                    <p className="text-sm text-slate-500 mb-6 leading-relaxed">
                      System detected focus on {user.subjects[0]}. Recommended next: {user.subjects[1] || 'Practice Test'}.
                    </p>
                    <div className="space-y-3 mb-8">
                      {['Review Life Processes', 'Solve 5-mark Numerical', 'Mock MCQ Test'].map((task, i) => (
                        <div key={i} className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-700">
                          <div className="w-5 h-5 rounded-full border-2 border-[#1D9E75] flex items-center justify-center">
                            <input type="checkbox" className="w-3 h-3 accent-[#1D9E75] cursor-pointer" />
                          </div>
                          <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{task}</span>
                        </div>
                      ))}
                    </div>
                    <Button
                      className="w-full bg-slate-900 dark:bg-white dark:text-slate-900 hover:bg-slate-800 rounded-2xl font-black py-6"
                      onClick={() => navigate('/practice')}
                    >
                      Execute Plan
                    </Button>
                  </div>
                </Card>

                <Card className="p-8 bg-[#1D9E75] text-black border-none shadow-xl rounded-[32px] relative overflow-hidden">
                  <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="p-3 bg-white/60 backdrop-blur-md rounded-2xl">
                        <Target size={24} />
                      </div>
                      <h3 className="text-xl font-black text-black">Mastery Insights</h3>
                    </div>
                    <div className="space-y-6">
                      <div>
                        <div className="flex justify-between text-xs font-black uppercase tracking-widest mb-2">
                          <span>Concept Mastery</span>
                          <span>78%</span>
                        </div>
                        <div className="h-3 bg-black/15 rounded-full overflow-hidden">
                          <div className="h-full bg-yellow-300 rounded-full" style={{ width: '78%' }} />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-xs font-black uppercase tracking-widest mb-2">
                          <span>Board Readiness</span>
                          <span>62%</span>
                        </div>
                        <div className="h-3 bg-black/15 rounded-full overflow-hidden">
                          <div className="h-full bg-black rounded-full" style={{ width: '62%' }} />
                        </div>
                      </div>
                    </div>
                    <div className="mt-8 p-4 bg-white/50 rounded-2xl border border-black/10">
                      <p className="text-xs font-medium leading-relaxed italic text-black/80">
                        "Your speed in numericals has improved by 15% this week. Focus on balancing equations next."
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      className="w-full mt-6 text-black hover:bg-black/10 font-bold border border-black/20 rounded-2xl"
                      onClick={handleParentReport}
                      disabled={reportLoading}
                    >
                      {reportLoading ? 'Sending via Resend...' : 'Send Weekly Parent Report'}
                    </Button>
                  </div>
                  <div className="absolute -right-16 -bottom-16 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
                </Card>
              </div>
            </section>

            {/* Interactive Study Arena */}
            <section>
              <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center">
                  <Trophy className="text-[#1D9E75] mr-3" size={24} />
                  Interactive Study Arena
                </h2>
                <span className="px-3 py-1 bg-emerald-50 dark:bg-emerald-900/20 text-[#1D9E75] text-[10px] font-black rounded-full uppercase tracking-wider">
                  Drag • Match
                </span>
              </div>

              <div className="grid grid-cols-1 gap-6">
                <Card className="p-6 bg-white dark:bg-[#0f172a] border-none shadow-xl rounded-[28px]">
                  <div className="flex items-center justify-between mb-5">
                    <div>
                      <h3 className="text-lg font-black text-slate-900 dark:text-white">Concept Matching</h3>
                      <p className="text-xs text-slate-500 font-semibold">Drag each definition to the right term.</p>
                    </div>
                    <Button variant="ghost" className="text-slate-500" onClick={resetMatchingGame}>
                      <RotateCcw size={14} className="mr-2" /> Reset
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 gap-3 mb-5">
                    {BASE_MATCH_ITEMS.map((item) => {
                      const assigned = assignedMatches[item.term];
                      const correct = assigned === item.definition;
                      return (
                        <div
                          key={item.term}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => {
                            e.preventDefault();
                            const droppedDefinition = e.dataTransfer.getData('text/plain');
                            if (!droppedDefinition) return;
                            handleDefinitionDrop(item.term, droppedDefinition);
                          }}
                          className={`p-4 rounded-2xl border-2 transition-colors ${correct
                            ? 'border-emerald-300 bg-emerald-50 dark:bg-emerald-900/20'
                            : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70'
                            }`}
                        >
                          <p className="text-sm font-black text-slate-900 dark:text-white mb-2">{item.term}</p>
                          <p className={`text-xs font-semibold ${assigned ? 'text-slate-700 dark:text-slate-200' : 'text-slate-400'}`}>
                            {assigned || 'Drop definition here'}
                          </p>
                        </div>
                      );
                    })}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {definitionPool.map((definition) => {
                      const isUsed = Object.values(assignedMatches).includes(definition);
                      return (
                        <button
                          key={definition}
                          draggable={!isUsed}
                          onDragStart={(e) => {
                            if (isUsed) return;
                            e.dataTransfer.setData('text/plain', definition);
                          }}
                          className={`p-3 rounded-xl text-left text-xs font-bold border transition-all ${isUsed
                            ? 'border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                            : 'border-[#1D9E75]/30 bg-[#1D9E75]/5 text-slate-700 dark:text-slate-200 cursor-grab active:cursor-grabbing hover:bg-[#1D9E75]/10'
                            }`}
                        >
                          {definition}
                        </button>
                      );
                    })}
                  </div>

                  <p className="mt-4 text-xs font-black text-[#1D9E75] uppercase tracking-wider">
                    Score: {solvedMatches}/{BASE_MATCH_ITEMS.length} {isMatchingComplete ? '• Perfect Match!' : ''}
                  </p>
                </Card>
              </div>
            </section>

            {/* Activity Feed */}
            <section>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6 flex items-center">
                <History className="text-[#1D9E75] mr-3" size={24} />
                Recent Learning
              </h2>
              <Card className="bg-white dark:bg-[#0f172a] border-none shadow-xl rounded-[32px] overflow-hidden">
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {recentActivity.length > 0 ? (
                    [...recentActivity].reverse().slice(0, 5).map((activity: StatsResponse['recent_activity'][number], index: number) => (
                      <div key={index} className="p-6 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors flex items-center justify-between">
                        <div className="flex items-center gap-5">
                          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${activity.action === 'question' ? 'bg-purple-100 text-purple-600' : 'bg-emerald-100 text-emerald-600'
                            }`}>
                            {activity.action === 'question' ? <Brain size={24} /> : <Target size={24} />}
                          </div>
                          <div>
                            <p className="font-bold text-slate-900 dark:text-white">
                              {activity.action === 'question' ? 'AI Consultation' : 'Practice Drill'} in {activity.subject}
                            </p>
                            <p className="text-sm text-slate-500">{activity.chapter}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-bold text-slate-400 mb-1 uppercase tracking-tighter">
                            {new Date(activity.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                          </p>
                          <p className="text-xs text-slate-400">
                            {new Date(activity.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-16 text-center">
                      <div className="w-20 h-20 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                        <History size={32} className="text-slate-300" />
                      </div>
                      <p className="text-slate-500 font-medium">Your study journey starts here.</p>
                      <Button className="mt-6 bg-[#1D9E75] hover:bg-[#16805d]" onClick={() => navigate('/ask')}>Ask your first question</Button>
                    </div>
                  )}
                </div>
              </Card>
            </section>
          </div>

          {/* Right Sidebar */}
          <div className="xl:col-span-1 space-y-8">
            {/* Pro Upgrade Card */}
            {!user.name.endsWith('_PRO') && (
              <Card className="p-8 bg-yellow-300 text-black border-none rounded-[32px] shadow-2xl relative overflow-hidden group">
                <div className="relative z-10">
                  <div className="w-12 h-12 bg-yellow-400 rounded-2xl flex items-center justify-center mb-6">
                    <Award className="text-slate-900" size={28} />
                  </div>
                  <h3 className="text-2xl font-black mb-3 leading-tight text-black">Master Pro Access</h3>
                  <p className="text-black/80 text-sm mb-8 leading-relaxed">
                    Unlock Unlimited Vision AI, handwritten notes scanner, and Mock Exams for <span className="text-black font-bold">50 AED/mo.</span>
                  </p>
                  <Button
                    className="w-full !bg-white !text-black hover:!bg-slate-100 font-black py-6 rounded-2xl text-lg transition-transform active:scale-95"
                    onClick={() => navigate('/settings')}
                  >
                    Upgrade Now
                  </Button>
                </div>
                <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-[#1D9E75]/20 rounded-full blur-[60px] group-hover:scale-150 transition-transform duration-700" />
              </Card>
            )}

            {/* Weak Topics */}
            <Card className="p-8 bg-white dark:bg-[#0f172a] border-none rounded-[32px] shadow-xl">
              <h3 className="font-bold text-xl text-slate-900 dark:text-white mb-6">Review Needed</h3>
              <div className="space-y-4">
                {weakTopics.length > 0 ? (
                  weakTopics.map((topic: string) => (
                    <div key={topic} className="group flex items-center justify-between p-4 bg-red-50 dark:bg-red-900/10 rounded-2xl hover:bg-red-100 dark:hover:bg-red-900/20 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                        <span className="text-sm text-red-700 dark:text-red-300 font-bold">{topic}</span>
                      </div>
                      <ArrowRight size={16} className="text-red-400 group-hover:translate-x-1 transition-transform" />
                    </div>
                  ))
                ) : (
                  <div className="text-center py-6">
                    <Target className="text-slate-200 dark:text-slate-800 mx-auto mb-2" size={40} />
                    <p className="text-xs text-slate-500">Practice more to see topics that need focus.</p>
                  </div>
                )}
              </div>
            </Card>

            {/* Study Streak Card */}
            <Card className="p-8 bg-white dark:bg-[#0f172a] border-none rounded-[32px] shadow-xl text-center">
              <h3 className="font-bold text-lg text-slate-900 dark:text-white mb-4">Weekly Goal</h3>
              <div className="flex justify-between items-end h-24 gap-2 px-2">
                {[40, 70, 45, 90, 60, 30, 0].map((h, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center">
                    <div
                      className={`w-full rounded-t-lg transition-all duration-500 ${i === 3 ? 'bg-[#1D9E75]' : 'bg-slate-100 dark:bg-slate-800'}`}
                      style={{ height: h + '%' }}
                    />
                    <span className="text-[10px] mt-2 font-bold text-slate-400 uppercase">
                      {['M', 'T', 'W', 'T', 'F', 'S', 'S'][i]}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
};
