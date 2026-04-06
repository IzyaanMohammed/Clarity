import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, User, BookOpen, Target, Clock, Brain, Zap, Save, LogOut, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';
import { Navbar } from '../components/layout/Navbar';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { clearAuthToken, clearUser, getUser, saveUser } from '../utils/storage';
import { logoutUser, updateMyProfile } from '../api';

const CLASSES = ['9', '10', '11', '12'];
const SUBJECTS = ['Science', 'Physics', 'Chemistry', 'Biology', 'Maths', 'English', 'Social Science', 'Computer Science'];
const LEARNING_STYLES = ['Visual', 'Auditory', 'Reading/Writing', 'Kinesthetic', 'Mixed'];
const GOALS = ['Score 95+', 'Score 80-95', 'Pass with Merit', 'Improvement', 'Just Prepare'];
const STUDY_HOURS = ['30 min/day', '1 hour/day', '2 hours/day', '3+ hours/day'];

export const Profile = () => {
    const navigate = useNavigate();
    const user = getUser();

    const [name, setName] = useState(user?.name || '');
    const [school, setSchool] = useState(user?.school || '');
    const [selectedClass, setSelectedClass] = useState((user?.class || '10').toString());
    const [selectedSubjects, setSelectedSubjects] = useState<string[]>(user?.subjects || []);
    const [learningStyle, setLearningStyle] = useState(user?.learningStyle || 'Mixed');
    const [goal, setGoal] = useState(user?.goal || 'Score 95+');
    const [studyHours, setStudyHours] = useState(user?.studyHours || '2 hours/day');
    const [focusAreas, setFocusAreas] = useState((user?.focusAreas || '').split(',').map(x => x.trim()).filter(Boolean));
    const [focusInput, setFocusInput] = useState('');

    const toggleSubject = (subject: string) => {
        setSelectedSubjects((prev) =>
            prev.includes(subject)
                ? prev.filter((s) => s !== subject)
                : [...prev, subject]
        );
    };

    const addFocusArea = () => {
        if (focusInput.trim()) {
            setFocusAreas([...focusAreas, focusInput.trim()]);
            setFocusInput('');
        }
    };

    const removeFocusArea = (idx: number) => {
        setFocusAreas(focusAreas.filter((_, i) => i !== idx));
    };

    const handleSave = async () => {
        if (!name || selectedSubjects.length === 0) {
            toast.error('⚠️ Name and subjects are required!');
            return;
        }

        const payload = {
            name,
            school,
            class: Number(selectedClass),
            subjects: selectedSubjects,
            learningStyle,
            goal,
            studyHours,
            focusAreas: focusAreas.join(','),
            examBoard: user?.examBoard,
            preferredLanguage: user?.preferredLanguage,
            preferredPace: user?.preferredPace,
            confidenceLevel: user?.confidenceLevel,
            revisionFrequency: user?.revisionFrequency,
            parentEmail: user?.parentEmail,
        };

        try {
            await updateMyProfile(payload);
            saveUser(payload);
            toast.success('✅ Profile updated successfully!');
            navigate('/dashboard');
        } catch {
            toast.error('Profile sync failed. Please retry.');
        }
    };

    const handleLogout = async () => {
        if (confirm('Are you sure you want to logout? Your profile will be saved.')) {
            try {
                await logoutUser();
            } catch {
                // If backend is unavailable, still allow local logout.
            }
            clearUser();
            clearAuthToken();
            window.location.href = '/onboarding';
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-[#020617] dark:to-slate-900">
            <Navbar />
            <div className="max-w-6xl mx-auto px-4 md:px-8 py-8 mt-20 md:mt-0">
                {/* Header */}
                <div className="mb-10">
                    <button
                        onClick={() => navigate('/dashboard')}
                        className="mb-8 flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:text-[#1D9E75] transition-all font-bold group"
                    >
                        <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
                        Back to Dashboard
                    </button>

                    <div className="flex items-end gap-6">
                        <div className="p-6 bg-gradient-to-br from-[#1D9E75] to-emerald-600 rounded-3xl">
                            <User className="text-white" size={48} />
                        </div>
                        <div>
                            <h1 className="text-4xl font-black text-slate-900 dark:text-white mb-2">Profile Settings</h1>
                            <p className="text-slate-600 dark:text-slate-400 font-bold">Customize your study journey</p>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Main Content */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Identity Section */}
                        <Card className="p-8 bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-[32px]">
                            <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-6 flex items-center gap-3">
                                <User className="text-[#1D9E75]" size={28} />
                                Identity
                            </h2>
                            <div className="space-y-6">
                                <div>
                                    <label className="block text-sm font-black text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-3">
                                        Full Name
                                    </label>
                                    <input
                                        type="text"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        placeholder="Your name"
                                        className="w-full px-5 py-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-bold text-lg outline-none focus:ring-2 focus:ring-[#1D9E75] focus:border-transparent"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-black text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-3">
                                        School Name
                                    </label>
                                    <input
                                        type="text"
                                        value={school}
                                        onChange={(e) => setSchool(e.target.value)}
                                        placeholder="Your school"
                                        className="w-full px-5 py-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-bold text-lg outline-none focus:ring-2 focus:ring-[#1D9E75] focus:border-transparent"
                                    />
                                </div>
                            </div>
                        </Card>

                        {/* Board Settings */}
                        <Card className="p-8 bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-[32px]">
                            <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-6 flex items-center gap-3">
                                <BookOpen className="text-[#1D9E75]" size={28} />
                                Board & Subjects
                            </h2>

                            <div className="space-y-6">
                                <div>
                                    <label className="block text-sm font-black text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-4">
                                        Class
                                    </label>
                                    <div className="grid grid-cols-4 gap-3">
                                        {CLASSES.map((c) => (
                                            <button
                                                key={c}
                                                onClick={() => setSelectedClass(c)}
                                                className={`py-4 rounded-2xl font-black text-lg transition-all transform hover:scale-105 ${selectedClass === c
                                                    ? 'bg-[#1D9E75] text-white shadow-lg'
                                                    : 'bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                                                    }`}
                                            >
                                                {c}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-black text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-4">
                                        Subjects
                                    </label>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                        {SUBJECTS.map((subject) => (
                                            <button
                                                key={subject}
                                                onClick={() => toggleSubject(subject)}
                                                className={`p-4 rounded-2xl border-2 font-bold text-sm transition-all ${selectedSubjects.includes(subject)
                                                    ? 'border-[#1D9E75] bg-emerald-50 dark:bg-emerald-900/20 text-[#1D9E75]'
                                                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                                                    }`}
                                            >
                                                {subject}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </Card>

                        {/* Learning Preferences */}
                        <Card className="p-8 bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-[32px]">
                            <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-6 flex items-center gap-3">
                                <Brain className="text-[#1D9E75]" size={28} />
                                Learning Style
                            </h2>
                            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                                {LEARNING_STYLES.map((style) => (
                                    <button
                                        key={style}
                                        onClick={() => setLearningStyle(style)}
                                        className={`py-4 px-3 rounded-2xl border-2 font-bold text-sm transition-all ${learningStyle === style
                                            ? 'border-[#1D9E75] bg-emerald-50 dark:bg-emerald-900/20 text-[#1D9E75]'
                                            : 'border-slate-200 dark:border-slate-700 text-slate-600'
                                            }`}
                                    >
                                        {style}
                                    </button>
                                ))}
                            </div>
                            <p className="text-xs text-slate-500 mt-4 italic">
                                💡 We'll adapt content based on your learning style
                            </p>
                        </Card>

                        {/* Goals & Study Hours */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <Card className="p-8 bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-[32px]">
                                <h2 className="text-xl font-black text-slate-900 dark:text-white mb-4 flex items-center gap-3">
                                    <Target className="text-[#1D9E75]" size={24} />
                                    Board Goal
                                </h2>
                                <div className="space-y-2">
                                    {GOALS.map((g) => (
                                        <button
                                            key={g}
                                            onClick={() => setGoal(g)}
                                            className={`w-full text-left py-3 px-4 rounded-xl border-2 font-bold transition-all ${goal === g
                                                ? 'border-[#1D9E75] bg-emerald-50 dark:bg-emerald-900/20 text-[#1D9E75]'
                                                : 'border-slate-200 dark:border-slate-700 text-slate-600'
                                                }`}
                                        >
                                            {g}
                                        </button>
                                    ))}
                                </div>
                            </Card>

                            <Card className="p-8 bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-[32px]">
                                <h2 className="text-xl font-black text-slate-900 dark:text-white mb-4 flex items-center gap-3">
                                    <Clock className="text-[#1D9E75]" size={24} />
                                    Daily Commitment
                                </h2>
                                <div className="space-y-2">
                                    {STUDY_HOURS.map((hours) => (
                                        <button
                                            key={hours}
                                            onClick={() => setStudyHours(hours)}
                                            className={`w-full text-left py-3 px-4 rounded-xl border-2 font-bold transition-all ${studyHours === hours
                                                ? 'border-[#1D9E75] bg-emerald-50 dark:bg-emerald-900/20 text-[#1D9E75]'
                                                : 'border-slate-200 dark:border-slate-700 text-slate-600'
                                                }`}
                                        >
                                            {hours}
                                        </button>
                                    ))}
                                </div>
                            </Card>
                        </div>

                        {/* Focus Areas */}
                        <Card className="p-8 bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-[32px]">
                            <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-6 flex items-center gap-3">
                                <Zap className="text-[#1D9E75]" size={28} />
                                Weak Areas (Need Focus)
                            </h2>
                            <div className="space-y-4">
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={focusInput}
                                        onChange={(e) => setFocusInput(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && addFocusArea()}
                                        placeholder="e.g. Organic Chemistry, Trigonometry..."
                                        className="flex-1 px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-medium outline-none focus:ring-2 focus:ring-[#1D9E75]"
                                    />
                                    <button
                                        onClick={addFocusArea}
                                        className="px-4 py-3 bg-[#1D9E75] text-white rounded-xl font-bold hover:bg-[#16805d] transition-all"
                                    >
                                        Add
                                    </button>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {focusAreas.map((area, idx) => (
                                        <div
                                            key={idx}
                                            className="flex items-center gap-2 px-4 py-2 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded-full border border-amber-200 dark:border-amber-800 font-medium text-sm"
                                        >
                                            {area}
                                            <button
                                                onClick={() => removeFocusArea(idx)}
                                                className="text-amber-600 hover:text-amber-800 font-bold ml-1"
                                            >
                                                ×
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </Card>
                    </div>

                    {/* Sidebar */}
                    <div className="space-y-6">
                        {/* Summary Card */}
                        <Card className="p-6 bg-gradient-to-br from-[#1D9E75]/10 to-emerald-50/50 dark:from-emerald-900/20 dark:to-emerald-950/20 border-2 border-[#1D9E75]/30 rounded-[24px]">
                            <h3 className="font-black text-[#1D9E75] mb-4 flex items-center gap-2">
                                <Sparkles size={20} />
                                Your Profile
                            </h3>
                            <div className="space-y-3 text-sm">
                                <div>
                                    <p className="text-slate-600 dark:text-slate-400 font-bold">Class</p>
                                    <p className="text-lg font-black text-slate-900 dark:text-white">{selectedClass}</p>
                                </div>
                                <div>
                                    <p className="text-slate-600 dark:text-slate-400 font-bold">Subjects ({selectedSubjects.length})</p>
                                    <p className="text-slate-900 dark:text-white font-bold">{selectedSubjects.join(', ') || 'None'}</p>
                                </div>
                                <div>
                                    <p className="text-slate-600 dark:text-slate-400 font-bold">Goal</p>
                                    <p className="text-slate-900 dark:text-white font-bold">{goal}</p>
                                </div>
                                <div>
                                    <p className="text-slate-600 dark:text-slate-400 font-bold">Daily Study</p>
                                    <p className="text-slate-900 dark:text-white font-bold">{studyHours}</p>
                                </div>
                            </div>
                        </Card>

                        {/* Action Buttons */}
                        <Button
                            onClick={handleSave}
                            className="w-full py-4 bg-gradient-to-r from-[#1D9E75] to-emerald-600 hover:from-[#16805d] hover:to-emerald-700 text-white font-black rounded-xl shadow-lg transition-all flex items-center justify-center gap-2"
                        >
                            <Save size={20} />
                            Save Changes
                        </Button>

                        <Button
                            onClick={handleLogout}
                            className="w-full py-4 bg-red-100 dark:bg-red-900/20 hover:bg-red-200 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 font-black rounded-xl transition-all flex items-center justify-center gap-2 border-2 border-red-200 dark:border-red-800"
                        >
                            <LogOut size={20} />
                            Logout
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
};
