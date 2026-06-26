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
    const [subscriptionTier, setSubscriptionTier] = useState<'free' | 'pro' | 'pro_max'>('free');
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
            setSubscriptionTier('free');
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
            setSubscriptionTier((existingUser?.subscriptionTier || 'free') as 'free' | 'pro' | 'pro_max');
            setTeacherPersonality(existingUser?.teacherPersonality || 'Kind');
            setFocusChapters(existingUser?.focusChapters || {});
            setParentEmail(existingUser?.parentEmail || '');
            setCountry(existingUser?.country || 'India');
            setState(existingUser?.state || 'Tamil Nadu');
            setCity(existingUser?.city || 'Chennai');
        }
    }, [isEditing]);

    useEffect(() => {
        if (location.state?.editFocus) {
            setStep(10);
        }
    }, [location.state]);

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
        { title: 'About You', subtitle: 'Name and school details' },
        { title: 'Class', subtitle: 'Board level you are preparing for' },
        { title: 'Subjects', subtitle: 'Pick all subjects you study' },
        { title: 'Learning Style', subtitle: 'How you understand best' },
        { title: 'Goal', subtitle: 'Your target this year' },
        { title: 'Time Commitment', subtitle: 'Daily study capacity' },
        { title: 'Main Challenge', subtitle: 'Where you need the most support' },
        { title: 'Deep Personalization', subtitle: 'Set pace, language and revision behavior' },
        { title: 'AI Teacher', subtitle: 'Choose the personality of your AI tutor' },
        { title: 'School Focus', subtitle: 'Select chapters you are focusing on in school right now' },
        { title: 'Diagnostic Check', subtitle: 'Take a short baseline quiz so your study plan starts from real data' },
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
            if (!country.trim() || !state.trim() || !city.trim()) {
                toast.error('Please enter your location details (country, state, and city).');
                return false;
            }
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

        if (step === 8) {
            const email = parentEmail.trim();
            // Parent email is optional — only validate format if one is provided
            if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                toast.error('Enter a valid parent email address.');
                return false;
            }
        }

        if (step === 9 && !teacherPersonality) {
            toast.error('Please select an AI teacher personality.');
            return false;
        }

        if (step === 11 && !isEditing) {
            if (diagnosticLoading) {
                toast.error('Diagnostic is loading. Please wait a moment.');
                return false;
            }
            if (diagnosticQuestions.length === 0) {
                toast.error('Unable to load diagnostic questions right now. Try again.');
                return false;
            }
            const answered = diagnosticQuestions.filter((question) => diagnosticAnswers[question.id]);
            if (answered.length < diagnosticQuestions.length) {
                toast.error('Complete the diagnostic quiz to continue.');
                return false;
            }
        }

        return true;
    };

    const handleNext = () => {
        if (!validateStep()) return;
        if (location.state?.editFocus && step === 10) {
            handleComplete();
            return;
        }
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
            learningStyle,
            goal,
            studyHours,
            focusAreas: mainChallenge,
            examBoard,
            preferredLanguage: examBoard === 'Tamil Nadu State Board' ? (tnMedium === 'Tamil' ? 'Tamil' : 'English') : preferredLanguage,
            preferredPace,
            confidenceLevel,
            revisionFrequency,
            subscriptionTier,
            teacherPersonality,
            focusChapters,
            parentEmail: parentEmail.trim(),
            country: formatLocation(country),
            state: formatLocation(state),
            city: formatLocation(city),
        };

        const diagnosticPayload = {
            class_num: String(finalClass),
            subject: diagnosticQuerySubject || selectedSubjects[0] || 'mixed',
            answers: diagnosticQuestions.map((question) => ({
                question_id: question.id,
                selected_option: diagnosticAnswers[question.id] || '',
            })),
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
                const diagnosticResult = await submitDiagnostic(diagnosticPayload);
                setDiagnosticScore(diagnosticResult.total_score);
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

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                                <div>
                                    <label className="block text-xs font-black text-stone-500 uppercase tracking-wide mb-2">Country</label>
                                    <input
                                        type="text"
                                        list="country-options"
                                        value={country}
                                        onChange={(e) => setCountry(e.target.value)}
                                        className="w-full px-4 py-3 rounded-xl border-3 border-[#2C241B] shadow-neo bg-[#FCFAF8] text-[#2C241B] font-semibold outline-none focus:ring-4 focus:ring-[#8C5A35]/20 focus:border-[#8C5A35]"
                                        placeholder="Country"
                                    />
                                    <datalist id="country-options">
                                        {locationOptions.countries.map(c => <option key={c} value={c} />)}
                                    </datalist>
                                </div>
                                <div>
                                    <label className="block text-xs font-black text-stone-500 uppercase tracking-wide mb-2">State / Region</label>
                                    <input
                                        type="text"
                                        list="state-options"
                                        value={state}
                                        onChange={(e) => setState(e.target.value)}
                                        className="w-full px-4 py-3 rounded-xl border-3 border-[#2C241B] shadow-neo bg-[#FCFAF8] text-[#2C241B] font-semibold outline-none focus:ring-4 focus:ring-[#8C5A35]/20 focus:border-[#8C5A35]"
                                        placeholder="State"
                                    />
                                    <datalist id="state-options">
                                        {locationOptions.states.map(s => <option key={s} value={s} />)}
                                    </datalist>
                                </div>
                                <div>
                                    <label className="block text-xs font-black text-stone-500 uppercase tracking-wide mb-2">City</label>
                                    <input
                                        type="text"
                                        list="city-options"
                                        value={city}
                                        onChange={(e) => setCity(e.target.value)}
                                        className="w-full px-4 py-3 rounded-xl border-3 border-[#2C241B] shadow-neo bg-[#FCFAF8] text-[#2C241B] font-semibold outline-none focus:ring-4 focus:ring-[#8C5A35]/20 focus:border-[#8C5A35]"
                                        placeholder="City"
                                    />
                                    <datalist id="city-options">
                                        {locationOptions.cities.map(c => <option key={c} value={c} />)}
                                    </datalist>
                                </div>
                            </div>

                            <div className="p-4 rounded-2xl border-3 border-[#2C241B] shadow-neo bg-[#F2EFE9] relative overflow-hidden h-36 flex items-center justify-center">
                                <div className="absolute inset-0 opacity-20 pointer-events-none">
                                    <svg width="100%" height="100%" className="text-stone-600 ">
                                        <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                                            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="currentColor" strokeWidth="1"/>
                                        </pattern>
                                        <rect width="100%" height="100%" fill="url(#grid)" />
                                        <path d="M10,80 Q50,20 150,60 T350,30 T500,90 T700,50" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="5,5" />
                                        <path d="M30,120 Q120,40 250,110 T600,40" fill="none" stroke="currentColor" strokeWidth="2" />
                                    </svg>
                                </div>
                                <div className="text-center z-10 space-y-1">
                                    <div className="inline-flex p-2 rounded-full bg-amber-100 text-[#8C5A35] animate-bounce">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-map-pin"><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
                                    </div>
                                    <p className="text-xs font-bold text-stone-600 ">
                                        Map Marker: {city || 'Chennai'}, {state || 'Tamil Nadu'}, {country || 'India'}
                                    </p>
                                </div>
                                <div className="absolute bottom-2 right-2 flex gap-1 z-20">
                                    {[
                                        { city: 'Chennai', state: 'Tamil Nadu', country: 'India' },
                                        { city: 'New Delhi', state: 'Delhi', country: 'India' },
                                        { city: 'Mumbai', state: 'Maharashtra', country: 'India' },
                                    ].map((loc) => (
                                        <button
                                            key={loc.city}
                                            type="button"
                                            onClick={() => {
                                                setCity(loc.city);
                                                setState(loc.state);
                                                setCountry(loc.country);
                                            }}
                                            className="px-2 py-1 bg-[#FCFAF8] text-[10px] font-bold rounded-md border-3 border-[#2C241B] shadow-neo hover:bg-[#FCFAF8] :bg-stone-700 transition-colors  text-stone-700 "
                                        >
                                            📍 {loc.city}
                                        </button>
                                    ))}
                                </div>
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
                        </div>
                    )}

                    {step === 2 && (
                        <div className="space-y-4">
                            {examBoard === 'Tamil Nadu State Board' && (
                                <div className="p-3 rounded-xl bg-[#8C5A35]/10 text-[#8C5A35] text-xs font-bold border border-[#8C5A35]/20">
                                    ℹ️ Tamil Nadu State Board textbooks are supported for Grades 8, 9, 10, 11, and 12.
                                </div>
                            )}
                            <div className="grid grid-cols-5 gap-3">
                                {CLASSES.map((entry) => {
                                    const disabled = false;
                                    return (
                                        <button
                                            key={entry}
                                            disabled={disabled}
                                            onClick={() => setSelectedClass(entry)}
                                            className={`py-6 rounded-2xl font-black text-2xl transition-all ${disabled
                                                ? 'bg-[#FCFAF8] text-stone-300 cursor-not-allowed opacity-50'
                                                : selectedClass === entry
                                                    ? 'bg-[#8C5A35] text-white  /30'
                                                    : 'bg-[#F2EFE9] text-stone-700 hover:bg-[#E8E4DB] :bg-stone-700'
                                                }`}
                                        >
                                            {entry}
                                        </button>
                                    );
                                })}
                            </div>
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
                                            ? 'border-[#8C5A35] bg-amber-50 text-[#8C5A35]'
                                            : 'border-stone-200 text-stone-700 '
                                            }`}
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

                    {step === 4 && (
                        <div className="space-y-3">
                            {LEARNING_STYLES.map(({ name: label, icon: Icon, desc }) => (
                                <button
                                    key={label}
                                    onClick={() => setLearningStyle(label)}
                                    className={`w-full rounded-2xl border-2 p-4 text-left flex items-center gap-4 ${learningStyle === label
                                        ? 'border-[#8C5A35] bg-amber-50 '
                                        : 'border-stone-200 '
                                        }`}
                                >
                                    <Icon size={26} className={learningStyle === label ? 'text-[#8C5A35]' : 'text-stone-400'} />
                                    <div>
                                        <p className="font-black text-[#2C241B] ">{label}</p>
                                        <p className="text-sm text-stone-500 ">{desc}</p>
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
                                        ? 'border-[#8C5A35] bg-amber-50 text-[#8C5A35]'
                                        : 'border-stone-200 text-stone-700 '
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
                                        ? 'border-[#8C5A35] bg-amber-50 text-[#8C5A35]'
                                        : 'border-stone-200 text-stone-700 '
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
                                        ? 'border-[#8C5A35] bg-amber-50 text-[#8C5A35]'
                                        : 'border-stone-200 text-stone-700 '
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
                                <p className="text-xs font-black uppercase tracking-wide text-stone-500 mb-2">Exam Board</p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                    {EXAM_BOARDS.map((entry) => (
                                        <button
                                            key={entry.value}
                                            type="button"
                                            disabled={entry.disabled}
                                            onClick={() => {
                                                setExamBoard(entry.value);
                                                if (entry.value === 'Tamil Nadu State Board') {
                                                    setSelectedClass('10');
                                                    setState('Tamil Nadu');
                                                    setCity('Chennai');
                                                }
                                            }}
                                            className={`p-3 rounded-xl border-2 text-sm font-bold transition-all text-left flex justify-between items-center ${entry.disabled
                                                ? 'border-stone-100 bg-[#FCFAF8] text-stone-400 cursor-not-allowed'
                                                : examBoard === entry.value
                                                    ? 'border-[#8C5A35] bg-amber-50 text-[#8C5A35]  /10'
                                                    : 'border-stone-200 text-stone-700 hover:border-stone-350 :border-stone-600'
                                                }`}
                                        >
                                            <span>{entry.label}</span>
                                            {examBoard === entry.value && !entry.disabled && (
                                                <span className="w-2 h-2 rounded-full bg-[#8C5A35]" />
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {examBoard === 'Tamil Nadu State Board' && (
                                <div className="p-4 rounded-2xl border-2 border-amber-500/20 bg-amber-50/30 space-y-3">
                                    <p className="text-xs font-black uppercase tracking-wide text-[#8C5A35] flex items-center gap-1">
                                        <Sparkles size={14} /> Tamil Nadu Board Settings
                                    </p>
                                    <div>
                                        <p className="text-xs font-bold text-stone-600 mb-2">Select Instruction Medium</p>
                                        <div className="grid grid-cols-2 gap-2">
                                            {['English', 'Tamil'].map((med) => (
                                                <button
                                                    key={med}
                                                    type="button"
                                                    onClick={() => setTnMedium(med as 'English' | 'Tamil')}
                                                    className={`p-2.5 rounded-xl border-2 text-xs font-black transition-all ${tnMedium === med
                                                        ? 'border-[#8C5A35] bg-[#8C5A35] text-white '
                                                        : 'border-stone-200 text-stone-700 bg-transparent hover:bg-[#F2EFE9] :bg-stone-800'
                                                        }`}
                                                >
                                                    {med} Medium
                                                </button>
                                            ))}
                                        </div>
                                        <p className="text-[10px] text-stone-500 mt-2">
                                            * Selecting Tamil Medium will set your preferred language to Tamil and instruct the AI tutor to communicate with you and generate materials in Tamil script.
                                        </p>
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <p className="text-xs font-black uppercase tracking-wide text-stone-500 mb-2">Preferred Language</p>
                                    <select
                                        value={preferredLanguage}
                                        onChange={(e) => setPreferredLanguage(e.target.value)}
                                        className="w-full px-4 py-3 rounded-xl border-3 border-[#2C241B] shadow-neo bg-[#FCFAF8] font-semibold"
                                    >
                                        {LANGUAGES.map((entry) => (
                                            <option key={entry} value={entry}>{entry}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <p className="text-xs font-black uppercase tracking-wide text-stone-500 mb-2">Response Pace</p>
                                    <select
                                        value={preferredPace}
                                        onChange={(e) => setPreferredPace(e.target.value)}
                                        className="w-full px-4 py-3 rounded-xl border-3 border-[#2C241B] shadow-neo bg-[#FCFAF8] font-semibold"
                                    >
                                        {PACES.map((entry) => (
                                            <option key={entry} value={entry}>{entry}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <p className="text-xs font-black uppercase tracking-wide text-stone-500 mb-2">Confidence Level</p>
                                    <select
                                        value={confidenceLevel}
                                        onChange={(e) => setConfidenceLevel(e.target.value)}
                                        className="w-full px-4 py-3 rounded-xl border-3 border-[#2C241B] shadow-neo bg-[#FCFAF8] font-semibold"
                                    >
                                        {CONFIDENCE_LEVELS.map((entry) => (
                                            <option key={entry} value={entry}>{entry}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <p className="text-xs font-black uppercase tracking-wide text-stone-500 mb-2">Revision Frequency</p>
                                    <select
                                        value={revisionFrequency}
                                        onChange={(e) => setRevisionFrequency(e.target.value)}
                                        className="w-full px-4 py-3 rounded-xl border-3 border-[#2C241B] shadow-neo bg-[#FCFAF8] font-semibold"
                                    >
                                        {REVISION_FREQUENCY.map((entry) => (
                                            <option key={entry} value={entry}>{entry}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div>
                                <p className="text-xs font-black uppercase tracking-wide text-stone-500 mb-2">Parent Email <span className="normal-case font-semibold text-stone-400">(optional — for progress reports)</span></p>
                                <input
                                    type="email"
                                    value={parentEmail}
                                    onChange={(e) => setParentEmail(e.target.value)}
                                    placeholder="parent@example.com (optional)"
                                    className="w-full px-4 py-3 rounded-xl border-3 border-[#2C241B] shadow-neo bg-[#FCFAF8] font-semibold"
                                />
                                <p className="mt-1 text-[11px] text-stone-400">If provided, your parent gets login credentials to view your progress dashboard.</p>
                            </div>

                            <div>
                                <p className="text-xs font-black uppercase tracking-wide text-stone-500 mb-2">Plan preference</p>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                    {SUBSCRIPTION_TIERS.map((tier) => (
                                        <button
                                            key={tier.value}
                                            onClick={() => setSubscriptionTier(tier.value)}
                                            className={`rounded-xl border-2 p-3 text-left ${subscriptionTier === tier.value
                                                ? 'border-[#8C5A35] bg-amber-50 '
                                                : 'border-stone-200 '
                                                }`}
                                        >
                                            <p className="text-sm font-black text-[#2C241B] ">{tier.label}</p>
                                            <p className="text-[11px] text-stone-500 mt-1">{tier.desc}</p>
                                        </button>
                                    ))}
                                </div>
                                <p className="mt-3 text-[11px] text-stone-500">
                                    This choice is saved as a billing preference. Real paid access is activated later from Settings.
                                </p>
                            </div>
                        </div>
                    )}

                    {step === 9 && (
                        <div className="space-y-4">
                            {TEACHER_PERSONALITIES.map((p) => (
                                <button
                                    key={p.value}
                                    onClick={() => setTeacherPersonality(p.value as any)}
                                    className={`w-full rounded-2xl border-2 p-6 text-left flex items-center gap-4 transition-all ${teacherPersonality === p.value
                                        ? 'border-[#8C5A35] bg-amber-50 '
                                        : 'border-stone-200 hover:border-[#8C5A35]/50'
                                        }`}
                                >
                                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${teacherPersonality === p.value ? 'bg-[#8C5A35] text-white' : 'bg-[#F2EFE9] text-stone-500'}`}>
                                        <Sparkles size={24} />
                                    </div>
                                    <div>
                                        <p className="font-black text-[#2C241B] ">{p.label}</p>
                                        <p className="text-sm text-stone-500 font-medium">{p.desc}</p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}

                    {step === 10 && (
                        <div className="space-y-6">
                            <div className="rounded-2xl border border-[#8C5A35]/30 bg-amber-50 p-4">
                                <p className="text-sm font-bold text-[#2C241B] ">What are you studying in school this week?</p>
                                <p className="text-xs text-stone-500 mt-1">This helps the AI prioritize your daily missions and practice sets.</p>
                            </div>
                            <div className="space-y-6 max-h-[400px] overflow-y-auto pr-2">
                                {selectedSubjects.map((subject) => (
                                    <div key={subject} className="space-y-3">
                                        <div className="flex items-center justify-between border-b border-stone-150 pb-1.5 mb-2">
                                            <h3 className="text-sm font-black text-[#8C5A35] uppercase tracking-wider">{subject}</h3>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const allChapters = chaptersForSubject(subject);
                                                    const currentFocused = focusChapters[subject] || [];
                                                    const isAllSelected = allChapters.length > 0 && allChapters.every(c => currentFocused.includes(c));
                                                    setFocusChapters(prev => ({
                                                        ...prev,
                                                        [subject]: isAllSelected ? [] : allChapters
                                                    }));
                                                }}
                                                className="text-xs font-black text-[#8C5A35] hover:text-[#70482B] :text-amber-400 hover:underline transition-colors cursor-pointer"
                                            >
                                                {(() => {
                                                    const allChapters = chaptersForSubject(subject);
                                                    const currentFocused = focusChapters[subject] || [];
                                                    const isAllSelected = allChapters.length > 0 && allChapters.every(c => currentFocused.includes(c));
                                                    return isAllSelected ? 'Deselect All' : 'Select All';
                                                })()}
                                            </button>
                                        </div>
                                        <div className="grid grid-cols-1 gap-2">
                                            {chaptersForSubject(subject).map((chapter) => {
                                                const isFocused = (focusChapters[subject] || []).includes(chapter);
                                                return (
                                                    <button
                                                        key={chapter}
                                                        onClick={() => {
                                                            setFocusChapters(prev => {
                                                                const current = prev[subject] || [];
                                                                const next = isFocused
                                                                    ? current.filter(c => c !== chapter)
                                                                    : [...current, chapter];
                                                                return { ...prev, [subject]: next };
                                                            });
                                                        }}
                                                        className={`p-3 rounded-xl border-2 text-left text-sm font-bold transition-all ${isFocused
                                                            ? 'border-[#8C5A35] bg-amber-50 text-[#8C5A35]'
                                                            : 'border-stone-200 text-stone-600 hover:border-[#8C5A35]/30'
                                                            }`}
                                                    >
                                                        <div className="flex items-center justify-between">
                                                            <span>{chapter}</span>
                                                            {isFocused && <Check size={14} />}
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {step === 11 && (
                        <div className="space-y-5">
                            {isEditing ? (
                                <div className="rounded-2xl border-3 border-[#2C241B] shadow-neo bg-[#FCFAF8] p-4">
                                    <p className="text-sm font-black text-[#2C241B] ">Diagnostic is first-time only</p>
                                    <p className="text-xs text-stone-500 mt-1">
                                        You are updating an existing account, so the signup diagnostic is skipped.
                                    </p>
                                </div>
                            ) : (
                                <>
                                    <div className="rounded-2xl border-3 border-[#2C241B] shadow-neo bg-[#FCFAF8] p-4">
                                        <p className="text-sm font-black text-[#2C241B] ">Baseline diagnostic quiz</p>
                                        <p className="text-xs text-stone-500 mt-1">
                                            These questions are from one grade lower to test fundamentals.
                                            {diagnosticMeta ? ` Class ${diagnosticMeta.diagnosticClass} • ${diagnosticMeta.diagnosticSubject}` : ''}
                                        </p>
                                    </div>
                                    {diagnosticLoading && (
                                        <div className="rounded-2xl border-3 border-[#2C241B] shadow-neo bg-[#FCFAF8] p-4">
                                            <p className="text-sm text-stone-600 ">Loading diagnostic questions...</p>
                                        </div>
                                    )}
                                    <div className="space-y-4">
                                        {diagnosticQuestions.map((question, index) => (
                                            <div key={question.id} className="rounded-2xl border-3 border-[#2C241B] shadow-neo p-4">
                                                <p className="text-xs font-black uppercase tracking-wide text-[#8C5A35] mb-2">Question {index + 1}</p>
                                                <p className="text-[11px] font-bold text-stone-500 mb-2">{question.chapter}</p>
                                                <p className="text-sm font-bold text-[#2C241B] mb-3">{question.prompt}</p>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                                    {question.options.map((option) => (
                                                        <button
                                                            key={option.key}
                                                            onClick={() => setDiagnosticAnswers((prev) => ({ ...prev, [question.id]: option.key }))}
                                                            className={`rounded-xl border-2 p-3 text-left text-sm font-semibold transition-all ${diagnosticAnswers[question.id] === option.key
                                                                ? 'border-[#8C5A35] bg-amber-50 text-[#8C5A35]'
                                                                : 'border-stone-200 text-stone-700 '
                                                                }`}
                                                        >
                                                            <span className="font-black mr-2">{option.key}.</span>{option.text}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    {diagnosticScore !== null && (
                                        <div className="rounded-2xl bg-amber-50 border-3 border-[#2C241B] shadow-neo p-4">
                                            <p className="text-sm font-black text-amber-700 ">Diagnostic score: {diagnosticScore}%</p>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    )}

                    {step === 12 && (
                        <div className="text-center py-6 space-y-5">
                            <div className="text-5xl">🎯</div>
                            <h2 className="text-3xl font-black text-[#2C241B] ">Ready to Start</h2>
                            <p className="text-stone-600 font-semibold max-w-lg mx-auto">
                                {name || 'Student'}, your tutor is now tuned for Class {selectedClass}, {selectedSubjects.length} subjects, {learningStyle || 'your'} style, and a {goal || 'custom'} goal.
                            </p>
                            <div className="grid grid-cols-2 gap-3 text-left max-w-xl mx-auto">
                                <div className="bg-[#F2EFE9] rounded-xl p-3">
                                    <p className="text-xs uppercase font-bold text-stone-500">Daily Time</p>
                                    <p className="font-black text-[#2C241B] ">{studyHours}</p>
                                </div>
                                <div className="bg-[#F2EFE9] rounded-xl p-3">
                                    <p className="text-xs uppercase font-bold text-stone-500">Main Challenge</p>
                                    <p className="font-black text-[#2C241B] ">{mainChallenge}</p>
                                </div>
                                <div className="bg-[#F2EFE9] rounded-xl p-3">
                                    <p className="text-xs uppercase font-bold text-stone-500">Language & Pace</p>
                                    <p className="font-black text-[#2C241B] ">{preferredLanguage} • {preferredPace}</p>
                                </div>
                                <div className="bg-[#F2EFE9] rounded-xl p-3">
                                    <p className="text-xs uppercase font-bold text-stone-500">Board & Revision</p>
                                    <p className="font-black text-[#2C241B] ">{examBoard} • {revisionFrequency}</p>
                                </div>
                                <div className="bg-[#F2EFE9] rounded-xl p-3 col-span-2">
                                    <p className="text-xs uppercase font-bold text-stone-500">AI Personality</p>
                                    <p className="font-black text-[#2C241B] ">{teacherPersonality}</p>
                                </div>
                                <div className="bg-[#F2EFE9] rounded-xl p-3 col-span-2">
                                    <p className="text-xs uppercase font-bold text-stone-500">Plan preference</p>
                                    <p className="font-black text-[#2C241B] ">{subscriptionTier.replace('_', ' ').toUpperCase()}</p>
                                </div>
                            </div>
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

                    {step < steps.length - 1 && !(location.state?.editFocus && step === 10) ? (
                        <button
                            onClick={handleNext}
                            className="px-6 py-3 rounded-xl bg-gradient-to-r from-[#8C5A35] to-amber-600 text-white font-black hover:from-[#178764] hover:to-amber-700 flex items-center gap-2 "
                        >
                            Next
                            <ArrowRight size={18} />
                        </button>
                    ) : (
                        <button
                            onClick={step === 10 && location.state?.editFocus ? handleComplete : handleComplete}
                            disabled={isSubmitting}
                            className="px-6 py-3 rounded-xl bg-gradient-to-r from-[#8C5A35] to-amber-600 text-white font-black hover:from-[#178764] hover:to-amber-700 flex items-center gap-2 "
                        >
                            {isSubmitting ? 'Saving...' : (location.state?.editFocus && step === 10 ? 'Save Focus' : 'Enter Dashboard')}
                            {location.state?.editFocus && step === 10 ? <Check size={18} /> : <Sparkles size={18} />}
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
