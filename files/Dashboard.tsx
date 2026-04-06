import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BookOpen, Target, Flame, Clock, ArrowRight, Brain,
  History, Calendar, Zap, Award, Sparkles,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Navbar } from '../components/layout/Navbar';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { getUser } from '../utils/storage';
import { getStats, getParentReport } from '../api';

export const Dashboard = () => {
  const navigate = useNavigate();
  const user = getUser();
  const [stats, setStats] = useState<any>(null);
  const [daysToExam, setDaysToExam] = useState(0);
  const [reportLoading, setReportLoading] = useState(false);

  useEffect(() => {
    const examDate = new Date('2027-02-15');
    const today = new Date();
    const diffTime = Math.abs(examDate.getTime() - today.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    setDaysToExam(diffDays);

    const fetchStats = async () => {
      if (user?.name) {
        try {
          const data = await getStats(user.name);
          setStats(data);
        } catch (error) {
          console.error('Failed to fetch stats', error);
        }
      }
    };
    fetchStats();
  }, []);

  if (!user) {
    navigate('/onboarding');
    return null;
  }

  const handleParentReport = async () => {
    setReportLoading(true);
    try {
      const data = await getParentReport(user.name);
      alert(data.report);
    } catch (e) {
      toast.error('Report system offline. Try again in a moment!');
    } finally {
      setReportLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-[#020617] transition-colors duration-300">
      <Navbar />
      <main className="max-w-7xl mx-auto px-6 py-10">
        {/* Hero Section */}
        <div className="relative overflow-hidden rounded-[32px] bg-gradient-to-br from-[#1D9E75] to-[#059669] p-10 mb-12 shadow-2xl shadow-[#1D9E75]/30">
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
            <div className="max-w-xl">
              <div className="inline-flex items-center px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-white text-xs font-bold mb-4 border border-white/30">
                <Zap size={14} className="mr-2" />
                {user.name.endsWith('_PRO') ? 'PRO STUDENT' : 'FREE TIER'}
              </div>
              <h1 className="text-4xl md:text-5xl font-black text-white mb-4 tracking-tight leading-tight">
                Hey {user.name}, ready to{' '}
                <span className="text-yellow-300">Ace Boards?</span>
              </h1>
              <p className="text-[#ecfdf5]/90 text-lg font-medium leading-relaxed">
                Class {user.class} • {user.school || 'CBSE Student'} • Gulf Board Prep Mode Active
              </p>
            </div>

            <div className="flex flex-col items-center bg-white/10 backdrop-blur-lg rounded-3xl p-6 border border-white/20 text-center min-w-[180px]">
              <Calendar className="text-yellow-300 mb-2" size={32} />
              <p className="text-xs uppercase font-bold text-white/70 tracking-widest mb-1">
                Board Countdown
              </p>
              <p className="text-4xl font-black text-white">{daysToExam}</p>
              <p className="text-[10px] text-white/50 mt-1 uppercase">Days Left</p>
            </div>
          </div>

          <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 w-96 h-96 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 translate-y-1/2 -translate-x-1/2 w-64 h-64 bg-black/10 rounded-full blur-2xl" />
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {[
            { label: 'Streak', value: `${stats?.streak_days || 1} Days`, icon: <Flame className="text-orange-500" />, color: 'orange' },
            { label: 'Q&A Solved', value: stats?.total_questions || 0, icon: <Brain className="text-purple-500" />, color: 'purple' },
            { label: 'Accuracy', value: '85%', icon: <Target className="text-emerald-500" />, color: 'emerald' },
            { label: 'Time Spent', value: '1.2 Hrs', icon: <Clock className="text-blue-500" />, color: 'blue' },
          ].map((stat, i) => (
            <Card
              key={i}
              className="group p-6 bg-white dark:bg-[#0f172a] border-none shadow-xl shadow-slate-200/50 dark:shadow-none hover:scale-[1.02] transition-all rounded-3xl overflow-hidden relative"
            >
              <div className="relative z-10 flex items-center gap-5">
                <div className={`p-4 bg-${stat.color}-50 dark:bg-slate-800 rounded-2xl`}>
                  {stat.icon}
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    {stat.label}
                  </p>
                  <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                    {stat.value}
                  </p>
                </div>
              </div>
              <div className={`absolute -right-4 -bottom-4 w-16 h-16 bg-${stat.color}-500/5 rounded-full group-hover:scale-150 transition-transform`} />
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          <div className="lg:col-span-2 space-y-10">
            {/* Subjects */}
            <section>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center">
                  <BookOpen className="text-[#1D9E75] mr-3" size={24} />
                  My Subjects
                </h2>
                <Button variant="ghost" className="text-slate-500">
                  Edit Subjects
                </Button>
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
                          <h3 className="font-bold text-lg text-slate-900 dark:text-white group-hover:text-[#1D9E75] transition-colors">
                            {subject}
                          </h3>
                          <p className="text-xs text-slate-500 font-medium">
                            Class {user.class} • NCERT
                          </p>
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

            {/* AI Study Strategy */}
            <section>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center">
                  <Sparkles className="text-yellow-500 mr-3" size={24} />
                  AI Study Strategy
                </h2>
                <span className="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-500 text-[10px] font-black rounded-full uppercase tracking-tighter">
                  Updated Live
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="p-8 bg-white dark:bg-[#0f172a] border-none shadow-xl rounded-[32px] relative overflow-hidden group">
                  <div className="relative z-10">
                    <div className="flex items-center justify-between mb-6">
                      <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl text-[#1D9E75]">
                        <Calendar size={24} />
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                          Next Exam
                        </p>
                        <p className="text-sm font-bold text-slate-900 dark:text-white">
                          Science • 12 Days
                        </p>
                      </div>
                    </div>
                    <h3 className="text-xl font-black text-slate-900 dark:text-white mb-2">
                      Autonomous Study Plan
                    </h3>
                    <p className="text-sm text-slate-500 mb-6 leading-relaxed">
                      System detected focus on <strong>{user.subjects[0]}</strong>. Recommended next:{' '}
                      <strong>{user.subjects[1] || 'Practice Test'}</strong>.
                    </p>
                    <div className="space-y-3 mb-8">
                      {['Review Life Processes', 'Solve 5-mark Numerical', 'Mock MCQ Test'].map(
                        (task, i) => (
                          <div
                            key={i}
                            className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-700"
                          >
                            <div className="w-5 h-5 rounded-full border-2 border-[#1D9E75] flex items-center justify-center">
                              <input
                                type="checkbox"
                                className="w-3 h-3 accent-[#1D9E75] cursor-pointer"
                              />
                            </div>
                            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                              {task}
                            </span>
                          </div>
                        )
                      )}
                    </div>
                    <Button
                      className="w-full bg-slate-900 dark:bg-white dark:text-slate-900 hover:bg-slate-800 rounded-2xl font-black py-6"
                      onClick={() => navigate('/practice')}
                    >
                      Execute Plan
                    </Button>
                  </div>
                </Card>

                <Card className="p-8 bg-[#1D9E75] text-white border-none shadow-xl rounded-[32px] relative overflow-hidden">
                  <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="p-3 bg-white/20 backdrop-blur-md rounded-2xl">
                        <Target size={24} />
                      </div>
                      <h3 className="text-xl font-black">Mastery Insights</h3>
                    </div>
                    <div className="space-y-6">
                      <div>
                        <div className="flex justify-between text-xs font-black uppercase tracking-widest mb-2">
                          <span>Concept Mastery</span>
                          <span>78%</span>
                        </div>
                        <div className="h-3 bg-white/20 rounded-full overflow-hidden">
                          <div className="h-full bg-yellow-300 rounded-full" style={{ width: '78%' }} />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-xs font-black uppercase tracking-widest mb-2">
                          <span>Board Readiness</span>
                          <span>62%</span>
                        </div>
                        <div className="h-3 bg-white/20 rounded-full overflow-hidden">
                          <div className="h-full bg-white rounded-full" style={{ width: '62%' }} />
                        </div>
                      </div>
                    </div>
                    <div className="mt-8 p-4 bg-white/10 rounded-2xl border border-white/20">
                      <p className="text-xs font-medium leading-relaxed italic">
                        "Your speed in numericals has improved by 15% this week. Focus on balancing
                        equations next."
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      className="w-full mt-6 text-white hover:bg-white/10 font-bold border border-white/20 rounded-2xl"
                      onClick={handleParentReport}
                      disabled={reportLoading}
                    >
                      {reportLoading ? 'Generating...' : 'Send Weekly Parent Report'}
                    </Button>
                  </div>
                  <div className="absolute -right-16 -bottom-16 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
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
                  {stats?.recent_activity?.length > 0 ? (
                    [...stats.recent_activity]
                      .reverse()
                      .slice(0, 5)
                      .map((activity: any, index: number) => (
                        <div
                          key={index}
                          className="p-6 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors flex items-center justify-between"
                        >
                          <div className="flex items-center gap-5">
                            <div
                              className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                                activity.action === 'question'
                                  ? 'bg-purple-100 text-purple-600'
                                  : 'bg-emerald-100 text-emerald-600'
                              }`}
                            >
                              {activity.action === 'question' ? (
                                <Brain size={24} />
                              ) : (
                                <Target size={24} />
                              )}
                            </div>
                            <div>
                              <p className="font-bold text-slate-900 dark:text-white">
                                {activity.action === 'question' ? 'AI Consultation' : 'Practice Drill'}{' '}
                                in {activity.subject}
                              </p>
                              <p className="text-sm text-slate-500">{activity.chapter}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-xs font-bold text-slate-400 mb-1 uppercase tracking-tighter">
                              {new Date(activity.timestamp).toLocaleDateString([], {
                                month: 'short',
                                day: 'numeric',
                              })}
                            </p>
                            <p className="text-xs text-slate-400">
                              {new Date(activity.timestamp).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
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
                      <Button
                        className="mt-6 bg-[#1D9E75] hover:bg-[#16805d]"
                        onClick={() => navigate('/ask')}
                      >
                        Ask your first question
                      </Button>
                    </div>
                  )}
                </div>
              </Card>
            </section>
          </div>

          {/* Right Sidebar */}
          <div className="space-y-8">
            {!user.name.endsWith('_PRO') && (
              <Card className="p-8 bg-slate-900 text-white border-none rounded-[32px] shadow-2xl relative overflow-hidden group">
                <div className="relative z-10">
                  <div className="w-12 h-12 bg-yellow-400 rounded-2xl flex items-center justify-center mb-6">
                    <Award className="text-slate-900" size={28} />
                  </div>
                  <h3 className="text-2xl font-black mb-3 leading-tight">Master Pro Access</h3>
                  <p className="text-slate-400 text-sm mb-8 leading-relaxed">
                    Unlock Unlimited Vision AI, handwritten notes scanner, and Mock Exams for{' '}
                    <span className="text-white font-bold">50 AED/mo.</span>
                  </p>
                  <Button
                    className="w-full bg-white text-slate-900 hover:bg-slate-100 font-black py-6 rounded-2xl text-lg transition-transform active:scale-95"
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
              <h3 className="font-bold text-xl text-slate-900 dark:text-white mb-6">
                Review Needed
              </h3>
              <div className="space-y-4">
                {stats?.weak_topics?.length > 0 ? (
                  stats.weak_topics.map((topic: string) => (
                    <div
                      key={topic}
                      className="group flex items-center justify-between p-4 bg-red-50 dark:bg-red-900/10 rounded-2xl hover:bg-red-100 dark:hover:bg-red-900/20 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                        <span className="text-sm text-red-700 dark:text-red-300 font-bold">
                          {topic}
                        </span>
                      </div>
                      <ArrowRight
                        size={16}
                        className="text-red-400 group-hover:translate-x-1 transition-transform"
                      />
                    </div>
                  ))
                ) : (
                  <div className="text-center py-6">
                    <Target className="text-slate-200 dark:text-slate-800 mx-auto mb-2" size={40} />
                    <p className="text-xs text-slate-500">
                      Practice more to see topics that need focus.
                    </p>
                  </div>
                )}
              </div>
            </Card>

            {/* Weekly Goal Chart */}
            <Card className="p-8 bg-white dark:bg-[#0f172a] border-none rounded-[32px] shadow-xl text-center">
              <h3 className="font-bold text-lg text-slate-900 dark:text-white mb-4">
                Weekly Goal
              </h3>
              <div className="flex justify-between items-end h-24 gap-2 px-2">
                {[40, 70, 45, 90, 60, 30, 0].map((h, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center">
                    <div
                      className={`w-full rounded-t-lg transition-all duration-500 ${
                        i === 3 ? 'bg-[#1D9E75]' : 'bg-slate-100 dark:bg-slate-800'
                      }`}
                      style={{ height: `${h}%` }}
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
