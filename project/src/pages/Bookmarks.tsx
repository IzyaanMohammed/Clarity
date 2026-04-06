import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bookmark, Trash2, RefreshCw } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Navbar } from '../components/layout/Navbar';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { getBookmarks, removeBookmark } from '../utils/storage';

export const Bookmarks = () => {
    const navigate = useNavigate();
    const [bookmarks, setBookmarks] = useState(getBookmarks());
    const [filter, setFilter] = useState<'all' | 'answer' | 'flashcard' | 'summary'>('all');
    const [query, setQuery] = useState('');
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [showFlashcardAnswer, setShowFlashcardAnswer] = useState(true);
    const [activeBookmark, setActiveBookmark] = useState<(typeof bookmarks)[number] | null>(null);
    const filterOptions: Array<'all' | 'answer' | 'flashcard' | 'summary'> = ['all', 'answer', 'flashcard', 'summary'];

    const filtered = useMemo(() => {
        const queryText = query.trim().toLowerCase();
        return bookmarks.filter((b) => {
            const typeMatches = filter === 'all' ? true : b.type === filter;
            const searchMatches = !queryText || [b.type, b.subject, b.chapter, b.question, b.answer]
                .filter(Boolean)
                .join(' ')
                .toLowerCase()
                .includes(queryText);
            return typeMatches && searchMatches;
        });
    }, [bookmarks, filter, query]);

    const handleDelete = (id: string) => {
        removeBookmark(id);
        setBookmarks(getBookmarks());
    };

    const openDetail = (item: (typeof bookmarks)[number]) => {
        setActiveBookmark(item);
        setShowFlashcardAnswer(true);
    };

    const copyText = async (text: string) => {
        await navigator.clipboard.writeText(text);
    };

    const downloadText = (filename: string, text: string) => {
        const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="min-h-screen bg-[#f8fafc] dark:bg-[#020617] transition-colors duration-300">
            <Navbar />
            <main className="max-w-6xl mx-auto px-6 py-10">
                <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl md:text-4xl font-black text-slate-900 dark:text-white">
                            Revise Later
                        </h1>
                        <p className="text-slate-500 mt-2 font-medium">
                            Your saved answers, flashcards, and key revision notes.
                        </p>
                    </div>
                    <div className="flex gap-2 bg-white dark:bg-slate-800 p-1.5 rounded-2xl border border-slate-100 dark:border-slate-700">
                        {filterOptions.map((t) => (
                            <button
                                key={t}
                                onClick={() => setFilter(t)}
                                className={`px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wider ${filter === t
                                    ? 'bg-[#1D9E75] text-white'
                                    : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700'
                                    }`}
                            >
                                {t}
                            </button>
                        ))}
                    </div>
                </div>

                <Card className="p-4 mb-6 bg-white dark:bg-[#0f172a] border-none shadow-xl rounded-3xl">
                    <p className="text-xs font-black uppercase tracking-wider text-[#1D9E75] mb-3">Search Saved Items</p>
                    <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search subject, chapter, answer, or keyword"
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm"
                    />
                </Card>

                {filtered.length > 0 ? (
                    <div className="space-y-4">
                        {filtered.map((item) => (
                            <Card key={item.id} className="p-6 bg-white dark:bg-[#0f172a] border-none shadow-xl rounded-3xl">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="px-2 py-1 bg-[#1D9E75]/10 text-[#1D9E75] text-[10px] font-black rounded-lg uppercase tracking-wider">
                                                {item.type}
                                            </span>
                                            <span className="text-xs text-slate-500">{item.subject} • {item.chapter}</span>
                                        </div>
                                        {item.question && (
                                            <p className="text-sm font-bold text-slate-900 dark:text-white mb-2">Q: {item.question}</p>
                                        )}
                                        <div className="mt-1">
                                            <p className={`text-sm text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap ${expandedId === item.id ? '' : 'line-clamp-5'}`}>
                                                {item.answer}
                                            </p>
                                            <Button
                                                variant="ghost"
                                                className="mt-2 h-auto px-0 text-xs font-black text-[#1D9E75]"
                                                onClick={() => setExpandedId((current) => current === item.id ? null : item.id)}
                                            >
                                                {expandedId === item.id ? 'Show Less' : 'View Full Content'}
                                            </Button>
                                        </div>
                                        <div className="mt-4 flex gap-2">
                                            <Button
                                                variant="outline"
                                                className="rounded-xl"
                                                onClick={() => navigate('/ask', { state: { subject: item.subject, chapter: item.chapter } })}
                                            >
                                                Reopen In AI
                                            </Button>
                                            <Button
                                                variant="outline"
                                                className="rounded-xl"
                                                onClick={() => openDetail(item)}
                                            >
                                                Detail View
                                            </Button>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleDelete(item.id)}
                                        className="text-slate-400 hover:text-red-500 transition-colors"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            </Card>
                        ))}
                    </div>
                ) : (
                    <Card className="p-14 bg-white dark:bg-[#0f172a] border-none shadow-xl rounded-3xl text-center">
                        <Bookmark className="mx-auto text-[#1D9E75] mb-3" size={28} />
                        <p className="font-semibold text-slate-900 dark:text-white">No saved items yet.</p>
                        <p className="text-sm text-slate-500 mt-1">Save useful answers and flashcards to revise later.</p>
                    </Card>
                )}
            </main>

            <Modal
                isOpen={Boolean(activeBookmark)}
                onClose={() => setActiveBookmark(null)}
                title={activeBookmark ? `${activeBookmark.type.toUpperCase()} Detail` : 'Saved Item'}
                className="max-w-4xl"
            >
                {activeBookmark && (
                    <div className="space-y-5">
                        <div className="flex flex-wrap gap-2">
                            <Button
                                variant="outline"
                                className="rounded-xl"
                                onClick={() => copyText(`Question:\n${activeBookmark.question || ''}\n\nAnswer:\n${activeBookmark.answer || ''}`)}
                            >
                                Copy Text
                            </Button>
                            <Button
                                variant="outline"
                                className="rounded-xl"
                                onClick={() => downloadText(`${activeBookmark.subject}_${activeBookmark.chapter}.md`.replace(/\s+/g, '_'), `# ${activeBookmark.subject} • ${activeBookmark.chapter}\n\n${activeBookmark.question ? `## Question\n${activeBookmark.question}\n\n` : ''}## Answer\n${activeBookmark.answer}`)}
                            >
                                Download .md
                            </Button>
                        </div>
                        <div className="max-h-[60vh] overflow-y-auto rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-4">
                            {activeBookmark.type === 'flashcard' ? (
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-xs font-black uppercase tracking-wider text-[#1D9E75]">flashcard</p>
                                            <h4 className="text-lg font-black text-slate-900 dark:text-white">{activeBookmark.subject} • {activeBookmark.chapter}</h4>
                                        </div>
                                        <Button variant="outline" className="rounded-xl" onClick={() => setShowFlashcardAnswer((current) => !current)}>
                                            <RefreshCw size={14} className="mr-2" />
                                            Flip
                                        </Button>
                                    </div>
                                    <div className="rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 min-h-[240px] flex items-center justify-center text-center">
                                        <div>
                                            <p className="text-xs font-black uppercase tracking-wider text-[#1D9E75] mb-3">
                                                {showFlashcardAnswer ? 'Answer' : 'Question'}
                                            </p>
                                            <div className="prose prose-slate dark:prose-invert max-w-none">
                                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                                    {showFlashcardAnswer ? (activeBookmark.answer || 'No answer text available.') : (activeBookmark.question || 'No question available.')}
                                                </ReactMarkdown>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="prose prose-slate dark:prose-invert max-w-none">
                                    <p className="text-xs font-black uppercase tracking-wider text-[#1D9E75]">{activeBookmark.type}</p>
                                    <h4>{activeBookmark.subject} • {activeBookmark.chapter}</h4>
                                    {activeBookmark.question && <p><strong>Question:</strong> {activeBookmark.question}</p>}
                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                        {activeBookmark.answer || 'No answer text available.'}
                                    </ReactMarkdown>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
};
