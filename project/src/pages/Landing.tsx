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
    ChevronRight, 
    Lock, 
    Mail, 
    Star, 
    Users, 
    Layout, 
    Zap, 
    Check, 
    AlertTriangle, 
    BookOpen, 
    LineChart 
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

export const Landing = () => {
    return (
        <div className="min-h-screen bg-[slate-50] text-slate-900 transition-colors duration-300 font-sans">
            {/* Top Promotion Ribbon */}
            <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600 text-white text-xs md:text-sm font-black py-3 px-4 text-center relative overflow-hidden shadow-md flex items-center justify-center gap-2">
                <span className="inline-flex items-center gap-1 bg-white/20 px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider">
                    <Sparkles size={12} className="animate-spin-slow" /> Promo
                </span>
                <span><strong>Special Launch Campaign:</strong> All Pro and Pro Max plans are currently <strong>100% FREE</strong>! No card required.</span>
                <span className="hidden md:inline-block opacity-75">| Get started instantly.</span>
            </div>

            {/* Global Header */}
            <header className="sticky top-0 z-50 backdrop-blur-md bg-white/85 border-b border-slate-200/80 px-6 py-4 transition-all">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-[#1D9E75] text-white flex items-center justify-center shadow-lg shadow-emerald-500/10">
                            <Brain size={20} />
                        </div>
                        <div>
                            <p className="text-xl font-black tracking-tight">Clarity</p>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-[#1D9E75]">Student OS for CBSE</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 md:gap-3">
                        <Link to="/login" className="px-4 py-2 rounded-xl text-slate-600 hover:text-slate-900 text-sm font-black transition-colors">
                            Student Login
                        </Link>
                        <Link 
                            to="/parent-portal" 
                            className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-350 text-slate-700 hover:bg-slate-50 text-sm font-black transition-colors"
                        >
                            <Users size={15} />
                            Parent Portal Login
                        </Link>
                        <Link to="/onboarding" className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-black transition-all shadow-md">
                            Get Started
                        </Link>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-6 pt-10 pb-24 space-y-24">
                {/* Hero Section */}
                <section className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
                    <div className="lg:col-span-6 space-y-6">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-black uppercase tracking-wider border border-emerald-200">
                            <Star size={12} className="fill-emerald-600" />
                            CBSE Class 9-12 Syllabus Manager
                        </div>
                        <h1 className="text-5xl md:text-6xl font-black tracking-tight leading-none text-slate-900">
                            Stop searching. <br />
                            <span className="bg-gradient-to-r from-[#1D9E75] to-teal-600 bg-clip-text text-transparent">
                                Start finishing
                            </span> <br />
                            your syllabus.
                        </h1>
                        <p className="text-lg text-slate-600 font-medium leading-relaxed max-w-xl">
                            Clarity runs your full study journey: daily missions, weak-chapter recovery, board exam simulations, and readiness tracking that feels like having a personal CBSE mentor.
                        </p>
                        <div className="flex flex-wrap gap-3 pt-2">
                            <Link to="/onboarding" className="px-6 py-4 rounded-2xl bg-[#1D9E75] hover:bg-[#15805d] text-white font-black inline-flex items-center gap-2 transition-all shadow-lg shadow-emerald-500/20">
                                Build My Study OS
                                <ArrowRight size={18} />
                            </Link>
                            <Link to="/parent-portal" className="px-6 py-4 rounded-2xl border border-slate-300 hover:bg-slate-50 text-slate-700 font-black inline-flex items-center gap-2 transition-colors">
                                <Users size={18} className="text-[#1D9E75]" />
                                Open Parent Portal
                            </Link>
                        </div>
                        <div className="flex items-center gap-4 text-xs font-black text-slate-500 pt-4 border-t border-slate-200">
                            <span className="flex items-center gap-1"><Check size={14} className="text-emerald-500" /> No Card Required</span>
                            <span className="flex items-center gap-1"><Check size={14} className="text-emerald-500" /> Complete Setup in 2 Mins</span>
                            <span className="flex items-center gap-1"><Check size={14} className="text-emerald-500" /> Launch Offer Active</span>
                        </div>
                    </div>

                    {/* Right Side: Interactive Student Dashboard Mockup */}
                    <div className="lg:col-span-6 relative">
                        <div className="absolute -inset-1 rounded-[38px] bg-gradient-to-tr from-[#1D9E75] to-indigo-500 opacity-20 blur-xl pointer-events-none" />
                        <div className="relative rounded-[32px] border border-slate-200/80 bg-white shadow-2xl p-6 overflow-hidden">
                            {/* Mock Window Controls */}
                            <div className="flex items-center gap-1.5 mb-6 pb-4 border-b border-slate-100">
                                <span className="w-3 h-3 rounded-full bg-rose-400 inline-block" />
                                <span className="w-3 h-3 rounded-full bg-amber-400 inline-block" />
                                <span className="w-3 h-3 rounded-full bg-emerald-400 inline-block" />
                                <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-3">Clarity Student Workspace</span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                                {/* Sidebar Info */}
                                <div className="space-y-4">
                                    <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                                        <p className="text-[9px] font-black uppercase text-slate-450 tracking-wider">Active Student</p>
                                        <p className="text-sm font-black text-slate-900 mt-0.5">Izyaan Mohammed</p>
                                        <p className="text-[10px] font-semibold text-[#1D9E75] mt-1 bg-emerald-50 inline-block px-2 py-0.5 rounded-md">Class 12 • Physics</p>
                                    </div>
                                    <div className="space-y-1.5">
                                        <div className="flex items-center gap-2 p-2 rounded-xl bg-emerald-50 border border-emerald-100/50 text-[#1D9E75] text-xs font-black">
                                            <Layout size={14} /> Daily Mission
                                        </div>
                                        <div className="flex items-center gap-2 p-2 rounded-xl text-slate-500 hover:bg-slate-50 text-xs font-bold transition-colors">
                                            <Zap size={14} /> Studio AI
                                        </div>
                                        <div className="flex items-center gap-2 p-2 rounded-xl text-slate-500 hover:bg-slate-50 text-xs font-bold transition-colors">
                                            <Trophy size={14} /> Sim Exams
                                        </div>
                                    </div>
                                </div>

                                {/* Main Area content */}
                                <div className="md:col-span-2 space-y-4">
                                    {/* Daily task widgets */}
                                    <div className="p-4 rounded-2xl bg-slate-950 text-white shadow-md">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-[#1D9E75] mb-2.5">Today's Daily Mission</p>
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between text-xs p-2 rounded-xl bg-white/5 border border-white/10">
                                                <span className="flex items-center gap-2"><CheckCircle2 size={13} className="text-emerald-400" /> Solve 5 Wave Optics PYQs</span>
                                                <span className="text-[9px] uppercase font-black tracking-wider bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded">+15 XP</span>
                                            </div>
                                            <div className="flex items-center justify-between text-xs p-2 rounded-xl bg-white/5 border border-white/5">
                                                <span className="flex items-center gap-2"><div className="w-3.5 h-3.5 rounded-full border-2 border-white/20" /> Revise 2 Tricky Biology Traps</span>
                                                <span className="text-[9px] uppercase font-black tracking-wider bg-white/10 text-white/60 px-1.5 py-0.5 rounded">Pending</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Readiness Meter */}
                                    <div className="p-4 rounded-2xl border border-slate-105 bg-white shadow-sm flex items-center justify-between gap-4">
                                        <div>
                                            <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">CBSE Readiness Meter</p>
                                            <h4 className="text-2xl font-black text-slate-900 mt-1">78%</h4>
                                            <p className="text-[10px] font-bold text-slate-500 mt-0.5">High probability of 90+ Board marks</p>
                                        </div>
                                        {/* Simple SVG Circular Progress Bar */}
                                        <div className="relative w-16 h-16">
                                            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                                                <path className="text-slate-100" strokeWidth="3" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                                                <path className="text-[#1D9E75]" strokeDasharray="78, 100" strokeWidth="3" strokeLinecap="round" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                                            </svg>
                                            <div className="absolute inset-0 flex items-center justify-center text-xs font-black text-[#1D9E75]">78%</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Core Features Overview */}
                <section className="space-y-8">
                    <div className="text-center max-w-2xl mx-auto space-y-2">
                        <p className="text-xs font-black uppercase tracking-wider text-[#1D9E75]">Full-Cycle Learning</p>
                        <h2 className="text-3xl md:text-4xl font-black tracking-tight">Engineered for absolute preparation</h2>
                        <p className="text-slate-500 font-medium">Clarity connects diagnostic evaluation, active revisions, simulations, and parent communication in one continuous loop.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="rounded-[28px] bg-white border border-slate-200 p-8 shadow-sm hover:shadow-md transition-all space-y-4">
                            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-[#1D9E75] flex items-center justify-center shadow-inner">
                                <CalendarCheck2 size={22} />
                            </div>
                            <p className="font-black text-xl text-slate-900">Daily Mission Engine</p>
                            <p className="text-sm text-slate-600 leading-relaxed">
                                Every login greets the student with a highly focused, prioritized daily mission. Tasks dynamically generate based on exam proximity and syllabus weak chapters.
                            </p>
                        </div>
                        <div className="rounded-[28px] bg-white border border-slate-200 p-8 shadow-sm hover:shadow-md transition-all space-y-4">
                            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-[#1D9E75] flex items-center justify-center shadow-inner">
                                <Trophy size={22} />
                            </div>
                            <p className="font-black text-xl text-slate-900">Board Exam Simulator</p>
                            <p className="text-sm text-slate-600 leading-relaxed">
                                Simulates timed, authentic CBSE board exams. Features detailed, step-marking feedback so students know exactly which step lost marks and how to salvage them.
                            </p>
                        </div>
                        <div className="rounded-[28px] bg-white border border-slate-200 p-8 shadow-sm hover:shadow-md transition-all space-y-4">
                            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-[#1D9E75] flex items-center justify-center shadow-inner">
                                <ShieldCheck size={22} />
                            </div>
                            <p className="font-black text-xl text-slate-900">Parent Transparency Hub</p>
                            <p className="text-sm text-slate-600 leading-relaxed">
                                Generates a separate dashboard and emails automated weekly progress summaries to parents. Offers indicators of syllabus coverage, active study time, and risk points.
                            </p>
                        </div>
                    </div>
                </section>

                {/* VISUAL HIGHLIGHT: DEDICATED PARENT PORTAL HUB */}
                <section className="relative rounded-[36px] overflow-hidden border border-slate-200 bg-white p-8 md:p-14 shadow-xl">
                    <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-gradient-to-bl from-teal-500/10 to-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
                    
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center relative z-10">
                        {/* Parent Portal Info */}
                        <div className="lg:col-span-6 space-y-6">
                            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-50 text-teal-800 text-xs font-black uppercase tracking-wider border border-teal-200">
                                <Users size={12} />
                                Dedicated Family Hub
                            </div>
                            <h2 className="text-3xl md:text-4xl font-black tracking-tight text-slate-900 leading-tight">
                                Separate Parent Portal for report tracking & readiness
                            </h2>
                            <p className="text-slate-600 leading-relaxed font-medium">
                                Family transparency stays distinct. Clarity separates parent tracking from the student study interface, allowing parents to log in independently with distinct secure credentials.
                            </p>
                            <div className="space-y-3">
                                <div className="flex items-start gap-3">
                                    <div className="mt-1 bg-teal-100 text-teal-800 p-1 rounded-lg"><Mail size={14} /></div>
                                    <div>
                                        <p className="text-sm font-black text-slate-900">Weekly Progress Report Emails</p>
                                        <p className="text-xs text-slate-500">Automated reports listing asked questions, practice performance, and weak spots.</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <div className="mt-1 bg-teal-100 text-teal-800 p-1 rounded-lg"><LineChart size={14} /></div>
                                    <div>
                                        <p className="text-sm font-black text-slate-900">Live Syllabus Coverage & Readiness Indicators</p>
                                        <p className="text-xs text-slate-500">Track coverage percentage, risk assessment, and active time graphs.</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <div className="mt-1 bg-teal-100 text-teal-800 p-1 rounded-lg"><AlertTriangle size={14} /></div>
                                    <div>
                                        <p className="text-sm font-black text-slate-900">Actionable Intervention Guides</p>
                                        <p className="text-xs text-slate-500">Provides exact steps to support your child (e.g. which chapters need immediate recovery practice).</p>
                                    </div>
                                </div>
                            </div>
                            <div className="pt-2">
                                <Link 
                                    to="/parent-portal" 
                                    className="px-6 py-3.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-black inline-flex items-center gap-2 shadow-lg transition-all"
                                >
                                    Open Parent Portal Dashboard
                                    <ArrowRight size={16} />
                                </Link>
                            </div>
                        </div>

                        {/* Right: Parent Portal UI Mockup */}
                        <div className="lg:col-span-6 relative">
                            <div className="relative rounded-3xl border border-slate-200 bg-slate-50/50 p-6 shadow-md overflow-hidden">
                                <div className="flex items-center justify-between pb-4 border-b border-slate-200/60 mb-5">
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold text-xs">
                                            P
                                        </div>
                                        <div>
                                            <p className="text-xs font-black text-slate-900">Clarity Parent Portal</p>
                                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Access Active</p>
                                        </div>
                                    </div>
                                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block animate-pulse" />
                                </div>

                                <div className="space-y-4">
                                    {/* Linked Student Card */}
                                    <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-between">
                                        <div>
                                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Linked Student</p>
                                            <p className="text-sm font-black text-slate-900">Izyaan Mohammed</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Risk Level</p>
                                            <p className="text-xs font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-lg inline-block">Low Risk</p>
                                        </div>
                                    </div>

                                    {/* Action Plan */}
                                    <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-2.5">
                                        <p className="text-[10px] font-black uppercase text-[#1D9E75] tracking-wider">Recommended Parent Action Plan</p>
                                        <div className="space-y-2 text-xs">
                                            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-start gap-2">
                                                <span className="text-[#1D9E75] font-black mt-0.5">💡</span>
                                                <span className="text-slate-700 font-semibold leading-relaxed">
                                                    Ensure <strong>Izyaan</strong> completes 1 timed Physics simulator test for <strong>Wave Optics</strong> this week.
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Quick Summary Widgets */}
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="p-3 rounded-2xl bg-white border border-slate-200 text-center">
                                            <p className="text-[9px] font-bold text-slate-400 uppercase">Coverage</p>
                                            <p className="text-lg font-black text-slate-900 mt-0.5">84%</p>
                                        </div>
                                        <div className="p-3 rounded-2xl bg-white border border-slate-200 text-center">
                                            <p className="text-[9px] font-bold text-slate-400 uppercase">Weekly Score</p>
                                            <p className="text-lg font-black text-[#1D9E75] mt-0.5">82.5%</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* PRICING SECTION - ALL FREE PROMO */}
                <section id="pricing" className="space-y-6">
                    <div className="text-center max-w-2xl mx-auto space-y-2">
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-black uppercase tracking-wider">
                            🚀 Launch Offer Campaign
                        </span>
                        <h2 className="text-3xl md:text-4xl font-black tracking-tight text-slate-900">
                            Unlock full power, 100% free
                        </h2>
                        <p className="text-slate-500 font-medium leading-relaxed">
                            For a limited time, all study levels are free to access as part of our launch campaign. Start boosting your prep today.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
                        {tiers.map((tier) => (
                            <div 
                                key={tier.name} 
                                className={`rounded-[30px] p-8 border flex flex-col justify-between transition-all ${
                                    tier.highlight 
                                        ? 'border-[#1D9E75] bg-emerald-50/30 shadow-lg ring-2 ring-[#1D9E75]/10 relative' 
                                        : 'border-slate-200 bg-white hover:shadow-md'
                                }`}
                            >
                                {tier.highlight && (
                                    <span className="absolute -top-3.5 left-1/2 transform -translate-x-1/2 px-3.5 py-1 rounded-full bg-[#1D9E75] text-white text-[10px] font-black uppercase tracking-widest shadow-md">
                                        Most Popular
                                    </span>
                                )}
                                <div className="space-y-5">
                                    <div>
                                        <span className="px-2.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-slate-100 text-slate-600 border border-slate-200">
                                            {tier.badge}
                                        </span>
                                        <h3 className="text-lg font-black text-slate-900 mt-2.5">{tier.name}</h3>
                                    </div>
                                    <div className="flex items-baseline gap-2 pb-4 border-b border-slate-100">
                                        <span className="text-sm font-bold text-slate-400 line-through">{tier.originalPrice}</span>
                                        <span className="text-4xl font-black text-slate-900">{tier.promoPrice}</span>
                                        <span className="text-xs font-bold text-slate-500">/mo</span>
                                    </div>
                                    <ul className="space-y-2.5 text-xs font-medium text-slate-600">
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
                                                : 'bg-slate-900 hover:bg-slate-800 text-white'
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

                {/* Developer / Stripe readiness notice */}
                <section className="rounded-[28px] border border-slate-200 bg-white p-7 shadow-sm">
                    <div className="flex items-start gap-3">
                        <span className="text-[#1D9E75] font-black text-lg">🔧</span>
                        <div>
                            <p className="text-xs font-black uppercase tracking-wider text-slate-400">Campaign / Billing Status</p>
                            <p className="mt-1.5 text-xs text-slate-600 leading-relaxed font-semibold">
                                The Stripe/PayPal checkout engine is fully integrated in this workspace. Because the app runs in launch promotion mode, premium subscription barriers are currently bypassed. Students can activate trials and explore full Pro features directly.
                            </p>
                        </div>
                    </div>
                </section>
            </main>
        </div>
    );
};
