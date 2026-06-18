import { memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { Sparkles } from 'lucide-react';

type MarkdownContentProps = {
    content: string;
    className?: string;
};

/**
 * Normalise LaTeX delimiters so KaTeX can parse them.
 *
 * Handles all common variants produced by LLMs and text-extraction tools:
 *   \\[ … \\]   →  $$ … $$   (display/block math)
 *   \\( … \\)   →  $ … $     (inline math)
 *   \[ … \]    →  $$ … $$   (single-escape variants)
 *   \( … \)    →  $ … $
 *
 * Also converts bare chemical subscripts like H2O → H₂O via superscript/sub
 * rendering — we do NOT mangle these because KaTeX handles \text{} inside math.
 */
const SUBSCRIPTS: Record<string, string> = {
    '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄',
    '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉'
};

const convertChemicalSubscripts = (text: string): string => {
    return text.replace(/(?<=[A-Z][a-z]?|\))(\d+)/g, (match) => {
        return match.split('').map(char => SUBSCRIPTS[char] || char).join('');
    });
};

const preprocessMath = (text: string): string => {
    if (!text) return '';

    // Block math: \\[ ... \\] or \[ ... \]
    let processed = text.replace(/\\{1,2}\[([^]*?)\\{1,2}\]/g, (_: string, eq: string) => `$$${eq.trim()}$$`);

    // Inline math: \\( ... \\) or \( ... \)
    processed = processed.replace(/\\{1,2}\(([^]*?)\\{1,2}\)/g, (_: string, eq: string) => `$${eq.trim()}$`);

    // Convert unicode root symbol √ followed by parentheses to LaTeX \sqrt
    processed = processed.replace(/√\s*\(([^)]+)\)/g, (_, inside) => `$\\sqrt{${inside.trim()}}$`);

    // Convert unicode root symbol √ followed by curly braces to LaTeX \sqrt
    processed = processed.replace(/√\s*\{([^}]+)\}/g, (_, inside) => `$\\sqrt{${inside.trim()}}$`);

    // Convert unicode root symbol √ followed by alphanumeric/Greek characters to LaTeX \sqrt
    processed = processed.replace(/√\s*([0-9a-zA-Z\u0370-\u03ff]+)/g, (_, inside) => `$\\sqrt{${inside.trim()}}$`);

    // Fix chemical subscripts
    processed = convertChemicalSubscripts(processed);

    return processed;
};

export const MarkdownContent = memo(({ content, className = '' }: MarkdownContentProps) => {
    return (
        <div className={`prose max-w-none ${className}`}>
            <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkMath]}
                rehypePlugins={[rehypeKatex]}
                components={{
                    a: ({ href, children, ...props }) => {
                        if (href && href.startsWith('page://')) {
                            const pageNum = href.replace('page://', '');
                            return (
                                <button
                                    id={`page-anchor-${pageNum}`}
                                    onClick={() => {
                                        const event = new CustomEvent('jump-to-pdf-page', { detail: { page: pageNum } });
                                        window.dispatchEvent(event);
                                    }}
                                    className="inline-flex items-center gap-1.5 px-3 py-1 my-2 rounded-lg bg-amber-50 border border-amber-100 text-amber-700 font-black text-xs hover:bg-amber-100 :bg-amber-900/40 transition-all cursor-pointer select-none"
                                >
                                    📄 Page {pageNum}
                                </button>
                            );
                        }
                        return <a href={href} {...props}>{children}</a>;
                    },
                    h1: ({ ...props }) => <h1 className="text-2xl md:text-3xl font-black text-[#2C241B] mt-8 mb-4 tracking-tight border-b-2 border-[#8C5A35]/10 pb-2" {...props} />,
                    h2: ({ ...props }) => <h2 className="text-xl md:text-2xl font-extrabold text-[#3E352B] mt-6 mb-3 tracking-tight border-b border-stone-100 pb-1" {...props} />,
                    h3: ({ ...props }) => <h3 className="text-lg md:text-xl font-bold text-stone-700 mt-5 mb-2" {...props} />,
                    h4: ({ ...props }) => <h4 className="text-base md:text-lg font-bold text-stone-650 mt-4 mb-2" {...props} />,
                    p: ({ ...props }) => <p className="text-sm md:text-base leading-relaxed text-stone-600 mb-4 font-medium whitespace-pre-line" {...props} />,
                    ul: ({ ...props }) => <ul className="list-disc pl-6 mb-4 space-y-2 text-stone-600 text-sm md:text-base font-medium" {...props} />,
                    ol: ({ ...props }) => <ol className="list-decimal pl-6 mb-4 space-y-2 text-stone-600 text-sm md:text-base font-medium" {...props} />,
                    li: ({ ...props }) => <li className="pl-1 leading-relaxed" {...props} />,
                    blockquote: ({ ...props }) => <blockquote className="pl-4 py-2 my-5 border-l-4 border-[#8C5A35] bg-[#FCFAF8]/50 rounded-r-xl italic text-stone-500 " {...props} />,
                    hr: ({ ...props }) => <hr className="my-6 border-t border-stone-200 " {...props} />,
                    table: ({ ...props }) => (
                        <div className="my-6 rounded-2xl border border-stone-200 bg-[#FCFAF8] backdrop-blur-sm overflow-hidden shadow-md hover:shadow-lg transition-all duration-300">
                            {/* Widget Header Bar */}
                            <div className="px-5 py-3.5 bg-gradient-to-r from-amber-500/10 to-teal-500/10 border-b border-stone-200 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="relative flex h-2 w-2">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                                    </div>
                                    <Sparkles className="w-3.5 h-3.5 text-amber-600 " />
                                    <span className="text-[10px] font-black uppercase tracking-widest text-amber-800 ">
                                        Clarity AI Table Widget
                                    </span>
                                </div>
                                <span className="text-[9px] font-black text-stone-400 uppercase tracking-wider">
                                    Structured Data
                                </span>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-stone-100 text-left text-sm" {...props} />
                            </div>
                        </div>
                    ),
                    thead: ({ ...props }) => <thead className="bg-[#FCFAF8]/50 " {...props} />,
                    th: ({ ...props }) => <th className="px-5 py-3 text-xs font-black uppercase tracking-wider text-stone-700 border-b border-stone-200 bg-[#F2EFE9]/50 " {...props} />,
                    td: ({ ...props }) => <td className="px-5 py-3.5 text-stone-600 align-top border-t border-stone-100 text-xs md:text-sm font-medium" {...props} />,
                    tr: ({ ...props }) => <tr className="hover:bg-[#FCFAF8]/80 :bg-stone-800/50 even:bg-[#FCFAF8]/20 :bg-stone-800/10 transition-colors" {...props} />,
                }}
            >
                {preprocessMath(content)}
            </ReactMarkdown>
        </div>
    );
});

