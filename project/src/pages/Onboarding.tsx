import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ArrowLeft,
    ArrowRight,
    BookMarked,
    BookOpen,
    Check,
    Clock,
    Eye,
    Hand,
    School,
    Sparkles,
    Trash2,
    User,
    Volume2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Card } from '../components/ui/Card';
import { getAuthToken, getUser, saveAuthToken, saveUser } from '../utils/storage';
import { loginUser, registerUser, updateMyProfile } from '../api';
import { useCurriculumCatalog } from '../hooks/useCurriculumCatalog';

const CLASSES = ['9', '10', '11', '12'];

const LEARNING_STYLES = [
    { name: 'Visual', icon: Eye, desc: 'Diagrams, charts, colors' },
    { name: 'Auditory', icon: Volume2, desc: 'Explanations and discussions' },
    { name: 'Reading/Writing', icon: BookMarked, desc: 'Notes and structured text' },
    { name: 'Kinesthetic', icon: Hand, desc: 'Practice and hands-on learning' },
];

const GOALS = ['Score 95+', 'Score 80-95', 'Pass with Merit', 'Improve Gradually', 'Build Confidence'];
const STUDY_HOURS = ['30 min/day', '1 hour/day', '2 hours/day', '3+ hours/day'];
const CHALLENGES = ['Time Management', 'Weak Concepts', 'Exam Anxiety', 'Consistency', 'No Major Challenge'];
const EXAM_BOARDS = ['CBSE', 'ICSE', 'State Board', 'IB'];
const LANGUAGES = ['English', 'Hinglish', 'Hindi'];
const PACES = ['Slow and detailed', 'Balanced', 'Fast and concise'];
const CONFIDENCE_LEVELS = ['Needs strong support', 'Average confidence', 'High confidence'];
const REVISION_FREQUENCY = ['Daily', 'Alternate days', 'Twice a week', 'Weekly'];

