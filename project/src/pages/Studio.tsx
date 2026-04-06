import { useMemo, useState } from 'react';
import { Video, Network, Sparkles, Image as ImageIcon, Layers3, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { Navbar } from '../components/layout/Navbar';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { getUser } from '../utils/storage';
import {
    generateVideoFile,
    generateMindmapImage,
} from '../api';
import { useCurriculumCatalog } from '../hooks/useCurriculumCatalog';

export const Studio = () => {
    const user = getUser();
    const classNum = (user?.class || 10).toString();
    const { subjectsForClass, chaptersForSubject } = useCurriculumCatalog(classNum);
    const subjects = subjectsForClass.length ? subjectsForClass : (user?.subjects || ['Science']);
    const [subject, setSubject] = useState(subjects[0] || 'Science');
    const chapters = useMemo(() => chaptersForSubject(subject), [chaptersForSubject, subject]);
    const [chapter, setChapter] = useState(chapters[0] || '');
    const [topic, setTopic] = useState('');
    const [brollMode, setBrollMode] = useState<'minimal' | 'balanced' | 'aggressive'>('aggressive');
    const [montageLevel, setMontageLevel] = useState<'single' | 'light' | 'dynamic'>('dynamic');
    const [minExternalSegments, setMinExternalSegments] = useState(2);

    const [videoLoading, setVideoLoading] = useState(false);
    const [videoDownloadUrl, setVideoDownloadUrl] = useState('');
    const [videoError, setVideoError] = useState('');
    const [videoMeta, setVideoMeta] = useState<{
        externalVideoCount: number;
        montageSegments: number;
        brollMode: string;
        montageLevel: string;
        minExternalSegments: number;
    } | null>(null);

    const [mindmapLoading, setMindmapLoading] = useState(false);
    const [mindmapImageUrl, setMindmapImageUrl] = useState('');
    const [mindmapNotebookBlocks, setMindmapNotebookBlocks] = useState<Array<{
        title: string;
        summary: string;
        details: string[];
        exam_link: string;
    }>>([]);
    const [imageLoading, setImageLoading] = useState(false);

    const resolvedTopic = topic.trim() || chapter || 'Core Concept';

    const runVideo = async () => {
        if (!subject.trim()) {
            toast.error('Select a subject to create video.');
            return;
        }
        if (!chapter.trim()) {
            toast.error('Select a chapter to create video.');
            return;
        }
        if (!resolvedTopic.trim()) {
            toast.error('Specify a topic to create video.');
            return;
        }

        setVideoLoading(true);
        setVideoDownloadUrl('');
        setVideoError('');
        setVideoMeta(null);
        try {
            const payload = {
                class_num: classNum,
                subject,
                chapter,
                topic: resolvedTopic,
                duration_seconds: 90,
                style: 'concept-first',
                broll_mode: brollMode,
                montage_level: montageLevel,
                min_external_segments: minExternalSegments,
            };

            let result: {
                blob: Blob;
                meta: {
                    externalVideoCount: number;
                    montageSegments: number;
                    brollMode: string;
                    montageLevel: string;
                    minExternalSegments: number;
                };
            };
            try {
                result = await generateVideoFile(payload);
            } catch {
                // Auto-retry once before surfacing an error.
                result = await generateVideoFile(payload);
            }

            const blob = result.blob;
            const url = URL.createObjectURL(blob);
            setVideoDownloadUrl(url);
            setVideoMeta(result.meta);
            const link = document.createElement('a');
            link.href = url;
            link.download = `clarity_${classNum}_${subject}_${resolvedTopic.replace(/\s+/g, '_')}.mp4`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            toast.success('Video rendered and download started.');
        } catch {
            setVideoError('Rendering failed after auto-retry. Try again with a shorter topic title.');
            toast.error('Video generation failed.');
        } finally {
            setVideoLoading(false);
        }
    };

    const runMindmapImage = async () => {
        if (!subject.trim()) {
            toast.error('Select a subject for mindmap');
            return;
        }
        if (!chapter.trim()) {
            toast.error('Select a chapter for mindmap.');
            return;
        }
        if (!resolvedTopic.trim()) {
            toast.error('Specify a topic for mindmap.');
            return;
        }

        setMindmapLoading(true);
        setImageLoading(true);
        try {
            const response = await generateMindmapImage({
                class_num: classNum,
                subject,
                chapter,
                topic: resolvedTopic,
                depth: 'balanced',
                image_style: 'clean educational diagram with labeled nodes',
            });
            setMindmapImageUrl(response.image_url);
            setMindmapNotebookBlocks(response.notebook_blocks || []);
        } catch {
            toast.error('Mindmap image URL generation failed.');
        } finally {
            setMindmapLoading(false);
            setImageLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#f8fafc] dark:bg-[#020617] transition-colors duration-300">
            <Navbar />
            <main className="max-w-7xl mx-auto px-6 py-10">
                <div className="mb-8 flex items-center justify-between gap-4 flex-wrap">
                    <div>
                        <h1 className="text-4xl font-black text-slate-900 dark:text-white">AI Studio</h1>
                        <p className="text-slate-500 font-medium mt-2">A focused workspace for lesson videos, visual mindmaps, and saved outputs.</p>
                    </div>
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 text-sm font-black">
                        <Sparkles size={16} />
                        Main output is video
                    </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-[320px_minmax(0,1fr)] gap-8 items-start">
                    <aside className="space-y-5 xl:sticky xl:top-24">
                        <Card className="p-5 bg-white dark:bg-[#0f172a] border-none shadow-xl rounded-3xl">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-11 h-11 rounded-2xl bg-[#1D9E75]/10 text-[#1D9E75] flex items-center justify-center">
                                    <Layers3 size={22} />
                                </div>
                                <div>
                                    <p className="text-xs font-black uppercase tracking-wider text-slate-400">Workspace</p>
                                    <h2 className="text-lg font-black text-slate-900 dark:text-white">Create</h2>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <label className="block">
                                    <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-2 block">Subject</span>
                                    <select
                                        value={subject}
                                        onChange={(e) => {
                                            setSubject(e.target.value);
                                            const nextChapters = chaptersForSubject(e.target.value);
                                            setChapter(nextChapters[0] || '');
                                        }}
                                        className="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold"
                                    >
                                        {subjects.map((entry) => (
                                            <option key={entry} value={entry}>{entry}</option>
                                        ))}
                                    </select>
                                </label>

                                <label className="block">
                                    <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-2 block">Chapter</span>
                                    <select
                                        value={chapter}
                                        onChange={(e) => setChapter(e.target.value)}
                                        className="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold"
                                    >
                                        {chapters.map((entry) => (
                                            <option key={entry} value={entry}>{entry}</option>
                                        ))}
                                    </select>
                                </label>

                                <label className="block">
                                    <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-2 block">Topic focus</span>
                                    <input
                                        value={topic}
                                        onChange={(e) => setTopic(e.target.value)}
                                        placeholder="Optional topic focus"
                                        className="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-semibold"
                                    />
                                </label>

                                <div className="px-4 py-3 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 font-black text-sm flex items-center gap-2">
                                    <Sparkles size={16} />
                                    Class {classNum}
                                </div>

                                <label className="block">
                                    <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-2 block">B-roll strictness</span>
                                    <select
                                        value={brollMode}
                                        onChange={(e) => setBrollMode(e.target.value as 'minimal' | 'balanced' | 'aggressive')}
                                        className="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold"
                                    >
                                        <option value="minimal">Minimal fallback</option>
                                        <option value="balanced">Balanced</option>
                                        <option value="aggressive">Aggressive external fetch</option>
                                    </select>
                                </label>

                                <label className="block">
                                    <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-2 block">Montage mode</span>
                                    <select
                                        value={montageLevel}
                                        onChange={(e) => setMontageLevel(e.target.value as 'single' | 'light' | 'dynamic')}
                                        className="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold"
                                    >
                                        <option value="single">Single clip per scene</option>
                                        <option value="light">Two-clip montage</option>
                                        <option value="dynamic">Three-clip montage</option>
                                    </select>
                                </label>

                                <label className="block">
                                    <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-2 block">Minimum external segments</span>
                                    <input
                                        type="number"
                                        min={0}
                                        max={12}
                                        value={minExternalSegments}
                                        onChange={(e) => setMinExternalSegments(Math.max(0, Number(e.target.value || 0)))}
                                        className="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold"
                                    />
                                </label>
                            </div>
                        </Card>

                        <Card className="p-5 bg-white dark:bg-[#0f172a] border-none shadow-xl rounded-3xl">
                            <p className="text-xs font-black uppercase tracking-wider text-slate-400 mb-4">Quick Actions</p>
                            <div className="space-y-2">
                                <button
                                    onClick={runVideo}
                                    disabled={videoLoading}
                                    className="w-full flex items-center justify-between px-4 py-3 rounded-2xl bg-[#1D9E75] text-white font-black hover:bg-[#16805d] transition-colors disabled:opacity-60"
                                >
                                    <span className="flex items-center gap-2">
                                        <Video size={16} />
                                        {videoLoading ? 'Rendering...' : 'Create Video'}
                                    </span>
                                    <ArrowRight size={16} />
                                </button>
                                <div className="w-full rounded-2xl border border-sky-200 dark:border-sky-800 bg-gradient-to-r from-sky-50 via-cyan-50 to-emerald-50 dark:from-sky-900/20 dark:via-cyan-900/15 dark:to-emerald-900/20 px-4 py-3">
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <p className="text-xs font-black uppercase tracking-wider text-sky-600 dark:text-sky-300">Manim Realistic Video</p>
                                            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Coming soon with cinematic lesson scenes</p>
                                        </div>
                                        <span className="px-2 py-1 rounded-full text-[11px] font-black bg-white/80 dark:bg-slate-900/70 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-700">
                                            Coming Soon
                                        </span>
                                    </div>
                                </div>
                                <button
                                    onClick={runMindmapImage}
                                    disabled={imageLoading || mindmapLoading}
                                    className="w-full flex items-center justify-between px-4 py-3 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-black hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors disabled:opacity-60"
                                >
                                    <span className="flex items-center gap-2">
                                        <ImageIcon size={16} />
                                        {imageLoading || mindmapLoading ? 'Generating...' : 'Generate Mindmap'}
                                    </span>
                                    <ArrowRight size={16} />
                                </button>
                            </div>
                        </Card>
                    </aside>

                    <section className="space-y-8">
                        <Card className="p-6 bg-white dark:bg-[#0f172a] border-none shadow-xl rounded-3xl">
                            <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
                                <div>
                                    <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                                        <Video size={20} className="text-[#1D9E75]" />
                                        Main Video
                                    </h2>
                                    <p className="text-sm text-slate-500 mt-1">The primary output is a finished lesson video. Mindmap is secondary.</p>
                                </div>
                                <Button className="rounded-xl" onClick={runVideo} disabled={videoLoading}>
                                    {videoLoading ? 'Rendering...' : 'Create MP4'}
                                </Button>
                            </div>
                            <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-6 min-h-[520px] flex items-center justify-center">
                                {videoLoading ? (
                                    <div className="w-full max-w-xl space-y-4">
                                        <div className="h-3 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                                            <div className="h-full w-1/2 bg-gradient-to-r from-[#1D9E75] to-emerald-500 animate-pulse" />
                                        </div>
                                        <p className="text-center text-sm font-bold text-slate-600 dark:text-slate-300">Rendering the lesson video. This may take a moment.</p>
                                    </div>
                                ) : videoDownloadUrl ? (
                                    <div className="w-full space-y-4">
                                        <div className="rounded-2xl border border-sky-200 dark:border-sky-800 bg-sky-50/80 dark:bg-sky-900/20 p-4">
                                            <p className="text-sm font-black text-sky-700 dark:text-sky-300">Realistic Manim Lesson Video</p>
                                            <p className="text-xs text-sky-700/80 dark:text-sky-300/80 mt-1">
                                                Coming soon. For now, this enhanced classroom MP4 is generated as the main output.
                                            </p>
                                        </div>
                                        <p className="text-sm font-black uppercase tracking-wider text-[#1D9E75]">Video ready</p>
                                        {videoMeta && (
                                            <div className="rounded-2xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/80 dark:bg-emerald-900/20 px-4 py-3 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                                                External segments: {videoMeta.externalVideoCount} • Montage segments: {videoMeta.montageSegments} • Mode: {videoMeta.brollMode}/{videoMeta.montageLevel} • Min target: {videoMeta.minExternalSegments}
                                            </div>
                                        )}
                                        <video
                                            controls
                                            className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-black"
                                            src={videoDownloadUrl}
                                        />
                                        <Button
                                            className="rounded-xl"
                                            onClick={() => {
                                                const link = document.createElement('a');
                                                link.href = videoDownloadUrl;
                                                link.download = `clarity_${classNum}_${subject}_${resolvedTopic.replace(/\s+/g, '_')}.mp4`;
                                                document.body.appendChild(link);
                                                link.click();
                                                link.remove();
                                            }}
                                        >
                                            Download MP4 Again
                                        </Button>
                                    </div>
                                ) : (
                                    <p className="text-sm text-slate-500 text-center max-w-md">
                                        Video is the main output here. Click Create MP4 to generate a finished lesson file with topic-specific content.
                                    </p>
                                )}
                                {!videoLoading && videoError && (
                                    <p className="mt-3 text-xs font-bold text-rose-600 dark:text-rose-400">{videoError}</p>
                                )}
                            </div>
                        </Card>

                        <Card className="p-6 bg-white dark:bg-[#0f172a] border-none shadow-xl rounded-3xl">
                            <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
                                <div>
                                    <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                                        <Network size={20} className="text-[#1D9E75]" />
                                        Secondary Visuals
                                    </h2>
                                    <p className="text-sm text-slate-500 mt-1">Mindmap is now a supporting visual, not the main output.</p>
                                </div>
                                <Button className="rounded-xl" onClick={runMindmapImage} disabled={imageLoading || mindmapLoading}>
                                    <ImageIcon size={16} className="mr-1" />
                                    {imageLoading || mindmapLoading ? 'Generating...' : 'Generate Mindmap'}
                                </Button>
                            </div>
                            <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-6 min-h-[240px] mb-4 flex items-center justify-center">
                                {mindmapLoading ? (
                                    <div className="w-full max-w-xl space-y-4">
                                        <div className="h-3 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                                            <div className="h-full w-1/2 bg-gradient-to-r from-[#1D9E75] to-emerald-500 animate-pulse" />
                                        </div>
                                        <p className="text-center text-sm font-bold text-slate-600 dark:text-slate-300">Generating visual mindmap...</p>
                                    </div>
                                ) : mindmapImageUrl ? (
                                    <img
                                        src={mindmapImageUrl}
                                        alt="Mindmap visual"
                                        className="w-full rounded-2xl border border-slate-200 dark:border-slate-700"
                                    />
                                ) : (
                                    <p className="text-sm text-slate-500 text-center max-w-md">Use this as a side visual after the video, not the main deliverable.</p>
                                )}
                            </div>

                            {mindmapNotebookBlocks.length > 0 && (
                                <div className="mb-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950/40 p-4">
                                    <div className="mb-3 flex items-center justify-between gap-2">
                                        <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Notebook Mindmap Mode</p>
                                        <p className="text-xs font-semibold text-slate-400">Expandable concept boxes</p>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {mindmapNotebookBlocks.map((block, index) => (
                                            <details
                                                key={`${block.title}-${index}`}
                                                className="group rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/70 p-3"
                                                open={index === 0}
                                            >
                                                <summary className="cursor-pointer list-none">
                                                    <p className="text-sm font-black text-slate-900 dark:text-white">{block.title}</p>
                                                    <p className="text-xs text-slate-500 mt-1">{block.summary}</p>
                                                </summary>
                                                <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                                                    <div className="space-y-2">
                                                        {block.details.map((detail, i) => (
                                                            <div key={i} className="rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-900/20 px-2.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200">
                                                                {detail}
                                                            </div>
                                                        ))}
                                                    </div>
                                                    <div className="mt-3 rounded-lg border border-sky-200 dark:border-sky-800 bg-sky-50/70 dark:bg-sky-900/20 px-2.5 py-2 text-xs font-bold text-sky-700 dark:text-sky-300">
                                                        Exam Link: {block.exam_link}
                                                    </div>
                                                </div>
                                            </details>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {mindmapImageUrl && (
                                <div className="flex justify-end">
                                    <Button
                                        className="rounded-xl"
                                        onClick={() => {
                                            const link = document.createElement('a');
                                            link.href = mindmapImageUrl;
                                            link.download = `mindmap_${classNum}_${subject}_${resolvedTopic.replace(/\s+/g, '_')}.png`;
                                            document.body.appendChild(link);
                                            link.click();
                                            link.remove();
                                        }}
                                    >
                                        Download Mindmap Visual
                                    </Button>
                                </div>
                            )}
                        </Card>
                    </section>
                </div>
            </main>
        </div>
    );
};
