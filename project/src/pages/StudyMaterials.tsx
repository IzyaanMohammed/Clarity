import { useMemo, useState } from 'react';
import { BookOpen, FileText, Trash2, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';
import { Navbar } from '../components/layout/Navbar';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { MarkdownContent } from '../components/ui/MarkdownContent';
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
    const videoLibraryItems = useMemo(
        () => filteredMaterials.filter((item) => item.type === 'video'),
        [filteredMaterials]
    );
    const standardMaterials = useMemo(
        () => filteredMaterials.filter((item) => item.type !== 'video'),
        [filteredMaterials]
    );
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
            <div className="overflow-x-auto rounded-2xl border-3 border-[#2C241B] shadow-neo bg-[#FCFAF8] ">
                <table className="min-w-full text-left text-sm">
                    <thead className="bg-[#F2EFE9] ">
                        <tr>
                            {table.headers.map((header) => (
                                <th key={header} className="px-4 py-3 font-black text-stone-700 whitespace-nowrap">
                                    {header}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {table.rows.map((row, rowIndex) => (
                            <tr key={rowIndex} className="border-t border-stone-100 ">
                                {row.map((cell, cellIndex) => (
                                    <td key={`${rowIndex}-${cellIndex}`} className="px-4 py-3 text-stone-700 align-top">
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

    const parseVideoLibraryPayload = (raw?: string) => {
        if (!raw) return null;
        try {
            const parsed = JSON.parse(raw) as {
                key_moments?: Array<{ coach_note?: string }>;
                quiz?: Array<unknown>;
                selected_video?: { title?: string; channel?: string };
            };
            return parsed;
        } catch {
            return null;
        }
    };

    return (
        <div className="min-h-screen bg-[#f8fafc] transition-colors duration-300">
            <Navbar />
            <main className="max-w-7xl mx-auto px-6 py-10">
                <div className="mb-8">
                    <h1 className="text-4xl font-black text-[#2C241B] ">Total Study Materials</h1>
                    <p className="text-stone-500 font-medium mt-2">All OCR notes, saved outputs, and revision materials in one place.</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <Card className="p-6 bg-[#FCFAF8] border-none shadow-xl rounded-3xl">
                        <div className="mb-4 p-4 rounded-2xl border-3 border-[#2C241B] shadow-neo bg-[#FCFAF8] ">
                            <p className="text-xs font-black uppercase tracking-wider text-[#8C5A35] mb-3">Save Online Resource</p>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                <input
                                    value={linkTitle}
                                    onChange={(e) => setLinkTitle(e.target.value)}
                                    placeholder="Resource title"
                                    className="px-3 py-2 rounded-xl border-3 border-[#2C241B] shadow-neo bg-[#FCFAF8] text-sm"
                                />
                                <input
                                    value={linkUrl}
                                    onChange={(e) => setLinkUrl(e.target.value)}
                                    placeholder="https://..."
                                    className="px-3 py-2 rounded-xl border-3 border-[#2C241B] shadow-neo bg-[#FCFAF8] text-sm md:col-span-2"
                                />
                            </div>
                            <Button className="rounded-xl mt-3" onClick={saveResourceLink}>Save Link</Button>
                        </div>

                        <div className="mb-4 p-4 rounded-2xl border-3 border-[#2C241B] shadow-neo bg-[#FCFAF8] ">
                            <p className="text-xs font-black uppercase tracking-wider text-[#8C5A35] mb-3">Search Materials</p>
                            <input
                                value={materialQuery}
                                onChange={(e) => setMaterialQuery(e.target.value)}
                                placeholder="Search title, subject, chapter, or text"
                                className="w-full px-3 py-2 rounded-xl border-3 border-[#2C241B] shadow-neo bg-[#FCFAF8] text-sm"
                            />
                        </div>

                        <h2 className="text-xl font-black text-[#2C241B] mb-4 flex items-center gap-2">
                            <BookOpen size={20} className="text-[#8C5A35]" />
                            Video Library
                        </h2>
                        <div className="space-y-3 max-h-[280px] overflow-y-auto pr-1 mb-6">
                            {videoLibraryItems.length === 0 && (
                                <p className="text-sm text-stone-500">No video cards yet. Use Studio auto-fetch to build your Video Library.</p>
                            )}
                            {videoLibraryItems.map((item) => {
                                const payload = parseVideoLibraryPayload(item.content);
                                const moments = payload?.key_moments || [];
                                const quizzes = payload?.quiz || [];
                                const topTip = moments[0]?.coach_note || 'Play, pause, and write one board-style answer from the first key moment.';
                                return (
                                    <div key={item.id} className="p-4 rounded-2xl border-3 border-[#2C241B] shadow-neo bg-[#FCFAF8] ">
                                        <div className="flex items-center justify-between gap-2">
                                            <div>
                                                <p className="text-sm font-black text-[#2C241B] ">{item.title}</p>
                                                <p className="text-xs text-stone-500 mt-1">{item.subject} • {item.chapter}</p>
                                            </div>
                                            <Button variant="ghost" className="rounded-xl" onClick={() => removeItem(item.id)}>
                                                <Trash2 size={14} />
                                            </Button>
                                        </div>
                                        {item.url && (
                                            <div className="mt-3 rounded-xl overflow-hidden border-3 border-[#2C241B] shadow-neo bg-black">
                                                <iframe
                                                    src={item.url}
                                                    title={item.title}
                                                    className="w-full aspect-video"
                                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                                    allowFullScreen
                                                />
                                            </div>
                                        )}
                                        <div className="mt-3 flex flex-wrap gap-2">
                                            <span className="px-2 py-1 rounded-lg text-[10px] font-black uppercase bg-amber-100 text-amber-700">{moments.length} tips/hints</span>
                                            <span className="px-2 py-1 rounded-lg text-[10px] font-black uppercase bg-indigo-100 text-indigo-700">{quizzes.length} quiz questions</span>
                                        </div>
                                        <p className="mt-2 text-xs text-stone-600 ">Tip: {topTip}</p>
                                    </div>
                                );
                            })}
                        </div>

                        <h2 className="text-xl font-black text-[#2C241B] mb-4 flex items-center gap-2">
                            <FileText size={20} className="text-[#8C5A35]" />
                            OCR and Saved Materials
                        </h2>
                        <div className="space-y-3 max-h-[560px] overflow-y-auto pr-1">
                            {standardMaterials.length === 0 && (
                                <p className="text-sm text-stone-500">{materialQuery ? 'No matching materials found.' : 'No materials saved yet. Use OCR page or Studio (YouTube AI + Mindmap) to store outputs.'}</p>
                            )}
                            {standardMaterials.map((item) => (
                                <div key={item.id} className="p-4 rounded-2xl border-3 border-[#2C241B] shadow-neo bg-[#FCFAF8] ">
                                    <div className="flex items-center justify-between gap-2">
                                        <div>
                                            <p className="text-sm font-black text-[#2C241B] ">{item.title}</p>
                                            <p className="text-xs text-stone-500 mt-1">{new Date(item.createdAt).toLocaleString()}</p>
                                        </div>
                                        <Button variant="ghost" className="rounded-xl" onClick={() => removeItem(item.id)}>
                                            <Trash2 size={14} />
                                        </Button>
                                    </div>
                                    {item.content && (
                                        <div className="mt-3">
                                            <p className={`text-xs text-stone-600 whitespace-pre-wrap ${expandedMaterialId === item.id ? '' : 'line-clamp-6'}`}>
                                                {item.content}
                                            </p>
                                            <Button
                                                variant="ghost"
                                                className="mt-2 h-auto px-0 text-xs font-black text-[#8C5A35]"
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
                                            className="mt-3 w-full max-h-44 object-cover rounded-xl border-3 border-[#2C241B] shadow-neo "
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

                    <Card className="p-6 bg-[#FCFAF8] border-none shadow-xl rounded-3xl">
                        <div className="mb-4 p-4 rounded-2xl border-3 border-[#2C241B] shadow-neo bg-[#FCFAF8] ">
                            <p className="text-xs font-black uppercase tracking-wider text-[#8C5A35] mb-3">Search Saved Items</p>
                            <input
                                value={bookmarkQuery}
                                onChange={(e) => setBookmarkQuery(e.target.value)}
                                placeholder="Search subject, chapter, question, or answer"
                                className="w-full px-3 py-2 rounded-xl border-3 border-[#2C241B] shadow-neo bg-[#FCFAF8] text-sm"
                            />
                        </div>

                        <h2 className="text-xl font-black text-[#2C241B] mb-4 flex items-center gap-2">
                            <BookOpen size={20} className="text-[#8C5A35]" />
                            Flashcards and Saved Answers
                        </h2>
                        <div className="space-y-3 max-h-[560px] overflow-y-auto pr-1">
                            {filteredBookmarks.length === 0 && (
                                <p className="text-sm text-stone-500">{bookmarkQuery ? 'No matching saved items found.' : 'No saved flashcards/answers yet. Save from Ask AI or Flashcards.'}</p>
                            )}
                            {filteredBookmarks.map((item) => (
                                <div key={item.id} className="p-4 rounded-2xl border-3 border-[#2C241B] shadow-neo bg-[#FCFAF8] ">
                                    <p className="text-xs font-black uppercase tracking-wider text-[#8C5A35]">{item.type}</p>
                                    <p className="text-sm font-black text-[#2C241B] mt-1">{item.subject} • {item.chapter}</p>
                                    {item.question && <p className="text-xs text-stone-600 mt-2">Q: {item.question}</p>}
                                    <div className="mt-2">
                                        <p className={`text-xs text-stone-600 whitespace-pre-wrap ${expandedBookmarkId === item.id ? '' : 'line-clamp-5'}`}>
                                            {item.answer}
                                        </p>
                                        <Button
                                            variant="ghost"
                                            className="mt-2 h-auto px-0 text-xs font-black text-[#8C5A35]"
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
                                className="w-full max-h-[320px] object-contain rounded-2xl border-3 border-[#2C241B] shadow-neo bg-[#FCFAF8] "
                            />
                        )}
                        <div className="max-h-[60vh] overflow-y-auto space-y-5 rounded-2xl border-3 border-[#2C241B] shadow-neo bg-[#FCFAF8] p-4">
                            {activeMaterial.type === 'summary' && activeMaterial.content ? (
                                <div className="space-y-5">
                                    <section className="space-y-3">
                                        <h4 className="text-base font-black text-[#2C241B] ">Core Ideas</h4>
                                        {renderTableBlock(activeMaterial.content, 'Core Ideas', ['Key Terms', 'Board Focus', 'Quick Recall', 'Exam Tip']) || (
                                            <MarkdownContent content={extractMarkdownSection(activeMaterial.content, 'Core Ideas', ['Key Terms', 'Board Focus', 'Quick Recall', 'Exam Tip'])} />
                                        )}
                                    </section>
                                    <section className="space-y-3">
                                        <h4 className="text-base font-black text-[#2C241B] ">Key Terms</h4>
                                        {renderTableBlock(activeMaterial.content, 'Key Terms', ['Board Focus', 'Quick Recall', 'Exam Tip']) || (
                                            <MarkdownContent content={extractMarkdownSection(activeMaterial.content, 'Key Terms', ['Board Focus', 'Quick Recall', 'Exam Tip'])} />
                                        )}
                                    </section>
                                    <section className="space-y-3">
                                        <h4 className="text-base font-black text-[#2C241B] ">Board Focus</h4>
                                        {renderTableBlock(activeMaterial.content, 'Board Focus', ['Quick Recall', 'Exam Tip']) || (
                                            <MarkdownContent content={extractMarkdownSection(activeMaterial.content, 'Board Focus', ['Quick Recall', 'Exam Tip'])} />
                                        )}
                                    </section>
                                    <section className="space-y-3">
                                        <h4 className="text-base font-black text-[#2C241B] ">Quick Recall</h4>
                                        <MarkdownContent content={formatQuickRecallBlock(extractMarkdownSection(activeMaterial.content, 'Quick Recall', ['Exam Tip']))} />
                                    </section>
                                    <section className="space-y-3">
                                        <h4 className="text-base font-black text-[#2C241B] ">Exam Tip</h4>
                                        <MarkdownContent content={extractMarkdownSection(activeMaterial.content, 'Exam Tip', [])} />
                                    </section>
                                </div>
                            ) : activeMaterial.type === 'formula' && activeMaterial.content ? (
                                <div className="space-y-5">
                                    <section className="space-y-3">
                                        <h4 className="text-base font-black text-[#2C241B] ">Formulas</h4>
                                        {renderTableBlock(activeMaterial.content, 'Formulas', ['Definitions', 'Units', 'Common Mistakes', 'Exam Tip']) || (
                                            <MarkdownContent content={extractMarkdownSection(activeMaterial.content, 'Formulas', ['Definitions', 'Units', 'Common Mistakes', 'Exam Tip'])} />
                                        )}
                                    </section>
                                    <section className="space-y-3">
                                        <h4 className="text-base font-black text-[#2C241B] ">Definitions</h4>
                                        {renderTableBlock(activeMaterial.content, 'Definitions', ['Units', 'Common Mistakes', 'Exam Tip']) || (
                                            <MarkdownContent content={extractMarkdownSection(activeMaterial.content, 'Definitions', ['Units', 'Common Mistakes', 'Exam Tip'])} />
                                        )}
                                    </section>
                                    <section className="space-y-3">
                                        <h4 className="text-base font-black text-[#2C241B] ">Units</h4>
                                        {renderTableBlock(activeMaterial.content, 'Units', ['Common Mistakes', 'Exam Tip']) || (
                                            <MarkdownContent content={extractMarkdownSection(activeMaterial.content, 'Units', ['Common Mistakes', 'Exam Tip'])} />
                                        )}
                                    </section>
                                    <section className="space-y-3">
                                        <h4 className="text-base font-black text-[#2C241B] ">Common Mistakes</h4>
                                        {renderTableBlock(activeMaterial.content, 'Common Mistakes', ['Exam Tip']) || (
                                            <MarkdownContent content={extractMarkdownSection(activeMaterial.content, 'Common Mistakes', ['Exam Tip'])} />
                                        )}
                                    </section>
                                    <section className="space-y-3">
                                        <h4 className="text-base font-black text-[#2C241B] ">Exam Tip</h4>
                                        <MarkdownContent content={extractMarkdownSection(activeMaterial.content, 'Exam Tip', [])} />
                                    </section>
                                </div>
                            ) : activeMaterial.type === 'plan' && activeMaterial.content ? (
                                <div className="space-y-5">
                                    <section className="space-y-3">
                                        <h4 className="text-base font-black text-[#2C241B] ">Morning Sprint</h4>
                                        {renderTableBlock(activeMaterial.content, 'Morning Sprint', ['Afternoon Deep Work', 'Evening Review', 'Priority Fixes', 'Exam Tip']) || (
                                            <MarkdownContent content={extractMarkdownSection(activeMaterial.content, 'Morning Sprint', ['Afternoon Deep Work', 'Evening Review', 'Priority Fixes', 'Exam Tip'])} />
                                        )}
                                    </section>
                                    <section className="space-y-3">
                                        <h4 className="text-base font-black text-[#2C241B] ">Afternoon Deep Work</h4>
                                        {renderTableBlock(activeMaterial.content, 'Afternoon Deep Work', ['Evening Review', 'Priority Fixes', 'Exam Tip']) || (
                                            <MarkdownContent content={extractMarkdownSection(activeMaterial.content, 'Afternoon Deep Work', ['Evening Review', 'Priority Fixes', 'Exam Tip'])} />
                                        )}
                                    </section>
                                    <section className="space-y-3">
                                        <h4 className="text-base font-black text-[#2C241B] ">Evening Review</h4>
                                        {renderTableBlock(activeMaterial.content, 'Evening Review', ['Priority Fixes', 'Exam Tip']) || (
                                            <MarkdownContent content={extractMarkdownSection(activeMaterial.content, 'Evening Review', ['Priority Fixes', 'Exam Tip'])} />
                                        )}
                                    </section>
                                    <section className="space-y-3">
                                        <h4 className="text-base font-black text-[#2C241B] ">Priority Fixes</h4>
                                        {renderTableBlock(activeMaterial.content, 'Priority Fixes', ['Exam Tip']) || (
                                            <MarkdownContent content={extractMarkdownSection(activeMaterial.content, 'Priority Fixes', ['Exam Tip'])} />
                                        )}
                                    </section>
                                    <section className="space-y-3">
                                        <h4 className="text-base font-black text-[#2C241B] ">Exam Tip</h4>
                                        <MarkdownContent content={extractMarkdownSection(activeMaterial.content, 'Exam Tip', [])} />
                                    </section>
                                </div>
                            ) : (
                                <div className="prose prose-slate max-w-none">
                                    <MarkdownContent content={activeMaterial.content || 'No text content available.'} />
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
                        <div className="max-h-[55vh] overflow-y-auto rounded-2xl border-3 border-[#2C241B] shadow-neo bg-[#FCFAF8] p-4">
                            <div className="prose prose-slate max-w-none">
                                <p className="text-xs font-black uppercase tracking-wider text-[#8C5A35]">{activeBookmark.type}</p>
                                <h4>{activeBookmark.subject} • {activeBookmark.chapter}</h4>
                                {activeBookmark.question && <p><strong>Question:</strong> {activeBookmark.question}</p>}
                                <MarkdownContent content={activeBookmark.answer || 'No answer text available.'} />
                            </div>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
};
