import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, User, BookOpen, Target, Clock, Brain, Zap, Save, LogOut, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';
import { Navbar } from '../components/layout/Navbar';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { clearAuthToken, clearUser, getUser, saveUser } from '../utils/storage';
import { logoutUser, updateMyProfile } from '../api';

const CLASSES = ['8', '9', '10', '11', '12'];
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
    const [parentEmail, setParentEmail] = useState(user?.parentEmail || '');
    const [subscriptionTier, setSubscriptionTier] = useState<'free' | 'pro' | 'pro_max'>(user?.subscriptionTier || 'free');
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

        if (!parentEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(parentEmail.trim())) {
            toast.error('⚠️ Valid parent email is required.');
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
            parentEmail: parentEmail.trim(),
            subscriptionTier: subscriptionTier,
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
        <div className="min-h-screen bg-gradient-to-br from-stone-50 to-blue-50 ">
            <Navbar />
            <div className="max-w-6xl mx-auto px-4 md:px-8 py-8 mt-20 md:mt-0">
                {/* Header */}
                <div className="mb-10">
                    <button
                        onClick={() => navigate('/dashboard')}
                        className="mb-8 flex items-center gap-2 text-stone-600 hover:text-[#8C5A35] transition-all font-bold group"
                    >
                        <ArrowLeft size={20} className="group-hover:-transtone-x-1 transition-transform" />
                        Back to Dashboard
                    </button>

                    <div className="flex items-end gap-6">
                        <div className="p-6 bg-gradient-to-br from-[#8C5A35] to-amber-600 rounded-3xl">
                            <User className="text-white" size={48} />
                        </div>
                        <div>
                            <h1 className="text-4xl font-black text-[#2C241B] mb-2">Profile Settings</h1>
                            <p className="text-stone-600 font-bold">Customize your study journey</p>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Main Content */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Identity Section */}
                        <Card className="p-8 bg-[#FCFAF8] border-2 border-stone-100 rounded-[32px]">
                            <h2 className="text-2xl font-black text-[#2C241B] mb-6 flex items-center gap-3">
                                <User className="text-[#8C5A35]" size={28} />
                                Identity
                            </h2>
                            <div className="space-y-6">
                                <div>
                                    <label className="block text-sm font-black text-stone-600 uppercase tracking-wider mb-3">
                                        Full Name
                                    </label>
                                    <input
                                        type="text"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        placeholder="Your name"
                                        className="w-full px-5 py-4 rounded-2xl bg-[#FCFAF8] border-3 border-[#2C241B] shadow-neo text-[#2C241B] font-bold text-lg outline-none focus:ring-2 focus:ring-[#8C5A35] focus:border-transparent"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-black text-stone-600 uppercase tracking-wider mb-3">
                                        School Name
                                    </label>
                                    <input
                                        type="text"
                                        value={school}
                                        onChange={(e) => setSchool(e.target.value)}
                                        placeholder="Your school"
                                        className="w-full px-5 py-4 rounded-2xl bg-[#FCFAF8] border-3 border-[#2C241B] shadow-neo text-[#2C241B] font-bold text-lg outline-none focus:ring-2 focus:ring-[#8C5A35] focus:border-transparent"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-black text-stone-600 uppercase tracking-wider mb-3">
                                        Parent Email
                                    </label>
                                    <input
                                        type="email"
                                        value={parentEmail}
                                        onChange={(e) => setParentEmail(e.target.value)}
                                        placeholder="parent@example.com"
                                        className="w-full px-5 py-4 rounded-2xl bg-[#FCFAF8] border-3 border-[#2C241B] shadow-neo text-[#2C241B] font-bold text-lg outline-none focus:ring-2 focus:ring-[#8C5A35] focus:border-transparent"
                                    />
                                </div>
                            </div>
                        </Card>

                        {/* Board Settings */}
                        <Card className="p-8 bg-[#FCFAF8] border-2 border-stone-100 rounded-[32px]">
                            <h2 className="text-2xl font-black text-[#2C241B] mb-6 flex items-center gap-3">
                                <BookOpen className="text-[#8C5A35]" size={28} />
                                Board & Subjects
                            </h2>

                            <div className="space-y-6">
                                <div>
                                    <label className="block text-sm font-black text-stone-600 uppercase tracking-wider mb-4">
                                        Class
                                    </label>
                                    <div className="grid grid-cols-4 gap-3">
                                        {CLASSES.map((c) => (
                                            <button
                                                key={c}
                                                onClick={() => setSelectedClass(c)}
                                                className={`py-4 rounded-2xl font-black text-lg transition-all transform hover:scale-105 ${selectedClass === c
                                                    ? 'bg-[#8C5A35] text-white '
                                                    : 'bg-[#F2EFE9] text-stone-600 hover:bg-[#E8E4DB]'
                                                    }`}
                                            >
                                                {c}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-black text-stone-600 uppercase tracking-wider mb-4">
                                        Subjects
                                    </label>
                                    {/* Dynamically filter subjects based on grade to combine Physics/Chemistry/Biology under Science for grades 8, 9, 10 */}
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                        {(['11', '12'].includes(selectedClass)
                                            ? ['Physics', 'Chemistry', 'Biology', 'Maths', 'English']
                                            : ['Science', 'Maths', 'English', 'Social Science']
                                        ).map((subject) => (
                                            <button
                                                key={subject}
                                                onClick={() => toggleSubject(subject)}
                                                className={`p-4 rounded-2xl border-2 font-bold text-sm transition-all ${selectedSubjects.includes(subject)
                                                    ? 'border-[#8C5A35] bg-amber-50 text-[#8C5A35]'
                                                    : 'border-stone-200 text-stone-600 '
                                                    }`}
                                            >
                                                {subject}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                            </div>
                        </Card>

                        {/* Subscription Tier Selection */}
                        <Card className="p-8 bg-[#FCFAF8] border-2 border-stone-100 rounded-[32px]">
                            <h2 className="text-2xl font-black text-[#2C241B] mb-6 flex items-center gap-3">
                                <Sparkles className="text-[#8C5A35]" size={28} />
                                Subscription Plan
                            </h2>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {[
                                    {
                                        id: 'free',
                                        name: 'Free',
                                        desc: 'Standard limits, CBSE core practice',
                                        activeColor: 'border-stone-400 bg-[#FCFAF8] text-[#3E352B] ',
                                    },
                                    {
                                        id: 'pro',
                                        name: 'Pro',
                                        desc: 'Unlimited coach questions & AI notes',
                                        activeColor: 'border-stone-900 bg-stone-950 text-white ',
                                        inactiveColor: 'border-stone-800 bg-stone-900 text-stone-200 ',
                                    },
                                    {
                                        id: 'pro_max',
                                        name: 'Pro Max',
                                        desc: 'All Pro + Parent Portal & Milestones',
                                        activeColor: 'border-amber-500 bg-amber-50 text-amber-700 ',
                                        inactiveColor: 'border-stone-200 text-stone-600 hover:border-stone-350',
                                    },
                                ].map((plan) => (
                                    <button
                                        key={plan.id}
                                        type="button"
                                        onClick={() => setSubscriptionTier(plan.id as 'free' | 'pro' | 'pro_max')}
                                        className={`p-5 rounded-2xl border-2 text-left transition-all hover:scale-[1.02] flex flex-col justify-between h-36 ${
                                            subscriptionTier === plan.id
                                                ? plan.activeColor
                                                : plan.inactiveColor || 'border-stone-200 text-stone-600 hover:border-stone-350'
                                        }`}
                                    >
                                        <div>
                                            <p className={`font-black text-lg ${plan.id === 'pro' && subscriptionTier !== 'pro' ? 'text-white' : ''}`}>{plan.name}</p>
                                            <p className={`text-xs mt-1 leading-relaxed opacity-90 ${plan.id === 'pro' && subscriptionTier !== 'pro' ? 'text-stone-300' : ''}`}>{plan.desc}</p>
                                        </div>
                                        <div className="mt-3 flex items-center gap-1">
                                            <span className="text-[10px] uppercase font-black tracking-widest px-2.5 py-1 bg-[#FCFAF8]/40 rounded-md">
                                                {subscriptionTier === plan.id ? 'Active' : 'Select'}
                                            </span>
                                        </div>
                                    </button>
                                ))}
                            </div>
                            <p className="text-[10px] text-stone-400 mt-4 italic font-semibold">
                                * Plan upgrades are processed instantly. In development, self-assigned subscription changes are allowed.
                            </p>
                        </Card>

                        {/* Learning Preferences */}
                        <Card className="p-8 bg-[#FCFAF8] border-2 border-stone-100 rounded-[32px]">
                            <h2 className="text-2xl font-black text-[#2C241B] mb-6 flex items-center gap-3">
                                <Brain className="text-[#8C5A35]" size={28} />
                                Learning Style
                            </h2>
                            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                                {LEARNING_STYLES.map((style) => (
                                    <button
                                        key={style}
                                        onClick={() => setLearningStyle(style)}
                                        className={`py-4 px-3 rounded-2xl border-2 font-bold text-sm transition-all ${learningStyle === style
                                            ? 'border-[#8C5A35] bg-amber-50 text-[#8C5A35]'
                                            : 'border-stone-200 text-stone-600'
                                            }`}
                                    >
                                        {style}
                                    </button>
                                ))}
                            </div>
                            <p className="text-xs text-stone-500 mt-4 italic">
                                💡 We'll adapt content based on your learning style
                            </p>
                        </Card>

                        {/* Goals & Study Hours */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <Card className="p-8 bg-[#FCFAF8] border-2 border-stone-100 rounded-[32px]">
                                <h2 className="text-xl font-black text-[#2C241B] mb-4 flex items-center gap-3">
                                    <Target className="text-[#8C5A35]" size={24} />
                                    Board Goal
                                </h2>
                                <div className="space-y-2">
                                    {GOALS.map((g) => (
                                        <button
                                            key={g}
                                            onClick={() => setGoal(g)}
                                            className={`w-full text-left py-3 px-4 rounded-xl border-2 font-bold transition-all ${goal === g
                                                ? 'border-[#8C5A35] bg-amber-50 text-[#8C5A35]'
                                                : 'border-stone-200 text-stone-600'
                                                }`}
                                        >
                                            {g}
                                        </button>
                                    ))}
                                </div>
                            </Card>

                            <Card className="p-8 bg-[#FCFAF8] border-2 border-stone-100 rounded-[32px]">
                                <h2 className="text-xl font-black text-[#2C241B] mb-4 flex items-center gap-3">
                                    <Clock className="text-[#8C5A35]" size={24} />
                                    Daily Commitment
                                </h2>
                                <div className="space-y-2">
                                    {STUDY_HOURS.map((hours) => (
                                        <button
                                            key={hours}
                                            onClick={() => setStudyHours(hours)}
                                            className={`w-full text-left py-3 px-4 rounded-xl border-2 font-bold transition-all ${studyHours === hours
                                                ? 'border-[#8C5A35] bg-amber-50 text-[#8C5A35]'
                                                : 'border-stone-200 text-stone-600'
                                                }`}
                                        >
                                            {hours}
                                        </button>
                                    ))}
                                </div>
                            </Card>
                        </div>


                        {/* School Focus Chapters */}
                        <Card className="p-8 bg-[#FCFAF8] border-2 border-stone-100 rounded-[32px]">
                            <div className="flex justify-between items-start gap-4 flex-wrap mb-6">
                                <div>
                                    <h2 className="text-2xl font-black text-[#2C241B] flex items-center gap-3">
                                        <Target className="text-[#8C5A35]" size={28} />
                                        School Focus Chapters
                                    </h2>
                                    <p className="text-xs text-stone-500 mt-1">Select the chapters you are covering in class this week to personalize your AI tutor.</p>
                                </div>
                                <Button
                                    onClick={() => navigate('/onboarding', { state: { editFocus: true } })}
                                    className="bg-amber-50 text-[#8C5A35] hover:bg-[#8C5A35]/10 border border-[#8C5A35]/30 font-bold px-4 py-2 rounded-xl text-sm"
                                >
                                    Select / Edit Chapters
                                </Button>
                            </div>
                            
                            <div className="space-y-3">
                                {user?.focusChapters && Object.keys(user.focusChapters).length > 0 && Object.values(user.focusChapters).some(list => list.length > 0) ? (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        {Object.entries(user.focusChapters).map(([subj, chaps]) => {
                                            if (!chaps || chaps.length === 0) return null;
                                            return (
                                                <div key={subj} className="p-4 bg-[#FCFAF8] rounded-2xl border-3 border-[#2C241B] shadow-neo ">
                                                    <p className="text-xs font-black uppercase text-stone-400 mb-1">{subj}</p>
                                                    <p className="text-sm font-bold text-[#3E352B] ">{chaps.join(', ')}</p>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="p-6 text-center bg-[#FCFAF8] rounded-2xl border-2 border-dashed border-stone-200 ">
                                        <p className="text-sm text-stone-500 font-bold">No school focus chapters selected for this week.</p>
                                    </div>
                                )}
                            </div>
                        </Card>

                        {/* Focus Areas */}
                        <Card className="p-8 bg-[#FCFAF8] border-2 border-stone-100 rounded-[32px]">
                            <h2 className="text-2xl font-black text-[#2C241B] mb-6 flex items-center gap-3">
                                <Zap className="text-[#8C5A35]" size={28} />
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
                                        className="flex-1 px-4 py-3 rounded-xl bg-[#FCFAF8] border-3 border-[#2C241B] shadow-neo text-[#2C241B] font-medium outline-none focus:ring-2 focus:ring-[#8C5A35]"
                                    />
                                    <button
                                        onClick={addFocusArea}
                                        className="px-4 py-3 bg-[#8C5A35] text-white rounded-xl font-bold hover:bg-[#70482B] border-3 border-[#2C241B] shadow-neo hover:translate-y-[2px] hover:translate-x-[2px] hover:shadow-neo-sm active:translate-x-[4px] active:translate-y-[4px] active:shadow-none transition-all transition-all"
                                    >
                                        Add
                                    </button>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {focusAreas.map((area, idx) => (
                                        <div
                                            key={idx}
                                            className="flex items-center gap-2 px-4 py-2 bg-amber-100 text-amber-700 rounded-full border-3 border-[#2C241B] shadow-neo font-medium text-sm"
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
                        <Card className="p-6 bg-gradient-to-br from-[#8C5A35]/10 to-amber-50/50 border-2 border-[#8C5A35]/30 rounded-[24px]">
                            <h3 className="font-black text-[#8C5A35] mb-4 flex items-center gap-2">
                                <Sparkles size={20} />
                                Your Profile
                            </h3>
                            <div className="space-y-3 text-sm">
                                <div>
                                    <p className="text-stone-600 font-bold">Class</p>
                                    <p className="text-lg font-black text-[#2C241B] ">{selectedClass}</p>
                                </div>
                                <div>
                                    <p className="text-stone-600 font-bold">Subjects ({selectedSubjects.length})</p>
                                    <p className="text-[#2C241B] font-bold">{selectedSubjects.join(', ') || 'None'}</p>
                                </div>
                                <div>
                                    <p className="text-stone-600 font-bold">Goal</p>
                                    <p className="text-[#2C241B] font-bold">{goal}</p>
                                </div>
                                <div>
                                    <p className="text-stone-600 font-bold">Daily Study</p>
                                    <p className="text-[#2C241B] font-bold">{studyHours}</p>
                                </div>
                                <div>
                                    <p className="text-stone-600 font-bold">Plan</p>
                                    <p className="text-[#2C241B] font-black uppercase text-xs tracking-wider">
                                        {subscriptionTier === 'pro_max' ? 'Pro Max 🌟' : subscriptionTier === 'pro' ? 'Pro ⚡' : 'Free 📚'}
                                    </p>
                                </div>
                            </div>
                        </Card>

                        {/* Action Buttons */}
                        <Button
                            onClick={handleSave}
                            className="w-full py-4 bg-gradient-to-r from-[#8C5A35] to-amber-600 hover:from-[#70482B] hover:to-amber-700 text-white font-black rounded-xl  transition-all flex items-center justify-center gap-2"
                        >
                            <Save size={20} />
                            Save Changes
                        </Button>

                        <Button
                            onClick={handleLogout}
                            className="w-full py-4 bg-red-100 hover:bg-red-200 :bg-red-900/40 text-red-600 font-black rounded-xl transition-all flex items-center justify-center gap-2 border-2 border-red-200 "
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
