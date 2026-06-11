import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { 
    ArrowRight, 
    Brain, 
    CalendarCheck2, 
    Rocket, 
    ShieldCheck, 
    Sparkles, 
    Trophy, 
    CheckCircle2, 
    ChevronDown, 
    Mail, 
    Star, 
    Users, 
    Layout, 
    Zap, 
    Check, 
    AlertTriangle, 
    BookOpen, 
    LineChart,
    Video,
    FileText,
    MessageSquare,
    Flame
} from 'lucide-react';

const tiers = [
    {
        name: 'Free Starter',
        originalPrice: '0 AED',
        promoPrice: '0 AED',
        cta: 'Start Free',
        highlight: false,
        badge: 'Always Free',
        features: [
            'Core study workspace & setup',
            'Onboarding diagnostic test',
            'Progress tracking from basic activity',
            'Parent-linked account setup',
        ],
    },
    {
        name: 'Pro Syllabus Booster',
        originalPrice: '50 AED',
        promoPrice: '0 AED',
        cta: 'Access Pro Free',
        highlight: true,
        badge: 'Launch Special - Free',
        features: [
            'Unlimited AI questions & custom practice',
            'Deep OCR notes grading & explanation',
            'Rich subject analytics & topic breakdown',
            'Weekly parent report email delivery',
        ],
    },
    {
        name: 'Pro Max - Complete OS',
        originalPrice: '350 AED',
        promoPrice: '0 AED',
        cta: 'Access Pro Max Free',
        highlight: false,
        badge: 'Launch Special - Free',
        features: [
            'Board-style time-boxed exam simulator',
            'Independent Parent Portal access',
            'Automated CBSE readiness & risk indicators',
            'Highest-priority AI speed & tutor boosts',
        ],
    },
];

const faqsList = [
    {
        q: "How does Clarity align with the official CBSE syllabus?",
        a: "Clarity syncs directly with the latest NCERT textbooks and CBSE guidelines. Our diagnostic tests, daily missions, and mock exam simulators are generated to match the exact phrasing, marking schemes, and difficulty levels expected in CBSE Board Exams."
    },
    {
        q: "Why are the Pro and Pro Max plans currently free?",
        a: "As part of our initial launch campaign, we are making our full Student OS open to everyone for free. You get complete access to AI tutoring, PDF proxies, OCR grading, and the Parent Portal without inputting any credit card details."
    },
    {
        q: "Can multiple students link to the same parent email?",
        a: "Yes! If you have multiple children studying with Clarity, they can all link to the same parent email. The parent uses a single login and gets a clean tabbed switcher inside the Parent Portal to monitor each student's readiness and alerts separately."
    },
    {
        q: "What makes the PDF text extraction so fast?",
        a: "We use browser-based streaming and server-side PDF caching. Instead of downloading multi-megabyte PDF files into memory, the browser streams and renders pages instantly, while our backend permanently caches the processed chapters."
    }
];

const PROMPTS = {
    'wave-optics': {
        input: 'Show me Wave Optics PYQs from CBSE 2024',
        output: [
            '[Clarity AI] Question: Derive expression for fringe width in YDSE.',
            '----------------------------------------',
            '✔ Concept: Fringe Width β = λD/d',
            '⚠️ CBSE EXAM TRAP IDENTIFIED:',
            'Students often forget to explicitly state the path difference condition (Δx = nλ) for constructive interference.',
            'Skipping this formulation loses 0.5 marks under CBSE marking scheme.',
            '💡 Active Recall Tip: Practice drawing the wavefront diagram. The layout of waves determines 1.5 marks of the grade!'
        ]
    },
    'biology': {
        input: 'Grade my notes on Double Fertilization',
        output: [
            '[Clarity OCR Vision] Processing note image...',
            '✔ Handwriting recognition: 98.2% confidence',
            '✔ Text read: "...syngamy forms zygote. Second sperm cell fertilizes polar nuclei..."',
            '----------------------------------------',
            '✔ Checked against CBSE Answer Key:',
            '1. Syngamy identified (+1.0 Mark)',
            '2. Zygote formation identified (+1.0 Mark)',
            '✖ Triple Fusion: Term "Triple Fusion" not explicitly written (-0.5 Mark)',
            '----------------------------------------',
            'GRADE: 2.5 / 3.0 (B+)',
            'RECOVERY MISSION: Speak "Triple Fusion" to explain polar nuclei fusion.'
        ]
    },
    'simulator': {
        input: 'Start a timed Board Exam simulator',
        output: [
            '[Simulator] Launching Board-Style Physics Exam...',
            '✔ Time remaining: 03:00:00 (Locked)',
            '✔ Anti-Cheat active. NCERT chapter search disabled.',
            '----------------------------------------',
            'Q1: State Coulomb\'s Law. (2 Marks)',
            'Your Voice Answer: "Force is directly proportional to product of charges..."',
            '✔ Step-Marking analysis:',
            '  - State F = k * q1 * q2 / r² (+1.0 Mark)',
            '  - State definition of variables & vacuum permittivity (+1.0 Mark)',
            '✔ Verified Grade: 2.0 / 2.0 Marks'
        ]
    }
};

