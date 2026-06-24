import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { 
    ArrowRight, 
    Brain, 
    Rocket, 
    Trophy, 
    CheckCircle2, 
    ChevronDown, 
    Mail, 
    Users, 
    Check, 
    AlertTriangle, 
    BookOpen, 
    LineChart,
    Video,
    FileText,
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
    // Intro & Reveal stage states
    const [introPhase, setIntroPhase] = useState<'loading' | 'text' | 'line' | 'wipe' | 'reveal' | 'finished'>('loading');
    const [lettersVisible, setLettersVisible] = useState(false);
    const [hoveredLetterIdx, setHoveredLetterIdx] = useState<number | null>(null);
    const [focusRingSize, setFocusRingSize] = useState({ width: 0, height: 0 });
    const [tilt, setTilt] = useState({ x: 0, y: 0 });
    const [ripples, setRipples] = useState<{ id: number; x: number; y: number }[]>([]);

    // Interactive mockup states
    const [activeTab, setActiveTab] = useState<'workspace' | 'tutor' | 'simulator' | 'parent'>('workspace');
    const [openFaqIdx, setOpenFaqIdx] = useState<number | null>(null);

    // Interactive chat simulator states
    const [terminalPrompt, setTerminalPrompt] = useState<string>('');
    const [terminalOutput, setTerminalOutput] = useState<string>('');
    const [isTyping, setIsTyping] = useState<boolean>(false);
    const [visibleLinesCount, setVisibleLinesCount] = useState<number>(0);
    const [activePrompt, setActivePrompt] = useState<string | null>(null);

    // Scroll dilemma words switcher states
    const [isProblemVisible, setIsProblemVisible] = useState(false);
    const [problemWordIdx, setProblemWordIdx] = useState(0);
    const problemWords = ['CONFUSION', 'CHAOS', 'OVERWHELM', 'BOARD STRESS'];
    
    // Refs
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const wordElRef = useRef<HTMLDivElement>(null);
    const cursorRef = useRef<HTMLDivElement>(null);
    const cursorRingRef = useRef<HTMLDivElement>(null);
    const problemSectionRef = useRef<HTMLDivElement>(null);
    const stageRef = useRef<HTMLDivElement>(null);
    const isHoveredWordRef = useRef(false);

    const setIsHoveredWord = (hovered: boolean) => {
        isHoveredWordRef.current = hovered;
    };

    // Load fonts and style overrides
    useEffect(() => {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://fonts.googleapis.com/css2?family=Syne:wght@800&family=Inter:ital,wght@0,300;0,400;0,500;0,650;0,700;1,300&display=swap';
        document.head.appendChild(link);
        return () => {
            document.head.removeChild(link);
        };
    }, []);

    // Intro Phase sequence timer triggers
    useEffect(() => {
        const t1 = setTimeout(() => setIntroPhase('text'), 200);
        const t2 = setTimeout(() => setIntroPhase('line'), 600);
        const t3 = setTimeout(() => setIntroPhase('wipe'), 1100);
        const t4 = setTimeout(() => setIntroPhase('reveal'), 2050);
        const t5 = setTimeout(() => {
            setIntroPhase('finished');
            setLettersVisible(true);
        }, 2250);

        return () => {
            clearTimeout(t1);
            clearTimeout(t2);
            clearTimeout(t3);
            clearTimeout(t4);
            clearTimeout(t5);
        };
    }, []);

    // Canvas Vignette & Paper Grain drawing
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let W = window.innerWidth;
        let H = window.innerHeight;
        canvas.width = W;
        canvas.height = H;

        const drawPaper = () => {
            // Base warm paper canvas color
            ctx.fillStyle = '#f7f5f0';
            ctx.fillRect(0, 0, W, H);

            // Vintage radial vignette
            const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.15, W / 2, H / 2, H * 0.75);
            vg.addColorStop(0, 'rgba(247, 245, 240, 0)');
            vg.addColorStop(1, 'rgba(210, 205, 195, 0.28)');
            ctx.fillStyle = vg;
            ctx.fillRect(0, 0, W, H);

            // Granular paper specks
            for (let i = 0; i < 8000; i++) {
                const x = Math.random() * W;
                const y = Math.random() * H;
                const a = Math.random() * 0.04;
                ctx.fillStyle = `rgba(90, 80, 60, ${a})`;
                ctx.fillRect(x, y, 1, 1);
            }
        };

        drawPaper();

        const handleResize = () => {
            W = window.innerWidth;
            H = window.innerHeight;
            canvas.width = W;
            canvas.height = H;
            drawPaper();
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Floating particles generator
    useEffect(() => {
        if (introPhase !== 'finished') return;
        const symbols = ['✦', '·', '∘', '—', '≡', '⌁', '◦'];
        const container = stageRef.current;
        if (!container) return;

        const interval = setInterval(() => {
            const p = document.createElement('div');
            p.className = 'particle';
            p.textContent = symbols[Math.floor(Math.random() * symbols.length)];
            p.style.left = Math.random() * 100 + 'vw';
            p.style.bottom = '0';
            p.style.color = `rgba(26, 26, 46, ${Math.random() * 0.12 + 0.04})`;
            p.style.fontSize = (Math.random() * 10 + 8) + 'px';
            const dur = (Math.random() * 8 + 6).toFixed(1) + 's';
            const delay = (Math.random() * 4).toFixed(1) + 's';
            p.style.animationDuration = dur;
            p.style.animationDelay = delay;
            container.appendChild(p);

            setTimeout(() => {
                p.remove();
            }, (parseFloat(dur) + parseFloat(delay)) * 1000 + 200);
        }, 600);

        return () => clearInterval(interval);
    }, [introPhase]);

    // Focus ring size layout recalculation
    useEffect(() => {
        if (introPhase === 'finished') {
            const t = setTimeout(() => {
                if (wordElRef.current) {
                    const rect = wordElRef.current.getBoundingClientRect();
                    setFocusRingSize({
                        width: rect.width + 48,
                        height: rect.height + 28
                    });
                }
            }, 800);
            return () => clearTimeout(t);
        }
    }, [introPhase]);

    // Custom lag-ring cursor mouse follow
    useEffect(() => {
        let curX = window.innerWidth / 2;
        let curY = window.innerHeight / 2;
        let c2x = window.innerWidth / 2;
        let c2y = window.innerHeight / 2;

        const handleMouseMove = (e: MouseEvent) => {
            curX = e.clientX;
            curY = e.clientY;
        };

        window.addEventListener('mousemove', handleMouseMove);

        let active = true;
        const tick = () => {
            if (!active) return;
            c2x += (curX - c2x) * 0.1;
            c2y += (curY - c2y) * 0.1;

            const curEl = cursorRef.current;
            const curRing = cursorRingRef.current;
            if (curEl) {
                curEl.style.left = `${curX}px`;
                curEl.style.top = `${curY}px`;
            }
            if (curRing) {
                const size = isHoveredWordRef.current ? 44 : 28;
                curRing.style.width = `${size}px`;
                curRing.style.height = `${size}px`;
                curRing.style.left = `${c2x - curX - (size / 2)}px`;
                curRing.style.top = `${c2y - curY - (size / 2)}px`;
                curRing.style.borderColor = isHoveredWordRef.current ? 'rgba(26, 26, 46, 0.55)' : 'rgba(26, 26, 46, 0.35)';
            }
            requestAnimationFrame(tick);
        };
        tick();

        return () => {
            active = false;
            window.removeEventListener('mousemove', handleMouseMove);
        };
    }, []);

    // 3D Tilting computation
    useEffect(() => {
        if (introPhase !== 'finished') return;

        let mx = 0;
        let my = 0;
        let lx = 0;
        let ly = 0;

        const handleMouseMove = (e: MouseEvent) => {
            mx = (e.clientX / window.innerWidth - 0.5) * 2;
            my = (e.clientY / window.innerHeight - 0.5) * 2;
        };

        window.addEventListener('mousemove', handleMouseMove);

        let active = true;
        const tick = () => {
            if (!active) return;
            lx += (mx - lx) * 0.04;
            ly += (my - ly) * 0.04;

            setTilt({
                x: -ly * 5,
                y: lx * 7
            });

            requestAnimationFrame(tick);
        };
        tick();

        return () => {
            active = false;
            window.removeEventListener('mousemove', handleMouseMove);
        };
    }, [introPhase]);

    // Dynamic typewriter simulation console
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

    // Auto-play the first simulation after entrance
    useEffect(() => {
        if (introPhase === 'finished') {
            const timer = setTimeout(() => {
                simulateTerminal('wave-optics');
            }, 1200);
            return () => clearTimeout(timer);
        }
    }, [introPhase]);

    // Dilemma Switcher scroll observer
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

    // Switch words interval timer
    useEffect(() => {
        if (!isProblemVisible) return;
        const interval = setInterval(() => {
            setProblemWordIdx((prev) => (prev + 1) % problemWords.length);
        }, 1200);
        return () => clearInterval(interval);
    }, [isProblemVisible]);

    // Ink Ripple spawn trigger
    const handleStageClick = (e: React.MouseEvent) => {
        // Exclude inputs, buttons and links to prevent interface disruption
        const target = e.target as HTMLElement;
        if (target.closest('button') || target.closest('a') || target.closest('input')) return;

        const newRipple = {
            id: Date.now() + Math.random(),
            x: e.clientX,
            y: e.clientY
        };
        setRipples(prev => [...prev, newRipple]);
        setTimeout(() => {
            setRipples(prev => prev.filter(r => r.id !== newRipple.id));
        }, 850);
    };

    const toggleFaq = (index: number) => {
        setOpenFaqIdx((prev) => (prev === index ? null : index));
    };

    return (
        <div 
            onClick={handleStageClick}
            className={`min-h-screen text-[#1a1a2e] transition-all selection:bg-[#1a1a2e]/10 selection:text-[#1a1a2e] overflow-x-hidden ${
                introPhase !== 'finished' ? 'h-screen overflow-hidden' : 'relative'
            }`}
            style={{ backgroundColor: '#f7f5f0' }}
        >
            <style>{`
                /* Hide standard pointer on desktop */
                @media (min-width: 768px) {
                    html, body, a, button, [role="button"], select, input {
                        cursor: none !important;
                    }
                }

                #cur {
                    position: fixed;
                    z-index: 9999;
                    pointer-events: none;
                    transform: translate(-50%, -50%);
                }
                #cur-dot {
                    width: 6px;
                    height: 6px;
                    border-radius: 50%;
                    background: #1a1a2e;
                    position: absolute;
                    transform: translate(-50%, -50%);
                }
                #cur-ring {
                    border-radius: 50%;
                    border: 1.5px solid rgba(26, 26, 46, 0.35);
                    position: absolute;
                    transform: translate(-50%, -50%);
                    transition: width .2s, height .2s, border-color .2s;
                }

                .particle {
                    position: absolute;
                    pointer-events: none;
                    z-index: 11;
                    opacity: 0;
                    animation: floatParticle linear infinite;
                }
                @keyframes floatParticle {
                    0% { transform: translateY(0) rotate(0deg); opacity: 0; }
                    10% { opacity: 1; }
                    90% { opacity: .6; }
                    100% { transform: translateY(-160px) rotate(20deg); opacity: 0; }
                }

                .ruled {
                    position: absolute;
                    z-index: 1;
                    background: rgba(26, 26, 46, 0.03);
                    pointer-events: none;
                }
                .ruled.h { left: 0; right: 0; height: 1px; }
                .ruled.v { top: 0; bottom: 0; width: 1px; }

                #flare {
                    position: absolute;
                    z-index: 13;
                    top: 50%; left: 50%;
                    width: 3px; height: 3px;
                    border-radius: 50%;
                    background: #fff;
                    box-shadow: 0 0 0 0 rgba(255,255,255,0);
                    transform: translate(-50%,-50%);
                    pointer-events: none; opacity: 0;
                }
                .active-flare {
                    animation: flareOutAnim .7s ease forwards;
                }
                @keyframes flareOutAnim {
                    0% { opacity: 1; box-shadow: 0 0 60px 60px rgba(255,255,255,0.8); }
                    100% { opacity: 0; box-shadow: 0 0 200px 180px rgba(255,255,255,0); }
                }

                .ink-ripple {
                    position: fixed;
                    z-index: 999;
                    pointer-events: none;
                    border-radius: 50%;
                    border: 1.5px solid rgba(26, 26, 46, 0.25);
                    width: 0; height: 0;
                    transform: translate(-50%, -50%);
                    animation: rippleAnim 0.8s cubic-bezier(0.1, 0.8, 0.3, 1) forwards;
                }
                @keyframes rippleAnim {
                    0% { width: 0; height: 0; opacity: 1; }
                    100% { width: 450px; height: 450px; opacity: 0; }
                }

                /* Stationary custom components style */
                .ruled-paper-bg {
                    background-image: linear-gradient(rgba(26, 26, 46, 0.035) 1px, transparent 1px);
                    background-size: 100% 32px;
                }

                .flat-card {
                    background: #ffffff;
                    border: 1.5px solid #1a1a2e;
                    box-shadow: 4px 4px 0px #1a1a2e;
                    border-radius: 1.25rem;
                    transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.2s cubic-bezier(0.16, 1, 0.3, 1);
                }
                .flat-card:hover {
                    transform: translate(-2px, -2px);
                    box-shadow: 6px 6px 0px #1a1a2e;
                }

                .flat-btn-ink {
                    background: #1a1a2e;
                    color: #f7f5f0;
                    border: 1.5px solid #1a1a2e;
                    border-radius: 0.75rem;
                    box-shadow: 3px 3px 0px rgba(26, 26, 46, 0.35);
                    font-weight: 800;
                    transition: all 0.15s ease;
                }
                .flat-btn-ink:hover {
                    background: rgba(26, 26, 46, 0.9);
                    transform: translate(1px, 1px);
                    box-shadow: 1.5px 1.5px 0px rgba(26, 26, 46, 0.35);
                }

                .flat-btn-outline {
                    background: transparent;
                    color: #1a1a2e;
                    border: 1.5px solid rgba(26, 26, 46, 0.35);
                    border-radius: 0.75rem;
                    font-weight: 800;
                    transition: all 0.15s ease;
                }
                .flat-btn-outline:hover {
                    background: rgba(26, 26, 46, 0.05);
                    border-color: #1a1a2e;
                }
            `}</style>

            {/* Pointer Custom Cursor */}
            <div id="cur" ref={cursorRef} className="hidden md:block">
                <div id="cur-dot" />
                <div id="cur-ring" ref={cursorRingRef} />
            </div>

            {/* Click Ripples layer */}
            {ripples.map(r => (
                <div key={r.id} className="ink-ripple" style={{ left: `${r.x}px`, top: `${r.y}px` }} />
            ))}

            {/* Background textured canvas */}
            <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none z-0" />

            {/* Cinematic loading intro */}
            {introPhase !== 'finished' && (
                <div 
                    id="intro"
                    style={{
                        position: 'fixed', inset: 0, zIndex: 200,
                        background: '#f7f5f0',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexDirection: 'column',
                    }}
                >
                    <div 
                        id="ink"
                        style={{
                            width: introPhase === 'wipe' || introPhase === 'reveal' ? '250vmax' : '0vmax',
                            height: introPhase === 'wipe' || introPhase === 'reveal' ? '250vmax' : '0vmax',
                            borderRadius: '50%',
                            background: '#1a1a2e',
                            position: 'absolute',
                            left: '50%', top: '50%',
                            transform: 'translate(-50%, -50%)',
                            transition: 'width .9s cubic-bezier(.7,0,.3,1), height .9s cubic-bezier(.7,0,.3,1)',
                        }}
                    />
                    <div 
                        id="intro-text"
                        style={{
                            fontFamily: "'Syne', sans-serif",
                            fontWeight: 800,
                            fontSize: '13px',
                            letterSpacing: '10px',
                            textTransform: 'uppercase',
                            color: '#1a1a2e',
                            opacity: introPhase === 'text' || introPhase === 'line' ? 1 : 0,
                            position: 'relative',
                            zIndex: 2,
                            transition: 'opacity .8s ease',
                        }}
                    >
                        Clarity
                    </div>
                    <div 
                        id="intro-line"
                        style={{
                            width: introPhase === 'line' ? '120px' : '0px',
                            height: '1px',
                            background: '#1a1a2e',
                            opacity: introPhase === 'line' ? 0.15 : 0,
                            position: 'relative',
                            zIndex: 2,
                            marginTop: '20px',
                            transition: 'width 1.2s ease, opacity 0.5s ease',
                        }}
                    />
                </div>
            )}

            {/* Notebook margins and vertical layout wrapper */}
            <div 
                id="stage" 
                ref={stageRef}
                className="relative min-h-screen z-10 w-full flex flex-col transition-opacity duration-1000"
                style={{ opacity: introPhase === 'reveal' || introPhase === 'finished' ? 1 : 0 }}
            >
                {/* Background Ruled Lines */}
                <div className="ruled h" style={{ top: '25%' }} />
                <div className="ruled h" style={{ top: '37.5%' }} />
                <div className="ruled h" style={{ top: '62.5%' }} />
                <div className="ruled h" style={{ top: '75%' }} />
                <div className="ruled v" style={{ left: '6%' }} />

                {/* Full-screen Hero Header */}
                <section className="min-h-screen w-full relative flex items-center justify-center flex-col select-none overflow-hidden">
                    {/* Stationery Border Background */}
                    <div className="absolute inset-0 z-0 pointer-events-none opacity-80">
                        <img 
                            src="/stationary_bg.png" 
                            alt="Stationery background" 
                            className="w-full h-full object-cover md:object-fill opacity-90"
                        />
                    </div>
                    
                    <div className="relative text-center">
                        <div 
                            ref={wordElRef}
                            id="clarity"
                            className="select-none flex justify-center items-center gap-1 cursor-none"
                            style={{
                                position: 'relative',
                                zIndex: 50,
                                fontFamily: "'Syne', sans-serif",
                                fontSize: 'clamp(50px, 14vw, 200px)',
                                fontWeight: 900,
                                letterSpacing: '-0.035em',
                                transform: `rotateY(${tilt.y}deg) rotateX(${tilt.x}deg)`,
                                transformStyle: 'preserve-3d',
                            }}
                        >
                            {Array.from("Clarity").map((char, i) => {
                                const isHovered = hoveredLetterIdx === i;
                                return (
                                    <span 
                                        key={i} 
                                        className="L"
                                        onMouseEnter={() => {
                                            setHoveredLetterIdx(i);
                                            setIsHoveredWord(true);
                                        }}
                                        onMouseLeave={() => {
                                            setHoveredLetterIdx(null);
                                            setIsHoveredWord(false);
                                        }}
                                        style={{
                                            display: 'inline-block',
                                            position: 'relative',
                                            opacity: lettersVisible ? 1 : 0,
                                            filter: lettersVisible ? 'blur(0px)' : 'blur(8px)',
                                            transform: isHovered 
                                                ? 'translateZ(30px) scale(1.07)' 
                                                : (lettersVisible ? 'translateZ(0px) scale(1)' : 'translateZ(0px) scale(1.08)'),
                                            transition: isHovered 
                                                ? 'transform 0.15s ease' 
                                                : (lettersVisible 
                                                    ? `opacity 0.8s cubic-bezier(.16,1,.3,1) ${i * 90}ms, filter 0.9s cubic-bezier(.16,1,.3,1) ${i * 90}ms, transform 0.5s cubic-bezier(.16,1,.3,1)`
                                                    : 'none'),
                                            transformStyle: 'preserve-3d',
                                            backgroundImage: 'linear-gradient(110deg, #0a0a0a 40%, #3a3a3a 50%, #0a0a0a 60%)',
                                            backgroundSize: '200% auto',
                                            color: 'transparent',
                                            WebkitBackgroundClip: 'text',
                                            backgroundClip: 'text',
                                            animation: `gradientShift 6s linear infinite ${i * 0.2}s`,
                                        }}
                                    >
                                        {char}
                                    </span>
                                );
                            })}
                        </div>
                        <div id="flare" className={introPhase === 'reveal' || introPhase === 'finished' ? 'active-flare' : ''} />
                    </div>

                    <div 
                        id="sub"
                        style={{
                            position: 'absolute',
                            top: 'calc(50% + clamp(50px,7vw,100px))',
                            left: '50%', transform: 'translateX(-50%)',
                            textAlign: 'center',
                            opacity: lettersVisible ? 1 : 0,
                            width: 'min(520px, 90vw)',
                            zIndex: 12,
                            transition: 'opacity 1s ease',
                            transitionDelay: '400ms',
                        }}
                    >
                        <p style={{ fontSize: '15px', fontWeight: 300, color: 'rgba(26,26,46,0.48)', letterSpacing: '0.06em', lineHeight: 1.9 }}>
                            The AI tutor that brings<br/>
                            <em style={{ fontStyle: 'italic', color: 'rgba(26,26,46,0.7)' }}>absolute clarity</em> to every subject.
                        </p>
                        <div id="sub-line" style={{ width: '40px', height: '1px', background: '#1a1a2e', opacity: 0.15, margin: '16px auto 0' }} />
                        <div className="mt-8 animate-bounce flex flex-col items-center justify-center gap-1 text-[9px] uppercase tracking-widest text-[#1a1a2e]/40">
                            <span>Scroll down to study</span>
                            <ChevronDown size={14} />
                        </div>
                    </div>
                </section>

                {/* Sub-Header bar revealed post-intro */}
                <header 
                    className="sticky top-0 z-50 border-b border-[#1a1a2e]/10 px-6 py-4 transition-all"
                    style={{ backgroundColor: 'rgba(247, 245, 240, 0.95)', backdropFilter: 'blur(8px)' }}
                >
                    <div className="max-w-7xl mx-auto flex items-center justify-between font-medium">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 flex items-center justify-center border-1.5 border-[#1a1a2e] rounded-xl bg-[#FCFAF8] ">
                                <img src="/mind_pen_logo.png" alt="Clarity Logo" className="w-8 h-8 object-contain" />
                            </div>
                            <div>
                                <p className="text-lg font-black tracking-tight" style={{ fontFamily: "'Syne', sans-serif" }}>Clarity</p>
                                <p className="text-[9px] font-bold uppercase tracking-widest text-[#1a1a2e]/60">Student OS for CBSE</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 md:gap-3">
                            <Link 
                                to="/login" 
                                className="px-4 py-2 text-[#1a1a2e]/70 hover:text-[#1a1a2e] text-sm font-black transition-colors"
                                onMouseEnter={() => setIsHoveredWord(true)}
                                onMouseLeave={() => setIsHoveredWord(false)}
                            >
                                Student Login
                            </Link>
                            <Link 
                                to="/parent-portal" 
                                className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2 border border-[#1a1a2e]/20 text-[#1a1a2e]/80 hover:bg-[#1a1a2e]/5 text-sm font-black rounded-lg transition-colors"
                                onMouseEnter={() => setIsHoveredWord(true)}
                                onMouseLeave={() => setIsHoveredWord(false)}
                            >
                                <Users size={14} />
                                Parent Portal
                            </Link>
                            <Link 
                                to="/onboarding" 
                                className="px-5 py-2.5 bg-[#1a1a2e] text-[#f7f5f0] text-sm font-black rounded-lg hover:bg-[#1a1a2e]/90 "
                                onMouseEnter={() => setIsHoveredWord(true)}
                                onMouseLeave={() => setIsHoveredWord(false)}
                            >
                                Get Started
                            </Link>
                        </div>
                    </div>
                </header>

                {/* Top Promotion ribbon */}
                <div className="bg-[#1a1a2e] text-[#f7f5f0] text-xs md:text-sm font-bold py-3.5 px-4 text-center relative overflow-hidden shadow-inner flex items-center justify-center gap-2 z-20">
                    <span><strong>Launch Special Campaign:</strong> All Pro and Pro Max plans are currently <strong>100% FREE</strong>! No card needed.</span>
                </div>

                {/* Main page content layout sheets */}
                <main className="max-w-7xl mx-auto px-6 py-20 space-y-32 z-10 w-full relative">
                    {/* Section: CTAs & Mockup Workspace demo */}
                    <section className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center w-full relative pl-[clamp(24px, 7vw, 90px)]">
                        <div className="lg:col-span-7 flex flex-col items-center lg:items-start text-center lg:text-left space-y-6">
                            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-[#1a1a2e]/5 text-[#1a1a2e] text-xs font-black uppercase tracking-wider border border-[#1a1a2e]/15 rounded-full">
                                CBSE Class 9-12 Student OS
                            </div>

                            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight leading-tight" style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800 }}>
                                The only AI that studies NCERT with you — not instead of you.
                            </h2>

                            <p className="text-sm md:text-base text-[#1a1a2e]/70 font-semibold leading-relaxed max-w-xl">
                                Clear concepts, focused daily missions, active recall voice recovery, and timed board exam simulators. Designed to guarantee your best CBSE syllabus prep in one beautiful system.
                            </p>

                            <div className="flex flex-wrap gap-4 justify-center lg:justify-start pt-2">
                                <Link 
                                    to="/onboarding" 
                                    className="px-6 py-3 bg-[#1a1a2e] text-[#f7f5f0] font-black inline-flex items-center gap-2 rounded-xl border border-[#1a1a2e]  hover:transtone-x-[2px] hover:transtone-y-[2px] hover: transition-all"
                                    onMouseEnter={() => setIsHoveredWord(true)}
                                    onMouseLeave={() => setIsHoveredWord(false)}
                                >
                                    Build My Study OS
                                    <ArrowRight size={16} />
                                </Link>
                                <Link 
                                    to="/parent-portal" 
                                    className="px-6 py-3 border border-[#1a1a2e]/30 hover:bg-[#1a1a2e]/5 text-[#1a1a2e] font-black inline-flex items-center gap-2 rounded-xl transition-all"
                                    onMouseEnter={() => setIsHoveredWord(true)}
                                    onMouseLeave={() => setIsHoveredWord(false)}
                                >
                                    <Users size={16} />
                                    Open Parent Portal
                                </Link>
                            </div>
                        </div>

                        {/* Top Right: Simulated workspace widget */}
                        <div className="lg:col-span-5 w-full flex flex-col justify-center">
                            <div className="w-full bg-[#FCFAF8] border-1.5 border-[#1a1a2e] rounded-3xl  overflow-hidden flex flex-col">
                                {/* Snippet Header */}
                                <div className="bg-[#fcfbf9] px-4 py-3 flex items-center justify-between border-b border-[#1a1a2e]/10">
                                    <div className="flex items-center gap-1.5">
                                        <span className="w-2.5 h-2.5 rounded-full bg-[#1a1a2e] inline-block" />
                                        <span className="text-[10px] font-black text-[#1a1a2e] uppercase tracking-wider">Clarity Study Workspace</span>
                                    </div>
                                    <span className="text-[9px] font-mono text-[#1a1a2e]/40 uppercase tracking-widest font-black">Live Console</span>
                                </div>

                                {/* Dynamic Query selector tabs */}
                                <div className="bg-[#fdfdfb] p-3 border-b border-[#1a1a2e]/10 flex flex-wrap gap-1.5">
                                    {(['wave-optics', 'biology', 'simulator'] as const).map((key) => (
                                        <button 
                                            key={key}
                                            type="button"
                                            onClick={() => simulateTerminal(key)}
                                            disabled={isTyping}
                                            className={`px-3 py-1 rounded-lg text-[10px] font-black border transition-all ${
                                                activePrompt === key
                                                    ? 'bg-[#1a1a2e] text-[#f7f5f0] border-[#1a1a2e] '
                                                    : 'bg-[#FCFAF8] text-[#1a1a2e]/60 border-[#1a1a2e]/15 hover:text-[#1a1a2e] hover:border-[#1a1a2e]/30'
                                            }`}
                                            onMouseEnter={() => setIsHoveredWord(true)}
                                            onMouseLeave={() => setIsHoveredWord(false)}
                                        >
                                            {key === 'wave-optics' ? '💡 Wave Optics' : key === 'biology' ? '🌿 Biology Grading' : '⏱ Physics Exam'}
                                        </button>
                                    ))}
                                </div>

                                {/* Console content - Styled like a ruled worksheet sheet card */}
                                <div className="p-4 bg-[#FCFAF8] min-h-[300px] max-h-[360px] overflow-y-auto flex flex-col justify-start gap-4 text-xs font-semibold leading-relaxed">
                                    {terminalPrompt && (
                                        <>
                                            {/* User prompt write-in card */}
                                            <div className="flex justify-end w-full">
                                                <div className="bg-[#1a1a2e]/5 text-[#1a1a2e] px-4 py-2 rounded-2xl rounded-tr-none border border-[#1a1a2e]/10 max-w-[85%] text-left font-black">
                                                    {terminalPrompt}
                                                    {isTyping && <span className="animate-pulse ml-0.5">|</span>}
                                                </div>
                                            </div>

                                            {/* AI responses cards */}
                                            {terminalOutput && (
                                                <div className="flex flex-col gap-2 items-start w-full">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-5 h-5 border border-[#1a1a2e] bg-[#FCFAF8] flex items-center justify-center rounded-full text-[9px] font-black">
                                                            C
                                                        </div>
                                                        <span className="text-[9px] text-[#1a1a2e]/50 font-black uppercase tracking-wider">Clarity Coach</span>
                                                    </div>

                                                    <div className="bg-[#fcfbf9] text-[#1a1a2e] p-4 rounded-2xl rounded-tl-none border border-[#1a1a2e]/15  text-left w-full space-y-4 font-mono text-[11px] leading-relaxed">
                                                        {activePrompt === 'wave-optics' && (
                                                            <div className="space-y-4">
                                                                <p className="font-bold text-xs border-b border-[#1a1a2e]/10 pb-2">
                                                                    Derive expression for fringe width in YDSE (CBSE 2024)
                                                                </p>
                                                                
                                                                {visibleLinesCount >= 2 && (
                                                                    <div className="p-3 bg-[#FCFAF8] border border-[#1a1a2e]/10 rounded-xl space-y-1">
                                                                        <p className="text-[8px] font-black uppercase text-[#1a1a2e]/50 tracking-wider">Concept Formula</p>
                                                                        <p className="text-xs font-bold text-[#1a1a2e]">Fringe Width (β) = λD/d</p>
                                                                    </div>
                                                                )}

                                                                {visibleLinesCount >= 3 && (
                                                                    <div className="p-3 bg-red-50 border border-red-200 rounded-xl space-y-1">
                                                                        <p className="text-[8px] font-black uppercase text-red-700 tracking-wider flex items-center gap-1">
                                                                            ⚠️ CBSE Exam Trap Identified
                                                                        </p>
                                                                        <p className="text-[10px] text-red-800 font-bold leading-relaxed">
                                                                            Students often omit stating the path difference condition (Δx = nλ). Loss of <strong>0.5 Marks</strong> in grading rubric.
                                                                        </p>
                                                                    </div>
                                                                )}

                                                                {visibleLinesCount >= 4 && (
                                                                    <div className="space-y-2">
                                                                        <p className="text-[8px] font-black uppercase text-[#1a1a2e]/40 tracking-wider">CBSE Step-Marking Scheme</p>
                                                                        <div className="border border-[#1a1a2e]/10 rounded-lg overflow-hidden text-[10px] bg-[#FCFAF8]">
                                                                            <table className="w-full text-left">
                                                                                <thead>
                                                                                    <tr className="bg-[#fcfbf9] border-b border-[#1a1a2e]/10 font-bold text-[#1a1a2e]/60">
                                                                                        <th className="p-2">Step</th>
                                                                                        <th className="p-2 text-right">Value</th>
                                                                                    </tr>
                                                                                </thead>
                                                                                <tbody className="divide-y divide-[#1a1a2e]/5 text-[#1a1a2e]/80">
                                                                                    <tr>
                                                                                        <td className="p-2">Path Difference Formulation</td>
                                                                                        <td className="p-2 text-right text-amber-700 font-bold">+0.5 M</td>
                                                                                    </tr>
                                                                                    <tr>
                                                                                        <td className="p-2">Geometric Wavefront Construction</td>
                                                                                        <td className="p-2 text-right text-amber-700 font-bold">+1.5 M</td>
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
                                                                <div className="flex justify-between items-center bg-[#FCFAF8] p-2 rounded-lg border border-[#1a1a2e]/10 text-[9px]">
                                                                    <span className="font-black text-[#1a1a2e]/50 uppercase">OCR Handwritten Grading</span>
                                                                    <span className="text-[#1a1a2e] font-black">98.2% Confidence</span>
                                                                </div>

                                                                {visibleLinesCount >= 3 && (
                                                                    <div className="p-3 bg-[#fdfcf9] rounded-lg border border-[#1a1a2e]/5 italic text-[#1a1a2e]/70">
                                                                        "...syngamy forms zygote. Second sperm cell fertilizes polar nuclei..."
                                                                    </div>
                                                                )}

                                                                {visibleLinesCount >= 4 && (
                                                                    <div className="space-y-2">
                                                                        <p className="text-[8px] font-black uppercase text-[#1a1a2e]/40 tracking-wider">Answer Key Checklist</p>
                                                                        <div className="space-y-1 text-[10px]">
                                                                            <div className="flex items-center justify-between p-1.5 rounded bg-amber-500/5 text-amber-800 border border-amber-500/10">
                                                                                <span>✔ Syngamy identified</span>
                                                                                <span className="font-bold">+1.0 M</span>
                                                                            </div>
                                                                            <div className="flex items-center justify-between p-1.5 rounded bg-amber-500/5 text-amber-800 border border-amber-500/10">
                                                                                <span>✔ Zygote formation described</span>
                                                                                <span className="font-bold">+1.0 M</span>
                                                                            </div>
                                                                            <div className="flex items-center justify-between p-1.5 rounded bg-rose-500/5 text-rose-800 border border-rose-500/10">
                                                                                <span>✖ "Triple Fusion" omitted</span>
                                                                                <span className="font-bold text-rose-700">-0.5 M</span>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                )}

                                                                {visibleLinesCount >= 5 && (
                                                                    <div className="flex items-center justify-between pt-2 border-t border-[#1a1a2e]/10">
                                                                        <div>
                                                                            <span className="text-[8px] font-black uppercase text-[#1a1a2e]/40">Notes Grade</span>
                                                                            <p className="text-xs font-black">2.5 / 3.0 (B+)</p>
                                                                        </div>
                                                                        <button type="button" className="px-2.5 py-1 bg-[#1a1a2e] text-[#f7f5f0] rounded-lg text-[9px] font-black uppercase">
                                                                            🎙️ Speak to Recover
                                                                        </button>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}

                                                        {activePrompt === 'simulator' && (
                                                            <div className="space-y-4">
                                                                <div className="flex justify-between items-center border-b border-[#1a1a2e]/10 pb-2">
                                                                    <span className="text-xs font-bold">Coulomb's Law (2 Marks)</span>
                                                                    <span className="text-[9px] bg-red-100 text-red-800 font-bold px-1.5 py-0.5 rounded">02:14:55</span>
                                                                </div>

                                                                {visibleLinesCount >= 3 && (
                                                                    <div className="p-3 bg-[#fdfcf9] border border-[#1a1a2e]/10 rounded-xl space-y-1">
                                                                        <p className="text-[8px] font-black uppercase text-[#1a1a2e]/40 tracking-wider">Voice Input Transcription</p>
                                                                        <p className="text-[10px] text-[#1a1a2e]/80">"Force is proportional to product of charges..."</p>
                                                                    </div>
                                                                )}

                                                                {visibleLinesCount >= 4 && (
                                                                    <div className="space-y-1.5 text-[9px]">
                                                                        <div className="flex items-center gap-1.5 text-amber-800">
                                                                            <Check size={10} /> <span>State formula: F = k*q1*q2/r² (+1.0 M)</span>
                                                                        </div>
                                                                        <div className="flex items-center gap-1.5 text-amber-800">
                                                                            <Check size={10} /> <span>Define vacuum permittivity (+1.0 M)</span>
                                                                        </div>
                                                                        <div className="flex items-center justify-between border-t border-[#1a1a2e]/5 pt-1.5 mt-1 text-[11px] font-black">
                                                                            <span>Total Grade</span>
                                                                            <span>2.0 / 2.0 Marks</span>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Section: The Student Dilemma (Animated Word Switcher) */}
                    <section 
                        ref={problemSectionRef} 
                        id="problem-section" 
                        className="py-20 bg-[#1a1a2e] text-[#f7f5f0] rounded-3xl border border-[#1a1a2e] relative overflow-hidden text-center pl-[clamp(24px, 7vw, 90px)] pr-6 "
                    >
                        <div className="relative z-10 space-y-6">
                            <p className="text-[10px] font-black uppercase tracking-widest text-[#f7f5f0]/50">The Student Dilemma</p>
                            <h2 className="text-2xl md:text-3xl font-black tracking-tight max-w-2xl mx-auto leading-tight" style={{ fontFamily: "'Syne', sans-serif" }}>
                                Traditional CBSE preparation is locked in endless
                            </h2>
                            <div className="h-20 flex items-center justify-center">
                                <span className="text-4xl md:text-5xl font-mono font-bold tracking-tight text-red-500 select-none animate-pulse">
                                    {problemWords[problemWordIdx]}
                                </span>
                            </div>
                            <p className="text-[#f7f5f0]/70 max-w-lg mx-auto text-xs md:text-sm font-semibold leading-relaxed">
                                Reference guides, strict step-marking schemes, and test anxiety. Clarity restructures your study path into clear, active syllabus missions.
                            </p>
                        </div>
                    </section>

                    {/* Section: Interactive Workspace Mockups */}
                    <section className="space-y-8 pl-[clamp(24px, 7vw, 90px)]">
                        <div className="text-center max-w-2xl mx-auto space-y-3">
                            <p className="text-[10px] font-black uppercase tracking-wider text-[#1a1a2e]/60">Product Interface Preview</p>
                            <h2 className="text-3xl md:text-4xl font-black tracking-tight" style={{ fontFamily: "'Syne', sans-serif" }}>
                                Explore the Clarity Student OS
                            </h2>
                            <p className="text-[#1a1a2e]/70 font-semibold text-sm leading-relaxed">
                                Click the options below to switch between workspace mockups and preview how Clarity manages student progress.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch">
                            {/* Selector Tabs Column */}
                            <div className="lg:col-span-4 flex flex-col gap-3 justify-center">
                                {[
                                    {
                                        id: 'tutor',
                                        title: 'Ask AI',
                                        desc: 'Answers formatted the way CBSE marks them.'
                                    },
                                    {
                                        id: 'workspace',
                                        title: 'Practice',
                                        desc: 'Questions based on actual board exam patterns — 1 mark, 3 mark, 5 mark.'
                                    },
                                    {
                                        id: 'simulator',
                                        title: 'Exam Simulator',
                                        desc: 'Simulate your board exam. Same time limit. Same marking scheme.'
                                    },
                                    {
                                        id: 'parent',
                                        title: 'Chapter Deep Dive',
                                        desc: 'Every NCERT chapter — explained, mapped, and linked to the best YouTube lessons.'
                                    },
                                    {
                                        id: 'leaderboard',
                                        title: 'Leaderboard',
                                        desc: "Who's topping the boards this week?"
                                    }
                                ].map((tab) => (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id as any)}
                                        className={`w-full text-left p-5 border transition-all flex flex-col gap-1 rounded-xl ${
                                            activeTab === tab.id 
                                                ? 'bg-[#1a1a2e] text-[#f7f5f0] border-[#1a1a2e]  scale-[1.01]' 
                                                : 'bg-[#FCFAF8] border-[#1a1a2e]/10 text-[#1a1a2e]/80 hover:bg-[#1a1a2e]/5'
                                        }`}
                                        onMouseEnter={() => setIsHoveredWord(true)}
                                        onMouseLeave={() => setIsHoveredWord(false)}
                                    >
                                        <h4 className="font-black text-sm">{tab.title}</h4>
                                        <p className={`text-[11px] font-semibold leading-relaxed ${activeTab === tab.id ? 'text-[#f7f5f0]/80' : 'text-[#1a1a2e]/55'}`}>
                                            {tab.desc}
                                        </p>
                                    </button>
                                ))}
                            </div>

                            {/* Display Window mockup */}
                            <div className="lg:col-span-8 relative flex items-stretch">
                                <div className="w-full border border-[#1a1a2e]/15 bg-[#FCFAF8] shadow-2xl p-6 flex flex-col justify-between rounded-2xl overflow-hidden relative">
                                    <div className="flex items-center gap-1 mb-6 pb-3 border-b border-[#1a1a2e]/10">
                                        <span className="w-2.5 h-2.5 rounded-full bg-[#1a1a2e] inline-block" />
                                        <span className="w-2.5 h-2.5 rounded-full bg-[#1a1a2e] inline-block" />
                                        <span className="text-[9px] font-black uppercase text-[#1a1a2e]/40 tracking-widest ml-2">
                                            Clarity Student OS — {activeTab === 'parent' ? 'CHAPTER DEEP DIVE' : activeTab === 'workspace' ? 'PRACTICE' : activeTab.toUpperCase()}
                                        </span>
                                    </div>

                                    {/* Active Tab Contents */}
                                    <div className="flex-1 flex flex-col justify-center min-h-[280px]">
                                        {activeTab === 'workspace' && (
                                            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                                                <div className="md:col-span-7 space-y-4">
                                                    <div className="p-4 bg-[#1a1a2e] text-[#f7f5f0] rounded-xl  space-y-3">
                                                        <p className="text-[9px] font-black uppercase tracking-widest text-[#f7f5f0]/60">Today's Daily Mission</p>
                                                        <div className="space-y-1.5">
                                                            <div className="flex items-center justify-between text-xs p-2.5 bg-[#f7f5f0]/5 border border-[#f7f5f0]/10 rounded-lg">
                                                                <span className="flex items-center gap-2"><CheckCircle2 size={13} className="text-amber-400" /> Solve 5 Wave Optics PYQs</span>
                                                                <span className="text-[8px] font-black tracking-wider bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded">+15 XP</span>
                                                            </div>
                                                            <div className="flex items-center justify-between text-xs p-2.5 bg-[#f7f5f0]/5 border border-[#f7f5f0]/5 rounded-lg opacity-60">
                                                                <span className="flex items-center gap-2"><div className="w-3.5 h-3.5 border-1.5 border-[#f7f5f0]/30 rounded" /> Revise 2 Biology Traps</span>
                                                                <span className="text-[8px] font-black tracking-wider bg-[#f7f5f0]/10 text-[#f7f5f0]/60 px-1.5 py-0.5 rounded">Pending</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="p-3.5 border border-[#1a1a2e]/10 bg-[#fdfcf9] flex items-center justify-between rounded-xl">
                                                        <div>
                                                            <p className="text-[9px] font-black uppercase text-[#1a1a2e]/40">CBSE Readiness</p>
                                                            <h4 className="text-xl font-black">78%</h4>
                                                        </div>
                                                        <span className="text-[10px] font-black text-amber-850 bg-amber-50 px-2 py-0.5 rounded-full">High prep stability</span>
                                                    </div>
                                                </div>
                                                <div className="md:col-span-5 flex flex-col items-center justify-center p-5 bg-[#fcfbf9] border border-[#1a1a2e]/10 rounded-xl">
                                                    <Flame className="text-orange-500 w-10 h-10 mb-1 animate-bounce" />
                                                    <p className="text-xl font-black text-[#1a1a2e]">6 Days</p>
                                                    <p className="text-[8px] font-black uppercase text-[#1a1a2e]/40 tracking-widest mt-0.5">Study Streak</p>
                                                </div>
                                            </div>
                                        )}

                                        {activeTab === 'tutor' && (
                                            <div className="space-y-4">
                                                <div className="flex items-start gap-2.5">
                                                    <div className="w-6 h-6 border border-[#1a1a2e] flex items-center justify-center text-[9px] font-bold rounded-full">U</div>
                                                    <div className="p-3 bg-[#fdfcf9] border border-[#1a1a2e]/10 max-w-[85%] rounded-xl rounded-tl-none">
                                                        <p className="text-xs font-semibold text-[#1a1a2e]">Explain the Photoelectric Effect in CBSE board style.</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-start gap-2.5">
                                                    <div className="w-6 h-6 bg-[#1a1a2e] text-[#f7f5f0] flex items-center justify-center text-[9px] rounded-full"><Brain size={12} /></div>
                                                    <div className="p-3.5 bg-[#fdfcf9] border border-[#1a1a2e]/15 max-w-[85%] space-y-2 rounded-xl rounded-tl-none">
                                                        <p className="text-xs font-semibold text-[#1a1a2e]">
                                                            It is the emission of electrons when light of threshold frequency shines on metal.
                                                        </p>
                                                        <div className="p-2 bg-yellow-100 border border-[#1a1a2e]/20 text-[#1a1a2e] text-[10px] font-bold rounded-lg leading-relaxed">
                                                            <strong>Exam Trap:</strong> Kinetic energy depends strictly on light frequency, not light intensity!
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {activeTab === 'simulator' && (
                                            <div className="space-y-4">
                                                <div className="p-3 bg-[#1a1a2e] text-[#f7f5f0] flex items-center justify-between rounded-t-xl border-b border-[#1a1a2e]/20">
                                                    <div className="flex items-center gap-1.5">
                                                        <Trophy size={14} className="text-yellow-300" />
                                                        <span className="text-[10px] font-bold">Physics Part I Simulator</span>
                                                    </div>
                                                    <span className="text-[9px] font-mono text-[#f7f5f0]/80">02:14:55</span>
                                                </div>
                                                <div className="p-4 bg-[#fcfbf9] border border-[#1a1a2e]/10 rounded-b-xl space-y-3 font-mono text-[11px]">
                                                    <p className="font-bold text-[#1a1a2e]">Q1: State Coulomb's law. (2 Marks)</p>
                                                    <div className="space-y-1 text-amber-800 text-[10px]">
                                                        <p className="flex items-center gap-1"><Check size={11} /> Formula: F = k*q1*q2/r² (+1.0 Mark)</p>
                                                        <p className="flex items-center gap-1"><Check size={11} /> Define variables & vacuum permittivity (+1.0 Mark)</p>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {activeTab === 'parent' && (
                                            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                                                <div className="md:col-span-7 space-y-3">
                                                    <div className="p-4 bg-[#FCFAF8] border border-[#1a1a2e]/10 rounded-xl space-y-2">
                                                        <div className="flex items-center justify-between">
                                                            <p className="text-[10px] font-black uppercase text-[#1a1a2e]/50">NCERT Mapping</p>
                                                            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                                                        </div>
                                                        <p className="text-sm font-bold text-[#1a1a2e]">Chemical Reactions (Pg 12-18)</p>
                                                        <div className="w-full bg-[#1a1a2e]/10 rounded-full h-1.5 mt-2 overflow-hidden">
                                                            <div className="bg-[#8C5A35] h-1.5 rounded-full w-[85%]"></div>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="md:col-span-5 space-y-3">
                                                    <div className="p-3 bg-[#fcfbf9] border border-[#1a1a2e]/10 rounded-xl flex items-center gap-3">
                                                        <div className="w-10 h-10 bg-red-500/10 text-red-600 rounded-lg flex items-center justify-center"><Video size={16} /></div>
                                                        <div>
                                                            <p className="text-[10px] font-black uppercase text-[#1a1a2e]/50">Best YouTube</p>
                                                            <p className="text-xs font-bold text-[#1a1a2e]">Ranked #1 for Board</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {activeTab === 'leaderboard' && (
                                            <div className="space-y-4">
                                                <div className="flex items-center justify-between border-b border-[#1a1a2e]/10 pb-2">
                                                    <p className="text-sm font-black text-[#1a1a2e]">Top Board Scorer</p>
                                                    <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">Weekly Reset</span>
                                                </div>
                                                <div className="flex items-center gap-3 p-3 bg-yellow-50 border border-yellow-200 rounded-xl">
                                                    <div className="w-8 h-8 rounded-full bg-yellow-400 text-yellow-900 flex items-center justify-center font-black text-xs">1</div>
                                                    <div className="flex-1">
                                                        <p className="text-xs font-bold text-[#1a1a2e]">Rahul S. <span className="ml-1 text-[10px] font-normal text-stone-500">Class 10</span></p>
                                                        <p className="text-[10px] font-black text-yellow-700">14 Day Streak 🔥</p>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-sm font-black text-[#1a1a2e]">2400</p>
                                                        <p className="text-[8px] font-black uppercase text-[#1a1a2e]/40">XP</p>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Section: Bento Grid Features Layout */}
                    <section className="space-y-8 pl-[clamp(24px, 7vw, 90px)]">
                        <div className="text-center max-w-2xl mx-auto space-y-2">
                            <p className="text-[10px] font-black uppercase tracking-wider text-[#1a1a2e]/60">Syllabus Tools OS</p>
                            <h2 className="text-3xl font-black tracking-tight" style={{ fontFamily: "'Syne', sans-serif" }}>
                                Fully featured for absolute preparation
                            </h2>
                            <p className="text-[#1a1a2e]/70 font-semibold leading-relaxed text-sm">
                                Clarity packages specialized revision and validation engines to keep syllabus tracking concrete.
                            </p>
                        </div>

                        {/* Bento Grid layout sheets */}
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                            {/* Card 1: Studio AI */}
                            <div className="md:col-span-8 flat-card p-6 flex flex-col md:flex-row gap-6 items-center">
                                <div className="space-y-4 flex-1">
                                    <div className="w-10 h-10 border border-[#1a1a2e] flex items-center justify-center rounded-xl bg-[#fcfbf9] ">
                                        <Video size={18} className="text-[#1a1a2e]" />
                                    </div>
                                    <h3 className="font-black text-xl">Studio Video Learning Assist</h3>
                                    <p className="text-xs text-[#1a1a2e]/70 leading-relaxed font-semibold">
                                        Convert curriculum videos into notes to remember and mock quizzes. Tracks tricky board exam traps automatically from references.
                                    </p>
                                </div>
                                <div className="w-full md:w-48 p-4 bg-[#fcfbf9] border border-[#1a1a2e]/15 rounded-xl space-y-1.5 shrink-0 font-mono text-[10px]">
                                    <span className="text-[8px] font-black uppercase text-[#1a1a2e]/50 tracking-widest">Tricky Point</span>
                                    <p className="font-bold leading-relaxed text-[#1a1a2e]">
                                        Planck's constant is independent of amplitude. Light intensity only scales photon counts!
                                    </p>
                                </div>
                            </div>

                            {/* Card 2: Active Recall Board */}
                            <div className="md:col-span-4 flat-card p-6 flex flex-col justify-between space-y-6">
                                <div className="space-y-4">
                                    <div className="w-10 h-10 border border-[#1a1a2e] flex items-center justify-center rounded-xl bg-[#fcfbf9] ">
                                        <Brain size={18} className="text-[#1a1a2e]" />
                                    </div>
                                    <h3 className="font-black text-xl">Active Recall Board</h3>
                                    <p className="text-xs text-[#1a1a2e]/70 leading-relaxed font-semibold">
                                        Speak or write what you remember. The AI voice grading engine benchmarks recall against NCERT concepts.
                                    </p>
                                </div>
                                <div className="flex items-center gap-1.5 border border-[#1a1a2e]/30 px-3 py-1 text-[9px] font-black uppercase w-fit rounded-lg">
                                    <span className="w-1.5 h-1.5 bg-[#1a1a2e] rounded-full animate-ping" />
                                    Voice Analysis Active
                                </div>
                            </div>

                            {/* Card 3: OCR Handwritten Grading */}
                            <div className="md:col-span-4 flat-card p-6 flex flex-col justify-between space-y-6">
                                <div className="space-y-4">
                                    <div className="w-10 h-10 border border-[#1a1a2e] flex items-center justify-center rounded-xl bg-[#fcfbf9] ">
                                        <FileText size={18} className="text-[#1a1a2e]" />
                                    </div>
                                    <h3 className="font-black text-xl">OCR Handwritten Grading</h3>
                                    <p className="text-xs text-[#1a1a2e]/70 leading-relaxed font-semibold">
                                        Snap a photo of your answers. Our vision OCR reads text, maps diagrams, and grades it against CBSE step-marking criteria.
                                    </p>
                                </div>
                                <span className="text-[9px] uppercase font-black tracking-wider text-[#1a1a2e]/40">Class 9-12 Supported</span>
                            </div>

                            {/* Card 4: Multi-Board & Dual Medium */}
                            <div className="md:col-span-8 flat-card p-6 flex flex-col md:flex-row gap-6 items-center">
                                <div className="space-y-4 flex-1">
                                    <div className="w-10 h-10 border border-[#1a1a2e] flex items-center justify-center rounded-xl bg-[#fcfbf9] ">
                                        <BookOpen size={18} className="text-[#1a1a2e]" />
                                    </div>
                                    <h3 className="font-black text-xl flex items-center gap-2">
                                        Multi-Board & Dual Medium
                                        <span className="px-2 py-0.5 bg-[#1a1a2e]/5 border border-[#1a1a2e]/20 text-[#1a1a2e] text-[8px] font-black rounded-full uppercase tracking-wider">Active</span>
                                    </h3>
                                    <p className="text-xs text-[#1a1a2e]/70 leading-relaxed font-semibold">
                                        Fully supports CBSE Board and Tamil Nadu State Board (TNSERT) across both English and Tamil Mediums. (IB & IGCSE coming soon).
                                    </p>
                                </div>
                                <div className="p-3 bg-[#1a1a2e]/5 border border-[#1a1a2e]/20 text-[10px] font-bold text-[#1a1a2e] flex items-center gap-1.5 shrink-0 rounded-xl">
                                    <Check size={12} /> TNSERT & CBSE Live
                                </div>
                            </div>

                            {/* Card 5: Worldwide & Local Leaderboards */}
                            <div className="md:col-span-12 flat-card p-6 flex flex-col md:flex-row gap-8 items-center">
                                <div className="space-y-4 flex-1">
                                    <div className="w-10 h-10 border border-[#1a1a2e] flex items-center justify-center rounded-xl bg-[#fcfbf9] ">
                                        <Trophy size={18} className="text-[#1a1a2e]" />
                                    </div>
                                    <h3 className="font-black text-xl flex items-center gap-2">
                                        Worldwide & Local Leaderboards
                                        <span className="px-2 py-0.5 bg-yellow-100 border border-yellow-300 text-yellow-800 text-[8px] font-black rounded-full uppercase tracking-wider">Active</span>
                                    </h3>
                                    <p className="text-xs text-[#1a1a2e]/70 leading-relaxed font-semibold">
                                        Earn points for daily activities like asking the AI (+10), active recall logs (+30), and mock practice exams (+50). Filter by Grade, State, or City.
                                    </p>
                                    <div className="flex flex-wrap gap-1.5 text-[9px] font-bold text-[#1a1a2e]/60">
                                        <span className="px-2.5 py-0.5 bg-[#1a1a2e]/5 border border-[#1a1a2e]/10 rounded-full">Practice (+50 pts)</span>
                                        <span className="px-2.5 py-0.5 bg-[#1a1a2e]/5 border border-[#1a1a2e]/10 rounded-full">Recall (+30 pts)</span>
                                    </div>
                                </div>
                                
                                {/* Mini Leaderboard Scoreboard */}
                                <div className="w-full md:w-72 bg-[#FCFAF8] border border-[#1a1a2e]/15 p-4 rounded-xl shrink-0 space-y-3">
                                    <p className="text-[9px] font-black uppercase tracking-wider text-[#1a1a2e]/55 flex justify-between items-center border-b border-[#1a1a2e]/10 pb-1.5">
                                        <span>Regional rankings</span>
                                        <span className="text-[#1a1a2e] font-bold">Tamil Nadu (State-wise)</span>
                                    </p>
                                    <div className="space-y-1.5 text-[11px] font-bold">
                                        <div className="flex items-center justify-between p-1.5 rounded bg-[#FCFAF8] text-[#1a1a2e] border border-[#1a1a2e]/10">
                                            <span className="flex items-center gap-2">
                                                <span className="w-4 h-4 rounded-full bg-yellow-100 text-yellow-800 flex items-center justify-center text-[9px] font-black">1</span>
                                                <span>Rohan Gupta</span>
                                            </span>
                                            <span className="font-mono text-amber-800 font-black">1,420 pts</span>
                                        </div>
                                        <div className="flex items-center justify-between p-1.5 rounded bg-[#FCFAF8] text-[#1a1a2e] border border-[#1a1a2e]/10">
                                            <span className="flex items-center gap-2">
                                                <span className="w-4 h-4 rounded-full bg-[#F2EFE9] text-stone-500 flex items-center justify-center text-[9px] font-black">2</span>
                                                <span>Priya Nair</span>
                                            </span>
                                            <span className="font-mono text-amber-800 font-black">1,180 pts</span>
                                        </div>
                                        <div className="flex items-center justify-between p-1.5 rounded bg-yellow-100/70 text-[#1a1a2e] border border-[#1a1a2e]/25 font-black ring-1 ring-[#1a1a2e]/10">
                                            <span className="flex items-center gap-2">
                                                <span className="w-4 h-4 rounded-full bg-[#1a1a2e] text-[#f7f5f0] flex items-center justify-center text-[9px] font-black">3</span>
                                                <span>You</span>
                                            </span>
                                            <span className="font-mono text-amber-800 font-black">950 pts</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Section: Family Hub Showcase */}
                    <section className="relative overflow-hidden border border-[#1a1a2e]/15 bg-[#FCFAF8] p-8 md:p-12  rounded-3xl pl-[clamp(24px, 7vw, 90px)]">
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center relative z-10">
                            {/* Parent Portal Info */}
                            <div className="lg:col-span-6 space-y-6">
                                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#1a1a2e]/5 text-[#1a1a2e] text-xs font-black uppercase tracking-wider border border-[#1a1a2e]/15 rounded-full">
                                    Dedicated Family Hub
                                </div>
                                <h2 className="text-3xl font-black tracking-tight leading-none" style={{ fontFamily: "'Syne', sans-serif" }}>
                                    Transparent Parent Portal for family alignment
                                </h2>
                                <p className="text-xs md:text-sm text-[#1a1a2e]/70 leading-relaxed font-semibold">
                                    Family transparency stays distinct. Clarity separates parent tracking from the student study interface, allowing parents to log in independently with distinct secure credentials.
                                </p>
                                <div className="space-y-3">
                                    <div className="flex items-start gap-2.5">
                                        <div className="mt-0.5 bg-[#1a1a2e]/5 text-[#1a1a2e] p-1.5 rounded-lg border border-[#1a1a2e]/10"><Mail size={12} /></div>
                                        <div>
                                            <p className="text-xs font-black text-[#1a1a2e]">Weekly Progress Report Emails</p>
                                            <p className="text-[11px] text-[#1a1a2e]/60">Automated reports listing questions, mock simulator performance, and weak spots.</p>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-2.5">
                                        <div className="mt-0.5 bg-[#1a1a2e]/5 text-[#1a1a2e] p-1.5 rounded-lg border border-[#1a1a2e]/10"><LineChart size={12} /></div>
                                        <div>
                                            <p className="text-xs font-black text-[#1a1a2e]">Live Coverage & Readiness Indicators</p>
                                            <p className="text-[11px] text-[#1a1a2e]/60">Track coverage percentage, risk assessment indexes, and active timelines.</p>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-2.5">
                                        <div className="mt-0.5 bg-[#1a1a2e]/5 text-[#1a1a2e] p-1.5 rounded-lg border border-[#1a1a2e]/10"><AlertTriangle size={12} /></div>
                                        <div>
                                            <p className="text-xs font-black text-[#1a1a2e]">Actionable Intervention Guides</p>
                                            <p className="text-[11px] text-[#1a1a2e]/60">Provides exact guides to support your child (e.g. which chapters need immediate practice).</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="pt-2">
                                    <Link 
                                        to="/parent-portal" 
                                        className="px-5 py-3 bg-[#1a1a2e] text-[#f7f5f0] text-xs font-black inline-flex items-center gap-2 rounded-xl  hover:transtone-x-[2px] hover:transtone-y-[2px] hover: transition-all"
                                        onMouseEnter={() => setIsHoveredWord(true)}
                                        onMouseLeave={() => setIsHoveredWord(false)}
                                    >
                                        Open Parent Dashboard
                                        <ArrowRight size={14} />
                                    </Link>
                                </div>
                            </div>

                            {/* Parent Portal UI Mockup */}
                            <div className="lg:col-span-6 relative">
                                <div className="relative border border-[#1a1a2e]/15 bg-[#fcfbf9] p-6  rounded-2xl">
                                    <div className="flex items-center justify-between pb-3 border-b border-[#1a1a2e]/10 mb-4">
                                        <div className="flex items-center gap-2">
                                            <div className="w-7 h-7 bg-[#1a1a2e] text-[#f7f5f0] flex items-center justify-center font-bold text-xs rounded-lg">
                                                P
                                            </div>
                                            <div>
                                                <p className="text-[11px] font-black text-[#1a1a2e]">Clarity Parent Portal</p>
                                                <p className="text-[9px] font-bold text-[#1a1a2e]/40 uppercase">Access Active</p>
                                            </div>
                                        </div>
                                        <span className="w-2 h-2 rounded-full bg-amber-500 inline-block animate-pulse" />
                                    </div>

                                    <div className="space-y-3 font-mono text-[11px]">
                                        {/* Linked Student Card */}
                                        <div className="p-3 bg-[#FCFAF8] border border-[#1a1a2e]/10 flex items-center justify-between rounded-xl">
                                            <div>
                                                <p className="text-[8px] font-bold text-[#1a1a2e]/40 uppercase">Student Profile</p>
                                                <p className="font-bold text-[#1a1a2e]">Izyaan Mohammed</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-[8px] font-bold text-[#1a1a2e]/40 uppercase">Risk Index</p>
                                                <p className="text-[9px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-500/10">Low Risk</p>
                                            </div>
                                        </div>

                                        {/* Action Plan */}
                                        <div className="p-3 bg-[#FCFAF8] border border-[#1a1a2e]/10 space-y-1.5 rounded-xl">
                                            <p className="text-[8px] font-black uppercase text-[#1a1a2e]/55">Recommended Action Plan</p>
                                            <p className="text-[#1a1a2e]/80 leading-relaxed text-[10px]">
                                                Ensure Rohan completes 1 mock Physics practice exam on <strong>Wave Optics</strong> this week.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Section: Pricing Cards */}
                    <section id="pricing" className="space-y-8 pl-[clamp(24px, 7vw, 90px)]">
                        <div className="text-center max-w-2xl mx-auto space-y-2">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-yellow-100 border border-yellow-300 text-yellow-850 text-xs font-black uppercase tracking-wider rounded-full">
                                Special Launch Offer
                            </span>
                            <h2 className="text-3xl font-black tracking-tight" style={{ fontFamily: "'Syne', sans-serif" }}>
                                Unlock full power, 100% free
                            </h2>
                            <p className="text-[#1a1a2e]/70 font-semibold text-sm leading-relaxed">
                                For a limited time, all study plans are free to access as part of our initial campaign. Boost your prep now.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
                            {tiers.map((tier) => (
                                <div 
                                    key={tier.name} 
                                    className={`p-6 border flex flex-col justify-between transition-all rounded-3xl ${
                                        tier.highlight 
                                            ? 'border-2 border-[#1a1a2e] bg-[#fcfbf9]/50  relative' 
                                            : 'border-[#1a1a2e]/15 bg-[#FCFAF8]  hover:'
                                    }`}
                                >
                                    {tier.highlight && (
                                        <span className="absolute -top-3 left-1/2 transform -transtone-x-1/2 px-3 py-0.5 bg-[#1a1a2e] text-[#f7f5f0] text-[8px] font-black uppercase tracking-widest shadow border border-[#1a1a2e] rounded-full">
                                            Most Popular
                                        </span>
                                    )}
                                    <div className="space-y-4">
                                        <div>
                                            <span className="px-2 py-0.5 text-[8px] font-black uppercase tracking-wider bg-[#1a1a2e]/5 text-[#1a1a2e] border border-[#1a1a2e]/10 rounded-full">
                                                {tier.badge}
                                            </span>
                                            <h3 className="text-base font-black mt-2">{tier.name}</h3>
                                        </div>
                                        <div className="flex items-baseline gap-1.5 pb-3 border-b border-[#1a1a2e]/10">
                                            <span className="text-xs font-bold text-[#1a1a2e]/40 line-through">{tier.originalPrice}</span>
                                            <span className="text-2xl font-black">{tier.promoPrice}</span>
                                            <span className="text-[10px] font-bold text-[#1a1a2e]/55">/mo</span>
                                        </div>
                                        <ul className="space-y-2 text-[11px] font-medium text-[#1a1a2e]/85">
                                            {tier.features.map((f) => (
                                                <li key={f} className="flex items-start gap-1.5">
                                                    <CheckCircle2 size={12} className="text-[#1a1a2e] mt-0.5 shrink-0" />
                                                    <span>{f}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                    <div className="pt-5">
                                        <Link 
                                            to="/onboarding" 
                                            className={`inline-flex w-full items-center justify-center gap-1.5 py-3 text-xs font-black  rounded-xl transition-all border ${
                                                tier.highlight 
                                                    ? 'bg-[#1a1a2e] text-[#f7f5f0] border-[#1a1a2e]  hover:transtone-x-[1px] hover:transtone-y-[1px]' 
                                                    : 'bg-transparent text-[#1a1a2e] border-[#1a1a2e]/25 hover:bg-[#1a1a2e]/5'
                                            }`}
                                            onMouseEnter={() => setIsHoveredWord(true)}
                                            onMouseLeave={() => setIsHoveredWord(false)}
                                        >
                                            {tier.cta}
                                            <Rocket size={12} />
                                        </Link>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* Section: Accordion FAQs */}
                    <section className="max-w-3xl mx-auto space-y-6 pl-[clamp(24px, 7vw, 90px)]">
                        <div className="text-center space-y-2">
                            <p className="text-[10px] font-black uppercase tracking-wider text-[#1a1a2e]/60">FAQ</p>
                            <h2 className="text-2xl font-black tracking-tight" style={{ fontFamily: "'Syne', sans-serif" }}>Frequently Asked Questions</h2>
                        </div>

                        <div className="space-y-2.5">
                            {faqsList.map((faq, index) => (
                                <div 
                                    key={index} 
                                    className="border border-[#1a1a2e]/15 bg-[#FCFAF8] overflow-hidden  rounded-xl"
                                >
                                    <button
                                        onClick={() => toggleFaq(index)}
                                        className="w-full flex items-center justify-between p-5 text-left font-black text-xs md:text-sm text-[#1a1a2e] select-none hover:bg-[#1a1a2e]/5 transition-colors"
                                        onMouseEnter={() => setIsHoveredWord(true)}
                                        onMouseLeave={() => setIsHoveredWord(false)}
                                    >
                                        <span>{faq.q}</span>
                                        <ChevronDown 
                                            size={16} 
                                            className={`text-[#1a1a2e]/40 transition-transform duration-300 ${
                                                openFaqIdx === index ? 'transform rotate-180 text-[#1a1a2e]' : ''
                                            }`}
                                        />
                                    </button>
                                    {openFaqIdx === index && (
                                        <div className="p-5 pt-0 border-t border-[#1a1a2e]/10 text-xs text-[#1a1a2e]/70 font-semibold leading-relaxed">
                                            {faq.a}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </section>
                </main>

                {/* Footer bar */}
                <footer className="border-t border-[#1a1a2e]/10 py-10 text-center text-[10px] font-bold text-[#1a1a2e]/40 uppercase tracking-widest pl-[clamp(24px, 7vw, 90px)] pr-6">
                    <p>© 2026 Clarity AI. CBSE study resources. Est. 2025.</p>
                </footer>
            </div>
        </div>
    );
};
