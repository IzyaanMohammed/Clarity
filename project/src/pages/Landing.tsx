import { useState, useEffect } from 'react';
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

export const Landing = () => {
    // Staged animation hero state
    const [heroStage, setHeroStage] = useState<'intro' | 'reveal' | 'subtext' | 'cta' | 'scroll'>('intro');
    const [introWord, setIntroWord] = useState('CONFUSION...');

    // Interactive mockup state
    const [activeTab, setActiveTab] = useState<'workspace' | 'tutor' | 'simulator' | 'parent'>('workspace');

    // FAQ state (accordion index)
    const [openFaqIdx, setOpenFaqIdx] = useState<number | null>(null);

    // Dynamic Google Fonts loading
    useEffect(() => {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;800;900&family=Space+Grotesk:wght@500;700&display=swap';
        document.head.appendChild(link);
        return () => {
            document.head.removeChild(link);
        };
    }, []);

    // Staged animation timing effects
    useEffect(() => {
        const wordsList = ['CONFUSION', 'CHAOS', 'OVERWHELM', 'BOARD STRESS'];
        let wordIdx = 0;
        const interval = setInterval(() => {
            if (wordIdx < wordsList.length) {
                setIntroWord(wordsList[wordIdx]);
                wordIdx++;
            } else {
                clearInterval(interval);
                setHeroStage('reveal');
            }
        }, 250);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (heroStage === 'reveal') {
            const t1 = setTimeout(() => setHeroStage('subtext'), 1000);
            return () => clearTimeout(t1);
        }
        if (heroStage === 'subtext') {
            const t2 = setTimeout(() => setHeroStage('cta'), 800);
            return () => clearTimeout(t2);
        }
        if (heroStage === 'cta') {
            const t3 = setTimeout(() => setHeroStage('scroll'), 800);
            return () => clearTimeout(t3);
        }
    }, [heroStage]);

    const toggleFaq = (index: number) => {
        setOpenFaqIdx((prev) => (prev === index ? null : index));
    };

    return (
        <div className="min-h-screen bg-[#f8fafc] dark:bg-[#020617] text-slate-900 dark:text-slate-100 transition-colors duration-300 font-sans overflow-x-hidden">
            {/* Top Promotion Ribbon */}
            <div className="bg-gradient-to-r from-emerald-600 via-teal-655 to-indigo-600 text-white text-xs md:text-sm font-black py-3.5 px-4 text-center relative overflow-hidden shadow-md flex items-center justify-center gap-2 z-55">
                <span className="inline-flex items-center gap-1 bg-white/20 px-2.5 py-0.5 rounded-full text-[10px] uppercase tracking-wider">
                    <Sparkles size={11} className="animate-spin-slow" /> Promo
                </span>
                <span><strong>Special Launch Campaign:</strong> All Pro and Pro Max plans are currently <strong>100% FREE</strong>! No card required.</span>
                <span className="hidden md:inline-block opacity-75">| Get started instantly.</span>
            </div>

            {/* Global Header */}
            <header className="sticky top-0 z-50 backdrop-blur-md bg-white/85 dark:bg-[#020617]/85 border-b border-slate-200/80 dark:border-slate-800/80 px-6 py-4 transition-all">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-[#1D9E75] text-white flex items-center justify-center shadow-lg shadow-emerald-500/20">
                            <Brain size={20} />
                        </div>
                        <div>
                            <p className="text-xl font-black tracking-tight">Clarity</p>
                            <p className="text-[10px] font-black uppercase tracking-widest text-[#1D9E75]">Student OS for CBSE</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 md:gap-3">
                        <Link to="/login" className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white text-sm font-black transition-colors">
                            Student Login
                        </Link>
                        <Link 
                            to="/parent-portal" 
                            className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-350 hover:bg-slate-50 dark:hover:bg-slate-900 text-sm font-black transition-colors"
                        >
                            <Users size={14} />
                            Parent Portal
                        </Link>
                        <Link to="/onboarding" className="px-5 py-2.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-950 text-sm font-black transition-all hover:scale-[1.02] shadow-md">
                            Get Started
                        </Link>
                    </div>
                </div>
            </header>

            {/* Hero Section */}
            <main className="max-w-7xl mx-auto px-6 pt-10 pb-24 space-y-32">
                {/* Epic Typographic Entrance Section */}
                <section className="flex flex-col items-center justify-center text-center min-h-[75vh] relative overflow-hidden rounded-[40px] bg-slate-900 text-white p-8 md:p-16 shadow-2xl border border-slate-800">
                    {/* Animated grid overlay */}
                    <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-35" />
                    
                    {/* Radial glowing backgrounds */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none animate-pulse" />
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] h-[350px] bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none animate-pulse-glow" />

                    {/* Stage 1: Fast Monospace Word Switcher */}
                    {heroStage === 'intro' && (
                        <div className="relative z-10 flex flex-col items-center justify-center min-h-[220px]">
                            <span className="text-[10px] font-mono uppercase tracking-[0.3em] text-red-500/80 mb-4 animate-pulse">SYSTEM RESET: PREPARATION DRIFT</span>
                            <h2 className="text-4xl md:text-6xl font-mono font-bold tracking-tight text-slate-300 select-none animate-pulse">
                                {introWord}
                            </h2>
                        </div>
                    )}

                    {/* Stage 2 & Beyond: Clarity Entrance */}
                    {heroStage !== 'intro' && (
                        <div className="relative z-10 flex flex-col items-center justify-center space-y-8 max-w-4xl min-h-[220px]">
                            {/* Syllabus Tag */}
                            <div className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-bold uppercase tracking-wider border border-emerald-500/20 transition-all duration-1000 transform ${
                                heroStage !== 'reveal' ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
                            }`}>
                                <Sparkles size={12} className="text-emerald-400 animate-spin-slow" />
                                CBSE Class 9-12 Student OS
                            </div>

                            {/* Main Morphing Title */}
                            <div className="relative">
                                {/* Shockwave ring effect */}
                                {heroStage === 'reveal' && (
                                    <div className="absolute inset-0 -m-8 rounded-full border border-emerald-500/20 animate-ping opacity-75 pointer-events-none" />
                                )}
                                
                                <h1 className="text-7xl md:text-9xl font-black tracking-tight leading-none select-none transition-all duration-1000 transform scale-100" style={{ fontFamily: "'Outfit', sans-serif" }}>
                                    <span className="bg-gradient-to-r from-emerald-400 via-teal-355 to-indigo-450 bg-clip-text text-transparent filter drop-shadow-[0_0_35px_rgba(52,211,153,0.25)]">
                                        Clarity
                                    </span>
                                </h1>
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
                            <div className={`flex flex-wrap gap-4 justify-center pt-4 transition-all duration-1000 transform ${
                                (heroStage === 'cta' || heroStage === 'scroll') 
                                    ? 'opacity-100 translate-y-0' 
                                    : 'opacity-0 translate-y-4'
                            }`}>
                                <Link to="/onboarding" className="px-8 py-4 rounded-2xl bg-[#1D9E75] hover:bg-[#15805d] text-white font-black inline-flex items-center gap-2 transition-all shadow-lg shadow-emerald-500/20 hover:scale-[1.03]">
                                    Build My Study OS
                                    <ArrowRight size={18} />
                                </Link>
                                <Link to="/parent-portal" className="px-8 py-4 rounded-2xl border border-slate-700 bg-slate-900/50 hover:bg-slate-800 text-slate-300 font-black inline-flex items-center gap-2 transition-all hover:scale-[1.03]">
                                    <Users size={18} className="text-emerald-450" />
                                    Open Parent Portal
                                </Link>
                            </div>

                            {/* Scrolling mouse/bounce indicator */}
                            <div className={`pt-12 transition-all duration-1000 ${
                                heroStage === 'scroll' ? 'opacity-100' : 'opacity-0'
                            }`}>
                                <div className="animate-bounce-slow flex flex-col items-center gap-2 text-slate-400 font-bold text-xs uppercase tracking-widest pointer-events-none select-none">
                                    <span>Scroll Down to Explore</span>
                                    <ChevronDown size={20} className="text-emerald-400" />
                                </div>
                            </div>
                        </div>
                    )}
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
                                    title: '🎯 Daily Mission Workspace',
                                    desc: 'Dynamic checklists prioritizing high-ROI board revision and weak topic recover goals.'
                                },
                                {
                                    id: 'tutor',
                                    title: '🤖 AI CBSE Study Coach',
                                    desc: 'Professional chat console resolving textbook questions and surfacing crucial CBSE exam traps.'
                                },
                                {
                                    id: 'simulator',
                                    title: '⏱️ Time Exam Simulator',
                                    desc: 'Board-style exam practice featuring detailed step-marking grading checklists.'
                                },
                                {
                                    id: 'parent',
                                    title: '👨‍👩‍👧 Parent Transparency Portal',
                                    desc: 'Separate dashboard displaying readiness scores, risk assessments, and weekly progress alerts.'
                                }
                            ].map((tab) => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id as any)}
                                    className={`w-full text-left p-6 rounded-[24px] border transition-all flex flex-col gap-1.5 ${
                                        activeTab === tab.id 
                                            ? 'bg-[#1D9E75] text-white border-transparent shadow-lg shadow-emerald-500/10 scale-[1.02]' 
                                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                                    }`}
                                >
                                    <h4 className="font-black text-base">{tab.title}</h4>
                                    <p className={`text-xs font-semibold ${activeTab === tab.id ? 'text-white/80' : 'text-slate-450 dark:text-slate-500'}`}>
                                        {tab.desc}
                                    </p>
                                </button>
                            ))}
                        </div>

                        {/* Interactive Screen Display Column */}
                        <div className="lg:col-span-8 relative flex items-stretch">
                            <div className="absolute -inset-1 rounded-[38px] bg-gradient-to-tr from-[#1D9E75] to-indigo-500 opacity-20 blur-xl pointer-events-none" />
                            <div className="relative w-full rounded-[32px] border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-[#0f172a] shadow-2xl p-8 flex flex-col justify-between overflow-hidden">
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
                                                <div className="p-5 rounded-2xl bg-slate-950 text-white shadow-md">
                                                    <p className="text-[10px] font-black uppercase tracking-widest text-[#1D9E75] mb-3">Today's Daily Mission</p>
                                                    <div className="space-y-2">
                                                        <div className="flex items-center justify-between text-xs p-3 rounded-xl bg-white/5 border border-white/10">
                                                            <span className="flex items-center gap-2"><CheckCircle2 size={14} className="text-emerald-400" /> Solve 5 Wave Optics PYQs</span>
                                                            <span className="text-[9px] uppercase font-black tracking-wider bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded">+15 XP</span>
                                                        </div>
                                                        <div className="flex items-center justify-between text-xs p-3 rounded-xl bg-white/5 border border-white/5">
                                                            <span className="flex items-center gap-2"><div className="w-4 h-4 rounded-full border-2 border-white/20" /> Revise 2 Tricky Biology Traps</span>
                                                            <span className="text-[9px] uppercase font-black tracking-wider bg-white/10 text-white/60 px-1.5 py-0.5 rounded">Pending</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="p-4 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex items-center justify-between shadow-sm">
                                                    <div>
                                                        <p className="text-[9px] font-black uppercase text-slate-400 tracking-wider">CBSE Readiness</p>
                                                        <h4 className="text-2xl font-black text-slate-900 dark:text-white">78%</h4>
                                                    </div>
                                                    <span className="text-xs font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20 px-2 py-0.5 rounded-lg">High prep stability</span>
                                                </div>
                                            </div>
                                            <div className="md:col-span-5 flex flex-col items-center justify-center p-6 bg-slate-50 dark:bg-slate-900/30 rounded-2xl border border-slate-100 dark:border-slate-800">
                                                <Flame className="text-orange-500 w-12 h-12 mb-2 animate-bounce-slow" />
                                                <p className="text-2xl font-black text-slate-900 dark:text-white">6 Days</p>
                                                <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest mt-1">Study Streak</p>
                                            </div>
                                        </div>
                                    )}

                                    {activeTab === 'tutor' && (
                                        <div className="space-y-4">
                                            <div className="flex items-start gap-3">
                                                <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xs font-black">U</div>
                                                <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-2xl rounded-tl-none max-w-[85%]">
                                                    <p className="text-xs font-bold text-slate-850 dark:text-slate-200">Explain the Photoelectric Effect in CBSE board style.</p>
                                                </div>
                                            </div>
                                            <div className="flex items-start gap-3">
                                                <div className="w-8 h-8 rounded-xl bg-[#1D9E75] text-white flex items-center justify-center text-xs"><Brain size={14} /></div>
                                                <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 dark:bg-emerald-950/20 rounded-2xl rounded-tl-none max-w-[85%] space-y-2">
                                                    <p className="text-xs font-bold text-slate-900 dark:text-slate-100">
                                                        It is the emission of electrons when light of threshold frequency shines on a metal surface.
                                                    </p>
                                                    <div className="p-2.5 bg-yellow-300/20 border border-yellow-300/30 rounded-xl text-yellow-800 dark:text-yellow-300 text-[11px] font-bold">
                                                        💡 <strong>CBSE Board Exam Tip:</strong> Always state that emission is instantaneous and kinetic energy depends on frequency, not intensity!
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {activeTab === 'simulator' && (
                                        <div className="space-y-4">
                                            <div className="p-4 bg-slate-950 text-white rounded-2xl flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <Trophy size={16} className="text-yellow-300" />
                                                    <span className="text-xs font-black">Physics Part I Simulator</span>
                                                </div>
                                                <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded font-mono font-black">02:14:55</span>
                                            </div>
                                            <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-3">
                                                <p className="text-xs font-black text-slate-900 dark:text-white">Q1: State Coulomb's law. (2 Marks)</p>
                                                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 rounded-xl text-xs space-y-1.5">
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
                                                <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl flex items-center justify-between shadow-sm">
                                                    <div>
                                                        <p className="text-[9px] font-black uppercase text-slate-400">Weekly Student Score</p>
                                                        <h4 className="text-2xl font-black text-[#1D9E75] mt-0.5">82.5%</h4>
                                                    </div>
                                                    <span className="text-[10px] bg-emerald-50 dark:bg-emerald-950/20 text-[#1D9E75] px-2.5 py-1 rounded-full font-black uppercase tracking-wider">Low Risk</span>
                                                </div>
                                                <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm space-y-2">
                                                    <p className="text-[9px] font-black uppercase text-[#1D9E75] tracking-wider">Recommended actions</p>
                                                    <p className="text-[11px] font-bold text-slate-655 dark:text-slate-300 leading-relaxed">
                                                        🎯 Ensure <strong>Izyaan</strong> completes 1 timed Physics simulator test on Wave Optics this week.
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="md:col-span-5 flex flex-col items-center justify-center p-6 bg-slate-50 dark:bg-slate-900/30 rounded-2xl border border-slate-100 dark:border-slate-800 text-center">
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
                        <p className="text-slate-500 dark:text-slate-400 font-semibold leading-relaxed">
                            No shortcuts. Clarity packages specialized revision and verification engines to keep syllabus tracking concrete.
                        </p>
                    </div>

                    {/* Bento Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                        {/* Box 1: Studio AI (Video Learning Assist) */}
                        <div className="md:col-span-8 rounded-[32px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 p-8 shadow-sm hover:shadow-md transition-all flex flex-col md:flex-row gap-6 items-center">
                            <div className="space-y-4 flex-1">
                                <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shadow-inner">
                                    <Video size={22} />
                                </div>
                                <h3 className="font-black text-2xl text-slate-900 dark:text-white">Studio Video Learning Assist</h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed font-semibold">
                                    Convert curriculum videos into points to remember and active mock quizzes. Tracks trickiest CBSE board exam questions and traps automatically from reference transcripts.
                                </p>
                            </div>
                            <div className="w-full md:w-56 p-4 bg-slate-50 dark:bg-[#0c0e14] rounded-2xl border border-slate-100 dark:border-slate-800 space-y-2 shrink-0">
                                <span className="text-[9px] font-black uppercase text-[#1D9E75] tracking-widest">Tricky Point</span>
                                <p className="text-xs font-bold leading-relaxed text-slate-800 dark:text-slate-200">
                                    Planck's constant remains independent of amplitude. Intensity only scales photon counts!
                                </p>
                            </div>
                        </div>

                        {/* Box 2: Active Recall Board */}
                        <div className="md:col-span-4 rounded-[32px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 p-8 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-6">
                            <div className="space-y-4">
                                <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 text-[#1D9E75] flex items-center justify-center shadow-inner">
                                    <Brain size={22} />
                                </div>
                                <h3 className="font-black text-2xl text-slate-900 dark:text-white">Active Recall Board</h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed font-semibold">
                                    Speak or write down what you remember. The AI voice grading engine benchmarks your recall against exact NCERT concepts and reports progress instantly.
                                </p>
                            </div>
                            <div className="flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 rounded-xl text-emerald-700 dark:text-emerald-350 text-xs font-bold w-fit">
                                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-ping" />
                                Voice Analysis Active
                            </div>
                        </div>

                        {/* Box 3: OCR Note Grading */}
                        <div className="md:col-span-4 rounded-[32px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 p-8 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-6">
                            <div className="space-y-4">
                                <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 flex items-center justify-center shadow-inner">
                                    <FileText size={22} />
                                </div>
                                <h3 className="font-black text-2xl text-slate-900 dark:text-white">OCR Handwritten Grading</h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed font-semibold">
                                    Snap a picture of your handwritten answers or notebooks. Our vision OCR system reads your text, identifies diagrams, and grades it against CBSE step-marking criteria.
                                </p>
                            </div>
                            <span className="text-[10px] uppercase font-black tracking-wider text-slate-400">Class 9-12 Supported</span>
                        </div>

                        {/* Box 4: PDF Proxy & Caching */}
                        <div className="md:col-span-8 rounded-[32px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 p-8 shadow-sm hover:shadow-md transition-all flex flex-col md:flex-row gap-6 items-center">
                            <div className="space-y-4 flex-1">
                                <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-450 flex items-center justify-center shadow-inner">
                                    <BookOpen size={22} />
                                </div>
                                <h3 className="font-black text-2xl text-slate-900 dark:text-white">Incremental PDF Reader</h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed font-semibold">
                                    Bypasses heavy loading times using native streaming. Points directly to our cached proxy so you can read textbooks and custom chapters instantly as you scroll.
                                </p>
                            </div>
                            <div className="p-4 bg-slate-55/50 dark:bg-[#0c0e14] rounded-2xl border border-slate-100 dark:border-slate-800 text-xs font-bold text-[#1D9E75] flex items-center gap-2 shrink-0">
                                <Check size={14} /> Permanent Cache Enabled
                            </div>
                        </div>
                    </div>
                </section>

                {/* Section: Family Hub Showcase */}
                <section className="relative rounded-[36px] overflow-hidden border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 md:p-14 shadow-xl">
                    <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-gradient-to-bl from-teal-500/10 to-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
                    
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center relative z-10">
                        {/* Parent Portal Info */}
                        <div className="lg:col-span-6 space-y-6">
                            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-50 dark:bg-teal-950/20 text-teal-850 dark:text-teal-450 text-xs font-black uppercase tracking-wider border border-teal-200/50">
                                <Users size={12} />
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
                                    <div className="mt-1 bg-teal-100 dark:bg-teal-950 text-teal-800 dark:text-teal-450 p-1.5 rounded-lg"><Mail size={14} /></div>
                                    <div>
                                        <p className="text-sm font-black text-slate-900 dark:text-white">Weekly Progress Report Emails</p>
                                        <p className="text-xs text-slate-500">Automated reports listing asked questions, practice performance, and weak spots.</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <div className="mt-1 bg-teal-100 dark:bg-teal-950 text-teal-800 dark:text-teal-450 p-1.5 rounded-lg"><LineChart size={14} /></div>
                                    <div>
                                        <p className="text-sm font-black text-slate-900 dark:text-white">Live Syllabus Coverage & Readiness Indicators</p>
                                        <p className="text-xs text-slate-500">Track coverage percentage, risk assessment, and active time graphs.</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <div className="mt-1 bg-teal-100 dark:bg-teal-950 text-teal-800 dark:text-teal-450 p-1.5 rounded-lg"><AlertTriangle size={14} /></div>
                                    <div>
                                        <p className="text-sm font-black text-slate-900 dark:text-white">Actionable Intervention Guides</p>
                                        <p className="text-xs text-slate-500">Provides exact steps to support your child (e.g. which chapters need immediate recovery practice).</p>
                                    </div>
                                </div>
                            </div>
                            <div className="pt-2">
                                <Link 
                                    to="/parent-portal" 
                                    className="px-6 py-3.5 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-950 font-black inline-flex items-center gap-2 shadow-lg transition-all hover:scale-[1.02]"
                                >
                                    Open Parent Portal Dashboard
                                    <ArrowRight size={16} />
                                </Link>
                            </div>
                        </div>

                        {/* Right: Parent Portal UI Mockup */}
                        <div className="lg:col-span-6 relative">
                            <div className="relative rounded-3xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 p-6 shadow-md overflow-hidden">
                                <div className="flex items-center justify-between pb-4 border-b border-slate-200/60 dark:border-slate-800/60 mb-5">
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-xl bg-slate-900 dark:bg-slate-800 text-white flex items-center justify-center font-bold text-xs">
                                            P
                                        </div>
                                        <div>
                                            <p className="text-xs font-black text-slate-900 dark:text-white">Clarity Parent Portal</p>
                                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Access Active</p>
                                        </div>
                                    </div>
                                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block animate-pulse" />
                                </div>

                                <div className="space-y-4">
                                    {/* Linked Student Card */}
                                    <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
                                        <div>
                                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Linked Student</p>
                                            <p className="text-sm font-black text-slate-900 dark:text-white">Izyaan Mohammed</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Risk Level</p>
                                            <p className="text-xs font-black text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20 px-2 py-0.5 rounded-lg inline-block">Low Risk</p>
                                        </div>
                                    </div>

                                    {/* Action Plan */}
                                    <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-2.5">
                                        <p className="text-[10px] font-black uppercase text-[#1D9E75] tracking-wider">Recommended Parent Action Plan</p>
                                        <div className="space-y-2 text-xs">
                                            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 flex items-start gap-2">
                                                <span className="text-[#1D9E75] font-black mt-0.5">💡</span>
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
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-450 text-xs font-black uppercase tracking-wider">
                            🚀 Launch Offer Campaign
                        </span>
                        <h2 className="text-4xl font-black tracking-tight text-slate-900 dark:text-white">
                            Unlock full power, 100% free
                        </h2>
                        <p className="text-slate-500 dark:text-slate-400 font-semibold leading-relaxed">
                            For a limited time, all study levels are free to access as part of our launch campaign. Start boosting your prep today.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
                        {tiers.map((tier) => (
                            <div 
                                key={tier.name} 
                                className={`rounded-[30px] p-8 border flex flex-col justify-between transition-all ${
                                    tier.highlight 
                                        ? 'border-[#1D9E75] bg-emerald-50/20 dark:bg-emerald-950/10 shadow-lg ring-2 ring-[#1D9E75]/10 relative' 
                                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:shadow-md'
                                }`}
                            >
                                {tier.highlight && (
                                    <span className="absolute -top-3.5 left-1/2 transform -translate-x-1/2 px-3.5 py-1 rounded-full bg-[#1D9E75] text-white text-[10px] font-black uppercase tracking-widest shadow-md">
                                        Most Popular
                                    </span>
                                )}
                                <div className="space-y-5">
                                    <div>
                                        <span className="px-2.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-650 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                            {tier.badge}
                                        </span>
                                        <h3 className="text-lg font-black text-slate-900 dark:text-white mt-2.5">{tier.name}</h3>
                                    </div>
                                    <div className="flex items-baseline gap-2 pb-4 border-b border-slate-100 dark:border-slate-800">
                                        <span className="text-sm font-bold text-slate-400 line-through">{tier.originalPrice}</span>
                                        <span className="text-4xl font-black text-slate-900 dark:text-white">{tier.promoPrice}</span>
                                        <span className="text-xs font-bold text-slate-500">/mo</span>
                                    </div>
                                    <ul className="space-y-2.5 text-xs font-medium text-slate-650 dark:text-slate-300">
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
                                        className={`inline-flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-xs font-black shadow-md transition-all ${
                                            tier.highlight 
                                                ? 'bg-[#1D9E75] hover:bg-[#15805d] text-white' 
                                                : 'bg-slate-900 dark:bg-white hover:bg-slate-800 dark:hover:bg-slate-100 text-white dark:text-slate-950'
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
                                className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm transition-all"
                            >
                                <button
                                    onClick={() => toggleFaq(index)}
                                    className="w-full flex items-center justify-between p-6 text-left font-black text-sm md:text-base text-slate-900 dark:text-white select-none hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors"
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

                {/* Developer / Stripe readiness notice */}
                <section className="rounded-[28px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-7 shadow-sm">
                    <div className="flex items-start gap-3">
                        <span className="text-[#1D9E75] font-black text-lg">🔧</span>
                        <div>
                            <p className="text-xs font-black uppercase tracking-wider text-slate-400">Campaign / Billing Status</p>
                            <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-semibold">
                                The Stripe/PayPal checkout engine is fully integrated in this workspace. Because the app runs in launch promotion mode, premium subscription barriers are currently bypassed. Students can activate trials and explore full Pro features directly.
                            </p>
                        </div>
                    </div>
                </section>
            </main>
        </div>
    );
};