export const Onboarding = () => {
    const navigate = useNavigate();
    const existingUser = getUser();
    const existingToken = getAuthToken();
    const isEditing = !!existingUser;

    const [step, setStep] = useState(0);
    const [name, setName] = useState(existingUser?.name || '');
    const [password, setPassword] = useState('');
    const [school, setSchool] = useState(existingUser?.school || '');
    const [selectedClass, setSelectedClass] = useState((existingUser?.class || '10').toString());
    const [selectedSubjects, setSelectedSubjects] = useState<string[]>(existingUser?.subjects || []);
    const { subjectsForClass } = useCurriculumCatalog(selectedClass);
    const availableSubjects = subjectsForClass.length ? subjectsForClass : [
        'Science',
        'Physics',
        'Chemistry',
        'Biology',
        'Maths',
        'English',
        'Social Science',
        'Computer Science',
    ];
    const [learningStyle, setLearningStyle] = useState(existingUser?.learningStyle || '');
    const [goal, setGoal] = useState(existingUser?.goal || '');
    const [studyHours, setStudyHours] = useState(existingUser?.studyHours || '');
    const [mainChallenge, setMainChallenge] = useState(existingUser?.focusAreas || '');
    const [examBoard, setExamBoard] = useState(existingUser?.examBoard || 'CBSE');
    const [preferredLanguage, setPreferredLanguage] = useState(existingUser?.preferredLanguage || 'English');
    const [preferredPace, setPreferredPace] = useState(existingUser?.preferredPace || 'Balanced');
    const [confidenceLevel, setConfidenceLevel] = useState(existingUser?.confidenceLevel || 'Average confidence');
    const [revisionFrequency, setRevisionFrequency] = useState(existingUser?.revisionFrequency || 'Alternate days');
    const [parentEmail, setParentEmail] = useState(existingUser?.parentEmail || '');

    const steps = [
        { title: 'Welcome', subtitle: 'Set up your personal AI tutor in under 1 minute' },
        { title: 'About You', subtitle: 'Name and school details' },
        { title: 'Class', subtitle: 'Board level you are preparing for' },
        { title: 'Subjects', subtitle: 'Pick all subjects you study' },
        { title: 'Learning Style', subtitle: 'How you understand best' },
        { title: 'Goal', subtitle: 'Your target this year' },
        { title: 'Time Commitment', subtitle: 'Daily study capacity' },
        { title: 'Main Challenge', subtitle: 'Where you need the most support' },
        { title: 'Deep Personalization', subtitle: 'Set pace, language and revision behavior' },
        { title: 'Finish', subtitle: 'Review and begin your journey' },
    ];

    const toggleSubject = (subject: string) => {
        setSelectedSubjects((prev) =>
            prev.includes(subject) ? prev.filter((s) => s !== subject) : [...prev, subject]
        );
    };

    useEffect(() => {
        setSelectedSubjects((prev) => prev.filter((subject) => availableSubjects.includes(subject)));
    }, [selectedClass, availableSubjects.join('|')]);

    const validateStep = () => {
        if (step === 1 && (!name.trim() || !school.trim())) {
            toast.error('Please fill in your full name and school.');
            return false;
        }

        if (step === 3 && selectedSubjects.length === 0) {
            toast.error('Pick at least one subject to continue.');
            return false;
        }

        if (step === 4 && !learningStyle) {
            toast.error('Select a learning style.');
            return false;
        }

        if (step === 5 && !goal) {
            toast.error('Select your target goal.');
            return false;
        }

        if (step === 6 && !studyHours) {
            toast.error('Select your daily commitment.');
            return false;
        }

        if (step === 7 && !mainChallenge) {
            toast.error('Select your main challenge.');
            return false;
        }

        if (step === 8 && (!examBoard || !preferredLanguage || !preferredPace || !confidenceLevel || !revisionFrequency)) {
            toast.error('Complete the personalization settings.');
            return false;
        }

        return true;
    };

    const handleNext = () => {
        if (!validateStep()) return;
        setStep((prev) => Math.min(prev + 1, steps.length - 1));
    };

    const handleComplete = async () => {
        const profile = {
            name: name.trim(),
            school: school.trim(),
            class: Number(selectedClass),
            subjects: selectedSubjects,
            learningStyle,
            goal,
            studyHours,
            focusAreas: mainChallenge,
            examBoard,
            preferredLanguage,
            preferredPace,
            confidenceLevel,
            revisionFrequency,
            parentEmail: parentEmail.trim() || undefined,
        };

        try {
            if (isEditing && existingToken) {
                await updateMyProfile(profile);
                saveUser(profile);
                toast.success('Profile updated successfully.');
                navigate('/dashboard');
                return;
            }

            if (!password.trim() || password.trim().length < 6) {
                toast.error('Set a password with at least 6 characters.');
                return;
            }

            const result = await registerUser({ profile, password: password.trim() });
            saveAuthToken(result.token);
            saveUser(result.user);
            toast.success('Welcome to Clarity.');
            navigate('/dashboard');
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Unable to complete onboarding right now.';
            toast.error(message);
        }
    };

    const handleReset = () => {
        if (confirm('Reset all saved data? This cannot be undone.')) {
            localStorage.clear();
            window.location.reload();
        }
    };

    const progress = ((step + 1) / steps.length) * 100;

    const handleLogin = async () => {
        if (!name.trim() || !password.trim()) {
            toast.error('Enter name and password to login.');
            return;
        }
        try {
            const result = await loginUser({ name: name.trim(), password: password.trim() });
            saveAuthToken(result.token);
            saveUser(result.user);
            toast.success('Logged in successfully.');
            navigate('/dashboard');
        } catch {
            toast.error('Invalid credentials or account not found.');
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-[#1D9E75]/5 via-slate-50 to-emerald-50/30 dark:from-[#020617] dark:via-slate-950 dark:to-emerald-950/20 flex items-center justify-center p-4 md:p-8">
            <div className="w-full max-w-3xl">
                <div className="mb-8">
                    <div className="flex items-end justify-between gap-4 mb-3">
                        <div>
                            <h1 className="text-3xl md:text-4xl font-black text-slate-900 dark:text-white">{steps[step].title}</h1>
                            <p className="text-slate-600 dark:text-slate-400 font-semibold mt-1">{steps[step].subtitle}</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                            <p className="text-3xl font-black text-[#1D9E75]">{step + 1}</p>
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">of {steps.length}</p>
                        </div>
                    </div>
                    <div className="h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-[#1D9E75] to-emerald-500 transition-all duration-300"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                </div>

                <Card className="p-6 md:p-10 bg-white dark:bg-slate-900 border-none shadow-2xl rounded-[32px]">
                    {step === 0 && (
                        <div className="text-center py-6">
                            <div className="inline-flex items-center justify-center w-24 h-24 rounded-[28px] bg-gradient-to-br from-[#1D9E75]/20 to-emerald-100 dark:from-emerald-900/40 dark:to-emerald-800/30 mb-6">
                                <BookOpen className="text-[#1D9E75]" size={44} />
                            </div>
                            <h2 className="text-4xl font-black text-slate-900 dark:text-white mb-3">Welcome to Clarity</h2>
                            <p className="text-slate-600 dark:text-slate-400 font-semibold max-w-xl mx-auto leading-relaxed">
                                This setup asks 12+ personalization inputs through guided choices so every answer, plan, and practice set feels tutor-level personalized.
                            </p>
                            <div className="mt-8 grid grid-cols-3 gap-3 max-w-md mx-auto text-sm font-bold">
                                <div className="rounded-xl bg-slate-100 dark:bg-slate-800 py-3">AI Tutor</div>
                                <div className="rounded-xl bg-slate-100 dark:bg-slate-800 py-3">Board Focus</div>
                                <div className="rounded-xl bg-slate-100 dark:bg-slate-800 py-3">Action Plan</div>
                            </div>

                            {!isEditing && (
                                <div className="mt-8 max-w-md mx-auto text-left p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60">
                                    <p className="text-xs font-black uppercase tracking-wider text-slate-500 mb-3">Already have an account?</p>
                                    <div className="space-y-3">
                                        <input
                                            type="text"
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            placeholder="Name"
                                            className="w-full px-3 py-2 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-semibold"
                                        />
                                        <input
                                            type="password"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            placeholder="Password"
                                            className="w-full px-3 py-2 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-semibold"
                                        />
                                        <button
                                            onClick={handleLogin}
                                            className="w-full py-2 rounded-xl bg-slate-900 dark:bg-white dark:text-slate-900 text-white text-xs font-black uppercase tracking-wider"
                                        >
                                            Login
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {step === 1 && (
                        <div className="space-y-5">
                            <div>
                                <label className="flex items-center gap-2 text-sm font-black text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-2">
                                    <User size={16} className="text-[#1D9E75]" />
                                    Full Name
                                </label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-semibold outline-none focus:ring-4 focus:ring-[#1D9E75]/20 focus:border-[#1D9E75]"
                                    placeholder="e.g. Aditi Sharma"
                                    autoFocus
                                />
                            </div>
                            <div>
                                <label className="flex items-center gap-2 text-sm font-black text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-2">
                                    <School size={16} className="text-[#1D9E75]" />
                                    School Name
                                </label>
                                <input
                                    type="text"
                                    value={school}
                                    onChange={(e) => setSchool(e.target.value)}
                                    className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-semibold outline-none focus:ring-4 focus:ring-[#1D9E75]/20 focus:border-[#1D9E75]"
                                    placeholder="e.g. DPS Noida"
                                />
                            </div>
                            <div>
                                <label className="flex items-center gap-2 text-sm font-black text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-2">
                                    <Sparkles size={16} className="text-[#1D9E75]" />
                                    Password
                                </label>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-semibold outline-none focus:ring-4 focus:ring-[#1D9E75]/20 focus:border-[#1D9E75]"
                                    placeholder={isEditing ? 'Keep unchanged unless re-registering' : 'At least 6 characters'}
                                />
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="grid grid-cols-4 gap-3">
                            {CLASSES.map((entry) => (
                                <button
                                    key={entry}
                                    onClick={() => setSelectedClass(entry)}
                                    className={`py-6 rounded-2xl font-black text-2xl transition-all ${selectedClass === entry
                                        ? 'bg-[#1D9E75] text-white shadow-lg shadow-[#1D9E75]/30'
                                        : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                                        }`}
                                >
                                    {entry}
                                </button>
                            ))}
                        </div>
                    )}

                    {step === 3 && (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            {availableSubjects.map((subject) => {
                                const selected = selectedSubjects.includes(subject);
                                return (
                                    <button
                                        key={subject}
                                        onClick={() => toggleSubject(subject)}
                                        className={`p-4 rounded-2xl border-2 transition-all text-sm font-bold min-h-[92px] flex flex-col justify-between ${selected
                                            ? 'border-[#1D9E75] bg-emerald-50 dark:bg-emerald-900/20 text-[#1D9E75]'
                                            : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                                            }`}
                                    >
                                        <span className="leading-tight break-words">{subject}</span>
                                        <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${selected ? 'bg-[#1D9E75] border-[#1D9E75]' : 'border-slate-300 dark:border-slate-600'}`}>
                                            {selected && <Check size={13} className="text-white" />}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {step === 4 && (
                        <div className="space-y-3">
                            {LEARNING_STYLES.map(({ name: label, icon: Icon, desc }) => (
                                <button
                                    key={label}
                                    onClick={() => setLearningStyle(label)}
                                    className={`w-full rounded-2xl border-2 p-4 text-left flex items-center gap-4 ${learningStyle === label
                                        ? 'border-[#1D9E75] bg-emerald-50 dark:bg-emerald-900/20'
                                        : 'border-slate-200 dark:border-slate-700'
                                        }`}
                                >
                                    <Icon size={26} className={learningStyle === label ? 'text-[#1D9E75]' : 'text-slate-400'} />
                                    <div>
                                        <p className="font-black text-slate-900 dark:text-white">{label}</p>
                                        <p className="text-sm text-slate-500 dark:text-slate-400">{desc}</p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}

                    {step === 5 && (
                        <div className="space-y-3">
                            {GOALS.map((entry) => (
                                <button
                                    key={entry}
                                    onClick={() => setGoal(entry)}
                                    className={`w-full p-4 rounded-2xl border-2 text-left font-bold ${goal === entry
                                        ? 'border-[#1D9E75] bg-emerald-50 dark:bg-emerald-900/20 text-[#1D9E75]'
                                        : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                                        }`}
                                >
                                    {entry}
                                </button>
                            ))}
                        </div>
                    )}

                    {step === 6 && (
                        <div className="space-y-3">
                            {STUDY_HOURS.map((entry) => (
                                <button
                                    key={entry}
                                    onClick={() => setStudyHours(entry)}
                                    className={`w-full p-4 rounded-2xl border-2 text-left font-bold flex items-center gap-3 ${studyHours === entry
                                        ? 'border-[#1D9E75] bg-emerald-50 dark:bg-emerald-900/20 text-[#1D9E75]'
                                        : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                                        }`}
                                >
                                    <Clock size={18} />
                                    {entry}
                                </button>
                            ))}
                        </div>
                    )}

                    {step === 7 && (
                        <div className="space-y-3">
                            {CHALLENGES.map((entry) => (
                                <button
                                    key={entry}
                                    onClick={() => setMainChallenge(entry)}
                                    className={`w-full p-4 rounded-2xl border-2 text-left font-bold ${mainChallenge === entry
                                        ? 'border-[#1D9E75] bg-emerald-50 dark:bg-emerald-900/20 text-[#1D9E75]'
                                        : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                                        }`}
                                >
                                    {entry}
                                </button>
                            ))}
                        </div>
                    )}

                    {step === 8 && (
                        <div className="space-y-6">
                            <div>
                                <p className="text-xs font-black uppercase tracking-wide text-slate-500 mb-2">Exam Board</p>
                                <div className="grid grid-cols-2 gap-2">
                                    {EXAM_BOARDS.map((entry) => (
                                        <button
                                            key={entry}
                                            onClick={() => setExamBoard(entry)}
                                            className={`p-3 rounded-xl border-2 text-sm font-bold ${examBoard === entry
                                                ? 'border-[#1D9E75] bg-emerald-50 dark:bg-emerald-900/20 text-[#1D9E75]'
                                                : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                                                }`}
                                        >
                                            {entry}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <p className="text-xs font-black uppercase tracking-wide text-slate-500 mb-2">Preferred Language</p>
                                    <select
                                        value={preferredLanguage}
                                        onChange={(e) => setPreferredLanguage(e.target.value)}
                                        className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-semibold"
                                    >
                                        {LANGUAGES.map((entry) => (
                                            <option key={entry} value={entry}>{entry}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <p className="text-xs font-black uppercase tracking-wide text-slate-500 mb-2">Response Pace</p>
                                    <select
                                        value={preferredPace}
                                        onChange={(e) => setPreferredPace(e.target.value)}
                                        className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-semibold"
                                    >
                                        {PACES.map((entry) => (
                                            <option key={entry} value={entry}>{entry}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <p className="text-xs font-black uppercase tracking-wide text-slate-500 mb-2">Confidence Level</p>
                                    <select
                                        value={confidenceLevel}
                                        onChange={(e) => setConfidenceLevel(e.target.value)}
                                        className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-semibold"
                                    >
                                        {CONFIDENCE_LEVELS.map((entry) => (
                                            <option key={entry} value={entry}>{entry}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <p className="text-xs font-black uppercase tracking-wide text-slate-500 mb-2">Revision Frequency</p>
                                    <select
                                        value={revisionFrequency}
                                        onChange={(e) => setRevisionFrequency(e.target.value)}
                                        className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-semibold"
                                    >
                                        {REVISION_FREQUENCY.map((entry) => (
                                            <option key={entry} value={entry}>{entry}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div>
                                <p className="text-xs font-black uppercase tracking-wide text-slate-500 mb-2">Parent Email (optional)</p>
                                <input
                                    type="email"
                                    value={parentEmail}
                                    onChange={(e) => setParentEmail(e.target.value)}
                                    placeholder="parent@example.com"
                                    className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-semibold"
                                />
                            </div>
                        </div>
                    )}

                    {step === 9 && (
                        <div className="text-center py-6 space-y-5">
                            <div className="text-5xl">🎯</div>
                            <h2 className="text-3xl font-black text-slate-900 dark:text-white">Ready to Start</h2>
                            <p className="text-slate-600 dark:text-slate-400 font-semibold max-w-lg mx-auto">
                                {name || 'Student'}, your tutor is now tuned for Class {selectedClass}, {selectedSubjects.length} subjects, {learningStyle || 'your'} style, and a {goal || 'custom'} goal.
                            </p>
                            <div className="grid grid-cols-2 gap-3 text-left max-w-xl mx-auto">
                                <div className="bg-slate-100 dark:bg-slate-800 rounded-xl p-3">
                                    <p className="text-xs uppercase font-bold text-slate-500">Daily Time</p>
                                    <p className="font-black text-slate-900 dark:text-white">{studyHours}</p>
                                </div>
                                <div className="bg-slate-100 dark:bg-slate-800 rounded-xl p-3">
                                    <p className="text-xs uppercase font-bold text-slate-500">Main Challenge</p>
                                    <p className="font-black text-slate-900 dark:text-white">{mainChallenge}</p>
                                </div>
                                <div className="bg-slate-100 dark:bg-slate-800 rounded-xl p-3">
                                    <p className="text-xs uppercase font-bold text-slate-500">Language & Pace</p>
                                    <p className="font-black text-slate-900 dark:text-white">{preferredLanguage} • {preferredPace}</p>
                                </div>
                                <div className="bg-slate-100 dark:bg-slate-800 rounded-xl p-3">
                                    <p className="text-xs uppercase font-bold text-slate-500">Board & Revision</p>
                                    <p className="font-black text-slate-900 dark:text-white">{examBoard} • {revisionFrequency}</p>
                                </div>
                            </div>
                        </div>
                    )}
                </Card>

                <div className={`mt-6 flex items-center gap-3 ${step === 0 ? 'justify-end' : 'justify-between'}`}>
                    {step > 0 && (
                        <button
                            onClick={() => setStep((prev) => Math.max(0, prev - 1))}
                            className="px-5 py-3 rounded-xl font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2"
                        >
                            <ArrowLeft size={18} />
                            Back
                        </button>
                    )}

                    {step < steps.length - 1 ? (
                        <button
                            onClick={handleNext}
                            className="px-6 py-3 rounded-xl bg-gradient-to-r from-[#1D9E75] to-emerald-600 text-white font-black hover:from-[#178764] hover:to-emerald-700 flex items-center gap-2 shadow-lg"
                        >
                            Next
                            <ArrowRight size={18} />
                        </button>
                    ) : (
                        <button
                            onClick={handleComplete}
                            className="px-6 py-3 rounded-xl bg-gradient-to-r from-[#1D9E75] to-emerald-600 text-white font-black hover:from-[#178764] hover:to-emerald-700 flex items-center gap-2 shadow-lg"
                        >
                            Enter Dashboard
                            <Sparkles size={18} />
                        </button>
                    )}
                </div>

                {existingUser && (
                    <button
                        onClick={handleReset}
                        className="mx-auto mt-6 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400 hover:text-red-500"
                    >
                        <Trash2 size={14} />
                        Clear All Data
                    </button>
                )}
            </div>
        </div>
    );
};
