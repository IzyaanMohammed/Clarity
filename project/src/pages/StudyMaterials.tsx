import { useMemo, useState } from 'react';
import { BookOpen, FileText, Trash2, ExternalLink } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import remarkGfm from 'remark-gfm';
import toast from 'react-hot-toast';
import { Navbar } from '../components/layout/Navbar';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { addStudyMaterial, getBookmarks, getStudyMaterials, removeStudyMaterial, type StudyMaterialItem } from '../utils/storage';
import type { BookmarkItem } from '../types';
import { extractMarkdownSection, formatQuickRecallBlock, parseMarkdownTable } from '../utils/markdown';

export const StudyMaterials = () => {
    const [refresh, setRefresh] = useState(0);
    const [linkTitle, setLinkTitle] = useState('');
    const [linkUrl, setLinkUrl] = useState('');
    const [materialQuery, setMaterialQuery] = useState('');
    const [bookmarkQuery, setBookmarkQuery] = useState('');
    const [expandedMaterialId, setExpandedMaterialId] = useState<string | null>(null);
    const [expandedBookmarkId, setExpandedBookmarkId] = useState<string | null>(null);
    const [activeMaterial, setActiveMaterial] = useState<StudyMaterialItem | null>(null);
    const [activeBookmark, setActiveBookmark] = useState<BookmarkItem | null>(null);
    const materials = useMemo(() => getStudyMaterials(), [refresh]);
    const bookmarks = useMemo(() => getBookmarks(), [refresh]);
    const filteredMaterials = useMemo(() => {
        const query = materialQuery.trim().toLowerCase();
        if (!query) return materials;
        return materials.filter((item) => (
            [item.title, item.content, item.subject, item.chapter, item.type, item.url]
                .filter(Boolean)
                .join(' ')
                .toLowerCase()
                .includes(query)
        ));
    }, [materials, materialQuery]);
    const filteredBookmarks = useMemo(() => {
        const query = bookmarkQuery.trim().toLowerCase();
        if (!query) return bookmarks;
        return bookmarks.filter((item) => (
            [item.subject, item.chapter, item.question, item.answer, item.type]
                .filter(Boolean)
                .join(' ')
                .toLowerCase()
                .includes(query)
        ));
    }, [bookmarks, bookmarkQuery]);

    const removeItem = (id: string) => {
        removeStudyMaterial(id);
        setRefresh((v) => v + 1);
    };

    const saveResourceLink = () => {
        const title = linkTitle.trim();
        const url = linkUrl.trim();
        if (!title || !url) {
            toast.error('Enter both title and URL.');
            return;
        }
        addStudyMaterial({
            id: `link_${Date.now()}`,
            type: 'link',
            title,
            url,
            createdAt: Date.now(),
        });
        setLinkTitle('');
        setLinkUrl('');
        setRefresh((v) => v + 1);
        toast.success('Online material saved.');
    };

    const copyText = async (text: string) => {
        await navigator.clipboard.writeText(text);
        toast.success('Copied to clipboard.');
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
        toast.success('Downloaded.');
    };

    const renderTableBlock = (content: string, section: string, nextSections: string[]) => {
        const block = extractMarkdownSection(content, section, nextSections);
        const table = parseMarkdownTable(block);
        if (!table) return null;

        return (
            <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
                <table className="min-w-full text-left text-sm">
                    <thead className="bg-slate-100 dark:bg-slate-800">
                        <tr>
                            {table.headers.map((header) => (
                                <th key={header} className="px-4 py-3 font-black text-slate-700 dark:text-slate-200 whitespace-nowrap">
                                    {header}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {table.rows.map((row, rowIndex) => (
                            <tr key={rowIndex} className="border-t border-slate-100 dark:border-slate-800">
                                {row.map((cell, cellIndex) => (
                                    <td key={`${rowIndex}-${cellIndex}`} className="px-4 py-3 text-slate-700 dark:text-slate-200 align-top">
                                        {cell}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-[#f8fafc] dark:bg-[#020617] transition-colors duration-300">
            <Navbar />
            <main className="max-w-7xl mx-auto px-6 py-10">
                <div className="mb-8">
                    <h1 className="text-4xl font-black text-slate-900 dark:text-white">Total Study Materials</h1>
                    <p className="text-slate-500 font-medium mt-2">All OCR notes, saved outputs, and revision materials in one place.</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <Card className="p-6 bg-white dark:bg-[#0f172a] border-none shadow-xl rounded-3xl">
                        <div className="mb-4 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                            <p className="text-xs font-black uppercase tracking-wider text-[#1D9E75] mb-3">Save Online Resource</p>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                <input
                                    value={linkTitle}
                                    onChange={(e) => setLinkTitle(e.target.value)}
                                    placeholder="Resource title"
                                    className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
                                />
                                <input
                                    value={linkUrl}
                                    onChange={(e) => setLinkUrl(e.target.value)}
                                    placeholder="https://..."
                                    className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm md:col-span-2"
                                />
                            </div>
                            <Button className="rounded-xl mt-3" onClick={saveResourceLink}>Save Link</Button>
                        </div>

                        <div className="mb-4 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                            <p className="text-xs font-black uppercase tracking-wider text-[#1D9E75] mb-3">Search Materials</p>
                            <input
                                value={materialQuery}
                                onChange={(e) => setMaterialQuery(e.target.value)}
                                placeholder="Search title, subject, chapter, or text"
                                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
                            />
                        </div>

                        <h2 className="text-xl font-black text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                            <FileText size={20} className="text-[#1D9E75]" />
                            OCR and Saved Materials
                        </h2>
                        <div className="space-y-3 max-h-[560px] overflow-y-auto pr-1">
                            {filteredMaterials.length === 0 && (
                                <p className="text-sm text-slate-500">{materialQuery ? 'No matching materials found.' : 'No materials saved yet. Use OCR page or Studio to store outputs.'}</p>
                            )}
                            {filteredMaterials.map((item) => (
                                <div key={item.id} className="p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                                    <div className="flex items-center justify-between gap-2">
                                        <div>
                                            <p className="text-sm font-black text-slate-900 dark:text-white">{item.title}</p>
                                            <p className="text-xs text-slate-500 mt-1">{new Date(item.createdAt).toLocaleString()}</p>
                                        </div>
                                        <Button variant="ghost" className="rounded-xl" onClick={() => removeItem(item.id)}>
                                            <Trash2 size={14} />
                                        </Button>
                                    </div>
                                    {item.content && (
                                        <div className="mt-3">
                                            <p className={`text-xs text-slate-600 dark:text-slate-300 whitespace-pre-wrap ${expandedMaterialId === item.id ? '' : 'line-clamp-6'}`}>
                                                {item.content}
                                            </p>
                                            <Button
                                                variant="ghost"
                                                className="mt-2 h-auto px-0 text-xs font-black text-[#1D9E75]"
                                                onClick={() => setExpandedMaterialId((current) => current === item.id ? null : item.id)}
                                            >
                                                {expandedMaterialId === item.id ? 'Show Less' : 'View Full Content'}
                                            </Button>
                                        </div>
                                    )}
                                    {item.imageDataUrl && (
                                        <img
                                            src={item.imageDataUrl}
                                            alt={item.title}
                                            className="mt-3 w-full max-h-44 object-cover rounded-xl border border-slate-200 dark:border-slate-700"
                                        />
                                    )}
                                    {item.url && (
                                        <Button variant="outline" className="mt-3 rounded-xl" onClick={() => window.open(item.url, '_blank')}>
                                            <ExternalLink size={14} className="mr-1" /> Open Resource
                                        </Button>
                                    )}
                                    {(item.content || item.imageDataUrl) && (
                                        <Button
                                            variant="outline"
                                            className="mt-3 rounded-xl ml-2"
                                            onClick={() => setActiveMaterial(item)}
                                        >
                                            View Full Content
                                        </Button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </Card>

                    <Card className="p-6 bg-white dark:bg-[#0f172a] border-none shadow-xl rounded-3xl">
                        <div className="mb-4 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                            <p className="text-xs font-black uppercase tracking-wider text-[#1D9E75] mb-3">Search Saved Items</p>
                            <input
                                value={bookmarkQuery}
                                onChange={(e) => setBookmarkQuery(e.target.value)}
                                placeholder="Search subject, chapter, question, or answer"
                                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
                            />
                        </div>

                        <h2 className="text-xl font-black text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                            <BookOpen size={20} className="text-[#1D9E75]" />
                            Flashcards and Saved Answers
                        </h2>
                        <div className="space-y-3 max-h-[560px] overflow-y-auto pr-1">
                            {filteredBookmarks.length === 0 && (
                                <p className="text-sm text-slate-500">{bookmarkQuery ? 'No matching saved items found.' : 'No saved flashcards/answers yet. Save from Ask AI or Flashcards.'}</p>
                            )}
                            {filteredBookmarks.map((item) => (
                                <div key={item.id} className="p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                                    <p className="text-xs font-black uppercase tracking-wider text-[#1D9E75]">{item.type}</p>
                                    <p className="text-sm font-black text-slate-900 dark:text-white mt-1">{item.subject} • {item.chapter}</p>
                                    {item.question && <p className="text-xs text-slate-600 dark:text-slate-300 mt-2">Q: {item.question}</p>}
                                    <div className="mt-2">
                                        <p className={`text-xs text-slate-600 dark:text-slate-300 whitespace-pre-wrap ${expandedBookmarkId === item.id ? '' : 'line-clamp-5'}`}>
                                            {item.answer}
                                        </p>
                                        <Button
                                            variant="ghost"
                                            className="mt-2 h-auto px-0 text-xs font-black text-[#1D9E75]"
                                            onClick={() => setExpandedBookmarkId((current) => current === item.id ? null : item.id)}
                                        >
                                            {expandedBookmarkId === item.id ? 'Show Less' : 'View Full Content'}
                                        </Button>
                                    </div>
                                    <Button variant="outline" className="mt-3 rounded-xl" onClick={() => setActiveBookmark(item)}>
                                        Open Detail View
                                    </Button>
                                </div>
                            ))}
                        </div>
                    </Card>
                </div>
            </main>

            <Modal
                isOpen={Boolean(activeMaterial)}
                onClose={() => setActiveMaterial(null)}
                title={activeMaterial?.title || 'Material'}
                className="max-w-4xl"
            >
                {activeMaterial && (
                    <div className="space-y-5">
                        <div className="flex flex-wrap gap-2">
                            <Button variant="outline" className="rounded-xl" onClick={() => copyText(activeMaterial.content || '')}>
                                Copy Text
                            </Button>
                            <Button
                                variant="outline"
                                className="rounded-xl"
                                onClick={() => downloadText(`${activeMaterial.title.replace(/\s+/g, '_')}.md`, activeMaterial.content || '')}
                            >
                                Download .md
                            </Button>
                            {activeMaterial.url && (
                                <Button variant="outline" className="rounded-xl" onClick={() => window.open(activeMaterial.url, '_blank')}>
                                    Open Link
                                </Button>
                            )}
                        </div>
                        {activeMaterial.imageDataUrl && (
                            <img
                                src={activeMaterial.imageDataUrl}
                                alt={activeMaterial.title}
                                className="w-full max-h-[320px] object-contain rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900"
                            />
                        )}
                        <div className="max-h-[60vh] overflow-y-auto space-y-5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-4">
                            {activeMaterial.type === 'summary' && activeMaterial.content ? (
                                <div className="space-y-5">
                                    <section className="space-y-3">
                                        <h4 className="text-base font-black text-slate-900 dark:text-white">Core Ideas</h4>
                                        {renderTableBlock(activeMaterial.content, 'Core Ideas', ['Key Terms', 'Board Focus', 'Quick Recall', 'Exam Tip']) || (
                                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{extractMarkdownSection(activeMaterial.content, 'Core Ideas', ['Key Terms', 'Board Focus', 'Quick Recall', 'Exam Tip'])}</ReactMarkdown>
                                        )}
                                    </section>
                                    <section className="space-y-3">
                                        <h4 className="text-base font-black text-slate-900 dark:text-white">Key Terms</h4>
                                        {renderTableBlock(activeMaterial.content, 'Key Terms', ['Board Focus', 'Quick Recall', 'Exam Tip']) || (
                                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{extractMarkdownSection(activeMaterial.content, 'Key Terms', ['Board Focus', 'Quick Recall', 'Exam Tip'])}</ReactMarkdown>
                                        )}
                                    </section>
                                    <section className="space-y-3">
                                        <h4 className="text-base font-black text-slate-900 dark:text-white">Board Focus</h4>
                                        {renderTableBlock(activeMaterial.content, 'Board Focus', ['Quick Recall', 'Exam Tip']) || (
                                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{extractMarkdownSection(activeMaterial.content, 'Board Focus', ['Quick Recall', 'Exam Tip'])}</ReactMarkdown>
                                        )}
                                    </section>
                                    <section className="space-y-3">
                                        <h4 className="text-base font-black text-slate-900 dark:text-white">Quick Recall</h4>
                                        <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
                                            {formatQuickRecallBlock(extractMarkdownSection(activeMaterial.content, 'Quick Recall', ['Exam Tip']))}
                                        </ReactMarkdown>
                                    </section>
                                    <section className="space-y-3">
                                        <h4 className="text-base font-black text-slate-900 dark:text-white">Exam Tip</h4>
                                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                            {extractMarkdownSection(activeMaterial.content, 'Exam Tip', [])}
                                        </ReactMarkdown>
                                    </section>
                                </div>
                            ) : activeMaterial.type === 'formula' && activeMaterial.content ? (
                                <div className="space-y-5">
                                    <section className="space-y-3">
                                        <h4 className="text-base font-black text-slate-900 dark:text-white">Formulas</h4>
                                        {renderTableBlock(activeMaterial.content, 'Formulas', ['Definitions', 'Units', 'Common Mistakes', 'Exam Tip']) || (
                                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{extractMarkdownSection(activeMaterial.content, 'Formulas', ['Definitions', 'Units', 'Common Mistakes', 'Exam Tip'])}</ReactMarkdown>
                                        )}
                                    </section>
                                    <section className="space-y-3">
                                        <h4 className="text-base font-black text-slate-900 dark:text-white">Definitions</h4>
                                        {renderTableBlock(activeMaterial.content, 'Definitions', ['Units', 'Common Mistakes', 'Exam Tip']) || (
                                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{extractMarkdownSection(activeMaterial.content, 'Definitions', ['Units', 'Common Mistakes', 'Exam Tip'])}</ReactMarkdown>
                                        )}
                                    </section>
                                    <section className="space-y-3">
                                        <h4 className="text-base font-black text-slate-900 dark:text-white">Units</h4>
                                        {renderTableBlock(activeMaterial.content, 'Units', ['Common Mistakes', 'Exam Tip']) || (
                                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{extractMarkdownSection(activeMaterial.content, 'Units', ['Common Mistakes', 'Exam Tip'])}</ReactMarkdown>
                                        )}
                                    </section>
                                    <section className="space-y-3">
                                        <h4 className="text-base font-black text-slate-900 dark:text-white">Common Mistakes</h4>
                                        {renderTableBlock(activeMaterial.content, 'Common Mistakes', ['Exam Tip']) || (
                                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{extractMarkdownSection(activeMaterial.content, 'Common Mistakes', ['Exam Tip'])}</ReactMarkdown>
                                        )}
                                    </section>
                                    <section className="space-y-3">
                                        <h4 className="text-base font-black text-slate-900 dark:text-white">Exam Tip</h4>
                                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                            {extractMarkdownSection(activeMaterial.content, 'Exam Tip', [])}
                                        </ReactMarkdown>
                                    </section>
                                </div>
                            ) : activeMaterial.type === 'plan' && activeMaterial.content ? (
                                <div className="space-y-5">
                                    <section className="space-y-3">
                                        <h4 className="text-base font-black text-slate-900 dark:text-white">Morning Sprint</h4>
                                        {renderTableBlock(activeMaterial.content, 'Morning Sprint', ['Afternoon Deep Work', 'Evening Review', 'Priority Fixes', 'Exam Tip']) || (
                                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{extractMarkdownSection(activeMaterial.content, 'Morning Sprint', ['Afternoon Deep Work', 'Evening Review', 'Priority Fixes', 'Exam Tip'])}</ReactMarkdown>
                                        )}
                                    </section>
                                    <section className="space-y-3">
                                        <h4 className="text-base font-black text-slate-900 dark:text-white">Afternoon Deep Work</h4>
                                        {renderTableBlock(activeMaterial.content, 'Afternoon Deep Work', ['Evening Review', 'Priority Fixes', 'Exam Tip']) || (
                                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{extractMarkdownSection(activeMaterial.content, 'Afternoon Deep Work', ['Evening Review', 'Priority Fixes', 'Exam Tip'])}</ReactMarkdown>
                                        )}
                                    </section>
                                    <section className="space-y-3">
                                        <h4 className="text-base font-black text-slate-900 dark:text-white">Evening Review</h4>
                                        {renderTableBlock(activeMaterial.content, 'Evening Review', ['Priority Fixes', 'Exam Tip']) || (
                                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{extractMarkdownSection(activeMaterial.content, 'Evening Review', ['Priority Fixes', 'Exam Tip'])}</ReactMarkdown>
                                        )}
                                    </section>
                                    <section className="space-y-3">
                                        <h4 className="text-base font-black text-slate-900 dark:text-white">Priority Fixes</h4>
                                        {renderTableBlock(activeMaterial.content, 'Priority Fixes', ['Exam Tip']) || (
                                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{extractMarkdownSection(activeMaterial.content, 'Priority Fixes', ['Exam Tip'])}</ReactMarkdown>
                                        )}
                                    </section>
                                    <section className="space-y-3">
                                        <h4 className="text-base font-black text-slate-900 dark:text-white">Exam Tip</h4>
                                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                            {extractMarkdownSection(activeMaterial.content, 'Exam Tip', [])}
                                        </ReactMarkdown>
                                    </section>
                                </div>
                            ) : (
                                <div className="prose prose-slate dark:prose-invert max-w-none">
                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                        {activeMaterial.content || 'No text content available.'}
                                    </ReactMarkdown>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </Modal>

            <Modal
                isOpen={Boolean(activeBookmark)}
                onClose={() => setActiveBookmark(null)}
                title={activeBookmark ? `${activeBookmark.type.toUpperCase()} Detail` : 'Saved Item'}
                className="max-w-4xl"
            >
                {activeBookmark && (
                    <div className="space-y-5">
                        <div className="flex flex-wrap gap-2">
                            <Button variant="outline" className="rounded-xl" onClick={() => copyText(`Question:\n${activeBookmark.question || ''}\n\nAnswer:\n${activeBookmark.answer || ''}`)}>
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
                        <div className="max-h-[55vh] overflow-y-auto rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-4">
                            <div className="prose prose-slate dark:prose-invert max-w-none">
                                <p className="text-xs font-black uppercase tracking-wider text-[#1D9E75]">{activeBookmark.type}</p>
                                <h4>{activeBookmark.subject} • {activeBookmark.chapter}</h4>
                                {activeBookmark.question && <p><strong>Question:</strong> {activeBookmark.question}</p>}
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                    {activeBookmark.answer || 'No answer text available.'}
                                </ReactMarkdown>
                            </div>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
};