export const Landing = () => {
    // Staged animation hero state
    const [heroStage, setHeroStage] = useState<'reveal' | 'subtext' | 'cta' | 'scroll'>('reveal');

    // Interactive mockup state
    const [activeTab, setActiveTab] = useState<'workspace' | 'tutor' | 'simulator' | 'parent'>('workspace');

    // FAQ state (accordion index)
    const [openFaqIdx, setOpenFaqIdx] = useState<number | null>(null);

    // Interactive console chat state
    const [terminalPrompt, setTerminalPrompt] = useState<string>('');
    const [terminalOutput, setTerminalOutput] = useState<string>('');
    const [isTyping, setIsTyping] = useState<boolean>(false);
    const [visibleLinesCount, setVisibleLinesCount] = useState<number>(0);
    const [activePrompt, setActivePrompt] = useState<string | null>(null);

    // Scroll-triggered word switcher state
    const [isProblemVisible, setIsProblemVisible] = useState(false);
    const [problemWordIdx, setProblemWordIdx] = useState(0);
    const problemWords = ['CONFUSION', 'CHAOS', 'OVERWHELM', 'BOARD STRESS'];
    const problemSectionRef = useRef<HTMLDivElement>(null);

    // Hero Mouse Follow & Reveal Lens States
    const [heroMousePos, setHeroMousePos] = useState({ x: 0, y: 0 });
    const [isHeroHovered, setIsHeroHovered] = useState(false);
    const heroSectionRef = useRef<HTMLDivElement>(null);

    const [headingMousePos, setHeadingMousePos] = useState({ x: 0, y: 0 });
    const [isHeadingHovered, setIsHeadingHovered] = useState(false);
    const headingContainerRef = useRef<HTMLDivElement>(null);

    const handleHeroMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!heroSectionRef.current) return;
        const rect = heroSectionRef.current.getBoundingClientRect();
        setHeroMousePos({
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        });
    };

    const handleHeadingMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!headingContainerRef.current) return;
        const rect = headingContainerRef.current.getBoundingClientRect();
        setHeadingMousePos({
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        });
    };

    // Dynamic Google Fonts loading
    useEffect(() => {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://fonts.googleapis.com/css2?family=Sora:wght@700;800;900&family=Plus+Jakarta+Sans:wght@700;800&family=Outfit:wght@400;600;800;900&family=Syne:wght@800&family=Space+Grotesk:wght@500;700&display=swap';
        document.head.appendChild(link);
        return () => {
            document.head.removeChild(link);
        };
    }, []);

    // Staged animation timing effects
    useEffect(() => {
        if (heroStage === 'reveal') {
            const t1 = setTimeout(() => setHeroStage('subtext'), 150);
            return () => clearTimeout(t1);
        }
        if (heroStage === 'subtext') {
            const t2 = setTimeout(() => setHeroStage('cta'), 150);
            return () => clearTimeout(t2);
        }
        if (heroStage === 'cta') {
            const t3 = setTimeout(() => setHeroStage('scroll'), 150);
            return () => clearTimeout(t3);
        }
    }, [heroStage]);

    // Handle interactive console query simulation
    const simulateTerminal = (key: 'wave-optics' | 'biology' | 'simulator') => {
        if (isTyping) return;
        setIsTyping(true);
        setActivePrompt(key);
        setTerminalPrompt('');
        setTerminalOutput('');
        setVisibleLinesCount(0);

        const data = PROMPTS[key];
        let currentInput = '';
        let inputIdx = 0;

        const inputInterval = setInterval(() => {
            if (inputIdx < data.input.length) {
                currentInput += data.input[inputIdx];
                setTerminalPrompt(currentInput);
                inputIdx++;
            } else {
                clearInterval(inputInterval);
                setTimeout(() => {
                    let lineIdx = 0;
                    let currentLines: string[] = [];
                    
                    const outputInterval = setInterval(() => {
                        if (lineIdx < data.output.length) {
                            currentLines.push(data.output[lineIdx]);
                            setTerminalOutput(currentLines.join('\n'));
                            setVisibleLinesCount(lineIdx + 1);
                            lineIdx++;
                        } else {
                            clearInterval(outputInterval);
                            setIsTyping(false);
                        }
                    }, 120);
                }, 150);
            }
        }, 15);
    };

    // Auto-play the first simulation after hero enters scroll stage
    useEffect(() => {
        if (heroStage === 'scroll') {
            const timer = setTimeout(() => {
                simulateTerminal('wave-optics');
            }, 800);
            return () => clearTimeout(timer);
        }
    }, [heroStage]);

    // Scroll trigger observer for the problem switcher
    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setIsProblemVisible(true);
                }
            },
            { threshold: 0.15 }
        );

        const currentRef = problemSectionRef.current;
        if (currentRef) {
            observer.observe(currentRef);
        }

        return () => {
            if (currentRef) {
                observer.unobserve(currentRef);
            }
        };
    }, []);

    // Slow switcher animation cycle
    useEffect(() => {
        if (!isProblemVisible) return;
        const interval = setInterval(() => {
            setProblemWordIdx((prev) => (prev + 1) % problemWords.length);
        }, 1000); // Faster interval
        return () => clearInterval(interval);
    }, [isProblemVisible]);

    const toggleFaq = (index: number) => {
        setOpenFaqIdx((prev) => (prev === index ? null : index));
    };

    return (
        <div className="min-h-screen bg-[#f8fafc] dark:bg-[#020617] text-slate-900 dark:text-slate-100 transition-colors duration-300 font-sans overflow-x-hidden">
            {/* Custom Styles for animated gradient text */}
            <style>{`
                @keyframes gradient-x {
                    0%, 100% {
                        background-size: 200% 200%;
                        background-position: left center;
                    }
                    50% {
                        background-size: 200% 200%;
                        background-position: right center;
                    }
                }
                .animate-gradient-text {
                    animation: gradient-x 8s ease infinite;
                }
                .text-glow {
                    text-shadow: 0 4px 20px rgba(16, 185, 129, 0.35), 0 0 40px rgba(99, 102, 241, 0.2);
                }
                @keyframes shine-anim {
                    0% {
                        transform: translateX(-100%) skewX(-15deg);
                    }
                    100% {
                        transform: translateX(200%) skewX(-15deg);
                    }
                }
                .animate-shine {
                    animation: shine-anim 2.5s infinite ease-in-out;
                }
            `}</style>

            {/* Top Promotion Ribbon */}
            <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600 text-white text-xs md:text-sm font-black py-3.5 px-4 text-center relative overflow-hidden shadow-md flex items-center justify-center gap-2 z-50">
                <span className="inline-flex items-center gap-1 bg-white/20 px-2.5 py-0.5 rounded-full text-[10px] uppercase tracking-wider">
                    <Sparkles size={11} className="animate-spin-slow" /> Promo
                </span>
                <span><strong>Special Launch Campaign:</strong> All Pro and Pro Max plans are currently <strong>100% FREE</strong>! No card required.</span>
                <span className="hidden md:inline-block opacity-75">| Get started instantly.</span>
            </div>

            {/* Global Header */}
            <header className="sticky top-0 z-50 backdrop-blur-md bg-white/95 dark:bg-[#020617]/95 border-b border-slate-200/80 dark:border-slate-800/80 px-6 py-4 transition-all">
                <div className="max-w-7xl mx-auto flex items-center justify-between font-medium">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-black flex items-center justify-center rounded-xl border border-slate-800 shadow-md">
                            <img src="/clarity_logo.png" alt="Clarity Logo" className="w-10 h-10 object-contain" style={{ mixBlendMode: 'screen' }} />
                        </div>
                        <div>
                            <p className="text-xl font-black tracking-tight">Clarity</p>
                            <p className="text-[10px] font-black uppercase tracking-widest text-[#1D9E75]">Student OS for CBSE</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 md:gap-3">
                        <Link to="/login" className="px-4 py-2 text-slate-600 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white text-sm font-black transition-colors">
                            Student Login
                        </Link>
                        <Link 
                            to="/parent-portal" 
                            className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2 border border-slate-350 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900 text-sm font-black rounded-xl transition-colors"
                        >
                            <Users size={14} />
                            Parent Portal
                        </Link>
                        <Link to="/onboarding" className="px-5 py-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-950 text-sm font-black rounded-xl transition-all hover:scale-[1.02] border border-slate-800 dark:border-slate-200 shadow-sm">
                            Get Started
                        </Link>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-6 pt-10 pb-24 space-y-32">
                {/* Epic Typographic Entrance Section */}
                <section 
                    ref={heroSectionRef}
                    onMouseMove={handleHeroMouseMove}
                    onMouseEnter={() => setIsHeroHovered(true)}
                    onMouseLeave={() => setIsHeroHovered(false)}
                    className="relative overflow-hidden bg-slate-950 text-white p-8 md:p-16 border border-slate-850 min-h-[85vh] rounded-3xl flex flex-col justify-center shadow-2xl transition-all"
                >
                    {/* Animated grid overlay */}
                    <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-35" />
                    
                    {/* Radial glowing backgrounds */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-emerald-500/10 rounded-full blur-[140px] pointer-events-none animate-pulse" />
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none animate-pulse-glow" />

                    {isHeroHovered && (
                        <div 
                            className="absolute inset-0 pointer-events-none transition-opacity duration-500"
                            style={{
                                background: `radial-gradient(500px circle at ${heroMousePos.x}px ${heroMousePos.y}px, rgba(16, 185, 129, 0.07), rgba(99, 102, 241, 0.04), transparent 70%)`
                            }}
                        />
                    )}

                    <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center w-full min-h-[400px]">
                        {/* Left Column: Typographic Details */}
                        <div className="lg:col-span-7 flex flex-col items-center lg:items-start text-center lg:text-left space-y-6">
                            {/* Staged Logo Emblem */}
                            <div className={`w-24 h-24 bg-black border border-slate-800 flex items-center justify-center shadow-2xl rounded-2xl relative transition-all duration-1000 transform ${
                                heroStage !== 'reveal' ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
                            }`}>
                                <div className="absolute inset-0 border border-emerald-500/20 rounded-2xl animate-pulse pointer-events-none" />
                                <img src="/clarity_logo.png" alt="Clarity Emblem" className="w-20 h-20 object-contain" style={{ mixBlendMode: 'screen' }} />
                            </div>

                            {/* Syllabus Tag */}
                            <div className={`inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/10 text-emerald-400 text-xs font-bold uppercase tracking-wider border border-emerald-500/20 rounded-full transition-all duration-1000 transform ${
                                heroStage !== 'reveal' ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
                            }`}>
                                CBSE Class 9-12 Student OS
                            </div>

                            {/* Main Morphing Title */}
                            <div 
                                ref={headingContainerRef}
                                onMouseMove={handleHeadingMouseMove}
                                onMouseEnter={() => setIsHeadingHovered(true)}
                                onMouseLeave={() => setIsHeadingHovered(false)}
                                className="relative py-6 px-16 bg-white/10 dark:bg-slate-900/50 border border-slate-200/20 dark:border-slate-800/40 backdrop-blur-md rounded-[3rem] shadow-2xl overflow-hidden select-none cursor-zoom-in group max-w-max"
                            >
                                {/* Shiny shimmer animation line */}
                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full animate-shine pointer-events-none" />

                                {heroStage === 'reveal' && (
                                    <div className="absolute inset-0 -m-8 border border-emerald-500/20 animate-ping opacity-75 rounded-3xl pointer-events-none" />
                                )}
                                
                                {/* 1. Base Layer (100% opaque, bright and glowing) */}
                                <h1 className="text-8xl sm:text-[9.5rem] md:text-[11.5rem] lg:text-[13rem] font-extrabold tracking-[calc(-0.04em)] leading-none select-none" style={{ fontFamily: "'Sora', sans-serif", fontWeight: 800 }}>
                                    <span className="bg-gradient-to-r from-emerald-450 via-teal-300 via-indigo-550 to-emerald-450 bg-clip-text text-transparent animate-gradient-text text-glow">
                                        Clarity
                                    </span>
                                </h1>

                                {/* 2. Magnifier Zoom Layer (Scaled up from pointer origin, clipped to circular mask) */}
                                <div className="absolute inset-0 pointer-events-none" style={{
                                    clipPath: isHeadingHovered ? `circle(90px at ${headingMousePos.x}px ${headingMousePos.y}px)` : 'circle(0px at 0px 0px)',
                                    WebkitClipPath: isHeadingHovered ? `circle(90px at ${headingMousePos.x}px ${headingMousePos.y}px)` : 'circle(0px at 0px 0px)',
                                    transform: isHeadingHovered ? 'scale(1.12)' : 'none',
                                    transformOrigin: `${headingMousePos.x}px ${headingMousePos.y}px`,
                                    transition: 'transform 0.08s ease-out'
                                }}>
                                    <h1 className="absolute top-6 left-16 text-8xl sm:text-[9.5rem] md:text-[11.5rem] lg:text-[13rem] font-extrabold tracking-[calc(-0.04em)] leading-none select-none animate-gradient-text" style={{ fontFamily: "'Sora', sans-serif", fontWeight: 800 }}>
                                        <span className="bg-gradient-to-r from-emerald-400 via-teal-200 via-indigo-400 to-emerald-400 bg-clip-text text-transparent text-glow">
                                            Clarity
                                        </span>
                                    </h1>
                                </div>

                                {/* 3. Circular Glass Magnifying Lens Border */}
                                {isHeadingHovered && (
                                    <div 
                                        className="absolute pointer-events-none rounded-full border border-white/50 dark:border-white/40 shadow-2xl bg-white/5 backdrop-blur-[1.5px]" 
                                        style={{
                                            width: '180px',
                                            height: '180px',
                                            left: `${headingMousePos.x - 90}px`,
                                            top: `${headingMousePos.y - 90}px`,
                                        }}
                                    />
                                )}
                            </div>

                            {/* Subtext */}
                            <p className={`text-lg md:text-xl text-slate-300 font-medium leading-relaxed max-w-2xl transition-all duration-1000 transform ${
                                (heroStage === 'subtext' || heroStage === 'cta' || heroStage === 'scroll') 
                                    ? 'opacity-100 translate-y-0' 
                                    : 'opacity-0 translate-y-4'
                            }`}>
                                Clear concepts, focused daily missions, active recall voice recovery, and timed board exam simulators. Designed to guarantee your best syllabus prep in one beautiful system.
                            </p>

                            {/* CTAs */}
                            <div className={`flex flex-wrap gap-4 justify-center lg:justify-start pt-4 transition-all duration-1000 transform ${
                                (heroStage === 'cta' || heroStage === 'scroll') 
                                    ? 'opacity-100 translate-y-0' 
                                    : 'opacity-0 translate-y-4'
                            }`}>
                                <Link to="/onboarding" className="px-8 py-4 bg-[#1D9E75] hover:bg-[#15805d] text-white font-black inline-flex items-center gap-2 rounded-xl transition-all hover:scale-[1.03] border border-[#1D9E75] shadow-lg shadow-emerald-500/10">
                                    Build My Study OS
                                    <ArrowRight size={18} />
                                </Link>
                                <Link to="/parent-portal" className="px-8 py-4 border border-slate-700 bg-slate-900/50 hover:bg-slate-800 text-slate-300 font-black inline-flex items-center gap-2 rounded-xl transition-all hover:scale-[1.03] shadow-md">
                                    <Users size={18} className="text-emerald-400" />
                                    Open Parent Portal
                                </Link>
                            </div>

                            {/* Bouncing Indicator */}
                            <div className={`pt-8 transition-all duration-1000 hidden lg:block ${
                                heroStage === 'scroll' ? 'opacity-100' : 'opacity-0'
                            }`}>
                                <div className="animate-bounce-slow flex items-center gap-2 text-slate-400 font-bold text-xs uppercase tracking-widest pointer-events-none select-none">
                                    <span>Scroll to Explore</span>
                                    <ChevronDown size={16} className="text-emerald-400" />
                                </div>
                            </div>
                        </div>

                        {/* Right Column: Interactive Chat UI Simulator */}
                        <div className={`lg:col-span-5 w-full flex flex-col justify-center transition-all duration-1000 transform ${
                            (heroStage === 'subtext' || heroStage === 'cta' || heroStage === 'scroll')
                                ? 'opacity-100 translate-y-0 scale-100'
                                : 'opacity-0 translate-y-8 scale-95'
                        }`}>
                            <div className="w-full bg-white/95 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-805 rounded-3xl shadow-2xl backdrop-blur-md overflow-hidden flex flex-col">
                                {/* Chat Header */}
                                <div className="bg-slate-50/70 dark:bg-slate-950/60 px-4 py-3.5 flex items-center justify-between border-b border-slate-100 dark:border-slate-850">
                                    <div className="flex items-center gap-2">
                                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block animate-pulse" />
                                        <span className="text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider">Clarity Study Workspace</span>
                                    </div>
                                    <span className="text-[10px] font-mono text-slate-400 dark:text-slate-550 uppercase tracking-widest font-black">Active Session</span>
                                </div>
                                
                                {/* Quick Prompt Selector Pills */}
                                <div className="bg-slate-50/30 dark:bg-slate-900/60 p-3 border-b border-slate-100 dark:border-slate-850 flex flex-wrap gap-2">
                                    <button 
                                        type="button"
                                        onClick={() => simulateTerminal('wave-optics')}
                                        disabled={isTyping}
                                        className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                                            activePrompt === 'wave-optics'
                                                ? 'bg-emerald-50 dark:bg-emerald-900/20 text-[#1D9E75] border-[#1D9E75]/40 font-black shadow-sm'
                                                : 'bg-white dark:bg-slate-950 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:text-slate-850 dark:hover:text-slate-200 hover:border-slate-350 dark:hover:border-slate-700'
                                        }`}
                                    >
                                        💡 Wave Optics PYQ
                                    </button>
                                    <button 
                                        type="button"
                                        onClick={() => simulateTerminal('biology')}
                                        disabled={isTyping}
                                        className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                                            activePrompt === 'biology'
                                                ? 'bg-emerald-50 dark:bg-emerald-900/20 text-[#1D9E75] border-[#1D9E75]/40 font-black shadow-sm'
                                                : 'bg-white dark:bg-slate-950 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:text-slate-850 dark:hover:text-slate-200 hover:border-slate-350 dark:hover:border-slate-700'
                                        }`}
                                    >
                                        🌿 Grade Biology Note
                                    </button>
                                    <button 
                                        type="button"
                                        onClick={() => simulateTerminal('simulator')}
                                        disabled={isTyping}
                                        className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                                            activePrompt === 'simulator'
                                                ? 'bg-emerald-50 dark:bg-emerald-900/20 text-[#1D9E75] border-[#1D9E75]/40 font-black shadow-sm'
                                                : 'bg-white dark:bg-slate-950 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:text-slate-850 dark:hover:text-slate-200 hover:border-slate-350 dark:hover:border-slate-700'
                                        }`}
                                    >
                                        ⏱ Timed Exam Simulator
                                    </button>
                                </div>

                                {/* Chat Conversation Display */}
                                <div className="p-4 bg-white dark:bg-[#0b0f19] min-h-[300px] max-h-[360px] overflow-y-auto flex flex-col justify-start gap-4 select-none">
                                    {terminalPrompt ? (
                                        <>
                                            {/* User Message Bubble */}
                                            <div className="flex justify-end w-full">
                                                <div className="bg-[#1D9E75]/10 dark:bg-emerald-950/20 text-slate-800 dark:text-slate-100 px-4 py-2.5 rounded-2xl rounded-tr-none text-xs font-bold max-w-[85%] border border-[#1D9E75]/25 dark:border-emerald-500/20 shadow-sm text-left">
                                                    {terminalPrompt}
                                                    {isTyping && <span className="animate-pulse ml-0.5">|</span>}
                                                </div>
                                            </div>

                                            {/* AI Message Bubble */}
                                            {terminalOutput && (
                                                <div className="flex flex-col gap-2 items-start w-full animate-fadeIn">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-6 h-6 bg-[#1D9E75] text-white flex items-center justify-center rounded-full text-[10px]">
                                                            <Brain size={12} />
                                                        </div>
                                                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Clarity Coach</span>
                                                    </div>
                                                    <div className="bg-slate-50/80 dark:bg-slate-900/50 text-slate-800 dark:text-slate-250 p-4 rounded-3xl rounded-tl-none text-xs font-semibold max-w-[95%] border border-slate-200 dark:border-slate-850 shadow-sm text-left w-full space-y-4">
                                                        {activePrompt === 'wave-optics' && (
                                                            <div className="space-y-4">
                                                                <p className="font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5 text-xs">
                                                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                                                                    Derive expression for fringe width in YDSE (CBSE 2024)
                                                                </p>
                                                                
                                                                {visibleLinesCount >= 2 && (
                                                                    <div className="p-3.5 bg-emerald-500/5 dark:bg-emerald-955/10 border border-emerald-500/10 dark:border-emerald-500/20 rounded-2xl space-y-1">
                                                                        <p className="text-[9px] font-black uppercase text-[#1D9E75] tracking-wider">Concept Formula</p>
                                                                        <p className="text-sm font-black tracking-tight text-slate-850 dark:text-slate-150 font-mono">Fringe Width (β) = λD/d</p>
                                                                    </div>
                                                                )}

                                                                {visibleLinesCount >= 3 && (
                                                                    <div className="p-3.5 bg-rose-500/5 dark:bg-rose-955/10 border border-rose-500/10 dark:border-rose-500/20 rounded-2xl space-y-1.5">
                                                                        <p className="text-[9px] font-black uppercase text-rose-500 tracking-wider flex items-center gap-1">
                                                                            ⚠️ CBSE Exam Trap Identified
                                                                        </p>
                                                                        <p className="text-[11px] font-bold text-slate-600 dark:text-slate-400 leading-relaxed">
                                                                            Students often forget to explicitly state the path difference condition <span className="font-mono font-bold">Δx = nλ</span> for constructive interference. Skipping this loses <span className="font-bold text-rose-500">-0.5 Marks</span>.
                                                                        </p>
                                                                    </div>
                                                                )}

                                                                {visibleLinesCount >= 4 && (
                                                                    <div className="space-y-2">
                                                                        <p className="text-[9px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider">CBSE Marking Scheme Table</p>
                                                                        <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden text-[10px]">
                                                                            <table className="w-full text-left">
                                                                                <thead>
                                                                                    <tr className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 font-bold text-slate-500">
                                                                                        <th className="p-2">Step Description</th>
                                                                                        <th className="p-2 text-right">Weight</th>
                                                                                    </tr>
                                                                                </thead>
                                                                                <tbody className="divide-y divide-slate-150 dark:divide-slate-800 text-slate-655 dark:text-slate-350">
                                                                                    <tr>
                                                                                        <td className="p-2 font-semibold">Path Difference Formulation</td>
                                                                                        <td className="p-2 text-right font-black text-[#1D9E75]">+0.5 M</td>
                                                                                    </tr>
                                                                                    <tr>
                                                                                        <td className="p-2 font-semibold">Geometric Wavefront Construction</td>
                                                                                        <td className="p-2 text-right font-black text-[#1D9E75]">+1.5 M</td>
                                                                                    </tr>
                                                                                    <tr>
                                                                                        <td className="p-2 font-semibold">Final Fringe Width Simplification</td>
                                                                                        <td className="p-2 text-right font-black text-[#1D9E75]">+1.0 M</td>
                                                                                    </tr>
                                                                                </tbody>
                                                                            </table>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}

                                                        {activePrompt === 'biology' && (
                                                            <div className="space-y-4">
                                                                <div className="flex justify-between items-center bg-slate-100 dark:bg-slate-900/60 p-2 rounded-xl border border-slate-200 dark:border-slate-800">
                                                                    <span className="text-[9px] font-black uppercase text-slate-500 tracking-wider">OCR Vision Analysis</span>
                                                                    <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-[#1D9E75] text-[9px] font-black">98.2% Confidence</span>
                                                                </div>

                                                                {visibleLinesCount >= 3 && (
                                                                    <div className="p-3 bg-white dark:bg-slate-950/40 rounded-xl border border-slate-200 dark:border-slate-850 text-[11px] font-bold text-slate-600 dark:text-slate-400">
                                                                        "...syngamy forms zygote. Second sperm cell fertilizes polar nuclei..."
                                                                    </div>
                                                                )}

                                                                {visibleLinesCount >= 4 && (
                                                                    <div className="space-y-2">
                                                                        <p className="text-[9px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider">Answer Key Rubric Checklist</p>
                                                                        <div className="space-y-1.5 text-[10px] font-black">
                                                                            <div className="flex items-center justify-between p-2 rounded-xl bg-emerald-500/5 text-[#1D9E75] border border-emerald-500/10">
                                                                                <span>✔ Syngamy identified</span>
                                                                                <span>+1.0 Mark</span>
                                                                            </div>
                                                                            <div className="flex items-center justify-between p-2 rounded-xl bg-emerald-500/5 text-[#1D9E75] border border-emerald-500/10">
                                                                                <span>✔ Zygote formation described</span>
                                                                                <span>+1.0 Mark</span>
                                                                            </div>
                                                                            <div className="flex items-center justify-between p-2 rounded-xl bg-rose-500/5 text-rose-500 border border-rose-500/10">
                                                                                <span>✖ "Triple Fusion" term omitted</span>
                                                                                <span>-0.5 Mark</span>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                )}

                                                                {visibleLinesCount >= 5 && (
                                                                    <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-800">
                                                                        <div>
                                                                            <span className="text-[9px] font-black uppercase text-slate-400">Notes Grade</span>
                                                                            <p className="text-base font-black text-slate-850 dark:text-slate-100">2.5 / 3.0 (B+)</p>
                                                                        </div>
                                                                        <button type="button" className="px-3 py-1.5 bg-[#1D9E75] text-white rounded-xl text-[9px] font-black uppercase tracking-wider flex items-center gap-1 shadow-md hover:bg-[#15805d]">
                                                                            🎙️ Speak to Recover
                                                                        </button>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}

                                                        {activePrompt === 'simulator' && (
                                                            <div className="space-y-4">
                                                                <div className="flex justify-between items-center bg-slate-150/40 dark:bg-slate-900/60 p-2 rounded-xl border border-slate-200 dark:border-slate-800">
                                                                    <span className="text-[9px] font-black text-rose-500 tracking-wider flex items-center gap-1 uppercase">
                                                                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping inline-block" />
                                                                        TIMED BOARD SIMULATOR
                                                                    </span>
                                                                    <span className="font-mono text-xs font-black text-slate-800 dark:text-slate-250">03:00:00</span>
                                                                </div>

                                                                {visibleLinesCount >= 3 && (
                                                                    <div className="space-y-2">
                                                                        <div className="text-[11px] font-black text-slate-700 dark:text-slate-300">Q1: State Coulomb's Law (2 Marks)</div>
                                                                        <div className="p-3 bg-white dark:bg-slate-950/40 rounded-xl border border-slate-200 dark:border-slate-850 text-[11px] leading-relaxed text-slate-655 dark:text-slate-400">
                                                                            <span className="text-[8px] font-black text-slate-400 block uppercase mb-1">Your Voice Answer</span>
                                                                            "Force is directly proportional to product of charges and inversely proportional to square of distance..."
                                                                        </div>
                                                                    </div>
                                                                )}

                                                                {visibleLinesCount >= 4 && (
                                                                    <div className="space-y-2">
                                                                        <p className="text-[9px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider">Step-Marking Verification</p>
                                                                        <div className="space-y-1.5 text-[10px] font-black">
                                                                            <div className="flex items-center justify-between p-2 rounded-xl bg-emerald-500/5 text-[#1D9E75] border border-emerald-500/10">
                                                                                <span>✔ State formula (F = k * q1 * q2 / r²)</span>
                                                                                <span>+1.0 Mark</span>
                                                                            </div>
                                                                            <div className="flex items-center justify-between p-2 rounded-xl bg-emerald-500/5 text-[#1D9E75] border border-emerald-500/10">
                                                                                <span>✔ Define terms (permittivity constant)</span>
                                                                                <span>+1.0 Mark</span>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                )}

                                                                {visibleLinesCount >= 5 && (
                                                                    <div className="flex justify-between items-center pt-2 border-t border-slate-200 dark:border-slate-800">
                                                                        <span className="text-[9px] font-black uppercase text-slate-400">Verified Grade</span>
                                                                        <span className="px-3 py-1 bg-emerald-500/10 text-[#1D9E75] rounded-xl font-black text-[11px] border border-emerald-500/20">
                                                                            2.0 / 2.0 Marks (100%)
                                                                        </span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </>
                                    ) : (
                                        <div className="flex flex-col items-center justify-center py-16 text-slate-400 text-center space-y-3">
                                            <div className="w-12 h-12 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-full flex items-center justify-center shadow-inner">
                                                <Brain className="w-6 h-6 text-[#1D9E75] animate-pulse" />
                                            </div>
                                            <div>
                                                <p className="text-slate-700 dark:text-slate-300 font-extrabold text-xs">Clarity Study Assistant</p>
                                                <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 max-w-[220px] mx-auto leading-relaxed font-bold">Select a task pill above to simulate how the study assistant answers board questions and grades notes.</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Section: The Student Dilemma (Animated Word Switcher) */}
                <section ref={problemSectionRef} id="problem-section" className="py-24 bg-slate-950 text-white rounded-3xl border border-slate-900 relative overflow-hidden max-w-7xl mx-auto px-6 text-center shadow-xl">
                    <div className="absolute inset-0 bg-[linear-gradient(to_right,#0c0f1d_1px,transparent_1px),linear-gradient(to_bottom,#0c0f1d_1px,transparent_1px)] bg-[size:3rem_3rem] opacity-45" />
                    <div className="absolute -top-40 left-1/4 w-[400px] h-[400px] bg-rose-500/5 rounded-full blur-[100px] pointer-events-none" />
                    
                    <div className="relative z-10 space-y-6">
                        <p className="text-xs font-black uppercase tracking-widest text-rose-500">The Student Dilemma</p>
                        <h2 className="text-4xl md:text-5xl font-black tracking-tight max-w-3xl mx-auto leading-tight">
                            Traditional CBSE preparation is locked in endless...
                        </h2>
                        <div className="h-28 flex items-center justify-center">
                            <span className="text-5xl md:text-7xl font-mono font-bold tracking-tight text-red-500 select-none animate-pulse">
                                {problemWords[problemWordIdx]}
                            </span>
                        </div>
                        <p className="text-slate-405 max-w-xl mx-auto text-sm md:text-base font-semibold">
                            Endless reference guides, complex marking criteria, and test anxiety. Clarity structures your study path into clear, active missions that guarantee readiness.
                        </p>
                    </div>
                </section>

                {/* Section: Interactive Workspace Mockups */}
                <section className="space-y-8">
                    <div className="text-center max-w-3xl mx-auto space-y-3">
                        <p className="text-xs font-black uppercase tracking-wider text-[#1D9E75]">Interactive Product Demo</p>
                        <h2 className="text-4xl md:text-5xl font-black tracking-tight text-slate-900 dark:text-white">
                            Explore the Clarity Ecosystem
                        </h2>
                        <p className="text-slate-500 dark:text-slate-400 font-semibold text-lg leading-relaxed">
                            Click the tabs below to switch between the workspace views and preview how Clarity manages student preparation and parent transparent metrics.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch">
                        {/* Selector Tabs Column */}
                        <div className="lg:col-span-4 flex flex-col gap-3 justify-center">
                            {[
                                {
                                    id: 'workspace',
                                    title: 'Daily Mission Workspace',
                                    desc: 'Dynamic checklists prioritizing high-ROI board revision and weak topic recover goals.'
                                },
                                {
                                    id: 'tutor',
                                    title: 'AI CBSE Study Coach',
                                    desc: 'Professional chat console resolving textbook questions and surfacing crucial CBSE exam traps.'
                                },
                                {
                                    id: 'simulator',
                                    title: 'Time Exam Simulator',
                                    desc: 'Board-style exam practice featuring detailed step-marking grading checklists.'
                                },
                                {
                                    id: 'parent',
                                    title: 'Parent Transparency Portal',
                                    desc: 'Separate dashboard displaying readiness scores, risk assessments, and weekly progress alerts.'
                                }
                            ].map((tab) => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id as any)}
                                    className={`w-full text-left p-6 border transition-all flex flex-col gap-1.5 rounded-2xl ${
                                        activeTab === tab.id 
                                            ? 'bg-[#1D9E75] text-white border-transparent shadow-lg shadow-emerald-500/10 scale-[1.02]' 
                                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-350 hover:bg-slate-50 dark:hover:bg-slate-850'
                                    }`}
                                >
                                    <h4 className="font-black text-base">{tab.title}</h4>
                                    <p className={`text-xs font-semibold ${activeTab === tab.id ? 'text-white/80' : 'text-slate-400 dark:text-slate-500'}`}>
                                        {tab.desc}
                                    </p>
                                </button>
                            ))}
                        </div>

                        {/* Interactive Screen Display Column */}
                        <div className="lg:col-span-8 relative flex items-stretch">
                            <div className="absolute -inset-1 bg-gradient-to-tr from-[#1D9E75] to-indigo-500 opacity-20 blur-xl pointer-events-none" />
                            <div className="relative w-full border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-[#0f172a] shadow-2xl p-8 flex flex-col justify-between rounded-3xl overflow-hidden">
                                {/* Window Control Bar */}
                                <div className="flex items-center gap-1.5 mb-6 pb-4 border-b border-slate-100 dark:border-slate-800">
                                    <span className="w-3 h-3 rounded-full bg-rose-400 inline-block" />
                                    <span className="w-3 h-3 rounded-full bg-amber-400 inline-block" />
                                    <span className="w-3 h-3 rounded-full bg-emerald-400 inline-block" />
                                    <span className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-widest ml-3">
                                        Clarity Student OS — {activeTab.toUpperCase()}
                                    </span>
                                </div>

                                {/* Active Tab Contents */}
                                <div className="flex-1 flex flex-col justify-center min-h-[300px]">
                                    {activeTab === 'workspace' && (
                                        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                                            <div className="md:col-span-7 space-y-4">
                                                <div className="p-5 bg-slate-950 text-white shadow-md rounded-xl">
                                                    <p className="text-[10px] font-black uppercase tracking-widest text-[#1D9E75] mb-3">Today's Daily Mission</p>
                                                    <div className="space-y-2">
                                                        <div className="flex items-center justify-between text-xs p-3 bg-white/5 border border-white/10 rounded-lg">
                                                            <span className="flex items-center gap-2"><CheckCircle2 size={14} className="text-emerald-400" /> Solve 5 Wave Optics PYQs</span>
                                                            <span className="text-[9px] uppercase font-black tracking-wider bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded-full">+15 XP</span>
                                                        </div>
                                                        <div className="flex items-center justify-between text-xs p-3 bg-white/5 border border-white/5 rounded-lg">
                                                            <span className="flex items-center gap-2"><div className="w-4 h-4 border-2 border-white/20 rounded" /> Revise 2 Tricky Biology Traps</span>
                                                            <span className="text-[9px] uppercase font-black tracking-wider bg-white/10 text-white/60 px-1.5 py-0.5 rounded-full">Pending</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="p-4 border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex items-center justify-between shadow-sm rounded-xl">
                                                    <div>
                                                        <p className="text-[9px] font-black uppercase text-slate-400 tracking-wider">CBSE Readiness</p>
                                                        <h4 className="text-2xl font-black text-slate-900 dark:text-white">78%</h4>
                                                    </div>
                                                    <span className="text-xs font-bold text-emerald-605 bg-emerald-50 dark:bg-emerald-950/20 px-2 py-0.5 rounded-full">High prep stability</span>
                                                </div>
                                            </div>
                                            <div className="md:col-span-5 flex flex-col items-center justify-center p-6 bg-slate-50 dark:bg-slate-900/30 border border-slate-100 dark:border-slate-800 rounded-xl">
                                                <Flame className="text-orange-500 w-12 h-12 mb-2 animate-bounce-slow" />
                                                <p className="text-2xl font-black text-slate-900 dark:text-white">6 Days</p>
                                                <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest mt-1">Study Streak</p>
                                            </div>
                                        </div>
                                    )}

                                    {activeTab === 'tutor' && (
                                        <div className="space-y-4">
                                            <div className="flex items-start gap-3">
                                                <div className="w-8 h-8 bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xs font-black rounded-full">U</div>
                                                <div className="p-4 bg-slate-100 dark:bg-slate-800 max-w-[85%] rounded-2xl rounded-tl-none">
                                                    <p className="text-xs font-bold text-slate-805 dark:text-slate-200">Explain the Photoelectric Effect in CBSE board style.</p>
                                                </div>
                                            </div>
                                            <div className="flex items-start gap-3">
                                                <div className="w-8 h-8 bg-[#1D9E75] text-white flex items-center justify-center text-xs rounded-full"><Brain size={14} /></div>
                                                <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 dark:bg-emerald-950/20 max-w-[85%] space-y-2 rounded-2xl rounded-tl-none">
                                                    <p className="text-xs font-bold text-slate-900 dark:text-slate-105">
                                                        It is the emission of electrons when light of threshold frequency shines on a metal surface.
                                                    </p>
                                                    <div className="p-2.5 bg-yellow-300/20 border border-yellow-300/30 text-yellow-800 dark:text-yellow-300 text-[11px] font-bold rounded-lg">
                                                        <strong>CBSE Board Exam Tip:</strong> Always state that emission is instantaneous and kinetic energy depends on frequency, not intensity!
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {activeTab === 'simulator' && (
                                        <div className="space-y-4">
                                            <div className="p-4 bg-slate-950 text-white flex items-center justify-between rounded-t-xl border-b border-slate-850">
                                                <div className="flex items-center gap-2">
                                                    <Trophy size={16} className="text-yellow-300" />
                                                    <span className="text-xs font-black">Physics Part I Simulator</span>
                                                </div>
                                                <span className="text-[10px] bg-white/20 px-2 py-0.5 font-mono font-black rounded">02:14:55</span>
                                            </div>
                                            <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-b-xl space-y-3">
                                                <p className="text-xs font-black text-slate-900 dark:text-white">Q1: State Coulomb's law. (2 Marks)</p>
                                                <div className="p-3 bg-emerald-50 dark:bg-emerald-955/20 border border-emerald-100 dark:border-emerald-900/30 text-xs space-y-1.5 rounded-lg">
                                                    <p className="font-black text-[#1D9E75] uppercase text-[9px] tracking-wider">Step-Marking Verification</p>
                                                    <p className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5"><Check size={12} className="text-emerald-500" /> State formula: F = k*q1*q2/r² (+1.0 Mark)</p>
                                                    <p className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5"><Check size={12} className="text-emerald-500" /> Define variables & vacuum permittivity (+1.0 Mark)</p>
                                                    <div className="pt-1.5 border-t border-slate-100 dark:border-slate-800 flex justify-between font-bold text-slate-800 dark:text-slate-200">
                                                        <span>Total Grade</span>
                                                        <span>2.0 / 2.0 Marks</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {activeTab === 'parent' && (
                                        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                                            <div className="md:col-span-7 space-y-3">
                                                <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between shadow-sm rounded-xl">
                                                    <div>
                                                        <p className="text-[9px] font-black uppercase text-slate-400">Weekly Student Score</p>
                                                        <h4 className="text-2xl font-black text-[#1D9E75] mt-0.5">82.5%</h4>
                                                    </div>
                                                    <span className="text-[10px] bg-emerald-50 dark:bg-emerald-950/20 text-[#1D9E75] px-2.5 py-1 font-black uppercase tracking-wider border border-emerald-500/20 rounded-full">Low Risk</span>
                                                </div>
                                                <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-2 rounded-xl">
                                                    <p className="text-[9px] font-black uppercase text-[#1D9E75] tracking-wider">Recommended actions</p>
                                                    <p className="text-[11px] font-bold text-slate-600 dark:text-slate-300 leading-relaxed">
                                                        Ensure <strong>Izyaan</strong> completes 1 timed Physics simulator test on Wave Optics this week.
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="md:col-span-5 flex flex-col items-center justify-center p-6 bg-slate-50 dark:bg-slate-900/30 border border-slate-100 dark:border-slate-800 text-center rounded-xl">
                                                <div className="relative w-20 h-20 mb-2">
                                                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                                                        <path className="text-slate-200 dark:text-slate-700" strokeWidth="3.5" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                                                        <path className="text-[#1D9E75]" strokeDasharray="84, 100" strokeWidth="3.5" strokeLinecap="round" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                                                    </svg>
                                                    <div className="absolute inset-0 flex items-center justify-center text-sm font-black text-slate-800 dark:text-white">84%</div>
                                                </div>
                                                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mt-1">Syllabus Coverage</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Section: Bento Grid Features Layout */}
                <section className="space-y-8">
                    <div className="text-center max-w-2xl mx-auto space-y-2">
                        <p className="text-xs font-black uppercase tracking-wider text-[#1D9E75]">Bento Features OS</p>
                        <h2 className="text-4xl font-black tracking-tight text-slate-900 dark:text-white">
                            Fully featured for absolute preparation
                        </h2>
                        <p className="text-slate-550 dark:text-slate-400 font-semibold leading-relaxed">
                            No shortcuts. Clarity packages specialized revision and verification engines to keep syllabus tracking concrete.
                        </p>
                    </div>

                    {/* Bento Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                        {/* Box 1: Studio AI (Video Learning Assist) */}
                        <div className="md:col-span-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 p-8 shadow-sm hover:shadow-md transition-all flex flex-col md:flex-row gap-6 items-center rounded-3xl">
                            <div className="space-y-4 flex-1">
                                <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-650 dark:text-indigo-400 flex items-center justify-center shadow-inner rounded-xl">
                                    <Video size={22} />
                                </div>
                                <h3 className="font-black text-2xl text-slate-900 dark:text-white">Studio Video Learning Assist</h3>
                                <p className="text-sm text-slate-550 dark:text-slate-400 leading-relaxed font-semibold">
                                    Convert curriculum videos into points to remember and active mock quizzes. Tracks trickiest CBSE board exam questions and traps automatically from reference transcripts.
                                </p>
                            </div>
                            <div className="w-full md:w-56 p-4 bg-slate-50 dark:bg-[#0c0e14] border border-slate-100 dark:border-slate-850 space-y-2 shrink-0 rounded-xl">
                                <span className="text-[9px] font-black uppercase text-[#1D9E75] tracking-widest">Tricky Point</span>
                                <p className="text-xs font-bold leading-relaxed text-slate-800 dark:text-slate-200">
                                    Planck's constant remains independent of amplitude. Intensity only scales photon counts!
                                </p>
                            </div>
                        </div>

                        {/* Box 2: Active Recall Board */}
                        <div className="md:col-span-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 p-8 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-6 rounded-3xl">
                            <div className="space-y-4">
                                <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-955/30 text-[#1D9E75] flex items-center justify-center shadow-inner rounded-xl">
                                    <Brain size={22} />
                                </div>
                                <h3 className="font-black text-2xl text-slate-900 dark:text-white">Active Recall Board</h3>
                                <p className="text-sm text-slate-550 dark:text-slate-400 leading-relaxed font-semibold">
                                    Speak or write down what you remember. The AI voice grading engine benchmarks your recall against exact NCERT concepts and reports progress instantly.
                                </p>
                            </div>
                            <div className="flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 text-emerald-700 dark:text-emerald-350 text-xs font-bold w-fit rounded-lg">
                                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-ping" />
                                Voice Analysis Active
                            </div>
                        </div>

                        {/* Box 3: OCR Note Grading */}
                        <div className="md:col-span-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 p-8 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-6 rounded-3xl">
                            <div className="space-y-4">
                                <div className="w-12 h-12 bg-amber-50 dark:bg-amber-955/30 text-amber-600 dark:text-amber-400 flex items-center justify-center shadow-inner rounded-xl">
                                    <FileText size={22} />
                                </div>
                                <h3 className="font-black text-2xl text-slate-900 dark:text-white">OCR Handwritten Grading</h3>
                                <p className="text-sm text-slate-550 dark:text-slate-400 leading-relaxed font-semibold">
                                    Snap a picture of your handwritten answers or notebooks. Our vision OCR system reads your text, identifies diagrams, and grades it against CBSE step-marking criteria.
                                </p>
                            </div>
                            <span className="text-[10px] uppercase font-black tracking-wider text-slate-450">Class 9-12 Supported</span>
                        </div>

                        {/* Box 4: Multi-Board & Multi-Medium Support */}
                        <div className="md:col-span-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 p-8 shadow-sm hover:shadow-md transition-all flex flex-col md:flex-row gap-6 items-center rounded-3xl">
                            <div className="space-y-4 flex-1">
                                <div className="w-12 h-12 bg-blue-50 dark:bg-blue-955/30 text-blue-650 dark:text-blue-450 flex items-center justify-center shadow-inner rounded-xl">
                                    <BookOpen size={22} />
                                </div>
                                <h3 className="font-black text-2xl text-slate-900 dark:text-white flex items-center gap-2">
                                    Multi-Board & Dual Medium
                                    <span className="px-2 py-0.5 bg-emerald-50 dark:bg-emerald-950/20 text-[#1D9E75] text-[9px] font-black rounded-full uppercase tracking-wider">Active</span>
                                </h3>
                                <p className="text-sm text-slate-550 dark:text-slate-400 leading-relaxed font-semibold">
                                    Fully supports CBSE Board and Tamil Nadu State Board (TNSERT) across both English and Tamil Mediums. The AI model adapts questions, answers, and study resources according to your curriculum and instruction medium. (IB & IGCSE coming soon).
                                </p>
                            </div>
                            <div className="p-4 bg-emerald-500/5 dark:bg-emerald-955/10 border border-emerald-500/10 dark:border-emerald-500/20 text-xs font-bold text-[#1D9E75] flex items-center gap-2 shrink-0 rounded-xl">
                                <Check size={14} /> TNSERT & CBSE Live
                            </div>
                        </div>

                        {/* Box 5: Worldwide & Local Leaderboards */}
                        <div className="md:col-span-12 bg-gradient-to-br from-emerald-550/5 via-white to-indigo-500/5 dark:from-emerald-950/10 dark:via-slate-900 dark:to-indigo-950/10 border border-slate-200 dark:border-slate-850 p-8 shadow-sm hover:shadow-md transition-all flex flex-col md:flex-row gap-8 items-center rounded-3xl">
                            <div className="space-y-4 flex-1">
                                <div className="w-12 h-12 bg-yellow-50 dark:bg-yellow-955/20 text-yellow-600 dark:text-yellow-455 flex items-center justify-center shadow-inner rounded-xl">
                                    <Trophy size={22} className="animate-pulse" />
                                </div>
                                <h3 className="font-black text-2xl text-slate-900 dark:text-white flex items-center gap-2">
                                    Worldwide & Local Leaderboards
                                    <span className="px-2 py-0.5 bg-yellow-100 dark:bg-yellow-905/30 text-yellow-700 dark:text-yellow-400 text-[10px] font-black rounded-full uppercase tracking-wider">Active</span>
                                </h3>
                                <p className="text-sm text-slate-550 dark:text-slate-400 leading-relaxed font-semibold">
                                    Stay motivated with a regional point-based grading system. Earn points for daily activities like asking the AI (+10), active recall logs (+30), and timed practice exams (+50). Check your ranking on the overall leaderboards, filterable by Grade, Country, State, or City.
                                </p>
                                <div className="flex flex-wrap gap-2 text-[10px] font-bold text-slate-500">
                                    <span className="px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-full">⚡ Practice (+50 pts)</span>
                                    <span className="px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-full">🧠 Recall (+30 pts)</span>
                                    <span className="px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-full">💬 AI Chat (+10 pts)</span>
                                </div>
                            </div>
                            
                            {/* Mini Leaderboard Graphic */}
                            <div className="w-full md:w-80 bg-white/95 dark:bg-slate-950/95 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-lg shrink-0 space-y-3">
                                <p className="text-[10px] font-black uppercase tracking-wider text-slate-450 dark:text-slate-500 flex justify-between items-center">
                                    <span>Regional Rankings</span>
                                    <span className="text-[#1D9E75]">Tamil Nadu (State-wise)</span>
                                </p>
                                <div className="space-y-2 text-xs font-semibold">
                                    <div className="flex items-center justify-between p-2 rounded-xl bg-yellow-500/5 text-slate-800 dark:text-slate-250 border border-yellow-500/15">
                                        <span className="flex items-center gap-2">
                                            <span className="w-5 h-5 rounded-full bg-yellow-105 dark:bg-yellow-905/30 text-yellow-600 dark:text-yellow-400 flex items-center justify-center text-[10px] font-black">1</span>
                                            <span>Rohan Gupta</span>
                                        </span>
                                        <span className="font-mono text-[#1D9E75] font-black">1,420 pts</span>
                                    </div>
                                    <div className="flex items-center justify-between p-2 rounded-xl bg-slate-505/5 text-slate-800 dark:text-slate-250 border border-slate-300 dark:border-slate-700">
                                        <span className="flex items-center gap-2">
                                            <span className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-350 flex items-center justify-center text-[10px] font-black">2</span>
                                            <span>Priya Nair</span>
                                        </span>
                                        <span className="font-mono text-[#1D9E75] font-black">1,180 pts</span>
                                    </div>
                                    <div className="flex items-center justify-between p-2 rounded-xl bg-emerald-500/5 text-slate-800 dark:text-slate-250 border border-emerald-500/15 font-bold ring-1 ring-emerald-500/20">
                                        <span className="flex items-center gap-2">
                                            <span className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-[#1D9E75] flex items-center justify-center text-[10px] font-black">3</span>
                                            <span>You</span>
                                        </span>
                                        <span className="font-mono text-[#1D9E75] font-black">950 pts</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Section: Family Hub Showcase */}
                <section className="relative overflow-hidden border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 md:p-14 shadow-xl rounded-3xl">
                    <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-gradient-to-bl from-teal-500/10 to-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
                    
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center relative z-10">
                        {/* Parent Portal Info */}
                        <div className="lg:col-span-6 space-y-6">
                            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-teal-50 dark:bg-teal-955/20 text-teal-850 dark:text-teal-400 text-xs font-black uppercase tracking-wider border border-teal-200/50 rounded-full">
                                Dedicated Family Hub
                            </div>
                            <h2 className="text-4xl font-black tracking-tight text-slate-900 dark:text-white leading-none">
                                Transparent Parent Portal for family alignment
                            </h2>
                            <p className="text-slate-600 dark:text-slate-400 leading-relaxed font-semibold">
                                Family transparency stays distinct. Clarity separates parent tracking from the student study interface, allowing parents to log in independently with distinct secure credentials.
                            </p>
                            <div className="space-y-3">
                                <div className="flex items-start gap-3">
                                    <div className="mt-1 bg-teal-100 dark:bg-teal-955 text-teal-850 dark:text-teal-450 p-1.5 rounded-lg"><Mail size={14} /></div>
                                    <div>
                                        <p className="text-sm font-black text-slate-900 dark:text-white">Weekly Progress Report Emails</p>
                                        <p className="text-xs text-slate-550">Automated reports listing asked questions, practice performance, and weak spots.</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <div className="mt-1 bg-teal-100 dark:bg-teal-955 text-teal-850 dark:text-teal-450 p-1.5 rounded-lg"><LineChart size={14} /></div>
                                    <div>
                                        <p className="text-sm font-black text-slate-900 dark:text-white">Live Syllabus Coverage & Readiness Indicators</p>
                                        <p className="text-xs text-slate-550">Track coverage percentage, risk assessment, and active time graphs.</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <div className="mt-1 bg-teal-100 dark:bg-teal-955 text-teal-850 dark:text-teal-450 p-1.5 rounded-lg"><AlertTriangle size={14} /></div>
                                    <div>
                                        <p className="text-sm font-black text-slate-900 dark:text-white">Actionable Intervention Guides</p>
                                        <p className="text-xs text-slate-550">Provides exact steps to support your child (e.g. which chapters need immediate recovery practice).</p>
                                    </div>
                                </div>
                            </div>
                            <div className="pt-2">
                                <Link 
                                    to="/parent-portal" 
                                    className="px-6 py-3.5 bg-slate-900 dark:bg-white text-white dark:text-slate-950 font-black inline-flex items-center gap-2 shadow-lg transition-all hover:scale-[1.02] border border-slate-800 dark:border-slate-200 rounded-xl"
                                >
                                    Open Parent Portal Dashboard
                                    <ArrowRight size={16} />
                                </Link>
                            </div>
                        </div>

                        {/* Right: Parent Portal UI Mockup */}
                        <div className="lg:col-span-6 relative">
                            <div className="relative border border-slate-200 dark:border-slate-855 bg-slate-55/50 dark:bg-slate-950/40 p-6 shadow-md overflow-hidden rounded-2xl">
                                <div className="flex items-center justify-between pb-4 border-b border-slate-200/60 dark:border-slate-800/60 mb-5">
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 bg-slate-900 dark:bg-slate-800 text-white flex items-center justify-center font-bold text-xs border border-slate-850 rounded-lg">
                                            P
                                        </div>
                                        <div>
                                            <p className="text-xs font-black text-slate-900 dark:text-white">Clarity Parent Portal</p>
                                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Access Active</p>
                                        </div>
                                    </div>
                                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-550 inline-block animate-pulse" />
                                </div>

                                <div className="space-y-4">
                                    {/* Linked Student Card */}
                                    <div className="p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 shadow-sm flex items-center justify-between rounded-xl">
                                        <div>
                                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Linked Student</p>
                                            <p className="text-sm font-black text-slate-900 dark:text-white">Izyaan Mohammed</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Risk Level</p>
                                            <p className="text-xs font-black text-emerald-600 bg-emerald-50 dark:bg-emerald-955/20 px-2 py-0.5 inline-block border border-emerald-500/20 rounded-full">Low Risk</p>
                                        </div>
                                    </div>

                                    {/* Action Plan */}
                                    <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 shadow-sm space-y-2.5 rounded-xl">
                                        <p className="text-[10px] font-black uppercase text-[#1D9E75] tracking-wider">Recommended Parent Action Plan</p>
                                        <div className="space-y-2 text-xs">
                                            <div className="p-2.5 bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-850 flex items-start gap-2 rounded-lg">
                                                <span className="text-slate-700 dark:text-slate-300 font-bold leading-relaxed">
                                                    Ensure <strong>Izyaan</strong> completes 1 timed Physics simulator test for <strong>Wave Optics</strong> this week.
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Section: Pricing Cards */}
                <section id="pricing" className="space-y-8">
                    <div className="text-center max-w-2xl mx-auto space-y-2">
                        <span className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-100 dark:bg-emerald-955/40 text-emerald-800 dark:text-emerald-450 text-xs font-black uppercase tracking-wider border border-emerald-500/25 rounded-full">
                            Launch Offer Campaign
                        </span>
                        <h2 className="text-4xl font-black tracking-tight text-[#020617] dark:text-white">
                            Unlock full power, 100% free
                        </h2>
                        <p className="text-slate-500 dark:text-slate-450 font-semibold leading-relaxed">
                            For a limited time, all study levels are free to access as part of our launch campaign. Start boosting your prep today.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
                        {tiers.map((tier) => (
                            <div 
                                key={tier.name} 
                                className={`p-8 border flex flex-col justify-between transition-all rounded-3xl ${
                                    tier.highlight 
                                        ? 'border-[#1D9E75] bg-emerald-50/20 dark:bg-emerald-955/10 shadow-lg ring-2 ring-[#1D9E75]/10 relative' 
                                        : 'border-slate-200 dark:border-slate-855 bg-white dark:bg-slate-900 hover:shadow-md'
                                }`}
                            >
                                {tier.highlight && (
                                    <span className="absolute -top-3.5 left-1/2 transform -translate-x-1/2 px-3.5 py-1 bg-[#1D9E75] text-white text-[10px] font-black uppercase tracking-widest shadow-md border border-[#1D9E75] rounded-full">
                                        Most Popular
                                    </span>
                                )}
                                <div className="space-y-5">
                                    <div>
                                        <span className="px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-850 rounded-full">
                                            {tier.badge}
                                        </span>
                                        <h3 className="text-lg font-black text-[#020617] dark:text-white mt-2.5">{tier.name}</h3>
                                    </div>
                                    <div className="flex items-baseline gap-2 pb-4 border-b border-slate-100 dark:border-slate-850">
                                        <span className="text-sm font-bold text-slate-450 line-through">{tier.originalPrice}</span>
                                        <span className="text-4xl font-black text-[#020617] dark:text-white">{tier.promoPrice}</span>
                                        <span className="text-xs font-bold text-slate-500">/mo</span>
                                    </div>
                                    <ul className="space-y-2.5 text-xs font-medium text-slate-600 dark:text-slate-355">
                                        {tier.features.map((f) => (
                                            <li key={f} className="flex items-start gap-2">
                                                <CheckCircle2 size={13} className="text-[#1D9E75] mt-0.5 shrink-0" />
                                                <span>{f}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                                <div className="pt-6">
                                    <Link 
                                        to="/onboarding" 
                                        className={`inline-flex w-full items-center justify-center gap-2 py-3.5 text-xs font-black shadow-md rounded-xl transition-all border ${
                                            tier.highlight 
                                                ? 'bg-[#1D9E75] hover:bg-[#15805d] text-white border-[#1D9E75]' 
                                                : 'bg-slate-900 dark:bg-white hover:bg-slate-800 dark:hover:bg-slate-100 text-white dark:text-slate-955 border-slate-800 dark:border-slate-200'
                                        }`}
                                    >
                                        {tier.cta}
                                        <Rocket size={14} />
                                    </Link>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Section: Accordion FAQs */}
                <section className="max-w-3xl mx-auto space-y-6">
                    <div className="text-center space-y-2">
                        <p className="text-xs font-black uppercase tracking-wider text-[#1D9E75]">FAQ</p>
                        <h2 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">Frequently Asked Questions</h2>
                    </div>

                    <div className="space-y-3">
                        {faqsList.map((faq, index) => (
                            <div 
                                key={index} 
                                className="border border-slate-200 dark:border-slate-850 bg-white dark:bg-slate-900 overflow-hidden shadow-sm transition-all rounded-2xl"
                            >
                                <button
                                    onClick={() => toggleFaq(index)}
                                    className="w-full flex items-center justify-between p-6 text-left font-black text-sm md:text-base text-slate-900 dark:text-white select-none hover:bg-slate-50/50 dark:hover:bg-slate-850/20 transition-colors"
                                >
                                    <span>{faq.q}</span>
                                    <ChevronDown 
                                        size={18} 
                                        className={`text-slate-400 transition-transform duration-300 ${
                                            openFaqIdx === index ? 'transform rotate-180 text-[#1D9E75]' : ''
                                        }`}
                                    />
                                </button>
                                {openFaqIdx === index && (
                                    <div className="p-6 pt-0 border-t border-slate-100 dark:border-slate-800 text-xs md:text-sm text-slate-500 dark:text-slate-400 font-semibold leading-relaxed animate-fadeIn">
                                        {faq.a}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </section>
            </main>
        </div>
    );
};
