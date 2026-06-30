import { useMemo, useState } from 'react';
import { ArrowUpRight, Brain, Clock3, Sparkles, Target } from 'lucide-react';

type Pointer = {
    x: number;
    y: number;
};

const trackerItems = [
    { label: 'Read', value: 'NCERT', tone: 'bg-[#1a1a2e] text-[#f7f5f0]' },
    { label: 'Solve', value: 'Step marks', tone: 'bg-amber-100 text-[#1a1a2e]' },
    { label: 'Review', value: 'Daily recall', tone: 'bg-emerald-100 text-[#1a1a2e]' },
];

export default function ClarityOrbitWidget() {
    const [pointer, setPointer] = useState<Pointer>({ x: 50, y: 42 });
    const [isHovered, setIsHovered] = useState(false);

    const drift = useMemo(() => ({
        x: (pointer.x - 50) / 4,
        y: (pointer.y - 50) / 4,
        softX: (pointer.x - 50) / 8,
        softY: (pointer.y - 50) / 8,
    }), [pointer]);

    const handleMove = (event: React.MouseEvent<HTMLDivElement>) => {
        const rect = event.currentTarget.getBoundingClientRect();
        const x = ((event.clientX - rect.left) / rect.width) * 100;
        const y = ((event.clientY - rect.top) / rect.height) * 100;
        setPointer({
            x: Math.max(0, Math.min(100, x)),
            y: Math.max(0, Math.min(100, y)),
        });
    };

    return (
        <div
            className="relative w-full overflow-hidden rounded-3xl border border-[#1a1a2e]/15 bg-[#FCFAF8] shadow-[10px_10px_0px_0px_rgba(26,26,46,0.95)]"
            onMouseMove={handleMove}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => {
                setIsHovered(false);
                setPointer({ x: 50, y: 42 });
            }}
        >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(255,245,220,0.95),_transparent_35%),radial-gradient(circle_at_bottom_right,_rgba(130,220,205,0.18),_transparent_34%),linear-gradient(135deg,rgba(255,255,255,0.6),rgba(255,255,255,0.16))]" />
            <div className="absolute inset-0 opacity-[0.18]" style={{ backgroundImage: 'linear-gradient(rgba(26,26,46,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(26,26,46,0.12) 1px, transparent 1px)', backgroundSize: '24px 24px' }} />

            <div
                className="absolute inset-0 transition-opacity duration-300"
                style={{
                    opacity: isHovered ? 1 : 0.75,
                    background: `radial-gradient(circle at ${pointer.x}% ${pointer.y}%, rgba(255, 207, 128, 0.45), transparent 22%), radial-gradient(circle at ${pointer.x}% ${pointer.y}%, rgba(26, 26, 46, 0.08), transparent 48%)`,
                }}
            />

            <div className="relative z-10 p-5 md:p-6 min-h-[390px] flex flex-col">
                <div className="flex items-center justify-between pb-3 border-b border-[#1a1a2e]/10">
                    <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#1a1a2e]" />
                        <span className="text-[10px] font-black uppercase tracking-[0.28em] text-[#1a1a2e]/55">Clarity Orbit</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.24em] text-[#1a1a2e]/45">
                        <Sparkles size={12} className="text-amber-600" />
                        Mouse-linked study field
                    </div>
                </div>

                <div className="relative flex-1 min-h-[280px] flex items-center justify-center">
                    <div
                        className="absolute inset-10 rounded-full border border-[#1a1a2e]/10"
                        style={{ transform: `translate(${drift.softX}px, ${drift.softY}px)` }}
                    />
                    <div
                        className="absolute inset-20 rounded-full border border-[#1a1a2e]/10 border-dashed"
                        style={{ transform: `translate(${-drift.softX}px, ${-drift.softY}px)` }}
                    />

                    <div
                        className="absolute left-[12%] top-[15%] w-28 md:w-32 rounded-2xl border border-[#1a1a2e]/10 bg-[#fcfbf9]/92 p-3 shadow-[6px_6px_0px_0px_rgba(26,26,46,0.1)] transition-transform duration-150"
                        style={{ transform: `translate(${drift.x}px, ${drift.y}px) rotate(${-drift.y / 3}deg)` }}
                    >
                        <div className="flex items-center gap-2 text-[#1a1a2e] mb-2">
                            <Brain size={14} />
                            <p className="text-[10px] font-black uppercase tracking-[0.2em]">Understand</p>
                        </div>
                        <p className="text-[11px] font-semibold text-[#1a1a2e]/70 leading-relaxed">Turn one page into clear steps, traps, and recall prompts.</p>
                    </div>

                    <div
                        className="absolute right-[8%] top-[26%] w-24 md:w-28 rounded-2xl border border-[#1a1a2e]/10 bg-[#1a1a2e] p-3 text-[#f7f5f0] shadow-[6px_6px_0px_0px_rgba(26,26,46,0.12)] transition-transform duration-150"
                        style={{ transform: `translate(${-drift.x}px, ${drift.y * 0.7}px) rotate(${drift.x / 3}deg)` }}
                    >
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/70">Focus</p>
                            <Target size={13} className="text-amber-300" />
                        </div>
                        <p className="text-2xl font-black leading-none">94</p>
                        <p className="text-[10px] font-semibold text-white/60 mt-1">sharp study minutes today</p>
                    </div>

                    <div
                        className="relative z-20 w-[min(240px,52vw)] aspect-square rounded-full border-2 border-[#1a1a2e] bg-[#FCFAF8] shadow-[0_0_0_10px_rgba(255,255,255,0.34),0_24px_60px_rgba(26,26,46,0.18)] flex items-center justify-center"
                        style={{ transform: `translate(${drift.softX * 1.2}px, ${drift.softY * 1.2}px) rotate(${drift.x / 10}deg)` }}
                    >
                        <div className="absolute inset-3 rounded-full border border-[#1a1a2e]/10" />
                        <div className="absolute inset-8 rounded-full border border-[#1a1a2e]/10 border-dashed" />
                        <div className="absolute inset-14 rounded-full bg-[radial-gradient(circle,_rgba(255,244,220,0.95),_rgba(255,244,220,0.72),_rgba(255,255,255,0.12))]" />

                        <div className="relative z-10 text-center px-4">
                            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#1a1a2e] text-[#f7f5f0] text-[9px] font-black uppercase tracking-[0.24em] mb-3">
                                <Clock3 size={11} />
                                Live clarity
                            </div>
                            <h3 className="text-2xl md:text-3xl font-black tracking-tight text-[#1a1a2e]" style={{ fontFamily: "'Syne', sans-serif" }}>
                                Study, but cleaner.
                            </h3>
                            <p className="mt-2 text-[11px] md:text-xs font-semibold text-[#1a1a2e]/65 leading-relaxed max-w-[190px] mx-auto">
                                A responsive workspace that follows your cursor and keeps NCERT prep visually calm.
                            </p>
                        </div>

                        <div
                            className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-[#f7dfb7] border border-[#1a1a2e]/10 shadow-[4px_4px_0px_0px_rgba(26,26,46,0.08)]"
                            style={{ transform: `translate(-50%, -50%) translate(${drift.x * 1.6}px, ${drift.y * 1.6}px)` }}
                        />
                        <div
                            className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-[#c8efe3] border border-[#1a1a2e]/10 shadow-[4px_4px_0px_0px_rgba(26,26,46,0.08)]"
                            style={{ transform: `translate(50%, -50%) translate(${-drift.x * 1.4}px, ${-drift.y * 1.4}px)` }}
                        />
                    </div>

                    <div
                        className="absolute bottom-[14%] left-[13%] right-[13%] rounded-2xl border border-[#1a1a2e]/10 bg-[#fcfbf9]/95 px-4 py-3 shadow-[6px_6px_0px_0px_rgba(26,26,46,0.08)] backdrop-blur-sm"
                        style={{ transform: `translate(${drift.softX}px, ${-drift.softY}px)` }}
                    >
                        <div className="flex items-center justify-between gap-3 mb-3">
                            <div>
                                <p className="text-[9px] font-black uppercase tracking-[0.24em] text-[#1a1a2e]/45">Live learning path</p>
                                <p className="text-sm font-black text-[#1a1a2e]">Clarity turns motion into momentum</p>
                            </div>
                            <ArrowUpRight size={16} className="text-[#1a1a2e]/50 shrink-0" />
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                            {trackerItems.map((item) => (
                                <div key={item.label} className={`rounded-xl px-3 py-2.5 border border-[#1a1a2e]/10 ${item.tone}`}>
                                    <p className="text-[9px] font-black uppercase tracking-[0.22em] opacity-70">{item.label}</p>
                                    <p className="text-[11px] font-bold mt-1 leading-tight">{item.value}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}