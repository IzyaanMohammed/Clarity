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
        <div className={`prose dark:prose-invert max-w-none ${className}`}>
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
                                    className="inline-flex items-center gap-1.5 px-3 py-1 my-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300 font-black text-xs hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-all cursor-pointer select-none"
                                >
                                    📄 Page {pageNum}
                                </button>
                            );
                        }
                        return <a href={href} {...props}>{children}</a>;
                    },
                    h1: ({ ...props }) => <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white mt-8 mb-4 tracking-tight border-b-2 border-[#1D9E75]/10 pb-2" {...props} />,
                    h2: ({ ...props }) => <h2 className="text-xl md:text-2xl font-extrabold text-slate-800 dark:text-slate-100 mt-6 mb-3 tracking-tight border-b border-slate-100 dark:border-slate-900 pb-1" {...props} />,
                    h3: ({ ...props }) => <h3 className="text-lg md:text-xl font-bold text-slate-700 dark:text-slate-205 mt-5 mb-2" {...props} />,
                    h4: ({ ...props }) => <h4 className="text-base md:text-lg font-bold text-slate-650 dark:text-slate-300 mt-4 mb-2" {...props} />,
                    p: ({ ...props }) => <p className="text-sm md:text-base leading-relaxed text-slate-600 dark:text-slate-300 mb-4 font-medium whitespace-pre-line" {...props} />,
                    ul: ({ ...props }) => <ul className="list-disc pl-6 mb-4 space-y-2 text-slate-600 dark:text-slate-350 text-sm md:text-base font-medium" {...props} />,
                    ol: ({ ...props }) => <ol className="list-decimal pl-6 mb-4 space-y-2 text-slate-600 dark:text-slate-350 text-sm md:text-base font-medium" {...props} />,
                    li: ({ ...props }) => <li className="pl-1 leading-relaxed" {...props} />,
                    blockquote: ({ ...props }) => <blockquote className="pl-4 py-2 my-5 border-l-4 border-[#1D9E75] bg-slate-50/50 dark:bg-slate-900/30 rounded-r-xl italic text-slate-500 dark:text-slate-400" {...props} />,
                    hr: ({ ...props }) => <hr className="my-6 border-t border-slate-200 dark:border-slate-800" {...props} />,
                    table: ({ ...props }) => (
                        <div className="my-6 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/60 backdrop-blur-sm overflow-hidden shadow-md hover:shadow-lg transition-all duration-300">
                            {/* Widget Header Bar */}
                            <div className="px-5 py-3.5 bg-gradient-to-r from-emerald-500/10 to-teal-500/10 dark:from-emerald-500/20 dark:to-teal-500/10 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="relative flex h-2 w-2">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                    </div>
                                    <Sparkles className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                                    <span className="text-[10px] font-black uppercase tracking-widest text-emerald-800 dark:text-emerald-300">
                                        Clarity AI Table Widget
                                    </span>
                                </div>
                                <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                                    Structured Data
                                </span>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-slate-100 dark:divide-slate-800 text-left text-sm" {...props} />
                            </div>
                        </div>
                    ),
                    thead: ({ ...props }) => <thead className="bg-slate-50/50 dark:bg-slate-800/40" {...props} />,
                    th: ({ ...props }) => <th className="px-5 py-3 text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200 border-b border-slate-200 dark:border-slate-700 bg-slate-100/50 dark:bg-slate-800/40" {...props} />,
                    td: ({ ...props }) => <td className="px-5 py-3.5 text-slate-600 dark:text-slate-350 align-top border-t border-slate-100 dark:border-slate-800 text-xs md:text-sm font-medium" {...props} />,
                    tr: ({ ...props }) => <tr className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 even:bg-slate-50/20 dark:even:bg-slate-800/10 transition-colors" {...props} />,
                }}
            >
                {preprocessMath(content)}
            </ReactMarkdown>
        </div>
    );
});

