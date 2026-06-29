import { useEffect, useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
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
import { getDiagnosticQuestions, loginUser, registerUser, submitDiagnostic, updateMyProfile, getLocations, type DiagnosticQuestion } from '../api';
import { useCurriculumCatalog } from '../hooks/useCurriculumCatalog';

const CLASSES = ['8', '9', '10', '11', '12'];

const LEARNING_STYLES = [
    { name: 'Visual', icon: Eye, desc: 'Diagrams, charts, colors' },
    { name: 'Auditory', icon: Volume2, desc: 'Explanations and discussions' },
    { name: 'Reading/Writing', icon: BookMarked, desc: 'Notes and structured text' },
    { name: 'Kinesthetic', icon: Hand, desc: 'Practice and hands-on learning' },
];

const GOALS = ['Score 95+', 'Score 80-95', 'Pass with Merit', 'Improve Gradually', 'Build Confidence'];
const STUDY_HOURS = ['30 min/day', '1 hour/day', '2 hours/day', '3+ hours/day'];
const CHALLENGES = ['Time Management', 'Weak Concepts', 'Exam Anxiety', 'Consistency', 'No Major Challenge'];
const EXAM_BOARDS = [
    { value: 'CBSE', label: 'CBSE', disabled: false },
    { value: 'Tamil Nadu State Board', label: 'Tamil Nadu State Board (Coming Soon)', disabled: true },
    { value: 'ICSE', label: 'ICSE (Coming Soon)', disabled: true },
    { value: 'IB', label: 'IB (Coming Soon)', disabled: true },
    { value: 'IGCSE', label: 'IGCSE (Coming Soon)', disabled: true },
];
const LANGUAGES = ['English', 'Hinglish', 'Hindi'];
const PACES = ['Slow and detailed', 'Balanced', 'Fast and concise'];
const CONFIDENCE_LEVELS = ['Needs strong support', 'Average confidence', 'High confidence'];
const REVISION_FREQUENCY = ['Daily', 'Alternate days', 'Twice a week', 'Weekly'];
const TEACHER_PERSONALITIES = [
    { value: 'Strict', label: 'Strict', desc: 'No-nonsense, focus on precision and discipline' },
    { value: 'Kind', label: 'Kind', desc: 'Encouraging, supportive and patient' },
    { value: 'Lenient', label: 'Lenient', desc: 'Relaxed pace, flexible with mistakes' },
    { value: 'Enthusiastic', label: 'Enthusiastic', desc: 'High energy, focuses on curiosity and fun' },
] as const;
const SUBSCRIPTION_TIERS = [
    { value: 'free', label: 'Free', desc: 'Start here now' },
    { value: 'pro', label: 'Pro', desc: 'Billing-ready upgrade when checkout is connected' },
    { value: 'pro_max', label: 'Pro Max', desc: 'Everything in Pro plus exam and parent workflows' },
] as const;

export const Onboarding = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const existingUser = getUser();
    const existingToken = getAuthToken();
    const isEditing = !!existingUser && !!existingToken;

    const [step, setStep] = useState(1);
    const [name, setName] = useState('');
    const [password, setPassword] = useState('');
    const [loginName, setLoginName] = useState('');
    const [loginPassword, setLoginPassword] = useState('');
    const [school, setSchool] = useState('');
    const [selectedClass, setSelectedClass] = useState('10');
    const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
    const [learningStyle, setLearningStyle] = useState('');
    const [goal, setGoal] = useState('');
    const [studyHours, setStudyHours] = useState('');
    const [mainChallenge, setMainChallenge] = useState('');
    const [examBoard, setExamBoard] = useState('CBSE');
    const [preferredLanguage, setPreferredLanguage] = useState('English');
    const [preferredPace, setPreferredPace] = useState('Balanced');
    const [confidenceLevel, setConfidenceLevel] = useState('Average confidence');
    const [revisionFrequency, setRevisionFrequency] = useState('Alternate days');
    const [subscriptionTier, setSubscriptionTier] = useState<'free' | 'pro' | 'pro_max'>('pro');
    const [teacherPersonality, setTeacherPersonality] = useState('Kind');
    const [focusChapters, setFocusChapters] = useState<Record<string, string[]>>({});
    const [parentEmail, setParentEmail] = useState('');
    const [country, setCountry] = useState('India');
    const [state, setState] = useState('Tamil Nadu');
    const [city, setCity] = useState('Chennai');
    const [tnMedium, setTnMedium] = useState<'English' | 'Tamil'>('English');
    const [diagnosticAnswers, setDiagnosticAnswers] = useState<Record<string, string>>({});
    const [diagnosticScore, setDiagnosticScore] = useState<number | null>(null);
    const [diagnosticQuestions, setDiagnosticQuestions] = useState<DiagnosticQuestion[]>([]);
    const [diagnosticMeta, setDiagnosticMeta] = useState<{ diagnosticClass: string; diagnosticSubject: string } | null>(null);
    const [diagnosticQuerySubject, setDiagnosticQuerySubject] = useState<string>('mixed');
    const [diagnosticLoading, setDiagnosticLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [locationOptions, setLocationOptions] = useState<{countries: string[], states: string[], cities: string[]}>({countries: [], states: [], cities: []});

    useEffect(() => {
        fetch('https://ipapi.co/json/')
            .then(res => res.json())
            .then(data => {
                if (data.country_name) setCountry(data.country_name);
                if (data.region) setState(data.region);
                if (data.city) setCity(data.city);
            })
            .catch(console.error);
    }, []);

    useEffect(() => {
        getLocations().then(res => setLocationOptions(res));
    }, []);

    const { subjectsForClass, chaptersForSubject } = useCurriculumCatalog(selectedClass);
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
    
    // Clear all fields on mount if not in editing mode to avoid pre-population from previous sessions
    useEffect(() => {
        if (!isEditing) {
            localStorage.removeItem('ncertai_user');
            localStorage.removeItem('ncertai_token');
            setName('');
            setPassword('');
            setLoginName('');
            setLoginPassword('');
            setSchool('');
            setSelectedClass('10');
            setSelectedSubjects([]);
            setLearningStyle('');
            setGoal('');
            setStudyHours('');
            setMainChallenge('');
            setExamBoard('CBSE');
            setPreferredLanguage('English');
            setPreferredPace('Balanced');
            setConfidenceLevel('Average confidence');
            setRevisionFrequency('Alternate days');
            setSubscriptionTier('pro');
            setTeacherPersonality('Kind');
            setFocusChapters({});
            setParentEmail('');
            setCountry('India');
            setState('Tamil Nadu');
            setCity('Chennai');
        } else {
            setName(existingUser?.name || '');
            setSchool(existingUser?.school || '');
            setSelectedClass((existingUser?.class || '10').toString());
            setSelectedSubjects(existingUser?.subjects || []);
            setLearningStyle(existingUser?.learningStyle || '');
            setGoal(existingUser?.goal || '');
            setStudyHours(existingUser?.studyHours || '');
            setMainChallenge(existingUser?.focusAreas || '');
            setExamBoard(existingUser?.examBoard || 'CBSE');
            setPreferredLanguage(existingUser?.preferredLanguage || 'English');
            setPreferredPace(existingUser?.preferredPace || 'Balanced');
            setConfidenceLevel(existingUser?.confidenceLevel || 'Average confidence');
            setRevisionFrequency(existingUser?.revisionFrequency || 'Alternate days');
            setSubscriptionTier((existingUser?.subscriptionTier || 'pro') as 'free' | 'pro' | 'pro_max');
            setTeacherPersonality(existingUser?.teacherPersonality || 'Kind');
            setFocusChapters(existingUser?.focusChapters || {});
            setParentEmail(existingUser?.parentEmail || '');
            setCountry(existingUser?.country || 'India');
            setState(existingUser?.state || 'Tamil Nadu');
            setCity(existingUser?.city || 'Chennai');
        }
    }, [isEditing]);



    const pickDiagnosticSubject = (): string | undefined => {
        // Exclude English from diagnostic subject selection
        const subjectsWithoutEnglish = selectedSubjects.filter(
            (s) => s.trim().toLowerCase() !== 'english'
        );
        if (!subjectsWithoutEnglish.length) return undefined;

        const stemPriority = ['Physics', 'Chemistry', 'Biology', 'Maths', 'Science', 'Social Science'];
        const normalized = subjectsWithoutEnglish.map((s) => s.trim());
        const preferred = stemPriority.filter((s) => normalized.includes(s));
        const pool = preferred.length ? preferred : normalized;
        const index = Math.floor(Math.random() * pool.length);
        return pool[index];
    };

    const steps = [
        { title: 'Welcome', subtitle: 'Set up your personal AI tutor in under 1 minute' },
        { title: 'About You', subtitle: 'Name, class, and school details' },
        { title: 'Subjects', subtitle: 'Pick all subjects you study' },
        { title: 'Goal', subtitle: 'Your target this year' },
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

    useEffect(() => {
        let active = true;
        const loadDiagnostic = async () => {
            if (isEditing) {
                setDiagnosticQuestions([]);
                setDiagnosticMeta(null);
                setDiagnosticLoading(false);
                return;
            }
            if (!selectedClass) return;
            setDiagnosticLoading(true);
            try {
                const preferredSubject = pickDiagnosticSubject();
                const response = await getDiagnosticQuestions({
                    class_num: selectedClass,
                    subject: preferredSubject,
                });
                if (!active) return;
                setDiagnosticQuerySubject(preferredSubject || 'mixed');
                setDiagnosticQuestions(response.questions || []);
                setDiagnosticMeta({
                    diagnosticClass: response.diagnostic_class,
                    diagnosticSubject: response.diagnostic_subject,
                });
                setDiagnosticAnswers({});
                setDiagnosticScore(null);
            } catch {
                if (!active) return;
                setDiagnosticQuestions([]);
                setDiagnosticMeta(null);
            } finally {
                if (active) setDiagnosticLoading(false);
            }
        };
        loadDiagnostic();
        return () => {
            active = false;
        };
    }, [isEditing, selectedClass, selectedSubjects.join('|')]);

    const validateStep = () => {
        if (step === 1) {
            if (!name.trim() || !school.trim()) {
                toast.error('Please fill in your full name and school.');
                return false;
            }
            if (name.trim().length < 2) {
                toast.error('Name must be at least 2 characters.');
                return false;
            }
        }
        if (step === 2 && selectedSubjects.length === 0) {
            toast.error('Pick at least one subject to continue.');
            return false;
        }
        if (step === 3 && !goal) {
            toast.error('Select your target goal.');
            return false;
        }
        return true;
    };

    const handleNext = () => {
        if (!validateStep()) return;
        setStep((prev) => Math.min(prev + 1, steps.length - 1));
    };

    const handleComplete = async () => {
        if (isSubmitting) return;
        const finalClass = examBoard === 'Tamil Nadu State Board'
            ? `${selectedClass}_TN_${tnMedium === 'Tamil' ? 'TM' : 'EN'}`
            : Number(selectedClass);

        const formatLocation = (loc: string) => loc.trim().toLowerCase().replace(/\b\w/g, l => l.toUpperCase());

        const profile = {
            name: name.trim(),
            school: school.trim(),
            class: finalClass,
            subjects: selectedSubjects,
            learningStyle: 'Balanced',
            goal: goal || 'Pass with Merit',
            studyHours: '1 hour/day',
            focusAreas: 'Weak Concepts',
            examBoard: 'CBSE',
            preferredLanguage: 'English',
            preferredPace: 'Balanced',
            confidenceLevel: 'Average confidence',
            revisionFrequency: 'Alternate days',
            subscriptionTier: 'pro',
            teacherPersonality: 'Kind',
            focusChapters: {},
            parentEmail: parentEmail.trim(),
            country: country,
            state: state,
            city: city,
        };

        try {
            setIsSubmitting(true);
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

            try {
                const result = await registerUser({ profile, password: password.trim() });
                saveAuthToken(result.token);
                saveUser(result.user);
                toast.success('Welcome to Clarity.');
                navigate('/dashboard');
            } catch (error: unknown) {
                const message = error instanceof Error ? error.message : '';
                const conflict = /already exists|409|conflict/i.test(message);
                if (!conflict) {
                    throw error;
                }

                const loginResult = await loginUser({ name: name.trim(), password: password.trim() });
                saveAuthToken(loginResult.token);
                saveUser(loginResult.user);
                toast.success('Existing account found. Logged in successfully.');
                navigate('/dashboard');
            }
        } catch (error: any) {
            let message = 'Unable to complete onboarding right now.';
            if (error?.response?.data?.detail) {
                const detail = error.response.data.detail;
                if (Array.isArray(detail)) {
                    message = detail.map((d: any) => `${d.loc[d.loc.length - 1]}: ${d.msg}`).join(', ');
                } else {
                    message = detail;
                }
            } else if (error instanceof Error) {
                message = error.message;
            }
            toast.error(message);
        } finally {
            setIsSubmitting(false);
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
        if (!loginName.trim() || !loginPassword.trim()) {
            toast.error('Enter name and password to login.');
            return;
        }
        try {
            const result = await loginUser({ name: loginName.trim(), password: loginPassword.trim() });
            saveAuthToken(result.token);
            saveUser(result.user);
            toast.success('Logged in successfully.');
            navigate('/dashboard');
        } catch {
            toast.error('Invalid credentials or account not found.');
        }
    };

    return (
        <div className="min-h-screen relative bg-gradient-to-br from-[#8C5A35]/5 via-stone-50 to-amber-50/30 flex items-center justify-center p-4 md:p-8">
            <Link to="/" className="absolute top-6 left-6 md:top-8 md:left-8 flex items-center gap-2 text-stone-500 hover:text-[#8C5A35] font-bold text-sm transition-colors z-50">
                <ArrowLeft size={16} />
                Back to Home
            </Link>
            <div className="w-full max-w-3xl mt-10 md:mt-0">
                <div className="mb-8">
                    <div className="flex items-end justify-between gap-4 mb-3">
                        <div>
                            <h1 className="text-3xl md:text-4xl font-black text-[#2C241B] ">{steps[step].title}</h1>
                            <p className="text-stone-600 font-semibold mt-1">{steps[step].subtitle}</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                            <p className="text-3xl font-black text-[#8C5A35]">{step + 1}</p>
                            <p className="text-xs font-bold text-stone-500 uppercase tracking-wide">of {steps.length}</p>
                        </div>
                    </div>
                    <div className="h-2 bg-[#E8E4DB] rounded-full overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-[#8C5A35] to-amber-500 transition-all duration-300"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                </div>

                <Card className="p-6 md:p-10 bg-[#FCFAF8] border-none shadow-2xl rounded-[32px]">


                    {step === 1 && (
                        <div className="space-y-5">
                            <div>
                                <label className="flex items-center gap-2 text-sm font-black text-stone-700 uppercase tracking-wide mb-2">
                                    <User size={16} className="text-[#8C5A35]" />
                                    Full Name
                                </label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="w-full px-4 py-3 rounded-xl border-3 border-[#2C241B] shadow-neo bg-[#FCFAF8] text-[#2C241B] font-semibold outline-none focus:ring-4 focus:ring-[#8C5A35]/20 focus:border-[#8C5A35]"
                                    placeholder="e.g. Rohan Gupta"
                                    autoFocus
                                />
                            </div>
                            <div>
                                <label className="flex items-center gap-2 text-sm font-black text-stone-700 uppercase tracking-wide mb-2">
                                    <School size={16} className="text-[#8C5A35]" />
                                    School Name
                                </label>
                                <input
                                    type="text"
                                    value={school}
                                    onChange={(e) => setSchool(e.target.value)}
                                    className="w-full px-4 py-3 rounded-xl border-3 border-[#2C241B] shadow-neo bg-[#FCFAF8] text-[#2C241B] font-semibold outline-none focus:ring-4 focus:ring-[#8C5A35]/20 focus:border-[#8C5A35]"
                                    placeholder="e.g. DPS Noida"
                                />
                            </div>

                            <div className="grid grid-cols-5 gap-3 mt-4">
                                {CLASSES.map((entry) => (
                                    <button
                                        key={entry}
                                        onClick={() => setSelectedClass(entry)}
                                        className={`py-4 rounded-xl font-black text-xl transition-all ${
                                            selectedClass === entry
                                                ? 'bg-[#8C5A35] text-white  /30'
                                                : 'bg-[#F2EFE9] text-stone-700 hover:bg-[#E8E4DB] :bg-stone-700'
                                        }`}
                                    >
                                        {entry}
                                    </button>
                                ))}
                            </div>
                            <div>
                                <label className="flex items-center gap-2 text-sm font-black text-stone-700 uppercase tracking-wide mb-2">
                                    <Sparkles size={16} className="text-[#8C5A35]" />
                                    Password
                                </label>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full px-4 py-3 rounded-xl border-3 border-[#2C241B] shadow-neo bg-[#FCFAF8] text-[#2C241B] font-semibold outline-none focus:ring-4 focus:ring-[#8C5A35]/20 focus:border-[#8C5A35]"
                                    placeholder={isEditing ? 'Keep unchanged unless re-registering' : 'At least 6 characters'}
                                />
                            </div>
                            <div>
                                <label className="flex items-center gap-2 text-sm font-black text-stone-700 uppercase tracking-wide mb-2">
                                    <User size={16} className="text-[#8C5A35]" />
                                    Parent Email (Optional)
                                </label>
                                <input
                                    type="email"
                                    value={parentEmail}
                                    onChange={(e) => setParentEmail(e.target.value)}
                                    className="w-full px-4 py-3 rounded-xl border-3 border-[#2C241B] shadow-neo bg-[#FCFAF8] text-[#2C241B] font-semibold outline-none focus:ring-4 focus:ring-[#8C5A35]/20 focus:border-[#8C5A35]"
                                    placeholder="parent@example.com"
                                />
                            </div>
                        </div>
                    )}


                    {step === 2 && (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            {availableSubjects.map((subject) => {
                                const selected = selectedSubjects.includes(subject);
                                return (
                                    <button
                                        key={subject}
                                        onClick={() => toggleSubject(subject)}
                                        className={`p-4 rounded-2xl border-2 transition-all text-sm font-bold min-h-[92px] flex flex-col justify-between ${selected ? 'border-[#8C5A35] bg-amber-50 text-[#8C5A35]' : 'border-stone-200 text-stone-700 '}`}
                                    >
                                        <span className="leading-tight break-words">{subject}</span>
                                        <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${selected ? 'bg-[#8C5A35] border-[#8C5A35]' : 'border-stone-300 '}`}>
                                            {selected && <Check size={13} className="text-white" />}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {step === 3 && (
                        <div className="space-y-3">
                            {GOALS.map((entry) => (
                                <button
                                    key={entry}
                                    onClick={() => setGoal(entry)}
                                    className={`w-full p-4 rounded-2xl border-2 text-left font-bold ${goal === entry ? 'border-[#8C5A35] bg-amber-50 text-[#8C5A35]' : 'border-stone-200 text-stone-700 '}`}
                                >
                                    {entry}
                                </button>
                            ))}
                        </div>
                    )}

                    {step === 4 && (
                        <div className="text-center py-6 space-y-5">
                            <div className="text-5xl">🎯</div>
                            <h2 className="text-3xl font-black text-[#2C241B] ">Ready to Start</h2>
                            <p className="text-stone-600 font-semibold max-w-lg mx-auto">
                                {name || 'Student'}, your tutor is now tuned for Class {selectedClass}, {selectedSubjects.length} subjects, and a {goal || 'custom'} goal.
                            </p>
                        </div>
                    )}
                </Card>

                <div className={`mt-6 flex items-center gap-3 ${step === 0 ? 'justify-end' : 'justify-between'}`}>
                    {step > 0 && (
                        <button
                            onClick={() => setStep((prev) => Math.max(0, prev - 1))}
                            className="px-5 py-3 rounded-xl font-bold text-stone-600 hover:bg-[#F2EFE9] :bg-stone-800 flex items-center gap-2"
                        >
                            <ArrowLeft size={18} />
                            Back
                        </button>
                    )}

                    {step < steps.length - 1 ? (
                        <button
                            onClick={handleNext}
                            className="px-6 py-3 rounded-xl bg-gradient-to-r from-[#8C5A35] to-amber-600 text-white font-black hover:from-[#178764] hover:to-amber-700 flex items-center gap-2 "
                        >
                            Next
                            <ArrowRight size={18} />
                        </button>
                    ) : (
                        <button
                            onClick={handleComplete}
                            disabled={isSubmitting}
                            className="px-6 py-3 rounded-xl bg-gradient-to-r from-[#8C5A35] to-amber-600 text-white font-black hover:from-[#178764] hover:to-amber-700 flex items-center gap-2 "
                        >
                            {isSubmitting ? 'Saving...' : 'Enter Dashboard'}
                            <Sparkles size={18} />
                        </button>
                    )}
                </div>

                {existingUser && (
                    <button
                        onClick={handleReset}
                        className="mx-auto mt-6 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-stone-400 hover:text-red-500"
                    >
                        <Trash2 size={14} />
                        Clear All Data
                    </button>
                )}
            </div>
        </div>
    );
};
