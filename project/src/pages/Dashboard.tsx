import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Target, Flame, Clock, ArrowRight, Brain, History, Calendar, Zap, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';
import { Navbar } from '../components/layout/Navbar';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { getActivities, getBookmarks, getChatHistory, getStudyMaterials, getSubjectStats, getUser } from '../utils/storage';
import { getStats, sendParentReport, getDailyMission, getStudyNotifications, getMockSchedule, getResourceStack, getChapterReadiness, saveMaterialToDatabase, syncUserSnapshot, getRecommendations, type StatsResponse, type DailyMissionResponse, type StudyNotificationResponse, type MockScheduleResponse, type ResourceStackResponse, type ChapterReadinessResponse, type RecommendationItem } from '../api';

export const Dashboard = () => {
  const navigate = useNavigate();
  const user = getUser();
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [dismissedParentNote, setDismissedParentNote] = useState(() => localStorage.getItem('clarity_parent_note_dismissed') || '');
  const [dailyMission, setDailyMission] = useState<DailyMissionResponse | null>(null);
  const [missionLoading, setMissionLoading] = useState(false);
  const [daysToExam, setDaysToExam] = useState(0);
  const [reportLoading, setReportLoading] = useState(false);
  const [notifications, setNotifications] = useState<StudyNotificationResponse | null>(null);
  const [mockSchedule, setMockSchedule] = useState<MockScheduleResponse | null>(null);
  const [resourceStack, setResourceStack] = useState<ResourceStackResponse | null>(null);
  const [chapterReadiness, setChapterReadiness] = useState<ChapterReadinessResponse | null>(null);
  const [resourceLoading, setResourceLoading] = useState(false);
  const [recommendations, setRecommendations] = useState<RecommendationItem[]>([]);
  const [isEditingDate, setIsEditingDate] = useState(false);
  const [editDateValue, setEditDateValue] = useState(() => localStorage.getItem('clarity_exam_date') || '');
  const [otherDates, setOtherDates] = useState<Array<{ id: string; label: string; date: string }>>([]);
  const planTier = user?.subscriptionTier || 'free';
  const isPaidPlan = planTier === 'pro' || planTier === 'pro_max';
  const isTrial = user?.subscriptionStatus === 'trialing';
  let trialDaysLeft = 0;
  if (isTrial && user?.trialEnd) {
    try {
      const diff = new Date(user.trialEnd).getTime() - Date.now();
      trialDaysLeft = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
    } catch (e) {
      console.error("Error calculating trial days:", e);
    }
  }
  const recentActivity = stats?.recent_activity ?? [];

  useEffect(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const savedExamDate = localStorage.getItem('clarity_exam_date');
    let examDate: Date;
    if (savedExamDate) {
      examDate = new Date(savedExamDate);
    } else {
      const now = new Date();
      const boardYear = now.getMonth() <= 2 ? now.getFullYear() : now.getFullYear() + 1;
      examDate = new Date(`${boardYear}-02-15`);
      localStorage.setItem('clarity_exam_date', `${boardYear}-02-15`);
    }
    examDate.setHours(0, 0, 0, 0);

    const diffTime = examDate.getTime() - today.getTime();
    const diffDays = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
    setDaysToExam(diffDays);

    const savedOtherDates = localStorage.getItem('clarity_other_dates');
    if (savedOtherDates) {
      try {
        setOtherDates(JSON.parse(savedOtherDates));
      } catch (e) {
        console.error(e);
      }
    }

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

    const fetchRecommendations = async () => {
      if (!user?.name) return;
      try {
        const data = await getRecommendations();
        setRecommendations(data.recommendations || []);
      } catch (error) {
        console.error('Failed to fetch recommendations', error);
        setRecommendations([]);
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
    fetchRecommendations();
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dailyMission?.mission_id, user?.name]);

  const handleParentReport = async () => {
    setReportLoading(true);
    try {
      // Include credentials in report if needed - though usually handled by backend with user context
      const data = await sendParentReport();
      toast.success(data.message || 'Weekly report sent to your parents.');
      localStorage.setItem('ncertai_last_report', Date.now().toString());
    } catch {
      toast.error('Report system offline. Try again in a moment!');
    } finally {
      setReportLoading(false);
    }
  };

  useEffect(() => {
    if (!user?.name) return;

    // Automated weekly report logic
    const lastReport = localStorage.getItem('ncertai_last_report');
    const oneWeek = 7 * 24 * 60 * 60 * 1000;
    if (!lastReport || (Date.now() - parseInt(lastReport)) > oneWeek) {
      handleParentReport();
    }

    // Weekly focus reminder
    const lastFocusUpdate = localStorage.getItem('ncertai_last_focus_update');
    if (!lastFocusUpdate || (Date.now() - parseInt(lastFocusUpdate)) > oneWeek) {
      toast('Time to update your school focus for this week!', {
        icon: '🎯',
        duration: 6000,
      });
    }
  }, [user?.name]);

  if (!user) {
    navigate('/onboarding');
    return null;
  }

  const openRecommendation = (rec: RecommendationItem) => {
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

  const handleUpdateFocus = () => {
    localStorage.setItem('ncertai_last_focus_update', Date.now().toString());
    navigate('/onboarding', { state: { editFocus: true } });
  };

  const focusChaptersMap = user?.focusChapters || {};
  const hasFocus = Object.values(focusChaptersMap).some(list => list.length > 0);

  // Mark unused variables as read for TypeScript compiler
  void missionLoading;
  void notifications;
  void resourceLoading;
  void recommendations;
  void openRecommendation;
  void launchMissionTask;
  void launchResourceStack;

  return (
    <div className="min-h-screen bg-[#f8fafc] transition-colors duration-300">
      <Navbar />
      <main className="max-w-[1600px] mx-auto px-6 py-10">
        {/* Hero Section with Glassmorphism */}
        <div className="relative overflow-hidden rounded-[32px] bg-gradient-to-br from-[#8C5A35] to-[#059669] p-10 mb-12 shadow-2xl shadow-[#8C5A35]/30">
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
            <div className="max-w-xl">
              <div className="inline-flex items-center px-3 py-1 bg-[#FCFAF8]/20 backdrop-blur-md rounded-full text-white text-xs font-bold mb-4 border border-white/30">
                <Zap size={14} className="mr-2" />
                {isTrial 
                  ? `${planTier.toUpperCase().replace('_', ' ')} TRIAL (${trialDaysLeft} days left)` 
                  : isPaidPlan 
                    ? `PAID PLAN: ${planTier.toUpperCase().replace('_', ' ')}` 
                    : 'FREE TIER'}
              </div>
              <h1 className="text-4xl md:text-5xl font-black text-white mb-4 tracking-tight leading-tight">
                Hey {user.name}, ready to <span className="text-yellow-300">{(user.class === 10 || user.class === 12) ? "Ace Boards?" : "Ace Exams?"}</span>
              </h1>
              <p className="text-[#ecfdf5]/90 text-lg font-medium leading-relaxed">
                Class {user.class} • {user.school || 'CBSE Student'} • {user.parentEmail ? 'Parent-linked account active' : 'No parent email on file'}
              </p>
            </div>

            <div className="flex flex-col items-center bg-[#FCFAF8]/10 backdrop-blur-lg rounded-3xl p-6 border border-white/20 text-center min-w-[200px] relative group">
              {isEditingDate ? (
                <div className="flex flex-col items-center gap-2">
                  <input
                    type="date"
                    value={editDateValue}
                    onChange={(e) => setEditDateValue(e.target.value)}
                    className="px-2 py-1 text-xs font-bold text-[#3E352B] bg-[#FCFAF8] rounded border border-white/30 outline-none w-full"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        if (editDateValue) {
                          localStorage.setItem('clarity_exam_date', editDateValue);
                          const examDate = new Date(editDateValue);
                          examDate.setHours(0, 0, 0, 0);
                          const today = new Date();
                          today.setHours(0, 0, 0, 0);
                          const diffTime = examDate.getTime() - today.getTime();
                          const diffDays = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
                          setDaysToExam(diffDays);
                        }
                        setIsEditingDate(false);
                      }}
                      className="px-2 py-0.5 bg-yellow-300 hover:bg-yellow-400 text-[#2C241B] rounded font-black text-[10px] uppercase tracking-wider transition-all"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setIsEditingDate(false)}
                      className="px-2 py-0.5 bg-[#FCFAF8]/20 hover:bg-[#FCFAF8]/30 text-white rounded font-bold text-[10px] uppercase transition-all"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <Calendar className="text-yellow-300 mb-1" size={28} />
                  <p className="text-xs uppercase font-bold text-white/90 tracking-widest mb-1">
                    {(user.class === 10 || user.class === 12) ? "Board Countdown" : "Exam Countdown"}
                  </p>
                  <p className="text-4xl font-black text-white">{daysToExam}</p>
                  <p className="text-[10px] text-white/70 mt-1 uppercase">Days Left</p>
                  
                  <button 
                    onClick={() => {
                      setEditDateValue(localStorage.getItem('clarity_exam_date') || '');
                      setIsEditingDate(true);
                    }}
                    className="absolute top-2 right-2 p-1.5 rounded-lg bg-[#FCFAF8]/10 hover:bg-[#FCFAF8]/20 text-white transition-all"
                    title="Change Exam Date"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Decorative shapes */}
          <div className="absolute top-0 right-0 -transtone-y-1/2 transtone-x-1/2 w-96 h-96 bg-[#FCFAF8]/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 transtone-y-1/2 -transtone-x-1/2 w-64 h-64 bg-black/10 rounded-full blur-2xl" />
        </div>

        {/* Parent Note Message */}
        {(() => {
          const activeParentNote = stats?.parent_note || localStorage.getItem('clarity_parent_note') || '';
          const showParentNote = activeParentNote && activeParentNote !== dismissedParentNote;
          if (!showParentNote) return null;
          return (
            <Card className="p-6 mb-8 bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-200 rounded-[28px] flex items-center justify-between gap-4 shadow-md transition-all duration-300">
              <div className="flex items-center gap-3">
                <span className="text-2xl">✉️</span>
                <div>
                  <p className="text-xs font-black uppercase tracking-wider text-amber-600 ">Message from parent</p>
                  <p className="text-sm font-bold text-[#3E352B] mt-0.5">"{activeParentNote}"</p>
                </div>
              </div>
              <button 
                onClick={() => {
                  localStorage.setItem('clarity_parent_note_dismissed', activeParentNote);
                  localStorage.removeItem('clarity_parent_note');
                  setDismissedParentNote(activeParentNote);
                  toast.success('Message dismissed.');
                }}
                className="text-stone-400 hover:text-stone-650 text-xs font-black"
              >
                Dismiss
              </button>
            </Card>
          );
        })()}

        {/* Missing Profile Info Callout */}
        {(!user.teacherPersonality || !hasFocus) && (
          <Card className="p-8 mb-12 bg-rose-50 border-2 border-rose-200 rounded-[32px] flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-rose-100 rounded-2xl flex items-center justify-center text-rose-600">
                <Sparkles size={32} />
              </div>
              <div>
                <h3 className="text-xl font-black text-[#2C241B] ">Complete Your Study OS Setup</h3>
                <p className="text-sm text-stone-500 font-medium">You haven't set your {!user.teacherPersonality ? 'Teacher Personality' : 'School Focus'} yet. This is required for AI personalization.</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button
                variant="outline"
                className="border-stone-300 text-stone-650 font-black px-6 py-4 rounded-xl text-sm"
                onClick={() => navigate('/textbook-hub')}
              >
                Upload Textbook PDFs
              </Button>
              <Button
                className="bg-rose-600 hover:bg-rose-700 text-white font-black px-8 py-6 rounded-2xl"
                onClick={() => navigate('/onboarding', { state: { editFocus: true } })}
              >
                Finish Setup
              </Button>
            </div>
          </Card>
        )}

        {/* Active School Focus Week Callout */}
        {user.teacherPersonality && hasFocus && (
          <Card className="p-8 mb-12 bg-gradient-to-r from-amber-50/50 to-teal-50/50 border-2 border-amber-100 rounded-[32px] flex flex-col lg:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4 flex-1">
              <div className="w-14 h-14 bg-gradient-to-br from-[#8C5A35] to-amber-600 rounded-2xl flex items-center justify-center text-white flex-shrink-0 shadow-lg shadow-amber-500/20">
                <Target size={28} />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-black text-[#2C241B] ">Active School Focus Week</h3>
                <div className="flex flex-wrap gap-2 mt-3">
                  {Object.entries(focusChaptersMap).map(([subj, chaps]) => {
                    if (!chaps || chaps.length === 0) return null;
                    return (
                      <span key={subj} className="text-xs bg-[#FCFAF8] border border-stone-200 text-stone-700 font-bold px-3 py-1.5 rounded-xl shadow-sm">
                        <strong className="text-[#8C5A35]">{subj}:</strong> {chaps.join(', ')}
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button
                variant="outline"
                className="border-[#8C5A35]/30 hover:bg-[#8C5A35]/5 text-[#8C5A35] font-black px-6 py-4 rounded-xl text-sm"
                onClick={() => navigate('/textbook-hub')}
              >
                Upload Textbook PDFs
              </Button>
              <Button
                className="bg-[#8C5A35] hover:bg-[#70482B] text-white font-black px-6 py-4 rounded-xl text-sm flex items-center gap-2 transition-all transform hover:scale-[1.02]"
                onClick={handleUpdateFocus}
              >
                <Zap size={16} />
                Change Focus Chapters
              </Button>
            </div>
          </Card>
        )}

        {/* Action Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          {[
            {
              label: 'Streak',
              value: (stats?.streak_days || 1) + ' Days',
              icon: <Flame className="text-orange-500" />,
              iconBg: 'bg-orange-50 ',
              bubble: 'bg-orange-500/5',
            },
            {
              label: 'Q&A Solved',
              value: stats?.total_questions || 0,
              icon: <Brain className="text-pink-500" />,
              iconBg: 'bg-pink-50 ',
              bubble: 'bg-pink-500/5',
            },
            {
              label: 'Accuracy',
              value: `${stats?.accuracy_rate ?? 0}%`,
              icon: <Target className="text-amber-500" />,
              iconBg: 'bg-amber-50 ',
              bubble: 'bg-amber-500/5',
            },
            {
              label: 'Time Spent',
              value: `${(((stats?.estimated_study_minutes || 0) / 60) || 0).toFixed(1)} Hrs`,
              icon: <Clock className="text-blue-500" />,
              iconBg: 'bg-blue-50 ',
              bubble: 'bg-blue-500/5',
            },
          ].map((stat, i) => (
            <Card key={i} className="group p-8 bg-[#FCFAF8] border-none shadow-xl shadow-stone-200/50 hover:scale-[1.02] transition-all rounded-[32px] overflow-hidden relative">
              <div className="relative z-10 flex items-center gap-5">
                <div className={`p-5 rounded-2xl ${stat.iconBg}`}>
                  {stat.icon}
                </div>
                <div>
                  <p className="text-xs font-bold text-stone-500 uppercase tracking-wider">{stat.label}</p>
                  <p className="text-3xl font-black text-[#2C241B] mt-1">{stat.value}</p>
                </div>
              </div>
              <div className={`absolute -right-4 -bottom-4 w-24 h-24 rounded-full group-hover:scale-150 transition-transform ${stat.bubble}`} />
            </Card>
          ))}
        </div>

        <div className="space-y-12">
          {/* Upcoming Key Dates Section */}
          <section className="mb-12 animate-in fade-in duration-300">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-[#2C241B] flex items-center">
                <Calendar className="text-[#8C5A35] mr-3" size={24} />
                Upcoming Deadlines & Milestones
              </h2>
              <Button onClick={() => navigate('/plan')} variant="ghost" className="text-[#8C5A35] font-black text-sm">
                Manage Key Dates →
              </Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {/* Main Exam Date Card */}
              <Card className="p-6 bg-gradient-to-br from-amber-50/50 to-teal-55/50 border-2 border-amber-100 rounded-3xl">
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-700 ">
                  {(user.class === 10 || user.class === 12) ? "Board Examination" : "Final Examination"}
                </span>
                <h3 className="font-black text-lg text-[#2C241B] mt-1">
                  {localStorage.getItem('clarity_exam_date')
                    ? new Date(localStorage.getItem('clarity_exam_date')!).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
                    : 'Feb 15, 2026'}
                </h3>
                <p className="text-xs text-stone-500 font-medium mt-2">
                  {daysToExam > 0 ? `${daysToExam} days remaining` : 'Exam day! Good luck!'}
                </p>
              </Card>

              {/* Custom dates cards */}
              {otherDates.slice(0, 3).map((item) => {
                const dateObj = new Date(item.date);
                dateObj.setHours(0, 0, 0, 0);
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const diff = dateObj.getTime() - today.getTime();
                const days = Math.ceil(diff / (1000 * 60 * 60 * 24));

                return (
                  <Card key={item.id} className="p-6 bg-[#FCFAF8] border border-stone-100 rounded-3xl">
                    <span className="text-[10px] font-black uppercase tracking-wider text-stone-400">Custom Milestone</span>
                    <h3 className="font-bold text-base text-[#2C241B] mt-1 truncate">{item.label}</h3>
                    <p className="text-sm font-black text-[#8C5A35] mt-1">
                      {new Date(item.date).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                    </p>
                    <p className="text-xs text-stone-500 font-medium mt-2">
                      {days > 0 ? `${days} days left` : days === 0 ? 'Today!' : 'Passed'}
                    </p>
                  </Card>
                );
              })}

              {otherDates.length === 0 && (
                <div className="lg:col-span-3 p-6 flex items-center justify-center bg-[#FCFAF8] rounded-3xl border-2 border-dashed border-stone-200 ">
                  <p className="text-xs text-stone-400 font-bold">No custom monthly test or quiz deadlines added yet. Go to Plan to add key dates!</p>
                </div>
              )}
            </div>
          </section>

          {/* Subjects Section */}
          <section>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-[#2C241B] flex items-center">
                <BookOpen className="text-[#8C5A35] mr-3" size={24} />
                My Subjects
              </h2>
              <Button onClick={() => navigate('/profile')} variant="ghost" className="text-stone-500 font-bold">Edit Subjects</Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {user.subjects.map((subject: string) => (
                <Card
                  key={subject}
                  className="p-6 bg-[#FCFAF8] border-none shadow-lg hover:shadow-2xl hover:shadow-[#8C5A35]/20 cursor-pointer transition-all rounded-3xl group border-l-4 border-[#8C5A35]"
                  onClick={() => navigate('/ask', { state: { subject } })}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-5">
                      <div className="w-14 h-14 bg-[#FCFAF8] rounded-2xl flex items-center justify-center text-2xl font-black text-[#8C5A35]">
                        {subject[0]}
                      </div>
                      <div>
                        <h3 className="font-bold text-lg text-[#2C241B] group-hover:text-[#8C5A35] transition-colors">{subject}</h3>
                        <p className="text-xs text-stone-500 font-medium">Class {user.class} • NCERT</p>
                      </div>
                    </div>
                    <div className="w-10 h-10 bg-[#FCFAF8] rounded-full flex items-center justify-center text-stone-400 group-hover:bg-[#8C5A35] group-hover:text-white transition-all">
                      <ArrowRight size={20} />
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </section>

          {/* Autonomous Recommendations */}
          <section>
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
              <h2 className="text-2xl font-bold text-[#2C241B] flex items-center">
                <Sparkles className="text-yellow-500 mr-3" size={24} />
                AI Study Strategy
              </h2>
              <div className="flex items-center gap-4">
                <Button
                  variant="ghost"
                  className="text-[#8C5A35] hover:text-[#70482B] font-black text-sm p-0 flex items-center gap-1"
                  onClick={() => navigate('/ai-tutor')}
                >
                  Ask AI Tutor Coach →
                </Button>
                <span className="px-3 py-1 bg-[#F2EFE9] text-stone-500 text-[10px] font-black rounded-full uppercase tracking-tighter">Updated Live</span>
              </div>
            </div>
            <div className="space-y-8">
              <Card className="p-10 bg-[#FCFAF8] border-none shadow-xl rounded-[40px] relative overflow-hidden group">
                <div className="relative z-10 flex flex-col md:flex-row gap-10">
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-8">
                      <div className="p-4 bg-amber-50 rounded-2xl text-[#8C5A35]">
                        <Calendar size={32} />
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1">
                          {(user.class === 10 || user.class === 12) ? "Next Board Milestone" : "Next Exam Milestone"}
                        </p>
                        <p className="text-lg font-bold text-[#2C241B] ">
                          {mockSchedule ? `Mock Exam • ${mockSchedule.next_mock_date}` : `${localStorage.getItem('clarity_exam_date') ? new Date(localStorage.getItem('clarity_exam_date')!).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : 'Feb 15, 2026'} • ${(user.class === 10 || user.class === 12) ? 'CBSE Finals' : 'Final Exams'}`}
                        </p>
                      </div>
                    </div>
                    <h3 className="text-3xl font-black text-[#2C241B] mb-4">Autonomous Study Plan</h3>
                    <p className="text-lg text-stone-500 mb-8 leading-relaxed max-w-2xl">
                      {dailyMission?.tasks?.[0]
                        ? `Focusing on ${dailyMission.tasks[0].subject} today. We've optimized your path for ${dailyMission.tasks[0].chapter}.`
                        : 'No mission data yet. Complete a diagnostic or practice session to activate your custom strategy.'}
                    </p>
                    <Button
                      className="bg-stone-900 hover:bg-stone-800 rounded-2xl font-black px-12 py-8 text-xl"
                      onClick={() => navigate('/practice')}
                    >
                      Execute Strategy
                    </Button>
                  </div>
                  <div className="flex-1 space-y-4">
                    {(dailyMission?.tasks || []).slice(0, 3).map((task) => (
                      <div key={task.id} className="flex items-center gap-4 p-5 bg-[#FCFAF8] rounded-2xl border border-stone-100 hover:border-[#8C5A35] transition-colors">
                        <div className="w-8 h-8 rounded-full border-2 border-[#8C5A35] flex items-center justify-center bg-[#FCFAF8] ">
                          <input type="checkbox" className="w-5 h-5 accent-[#8C5A35] cursor-pointer" readOnly />
                        </div>
                        <div>
                          <span className="text-base font-bold text-stone-700 ">{task.title}</span>
                          <p className="text-xs text-stone-500 font-medium">{task.subject} • 30 mins</p>
                        </div>
                      </div>
                    ))}
                    {!dailyMission?.tasks?.length && (
                      <div className="h-full flex flex-col items-center justify-center p-10 bg-[#FCFAF8] rounded-3xl border-2 border-dashed border-stone-200 ">
                         <p className="text-sm text-stone-400 font-bold">Tasks will appear after your first activity.</p>
                      </div>
                    )}
                  </div>
                </div>
              </Card>

              <Card className="p-10 bg-[#8C5A35] text-black border-none shadow-xl rounded-[40px] relative overflow-hidden flex flex-col md:flex-row items-center gap-10">
                <div className="relative z-10 flex-1">
                  <div className="flex items-center gap-4 mb-8">
                    <div className="p-4 bg-[#FCFAF8]/60 backdrop-blur-md rounded-2xl">
                      <Target size={32} />
                    </div>
                    <h3 className="text-3xl font-black">Mastery Analytics</h3>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-10">
                    <div>
                      <div className="flex justify-between text-[10px] font-black uppercase tracking-widest mb-3">
                        <span>Concept Recall</span>
                        <span>{stats?.accuracy_rate ?? 0}%</span>
                      </div>
                      <div className="h-5 bg-black/10 rounded-full overflow-hidden p-1">
                        <div className="h-full bg-yellow-300 rounded-full" style={{ width: `${Math.min(100, stats?.accuracy_rate ?? 0)}%` }} />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-[10px] font-black uppercase tracking-widest mb-3">
                        <span>Syllabus Progress</span>
                        <span>{chapterReadiness?.readiness_score ?? 0}%</span>
                      </div>
                      <div className="h-5 bg-black/10 rounded-full overflow-hidden p-1">
                        <div className="h-full bg-black rounded-full" style={{ width: `${Math.min(100, chapterReadiness?.readiness_score ?? 0)}%` }} />
                      </div>
                    </div>
                  </div>
                </div>
                <div className="relative z-10 flex-1 w-full">
                  <div className="p-8 bg-[#FCFAF8]/40 backdrop-blur-md rounded-[32px] border border-black/5">
                    <p className="text-lg font-bold leading-relaxed italic text-black/90">
                      {chapterReadiness
                        ? `The algorithm identifies ${chapterReadiness.chapter} as your highest-ROI study focus for this week.`
                        : `${(user.class === 10 || user.class === 12) ? 'Board readiness' : 'Exam readiness'} is being calculated. Finish more chapters to unlock insights.`}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    className="w-full mt-6 text-black hover:bg-black/10 font-black text-base border-2 border-black/20 rounded-2xl py-7"
                    onClick={handleParentReport}
                    disabled={reportLoading}
                  >
                    {reportLoading ? 'Sending Report...' : 'Share Progress with Parents'}
                  </Button>
                </div>
                <div className="absolute top-0 right-0 w-96 h-96 bg-[#FCFAF8]/10 rounded-full blur-3xl -transtone-y-1/2 transtone-x-1/2" />
              </Card>
            </div>
          </section>

          {/* Activity Feed */}
          <section>
            <h2 className="text-2xl font-bold text-[#2C241B] mb-6 flex items-center">
              <History className="text-[#8C5A35] mr-3" size={24} />
              Recent Learning
            </h2>
            <Card className="bg-[#FCFAF8] border-none shadow-xl rounded-[32px] overflow-hidden">
              <div className="divide-y divide-stone-100 ">
                {recentActivity.length > 0 ? (
                  [...recentActivity].reverse().slice(0, 8).map((activity: any, index: number) => (
                    <div key={index} className="p-8 hover:bg-[#FCFAF8] :bg-stone-800/50 transition-colors flex items-center justify-between">
                      <div className="flex items-center gap-6">
                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${activity.action === 'question' ? 'bg-purple-100 text-purple-600' : 'bg-amber-100 text-amber-600'
                          }`}>
                          {activity.action === 'question' ? <Brain size={28} /> : <Target size={28} />}
                        </div>
                        <div>
                          <p className="font-bold text-lg text-[#2C241B] ">
                            {activity.action === 'question' ? 'AI Consultation' : 'Practice Drill'} in {activity.subject}
                          </p>
                          <p className="text-sm text-stone-500 font-medium">{activity.chapter}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-black text-stone-400 mb-1 uppercase tracking-widest">
                          {new Date(activity.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                        </p>
                        <p className="text-xs text-stone-400 font-medium">
                          {new Date(activity.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-20 text-center">
                    <div className="w-24 h-24 bg-[#FCFAF8] rounded-full flex items-center justify-center mx-auto mb-6">
                      <History size={40} className="text-stone-300" />
                    </div>
                    <p className="text-stone-500 font-bold text-lg">Your study journey starts here.</p>
                    <Button className="mt-8 bg-[#8C5A35] hover:bg-[#70482B] px-8 py-6 rounded-2xl" onClick={() => navigate('/ask')}>Ask your first question</Button>
                  </div>
                )}
              </div>
            </Card>
          </section>
        </div>
      </main>
    </div>
  );
};
