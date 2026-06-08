import { useEffect, useState, useRef } from 'react';
import { 
  AlertTriangle, BarChart3, LogOut, Mail, ShieldCheck, 
  CheckCircle2, MessageSquare, Send, Sparkles, Clock, Heart, Info, ArrowRight,
  Flame, BookOpen, Target, Settings, Check, User, Plus, Calendar, Compass, AlertCircle
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Card } from '../components/ui/Card';
import { 
  getParentPortalSummaryForParent, 
  parentLogin, 
  parentLogout, 
  getParentPortalSettings,
  updateParentPortalSettings,
  chatWithParentAdvisor,
  switchParentStudent,
  type ParentPortalSummaryResponse 
} from '../api';

const PARENT_TOKEN_KEY = 'clarity_parent_token';
const PARENT_EMAIL_KEY = 'clarity_parent_email';

interface WeeklyGoals {
  target_study_hours: number;
  target_practice_sessions: number;
  target_mock_exams: number;
  checked_actions: string[];
}

export const ParentPortal = () => {
    const [email, setEmail] = useState(() => localStorage.getItem(PARENT_EMAIL_KEY) || '');
    const [password, setPassword] = useState('');
    const [isAuthed, setIsAuthed] = useState(() => !!sessionStorage.getItem(PARENT_TOKEN_KEY));
    const [loading, setLoading] = useState(false);
    const [summary, setSummary] = useState<ParentPortalSummaryResponse | null>(null);

    // Interactive States
    const [activeTab, setActiveTab] = useState<'dashboard' | 'alerts' | 'encourage' | 'advisor' | 'logs'>('dashboard');
    const [encouragementNote, setEncouragementNote] = useState('');
    const [goals, setGoals] = useState<WeeklyGoals>({
      target_study_hours: 3,
      target_practice_sessions: 5,
      target_mock_exams: 1,
      checked_actions: []
    });
    const [isGoalsModalOpen, setIsGoalsModalOpen] = useState(false);
    
    // AI Advisor States
    const [chatHistory, setChatHistory] = useState<Array<{ sender: 'parent' | 'ai'; text: string }>>([
        { 
            sender: 'ai', 
            text: "Hello! I am your AI Parent Advisor. Ask me anything about your child's study habits, syllabus topics, or how to implement the recommended action items at home." 
        }
    ]);
    const [customAdvisorQuery, setCustomAdvisorQuery] = useState('');
    const [advisorLoading, setAdvisorLoading] = useState(false);
    const chatEndRef = useRef<HTMLDivElement>(null);

    // Auto Scroll Chat
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatHistory, advisorLoading]);

    // Fetch initial summary & DB settings
    useEffect(() => {
        const run = async () => {
            if (!isAuthed) {
                setSummary(null);
                return;
            }
            try {
                setLoading(true);
                const data = await getParentPortalSummaryForParent();
                setSummary(data);

                // Fetch DB settings (Note + Goals)
                const settingsData = await getParentPortalSettings();
                setEncouragementNote(settingsData.encouragement_note || '');
                if (settingsData.weekly_goals) {
                    try {
                        const parsed = JSON.parse(settingsData.weekly_goals);
                        setGoals(prev => ({
                            ...prev,
                            ...parsed,
                            checked_actions: parsed.checked_actions || []
                        }));
                    } catch (e) {
                        console.error('Failed to parse weekly goals json', e);
                    }
                }
            } catch {
                sessionStorage.removeItem(PARENT_TOKEN_KEY);
                localStorage.removeItem(PARENT_TOKEN_KEY);
                setIsAuthed(false);
                toast.error('Parent session expired. Please login again.');
            } finally {
                setLoading(false);
            }
        };
        run();
    }, [isAuthed]);

    const handleParentLogin = async () => {
        if (!email.trim() || !password.trim()) {
            toast.error('Enter parent email and password.');
            return;
        }
        setLoading(true);
        try {
            const result = await parentLogin({ email: email.trim(), password: password.trim() });
            sessionStorage.setItem(PARENT_TOKEN_KEY, result.token);
            localStorage.removeItem(PARENT_TOKEN_KEY);
            localStorage.setItem(PARENT_EMAIL_KEY, result.parent.email);
            setIsAuthed(true);
            setPassword('');
            toast.success(`Logged in for student ${result.parent.student}.`);
        } catch (error: any) {
            const detail = error?.response?.data?.detail;
            toast.error(detail || 'Invalid parent credentials. Check the email sent by Clarity.');
        } finally {
            setLoading(false);
        }
    };

    const handleParentLogout = async () => {
        try {
            await parentLogout();
        } catch {
            // Local logout still proceeds.
        }
        sessionStorage.removeItem(PARENT_TOKEN_KEY);
        localStorage.removeItem(PARENT_TOKEN_KEY);
        setIsAuthed(false);
        setSummary(null);
        toast.success('Parent session logged out.');
    };

    const handleSwitchStudent = async (studentUsername: string) => {
        if (studentUsername === summary?.student) return;
        try {
            setLoading(true);
            await switchParentStudent(studentUsername);
            toast.success(`Switched active view to student: ${studentUsername}`);
            
            // Re-fetch summary and settings for the newly active student
            const data = await getParentPortalSummaryForParent();
            setSummary(data);
            
            const settingsData = await getParentPortalSettings();
            setEncouragementNote(settingsData.encouragement_note || '');
            if (settingsData.weekly_goals) {
                try {
                    const parsed = JSON.parse(settingsData.weekly_goals);
                    setGoals(prev => ({
                        ...prev,
                        ...parsed,
                        checked_actions: parsed.checked_actions || []
                    }));
                } catch (e) {
                    console.error('Failed to parse weekly goals json', e);
                }
            } else {
                setGoals({
                    target_study_hours: 3,
                    target_practice_sessions: 5,
                    target_mock_exams: 1,
                    checked_actions: []
                });
            }
            
            // Reset chat history for the new student
            setChatHistory([
                { 
                    sender: 'ai', 
                    text: `Hello! I am your AI Parent Advisor. Ask me anything about ${studentUsername}'s study habits, syllabus topics, or how to implement the recommended action plan.`
                }
            ]);
        } catch {
            toast.error("Failed to switch student view.");
        } finally {
            setLoading(false);
        }
    };

    // Save Note & Goals to Database
    const handleSaveParentSettings = async (updatedGoals = goals, updatedNote = encouragementNote) => {
        try {
            await updateParentPortalSettings({
                encouragement_note: updatedNote,
                weekly_goals: JSON.stringify(updatedGoals)
            });
            // Update localstorage so student gets immediate feedback if on same device
            localStorage.setItem('clarity_parent_note', updatedNote);
            toast.success('💾 Settings synced directly with student\'s database!');
        } catch {
            toast.error('Failed to sync parent settings.');
        }
    };

    // Preset messages for post-it note
    const presetNotes = [
        "🌟 Super proud of your progress! Keep pushing!",
        "📚 You've been studying so hard today. Take a break, drink some water, and relax!",
        "🔥 Revision streak is looking great! Keep up the momentum!",
        "💡 Let's review the weak chapters together this weekend. You got this!"
    ];

    const handleSendPresetNote = (noteText: string) => {
        setEncouragementNote(noteText);
        handleSaveParentSettings(goals, noteText);
    };

    // Toggle parent checklist action
    const handleToggleChecklist = (rec: string) => {
        const isChecked = goals.checked_actions.includes(rec);
        const newActions = isChecked
            ? goals.checked_actions.filter(a => a !== rec)
            : [...goals.checked_actions, rec];
        
        const updated = { ...goals, checked_actions: newActions };
        setGoals(updated);
        handleSaveParentSettings(updated, encouragementNote);
    };

    // Quick preset questions for AI Parent Advisor
    const handleAskAdvisorPreset = async (question: string) => {
        if (advisorLoading) return;
        setChatHistory(prev => [...prev, { sender: 'parent', text: question }]);
        setAdvisorLoading(true);

        try {
            // Call the real OpenAI/OpenRouter backend route
            const historyPayload = chatHistory.slice(1).map(h => ({ sender: h.sender, text: h.text }));
            const result = await chatWithParentAdvisor(question, historyPayload);
            setChatHistory(prev => [...prev, { sender: 'ai', text: result.response }]);
        } catch (err) {
            toast.error("AI Advisor is temporarily unavailable. Check connectivity.");
            setChatHistory(prev => [...prev, { sender: 'ai', text: "I'm having trouble connecting to Clarity's AI engine. Please make sure the backend is active." }]);
        } finally {
            setAdvisorLoading(false);
        }
    };

    const handleAskAdvisorCustom = async () => {
        if (!customAdvisorQuery.trim() || advisorLoading) return;
        const query = customAdvisorQuery.trim();
        setChatHistory(prev => [...prev, { sender: 'parent', text: query }]);
        setCustomAdvisorQuery('');
        setAdvisorLoading(true);

        try {
            const historyPayload = chatHistory.slice(1).map(h => ({ sender: h.sender, text: h.text }));
            const result = await chatWithParentAdvisor(query, historyPayload);
            setChatHistory(prev => [...prev, { sender: 'ai', text: result.response }]);
        } catch (err) {
            toast.error("AI Advisor is temporarily unavailable.");
            setChatHistory(prev => [...prev, { sender: 'ai', text: "I'm having trouble connecting to Clarity's AI engine. Please make sure the backend is active." }]);
        } finally {
            setAdvisorLoading(false);
        }
    };

    const handleSaveWeeklyGoals = (hours: number, sessions: number, exams: number) => {
        const updated = {
            ...goals,
            target_study_hours: hours,
            target_practice_sessions: sessions,
            target_mock_exams: exams
        };
        setGoals(updated);
        setIsGoalsModalOpen(false);
        handleSaveParentSettings(updated, encouragementNote);
    };

    // Calculations & styling helpers
    const readinessScore = summary?.readiness_score || 0;
    const strokeDashoffset = 251.2 - (251.2 * readinessScore) / 100;
    const isHighRisk = summary?.risk_level.toLowerCase() === 'high';
    const isMediumRisk = summary?.risk_level.toLowerCase() === 'medium';

    const getScoreColor = (score: number) => {
        if (score >= 75) return 'text-emerald-500 stroke-emerald-500';
        if (score >= 45) return 'text-amber-500 stroke-amber-500';
        return 'text-rose-500 stroke-rose-500';
    };

    if (!isAuthed) {
        return (
            <div className="min-h-screen bg-[#f8fafc] dark:bg-[#020617] flex items-center justify-center px-4 py-12 transition-colors duration-300">
                <Card className="w-full max-w-xl p-8 md:p-10 rounded-[32px] bg-white dark:bg-slate-900 border-none shadow-2xl space-y-6">
                    <div className="text-center space-y-2">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#1D9E75]/10 text-[#1D9E75] mb-2">
                            <ShieldCheck size={32} />
                        </div>
                        <h1 className="text-3xl font-black text-slate-900 dark:text-white">Parent Transparency Portal</h1>
                        <p className="text-slate-500 dark:text-slate-400 text-sm font-semibold max-w-md mx-auto leading-relaxed">
                            Monitor your child's syllabus readiness, review AI risk alerts, and guide their prep from home.
                        </p>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <p className="text-xs font-black uppercase tracking-wider text-slate-400 mb-2">Parent Email</p>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full px-4 py-3.5 rounded-2xl border-2 border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-[#1D9E75] focus:border-transparent"
                                placeholder="parent@example.com"
                            />
                        </div>

                        <div>
                            <p className="text-xs font-black uppercase tracking-wider text-slate-400 mb-2">Portal Access Password</p>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full px-4 py-3.5 rounded-2xl border-2 border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-[#1D9E75] focus:border-transparent"
                                placeholder="Enter credentials sent to your email"
                            />
                        </div>

                        <button
                            onClick={handleParentLogin}
                            disabled={loading}
                            className="w-full py-4 rounded-2xl bg-gradient-to-r from-[#1D9E75] to-emerald-600 hover:from-[#16805d] hover:to-emerald-700 text-white font-black shadow-lg shadow-[#1D9E75]/25 transition-all flex items-center justify-center gap-2 disabled:opacity-60"
                        >
                            {loading ? 'Authenticating credentials...' : 'Access Parent Portal'}
                            <ArrowRight size={16} />
                        </button>

                        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-start gap-2.5 text-xs font-medium text-slate-500 leading-relaxed">
                            <Mail size={16} className="text-[#1D9E75] shrink-0 mt-0.5" />
                            <span>
                                Credentials are automatically mailed to you when the student configures your email. Ask your child to confirm or click "Send Report" on their dashboard.
                            </span>
                        </div>
                    </div>
                </Card>
            </div>
        );
    }

    // Advanced analytics calculations
    const stats_total_minutes = summary?.estimated_study_minutes || 0;
    const stats_streak = summary?.streak_days || 0;
    const stats_questions = summary?.total_questions || 0;
    const stats_practice_count = summary?.practice_attempts_count || 0;

    // Goal ratios
    const studyHoursProgress = parseFloat((stats_total_minutes / 60).toFixed(1));
    const studyHoursPercent = Math.min(100, Math.round((studyHoursProgress / goals.target_study_hours) * 100)) || 0;
    const practicePercent = Math.min(100, Math.round((stats_practice_count / goals.target_practice_sessions) * 100)) || 0;

    // Detect risk indicators
    const hasConceptGap = (summary?.weak_chapters && summary.weak_chapters.length > 0);
    const hasInactivity = stats_streak <= 1 && stats_questions === 0;
    const hasMockShortfall = stats_practice_count === 0;

    return (
        <div className="min-h-screen bg-[#f8fafc] dark:bg-[#020617] transition-colors duration-300">
            <main className="max-w-6xl mx-auto px-6 py-10 space-y-6">
                
                {/* Header card with student information */}
                <Card className="p-8 rounded-[32px] bg-white dark:bg-slate-900 border-none shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                    <div className="space-y-1">
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#1D9E75]/10 text-[#1D9E75] text-xs font-black uppercase tracking-wider">
                            <ShieldCheck size={12} />
                            Parent Supervisor Access
                        </div>
                        <h1 className="text-3xl font-black text-slate-900 dark:text-white leading-tight">
                            Transparency Portal for {summary?.student || 'Your Child'}
                        </h1>
                        <p className="text-slate-500 dark:text-slate-400 font-semibold text-sm">
                            Real-time tracking of syllabus mastery, active traps, and parent action checklists.
                        </p>
                    </div>
                    <button
                        onClick={handleParentLogout}
                        className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl border-2 border-slate-200 dark:border-slate-800 font-black text-xs uppercase tracking-wider text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-850 hover:text-rose-500 dark:hover:text-rose-400 transition-colors"
                    >
                        <LogOut size={14} />
                        Disconnect Session
                    </button>
                </Card>

                {summary && (
                    <>
                        {/* Student Selector Tabs Bar */}
                        {summary.students && summary.students.length > 1 && (
                            <div className="flex gap-2 p-1 bg-slate-200/50 dark:bg-slate-850 rounded-2xl border border-slate-200/60 dark:border-slate-800/80 mb-2 max-w-fit animate-fade-in">
                                {summary.students.map((stdUsername) => {
                                    const isActive = stdUsername === summary.student;
                                    return (
                                        <button
                                            key={stdUsername}
                                            onClick={() => handleSwitchStudent(stdUsername)}
                                            className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 ${
                                                isActive
                                                    ? 'bg-[#1D9E75] text-white shadow-md'
                                                    : 'text-slate-650 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                                            }`}
                                        >
                                            <User size={13} />
                                            <span>{stdUsername}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        )}

                        {/* KPI Summary Row */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                            
                            {/* Readiness score dial card */}
                            <Card className="p-6 rounded-[32px] bg-white dark:bg-slate-900 border-none shadow-xl flex items-center justify-between gap-4">
                                <div className="space-y-1">
                                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Syllabus Readiness</p>
                                    <p className="text-3xl font-black text-slate-900 dark:text-white">{readinessScore}%</p>
                                    <p className="text-[10px] text-slate-500 font-bold">Target: 75%+</p>
                                </div>
                                <div className="relative w-20 h-20 shrink-0">
                                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                                        <circle cx="50" cy="50" r="40" className="stroke-slate-100 dark:stroke-slate-800" strokeWidth="10" fill="transparent" />
                                        <circle 
                                            cx="50" 
                                            cy="50" 
                                            r="40" 
                                            className={getScoreColor(readinessScore)} 
                                            strokeWidth="10" 
                                            fill="transparent" 
                                            strokeDasharray="251.2"
                                            strokeDashoffset={strokeDashoffset}
                                            strokeLinecap="round"
                                        />
                                    </svg>
                                    <div className="absolute inset-0 flex items-center justify-center text-xs font-black text-slate-700 dark:text-slate-350">
                                        {readinessScore}%
                                    </div>
                                </div>
                            </Card>

                            {/* Risk alert card */}
                            <Card className={`p-6 rounded-[32px] border-2 bg-white dark:bg-slate-900 shadow-xl flex flex-col justify-between ${
                                isHighRisk 
                                    ? 'border-rose-200 dark:border-rose-950/40' 
                                    : isMediumRisk 
                                        ? 'border-amber-200 dark:border-amber-950/40' 
                                        : 'border-emerald-200 dark:border-emerald-950/40'
                            }`}>
                                <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Predictive Risk Status</p>
                                <div className="flex items-center gap-3 mt-2">
                                    <span className="text-3xl">
                                        {isHighRisk ? '🚨' : isMediumRisk ? '⚠️' : '✅'}
                                    </span>
                                    <div>
                                        <p className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
                                            {summary.risk_level} Risk
                                        </p>
                                        <p className="text-[10px] text-slate-500 font-bold">
                                            {isHighRisk ? 'Revision critical' : isMediumRisk ? 'Focus on gaps' : 'Prep looks solid'}
                                        </p>
                                    </div>
                                </div>
                            </Card>

                            {/* Streak Flame Card */}
                            <Card className="p-6 rounded-[32px] bg-white dark:bg-slate-900 border-none shadow-xl flex items-center justify-between gap-4">
                                <div className="space-y-1">
                                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Active Study Streak</p>
                                    <p className="text-3xl font-black text-slate-900 dark:text-white">{stats_streak} Days</p>
                                    <p className="text-[10px] text-slate-500 font-bold">CBSE Board exam streak</p>
                                </div>
                                <div className="w-14 h-14 bg-orange-100 dark:bg-orange-950/20 rounded-2xl flex items-center justify-center text-orange-500 shrink-0">
                                    <Flame size={30} fill="currentColor" />
                                </div>
                            </Card>

                            {/* Study Volume Stats */}
                            <Card className="p-6 rounded-[32px] bg-white dark:bg-slate-900 border-none shadow-xl flex items-center justify-between gap-4">
                                <div className="space-y-1">
                                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Study Volume</p>
                                    <p className="text-3xl font-black text-slate-900 dark:text-white">{stats_questions} Qs</p>
                                    <p className="text-[10px] text-slate-500 font-bold">{studyHoursProgress} Hours Logged</p>
                                </div>
                                <div className="w-14 h-14 bg-sky-100 dark:bg-sky-950/20 rounded-2xl flex items-center justify-center text-sky-500 shrink-0">
                                    <BookOpen size={28} />
                                </div>
                            </Card>

                        </div>

                        {/* Interactive Section Switcher Tabs */}
                        <div className="flex bg-slate-200/60 dark:bg-slate-850 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-x-auto scrollbar-none">
                            <button
                                onClick={() => setActiveTab('dashboard')}
                                className={`flex-1 py-3 px-4 text-xs font-black uppercase tracking-wider rounded-xl transition-all whitespace-nowrap ${
                                    activeTab === 'dashboard' 
                                        ? 'bg-[#1D9E75] text-white shadow-md' 
                                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-850'
                                    }`}
                            >
                                <span className="flex items-center justify-center gap-2">
                                    <BarChart3 size={14} />
                                    Analytics & Goals
                                </span>
                            </button>
                            <button
                                onClick={() => setActiveTab('alerts')}
                                className={`flex-1 py-3 px-4 text-xs font-black uppercase tracking-wider rounded-xl transition-all whitespace-nowrap ${
                                    activeTab === 'alerts' 
                                        ? 'bg-[#1D9E75] text-white shadow-md' 
                                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-850'
                                    }`}
                            >
                                <span className="flex items-center justify-center gap-2">
                                    <AlertTriangle size={14} />
                                    Risk & Gaps Alerts
                                </span>
                            </button>
                            <button
                                onClick={() => setActiveTab('encourage')}
                                className={`flex-1 py-3 px-4 text-xs font-black uppercase tracking-wider rounded-xl transition-all whitespace-nowrap ${
                                    activeTab === 'encourage' 
                                        ? 'bg-[#1D9E75] text-white shadow-md' 
                                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-850'
                                    }`}
                            >
                                <span className="flex items-center justify-center gap-2">
                                    <Heart size={14} />
                                    Write Message
                                </span>
                            </button>
                            <button
                                onClick={() => setActiveTab('advisor')}
                                className={`flex-1 py-3 px-4 text-xs font-black uppercase tracking-wider rounded-xl transition-all whitespace-nowrap ${
                                    activeTab === 'advisor' 
                                        ? 'bg-[#1D9E75] text-white shadow-md' 
                                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-850'
                                    }`}
                            >
                                <span className="flex items-center justify-center gap-2">
                                    <MessageSquare size={14} />
                                    AI advisor Chat
                                </span>
                            </button>
                            <button
                                onClick={() => setActiveTab('logs')}
                                className={`flex-1 py-3 px-4 text-xs font-black uppercase tracking-wider rounded-xl transition-all whitespace-nowrap ${
                                    activeTab === 'logs' 
                                        ? 'bg-[#1D9E75] text-white shadow-md' 
                                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-850'
                                    }`}
                            >
                                <span className="flex items-center justify-center gap-2">
                                    <Clock size={14} />
                                    Recent Feed
                                </span>
                            </button>
                        </div>

                        {/* TAB 1: ANALYTICS & GOALS */}
                        {activeTab === 'dashboard' && (
                            <div className="space-y-6">
                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                    
                                    {/* Subject confidence list */}
                                    <Card className="lg:col-span-2 p-6 rounded-[32px] bg-white dark:bg-slate-900 border-none shadow-xl space-y-6">
                                        <div>
                                            <h2 className="text-xl font-black text-slate-900 dark:text-white inline-flex items-center gap-2">
                                                <BarChart3 size={20} className="text-[#1D9E75]" />
                                                Subject Confidence
                                            </h2>
                                            <p className="text-xs text-slate-400 mt-1">Syllabus mastery percentage based on practice accuracy. Includes all chosen subjects.</p>
                                        </div>
                                        
                                        <div className="space-y-4">
                                            {summary.subject_confidence.map((item) => (
                                                <div key={item.subject} className="space-y-1.5">
                                                    <div className="flex justify-between text-xs font-black">
                                                        <span className="text-slate-700 dark:text-slate-350">{item.subject}</span>
                                                        <span className="text-[#1D9E75]">{item.confidence}%</span>
                                                    </div>
                                                    <div className="h-3 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden border border-slate-200/40 dark:border-slate-850">
                                                        <div 
                                                            className="h-full bg-gradient-to-r from-[#1D9E75] to-emerald-500 rounded-full transition-all duration-500" 
                                                            style={{ width: `${item.confidence}%` }} 
                                                        />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </Card>

                                    {/* Weekly Goals Progress Card */}
                                    <Card className="p-6 rounded-[32px] bg-white dark:bg-slate-900 border-none shadow-xl flex flex-col justify-between gap-6">
                                        <div className="space-y-4">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <h2 className="text-lg font-black text-slate-900 dark:text-white inline-flex items-center gap-2">
                                                        <Target size={18} className="text-[#1D9E75]" />
                                                        Weekly Targets
                                                    </h2>
                                                    <p className="text-[10px] text-slate-400 mt-0.5">Parent configured goals</p>
                                                </div>
                                                <button 
                                                    onClick={() => setIsGoalsModalOpen(true)}
                                                    className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-slate-850 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors"
                                                    title="Configure Goals"
                                                >
                                                    <Settings size={16} />
                                                </button>
                                            </div>

                                            <div className="space-y-4">
                                                {/* Study Hours Goal */}
                                                <div className="space-y-1">
                                                    <div className="flex justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                                                        <span>Weekly Hours Target</span>
                                                        <span>{studyHoursProgress} / {goals.target_study_hours} hrs</span>
                                                    </div>
                                                    <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-850 overflow-hidden">
                                                        <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${studyHoursPercent}%` }} />
                                                    </div>
                                                </div>

                                                {/* Practice Sessions Goal */}
                                                <div className="space-y-1">
                                                    <div className="flex justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                                                        <span>Practice Sets Target</span>
                                                        <span>{stats_practice_count} / {goals.target_practice_sessions} sets</span>
                                                    </div>
                                                    <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-850 overflow-hidden">
                                                        <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${practicePercent}%` }} />
                                                    </div>
                                                </div>

                                                {/* Mock Exams Goal */}
                                                <div className="space-y-1">
                                                    <div className="flex justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                                                        <span>Mock Tests Scheduled</span>
                                                        <span>{stats_practice_count >= goals.target_mock_exams ? 1 : 0} / {goals.target_mock_exams} tests</span>
                                                    </div>
                                                    <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-850 overflow-hidden">
                                                        <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${stats_practice_count >= goals.target_mock_exams ? 100 : 0}%` }} />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="p-3 rounded-2xl bg-[#1D9E75]/5 border border-[#1D9E75]/10 flex items-center gap-2.5 text-[11px] font-bold text-slate-500">
                                            <Info size={14} className="text-[#1D9E75] shrink-0" />
                                            <span>Goal progress resets at the start of every week.</span>
                                        </div>
                                    </Card>

                                </div>

                                {/* Checklist of recommended parent actions */}
                                <Card className="p-8 rounded-[32px] bg-white dark:bg-slate-900 border-none shadow-xl space-y-6">
                                    <div>
                                        <h2 className="text-xl font-black text-slate-900 dark:text-white inline-flex items-center gap-2">
                                            <ShieldCheck size={22} className="text-[#1D9E75]" />
                                            Parent Action Checklist
                                        </h2>
                                        <p className="text-xs text-slate-400 mt-1">Recommended actions to support your child's preparation at home this week.</p>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {summary.recommendations.map((rec) => {
                                            const isChecked = goals.checked_actions.includes(rec);
                                            return (
                                                <button
                                                    key={rec}
                                                    type="button"
                                                    onClick={() => handleToggleChecklist(rec)}
                                                    className={`p-4 rounded-2xl border-2 text-left font-bold text-xs leading-relaxed transition-all flex items-start gap-4 ${
                                                        isChecked 
                                                            ? 'border-emerald-500 bg-emerald-50/20 dark:bg-emerald-950/10 text-emerald-800 dark:text-emerald-350'
                                                            : 'border-slate-200 dark:border-slate-800 text-slate-750 dark:text-slate-300 hover:border-slate-300'
                                                    }`}
                                                >
                                                    <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 ${
                                                        isChecked ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-300 dark:border-slate-650'
                                                    }`}>
                                                        {isChecked && <CheckCircle2 size={13} />}
                                                    </span>
                                                    <span className={isChecked ? 'line-through opacity-75' : ''}>{rec}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </Card>
                            </div>
                        )}

                        {/* TAB 2: PREDICTIVE RISK & ALERTS */}
                        {activeTab === 'alerts' && (
                            <div className="space-y-6">
                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                    
                                    {/* Warnings list */}
                                    <Card className="lg:col-span-2 p-6 rounded-[32px] bg-white dark:bg-slate-900 border-none shadow-xl space-y-6">
                                        <div>
                                            <h2 className="text-xl font-black text-slate-900 dark:text-white inline-flex items-center gap-2">
                                                <AlertTriangle size={20} className="text-rose-500" />
                                                Active Readiness Warnings
                                            </h2>
                                            <p className="text-xs text-slate-400 mt-1">Syllabus gap alerts based on child's study logs and accuracy trends.</p>
                                        </div>

                                        <div className="space-y-4">
                                            {hasConceptGap && (
                                                <div className="p-4 rounded-2xl bg-rose-50/50 dark:bg-rose-950/10 border-2 border-rose-100 dark:border-rose-900/30 flex items-start gap-3">
                                                    <span className="text-xl mt-0.5">⚠️</span>
                                                    <div>
                                                        <p className="text-sm font-black text-slate-800 dark:text-slate-100">Critical Concept Gaps</p>
                                                        <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-0.5">
                                                            Student has scored below 50% in: {summary.weak_chapters.join(', ')}. Revision is urgently advised.
                                                        </p>
                                                    </div>
                                                </div>
                                            )}

                                            {hasInactivity && (
                                                <div className="p-4 rounded-2xl bg-amber-50/50 dark:bg-amber-950/10 border-2 border-amber-100 dark:border-amber-900/30 flex items-start gap-3">
                                                    <span className="text-xl mt-0.5">⏳</span>
                                                    <div>
                                                        <p className="text-sm font-black text-slate-800 dark:text-slate-100">Inactivity Warning</p>
                                                        <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-0.5">
                                                            No diagnostic assessment or practice session was recorded this week. Memory retention drop-off risk is high.
                                                        </p>
                                                    </div>
                                                </div>
                                            )}

                                            {hasMockShortfall && (
                                                <div className="p-4 rounded-2xl bg-sky-50/50 dark:bg-sky-950/10 border-2 border-sky-100 dark:border-sky-900/30 flex items-start gap-3">
                                                    <span className="text-xl mt-0.5">📝</span>
                                                    <div>
                                                        <p className="text-sm font-black text-slate-800 dark:text-slate-100">Exam Practice Deficit</p>
                                                        <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-0.5">
                                                            Student has not completed any timed worksheets or mock exams yet. Recommend scheduling a timed test to build stamina.
                                                        </p>
                                                    </div>
                                                </div>
                                            )}

                                            {!hasConceptGap && !hasInactivity && !hasMockShortfall && (
                                                <div className="p-6 text-center border-2 border-dashed border-slate-200 dark:border-slate-850 rounded-2xl space-y-2">
                                                    <span className="text-3xl block">🎉</span>
                                                    <p className="text-sm font-black text-slate-800 dark:text-slate-100">Syllabus Prep is Healthy</p>
                                                    <p className="text-xs text-slate-400 max-w-sm mx-auto">
                                                        No critical gaps detected! The student is consistently meeting accuracy and activity thresholds.
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    </Card>

                                    {/* Remediation Action Plan */}
                                    <Card className="p-6 rounded-[32px] bg-[#020617] text-white border-none shadow-xl flex flex-col justify-between gap-6">
                                        <div className="space-y-4">
                                            <div>
                                                <span className="px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-400 text-[9px] font-black uppercase tracking-wider">
                                                    Targeted Support
                                                </span>
                                                <h2 className="text-lg font-black text-white mt-1.5">Action Plan</h2>
                                                <p className="text-[10px] text-slate-400">Step-by-step home remediation workflow</p>
                                            </div>

                                            <div className="space-y-4 text-xs font-bold text-slate-350">
                                                <div className="flex gap-3">
                                                    <span className="w-5 h-5 rounded-full bg-slate-800 text-white flex items-center justify-center shrink-0">1</span>
                                                    <p>Have your child open Clarity's "Daily Mission" to target the automatically calculated gaps.</p>
                                                </div>
                                                <div className="flex gap-3">
                                                    <span className="w-5 h-5 rounded-full bg-slate-800 text-white flex items-center justify-center shrink-0">2</span>
                                                    <p>Run a structured 30-minute practice session together and look at the step-marking examiner feedback.</p>
                                                </div>
                                                <div className="flex gap-3">
                                                    <span className="w-5 h-5 rounded-full bg-slate-800 text-white flex items-center justify-center shrink-0">3</span>
                                                    <p>Leave an encouragement note in their study dashboard to keep them motivated.</p>
                                                </div>
                                            </div>
                                        </div>

                                        <button 
                                            onClick={() => setActiveTab('advisor')}
                                            className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-[#1D9E75] hover:opacity-90 text-white text-xs font-black shadow-md flex items-center justify-center gap-1.5"
                                        >
                                            <span>Ask Parent AI Advisor</span>
                                            <ArrowRight size={12} />
                                        </button>
                                    </Card>

                                </div>
                            </div>
                        )}

                        {/* TAB 3: WRITE MESSAGE (POST-IT NOTE) */}
                        {activeTab === 'encourage' && (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                                
                                {/* Handwritten note editor */}
                                <Card className="p-8 rounded-[32px] bg-white dark:bg-slate-900 border-none shadow-xl space-y-6">
                                    <div className="space-y-2">
                                        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-950/20 text-amber-500 mb-1">
                                            <Heart size={24} fill="currentColor" />
                                        </div>
                                        <h2 className="text-xl font-black text-slate-900 dark:text-white">Write Encouragement Note</h2>
                                        <p className="text-xs text-slate-500 leading-relaxed">
                                            This note will appear directly at the top of your child's workspace dashboard.
                                        </p>
                                    </div>

                                    <div className="space-y-4">
                                        <textarea
                                            value={encouragementNote}
                                            onChange={(e) => setEncouragementNote(e.target.value)}
                                            placeholder="Write message here..."
                                            className="w-full h-32 px-4 py-3 rounded-2xl border-2 border-slate-200 dark:border-slate-850 bg-slate-50 dark:bg-slate-950 font-semibold text-xs leading-relaxed outline-none focus:ring-2 focus:ring-[#1D9E75] focus:border-transparent text-slate-800 dark:text-slate-205"
                                            maxLength={120}
                                        />
                                        <div className="flex justify-between items-center text-[10px] text-slate-400 font-bold px-1">
                                            <span>Max 120 characters</span>
                                            <span>Sends instantly to student's screen</span>
                                        </div>

                                        <button
                                            onClick={() => handleSaveParentSettings(goals, encouragementNote)}
                                            className="w-full py-4 rounded-xl bg-[#1D9E75] hover:bg-[#16805d] text-white font-black shadow-md flex items-center justify-center gap-2"
                                        >
                                            <Send size={16} />
                                            <span>Save & Send Note</span>
                                        </button>
                                    </div>

                                    <div className="pt-4 border-t border-slate-100 dark:border-slate-850 space-y-2">
                                        <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Quick Presets</p>
                                        <div className="flex flex-col gap-2">
                                            {presetNotes.map((preset) => (
                                                <button
                                                    key={preset}
                                                    onClick={() => handleSendPresetNote(preset)}
                                                    className="p-3 rounded-xl border border-slate-150 dark:border-slate-800 text-left text-xs font-semibold hover:border-[#1D9E75]/30 hover:bg-[#1D9E75]/5 text-slate-650 dark:text-slate-350 transition-colors"
                                                >
                                                    {preset}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </Card>

                                {/* Post-it visual preview card */}
                                <div className="p-8 rounded-[32px] bg-gradient-to-tr from-amber-500/10 to-orange-500/10 dark:from-amber-950/20 dark:to-orange-950/20 flex flex-col justify-center items-center h-full min-h-[360px]">
                                    <div className="w-full max-w-sm aspect-square bg-[#FEF08A] text-slate-800 p-8 rounded-xl shadow-2xl flex flex-col justify-between transform -rotate-1 relative transition-all duration-300">
                                        <div className="absolute top-4 left-4 text-xs font-black uppercase tracking-wider text-amber-700/60">
                                            Post-it Preview
                                        </div>
                                        <div className="pt-6 font-semibold italic text-base leading-relaxed text-slate-800">
                                            {encouragementNote.trim() ? `"${encouragementNote}"` : '"Type in the box to see your note here..."'}
                                        </div>
                                        <div className="flex justify-between items-center border-t border-amber-400/40 pt-4">
                                            <span className="text-[10px] font-black uppercase tracking-wider text-amber-700/60">Clarity Parental Note</span>
                                            <Heart className="text-rose-500 fill-rose-500 animate-pulse" size={16} />
                                        </div>
                                    </div>
                                </div>

                            </div>
                        )}

                        {/* TAB 4: AI PARENT ADVISOR */}
                        {activeTab === 'advisor' && (
                            <Card className="p-8 rounded-[32px] bg-white dark:bg-slate-900 border-none shadow-xl space-y-6">
                                <div className="flex items-start gap-4">
                                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#1D9E75] to-emerald-600 flex items-center justify-center text-white flex-shrink-0">
                                        <Sparkles size={24} />
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-black text-slate-900 dark:text-white">AI Parent Advisor</h2>
                                        <p className="text-xs text-slate-400 mt-1">Get immediate advice on explaining difficult CBSE topics, handling test stress, and organizing study time.</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                    
                                    {/* Quick helper questions list */}
                                    <div className="space-y-3">
                                        <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Suggested Questions</p>
                                        {[
                                            `How can I help my child improve in ${summary.weak_chapters.join(', ') || 'their weakest chapters'}?`,
                                            `What does a Syllabus Readiness Score of ${readinessScore}% mean?`,
                                            "How can we reduce exam anxiety at home?",
                                            "What is a good weekly study schedule for grade 9/10?",
                                        ].map((q) => (
                                            <button
                                                key={q}
                                                type="button"
                                                onClick={() => handleAskAdvisorPreset(q)}
                                                className="w-full p-3.5 rounded-xl border border-slate-150 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-left text-[11px] font-bold text-slate-650 dark:text-slate-350 hover:bg-[#1D9E75]/10 hover:border-[#1D9E75]/40 transition-all flex items-center justify-between"
                                            >
                                                <span>{q}</span>
                                                <ArrowRight size={12} className="text-[#1D9E75] shrink-0 ml-2" />
                                            </button>
                                        ))}
                                    </div>

                                    {/* Interactive Chat Console */}
                                    <div className="lg:col-span-2 border border-slate-100 dark:border-slate-850 rounded-[24px] bg-slate-50/50 dark:bg-slate-950/20 p-5 flex flex-col h-[420px]">
                                        <div className="flex-1 overflow-y-auto space-y-4 pr-1 scrollbar-thin">
                                            {chatHistory.map((msg, i) => (
                                                <div 
                                                    key={i} 
                                                    className={`max-w-[85%] p-3.5 rounded-2xl text-xs font-semibold leading-relaxed ${
                                                        msg.sender === 'parent'
                                                            ? 'bg-[#1D9E75] text-white ml-auto'
                                                            : 'bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800/80 text-slate-850 dark:text-slate-350'
                                                    }`}
                                                >
                                                    <p className="whitespace-pre-line">{msg.text}</p>
                                                </div>
                                            ))}
                                            {advisorLoading && (
                                                <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-850 p-3.5 rounded-2xl text-xs font-bold text-slate-450 max-w-[140px] flex items-center gap-2">
                                                    <Clock size={12} className="animate-spin text-[#1D9E75]" />
                                                    <span>Advisor thinking...</span>
                                                </div>
                                            )}
                                            <div ref={chatEndRef} />
                                        </div>

                                        <div className="mt-4 flex gap-2 pt-3 border-t border-slate-150 dark:border-slate-850">
                                            <input
                                                type="text"
                                                value={customAdvisorQuery}
                                                onChange={(e) => setCustomAdvisorQuery(e.target.value)}
                                                onKeyDown={(e) => e.key === 'Enter' && handleAskAdvisorCustom()}
                                                placeholder="Type custom question for parent advisor..."
                                                className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 font-semibold text-xs outline-none focus:ring-1 focus:ring-[#1D9E75] text-slate-800 dark:text-slate-200"
                                            />
                                            <button
                                                onClick={handleAskAdvisorCustom}
                                                className="px-4 py-2.5 bg-[#1D9E75] hover:bg-[#16805d] text-white rounded-xl font-bold flex items-center justify-center transition-colors"
                                                title="Send Question"
                                            >
                                                <Send size={14} />
                                            </button>
                                        </div>
                                    </div>

                                </div>
                            </Card>
                        )}

                        {/* TAB 5: STUDENT ACTIVITY FEED */}
                        {activeTab === 'logs' && (
                            <Card className="p-8 rounded-[32px] bg-white dark:bg-slate-900 border-none shadow-xl space-y-6">
                                <div>
                                    <h2 className="text-xl font-black text-slate-900 dark:text-white inline-flex items-center gap-2">
                                        <Clock size={20} className="text-[#1D9E75]" />
                                        Recent Activity Feed
                                    </h2>
                                    <p className="text-xs text-slate-400 mt-1">Timeline of your child's most recent practice sets and diagnostic assessment attempts.</p>
                                </div>

                                <div className="relative border-l border-slate-100 dark:border-slate-800 pl-6 space-y-6">
                                    {summary.recent_activity && summary.recent_activity.length > 0 ? (
                                        summary.recent_activity.map((item, index) => {
                                            const hasScore = typeof item.score === 'number';
                                            const formattedDate = new Date(item.timestamp).toLocaleDateString(undefined, {
                                                month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                                            });

                                            return (
                                                <div key={index} className="relative">
                                                    {/* Event Dot */}
                                                    <span className={`absolute -left-[31px] top-1.5 w-3.5 h-3.5 rounded-full border-2 border-white dark:border-slate-900 ${
                                                        item.action === 'practice' ? 'bg-[#1D9E75]' : 'bg-sky-500'
                                                    }`} />
                                                    
                                                    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/40 border border-slate-200/40 dark:border-slate-850/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-xs font-black uppercase text-slate-400">
                                                                    {item.action === 'practice' ? 'Practice Set' : 'Question Solved'}
                                                                </span>
                                                                <span className="text-[10px] text-slate-500 font-bold">{formattedDate}</span>
                                                            </div>
                                                            <p className="text-sm font-black text-slate-800 dark:text-slate-205 mt-0.5">
                                                                {item.subject} • {item.chapter}
                                                            </p>
                                                        </div>

                                                        {hasScore && (
                                                            <div className="shrink-0 flex items-center gap-1.5">
                                                                <span className="text-xs font-bold text-slate-500">Score:</span>
                                                                <span className={`px-2.5 py-1 rounded-lg text-xs font-black ${
                                                                    item.score! >= 75 
                                                                        ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20' 
                                                                        : item.score! >= 45 
                                                                            ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/20' 
                                                                            : 'bg-rose-50 text-rose-600 dark:bg-rose-950/20'
                                                                }`}>
                                                                    {item.score}%
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })
                                    ) : (
                                        <div className="text-center py-8">
                                            <p className="text-xs text-slate-500 font-bold">No study activity logs recorded yet.</p>
                                        </div>
                                    )}
                                </div>
                            </Card>
                        )}
                    </>
                )}
            </main>

            {/* Weekly Goals Config Modal */}
            {isGoalsModalOpen && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <Card className="w-full max-w-md p-6 bg-white dark:bg-slate-900 border-none shadow-2xl space-y-6">
                        <div>
                            <h3 className="text-xl font-black text-slate-900 dark:text-white inline-flex items-center gap-2">
                                <Settings className="text-[#1D9E75]" size={20} />
                                Configure Weekly Goals
                            </h3>
                            <p className="text-xs text-slate-400 mt-1">Set academic milestones for your child to achieve this week.</p>
                        </div>

                        <form onSubmit={(e) => {
                            e.preventDefault();
                            const formData = new FormData(e.currentTarget);
                            const hours = Number(formData.get('study_hours') || 3);
                            const sessions = Number(formData.get('sessions') || 5);
                            const exams = Number(formData.get('mock_exams') || 1);
                            handleSaveWeeklyGoals(hours, sessions, exams);
                        }} className="space-y-4">
                            <div>
                                <label className="block text-xs font-black uppercase tracking-wider text-slate-450 mb-2">Target Study Hours / week</label>
                                <input 
                                    name="study_hours" 
                                    type="number" 
                                    min={1} 
                                    max={40} 
                                    defaultValue={goals.target_study_hours}
                                    className="w-full px-4 py-2.5 rounded-xl border-2 border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-bold outline-none focus:ring-1 focus:ring-[#1D9E75] text-slate-900 dark:text-white"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-black uppercase tracking-wider text-slate-450 mb-2">Target Practice Sets / week</label>
                                <input 
                                    name="sessions" 
                                    type="number" 
                                    min={1} 
                                    max={50} 
                                    defaultValue={goals.target_practice_sessions}
                                    className="w-full px-4 py-2.5 rounded-xl border-2 border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-bold outline-none focus:ring-1 focus:ring-[#1D9E75] text-slate-900 dark:text-white"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-black uppercase tracking-wider text-slate-450 mb-2">Target Mock Exams / week</label>
                                <input 
                                    name="mock_exams" 
                                    type="number" 
                                    min={0} 
                                    max={10} 
                                    defaultValue={goals.target_mock_exams}
                                    className="w-full px-4 py-2.5 rounded-xl border-2 border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-bold outline-none focus:ring-1 focus:ring-[#1D9E75] text-slate-900 dark:text-white"
                                />
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button 
                                    type="button" 
                                    onClick={() => setIsGoalsModalOpen(false)}
                                    className="flex-1 py-3 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-850 rounded-xl text-xs font-bold text-slate-500 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="submit"
                                    className="flex-1 py-3 bg-[#1D9E75] hover:bg-[#16805d] text-white rounded-xl text-xs font-black shadow-md transition-colors"
                                >
                                    Save Goals
                                </button>
                            </div>
                        </form>
                    </Card>
                </div>
            )}
        </div>
    );
};
