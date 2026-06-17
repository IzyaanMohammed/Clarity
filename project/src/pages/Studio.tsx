import { useEffect, useMemo, useRef, useState } from 'react';
import { Network, Sparkles, Image as ImageIcon, Layers3, Youtube, Brain, Play, Bookmark } from 'lucide-react';
import toast from 'react-hot-toast';
import { Navbar } from '../components/layout/Navbar';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { getUser } from '../utils/storage';
import {
    generateMindmapImage,
    getProgressAnalytics,
    getVideoLearningAssist,
    getVideoResourceStack,
    type VideoLearningAssistResponse,
    type VideoResourceStackResponse,
} from '../api';
import { useCurriculumCatalog } from '../hooks/useCurriculumCatalog';
import { addStudyMaterial, getStudyMaterials } from '../utils/storage';

export const Studio = () => {
    const user = getUser();
    const username = user?.name || 'student';
    const classNum = (user?.class || 10).toString();
    const planTier = user?.subscriptionTier || 'free';
    const videoAssistEnabled = true; // Enabled for all users in hardening phase

    const { subjectsForClass, chaptersForSubject } = useCurriculumCatalog(classNum);
    const subjects = subjectsForClass.length ? subjectsForClass : (user?.subjects || ['Science']);
    const STUDIO_SESSION_KEY = `clarity_studio_session_${username}_v2`;
    const readStudioSession = () => {
        try {
            const raw = localStorage.getItem(STUDIO_SESSION_KEY);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            return parsed && typeof parsed === 'object' ? parsed : null;
        } catch {
            return null;
        }
    };
    const storedStudioSession = readStudioSession();
    const [subject, setSubject] = useState(storedStudioSession?.subject || subjects[0] || 'Science');
    const chapters = useMemo(() => chaptersForSubject(subject), [chaptersForSubject, subject]);
    const [chapter, setChapter] = useState<string>(storedStudioSession?.chapter || chapters[0] || '');
    const [videoStack, setVideoStack] = useState<VideoResourceStackResponse | null>(storedStudioSession?.videoStack || null);
    const [loadingVideoStack, setLoadingVideoStack] = useState(false);
    const [activeVideoIndex, setActiveVideoIndex] = useState<number>(storedStudioSession?.activeVideoIndex || 0);
    const [videoAssist, setVideoAssist] = useState<VideoLearningAssistResponse | null>(storedStudioSession?.videoAssist || null);
    const [loadingVideoAssist, setLoadingVideoAssist] = useState(false);
    const [manualFetchLoading, setManualFetchLoading] = useState(false);
    const [savedVideoCount, setSavedVideoCount] = useState<number>(storedStudioSession?.savedVideoCount || 0);
    const [activeStudioTab, setActiveStudioTab] = useState<'video' | 'mindmap'>(storedStudioSession?.activeStudioTab || 'video');
    const [tutorPulse, setTutorPulse] = useState(false);
    const [playbackSeconds, setPlaybackSeconds] = useState(0);
    const [activeMomentIndex, setActiveMomentIndex] = useState(0);
    const [quizChoices, setQuizChoices] = useState<Record<number, number>>({});
    const [quizSubmitted, setQuizSubmitted] = useState(false);
    const [showQuiz, setShowQuiz] = useState(false);
    const [confusionNote, setConfusionNote] = useState('');
    const [selfConfidence, setSelfConfidence] = useState(60);

    const playerHostRef = useRef<HTMLDivElement | null>(null);
    const playerRef = useRef<any>(null);
    const playbackTimerRef = useRef<number | null>(null);
    const playerInitGuardRef = useRef(0);
    const lastVideoStackSignatureRef = useRef('');

    const playableVideos = useMemo(() => videoStack?.videos.filter((v) => v.embed_url) || [], [videoStack?.videos]);
    const activeVideo = playableVideos[activeVideoIndex] || null;

    const [mindmapLoading, setMindmapLoading] = useState(false);
    const [mindmapImageUrl, setMindmapImageUrl] = useState('');
    const [mindmapNotebookBlocks, setMindmapNotebookBlocks] = useState<Array<{
        title: string;
        summary: string;
        details: string[];
        exam_link: string;
    }>>([]);
    const [imageLoading, setImageLoading] = useState(false);

    const resolvedTopic = chapter.trim() || `${subject} core concept`;

    const VIDEO_CACHE_KEY = 'clarity_video_cache_v2';
    const AUTO_FETCH_SIGNATURE_KEY = `clarity_video_auto_fetch_signature_${username}`;

    const makeCacheKey = (params: { class_num: string; subject: string; chapter: string }) =>
        `${params.class_num}::${params.subject.trim().toLowerCase()}::${params.chapter.trim().toLowerCase()}`;

    const readVideoCache = (): Record<string, { saved_at: number; stack: VideoResourceStackResponse; assists: Record<string, VideoLearningAssistResponse> }> => {
        try {
            const raw = localStorage.getItem(VIDEO_CACHE_KEY);
            if (!raw) return {};
            const parsed = JSON.parse(raw);
            return parsed && typeof parsed === 'object' ? parsed : {};
        } catch {
            return {};
        }
    };

    const writeVideoCache = (cache: Record<string, { saved_at: number; stack: VideoResourceStackResponse; assists: Record<string, VideoLearningAssistResponse> }>) => {
        try {
            localStorage.setItem(VIDEO_CACHE_KEY, JSON.stringify(cache));
        } catch {
            // no-op
        }
    };

    const updateVideoCache = (params: {
        class_num: string;
        subject: string;
        chapter: string;
        stack?: VideoResourceStackResponse;
        assist?: VideoLearningAssistResponse;
        video_id?: string;
    }) => {
        const key = makeCacheKey(params);
        const cache = readVideoCache();
        const current = cache[key] || {
            saved_at: Date.now(),
            stack: params.stack as VideoResourceStackResponse,
            assists: {},
        };

        if (params.stack) {
            current.stack = params.stack;
        }
        if (params.assist) {
            const assistId = params.video_id || params.assist.video_id;
            if (assistId) {
                current.assists[assistId] = params.assist;
            }
        }
        current.saved_at = Date.now();
        cache[key] = current;

        const allKeys = Object.keys(cache);
        if (allKeys.length > 40) {
            allKeys
                .sort((a, b) => (cache[a].saved_at || 0) - (cache[b].saved_at || 0))
                .slice(0, allKeys.length - 40)
                .forEach((k) => delete cache[k]);
        }

        writeVideoCache(cache);
    };

    const getCachedStack = (params: { class_num: string; subject: string; chapter: string }) => {
        const cache = readVideoCache();
        const key = makeCacheKey(params);
        return cache[key] || null;
    };

    const isStudyFetchWindow = () => {
        const hour = new Date().getHours();
        return hour >= 16 && hour < 21;
    };

    const buildWeakTopicSignature = (topics: Array<{ subject?: string; chapter?: string; average_score?: number; total_attempts?: number }>) => {
        return topics
            .slice(0, 2)
            .map((topic) => [topic.subject || '', topic.chapter || '', Number(topic.average_score || 0), Number(topic.total_attempts || 0)].join('|'))
            .join('::');
    };

    const buildVideoLibraryPayload = (params: {
        source: 'manual' | 'weak-auto';
        subject: string;
        chapter: string;
        selectedVideo: Record<string, unknown>;
        stack: VideoResourceStackResponse;
        assist: VideoLearningAssistResponse | null;
    }) => {
        return {
            version: 'video-library-v1',
            source: params.source,
            subject: params.subject,
            chapter: params.chapter,
            selected_video: params.selectedVideo,
            booster: params.stack.clarity_booster,
            transcript_stats: params.assist?.transcript_stats || null,
            key_moments: params.assist?.key_moments || [],
            quiz: params.assist?.quiz || [],
            saved_at: Date.now(),
        };
    };

    const saveVideoLibraryItem = (params: {
        source: 'manual' | 'weak-auto';
        subject: string;
        chapter: string;
        stack: VideoResourceStackResponse;
        assist: VideoLearningAssistResponse | null;
    }) => {
        const firstVideo = (params.stack.videos || []).find((v) => v.embed_url) || params.stack.videos?.[0];
        if (!firstVideo) return false;

        const existing = getStudyMaterials();
        const duplicate = existing.some(
            (item) => item.type === 'video' && item.subject === params.subject && item.chapter === params.chapter && item.url === firstVideo.embed_url
        );
        if (duplicate) {
            return false;
        }

        addStudyMaterial({
            id: `video_lib_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            type: 'video',
            title: `Video Library: ${params.subject} - ${params.chapter}`,
            subject: params.subject,
            chapter: params.chapter,
            url: firstVideo.embed_url || firstVideo.url,
            content: JSON.stringify(
                buildVideoLibraryPayload({
                    source: params.source,
                    subject: params.subject,
                    chapter: params.chapter,
                    selectedVideo: firstVideo as unknown as Record<string, unknown>,
                    stack: params.stack,
                    assist: params.assist,
                })
            ),
            createdAt: Date.now(),
        });
        setSavedVideoCount((prev) => prev + 1);
        return true;
    };

    const resetVideoWorkspace = () => {
        setVideoStack(null);
        setVideoAssist(null);
        setActiveVideoIndex(0);
        setPlaybackSeconds(0);
        setActiveMomentIndex(0);
        setQuizChoices({});
        setQuizSubmitted(false);
        setShowQuiz(false);
        setConfusionNote('');
        setSelfConfidence(60);
    };

    const jumpToMoment = (seconds: number) => {
        try {
            const target = Math.max(0, Math.floor(seconds || 0));
            playerRef.current?.seekTo?.(target, true);
            setPlaybackSeconds(target);
        } catch {
            // no-op
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

    const runFetchCurrentChapterVideo = async () => {
        if (!videoAssistEnabled) {
            toast.error('YouTube AI + Video Library is available on Pro Max only.');
            return;
        }
        if (!subject.trim() || !chapter.trim()) {
            toast.error('Select subject and chapter first.');
            return;
        }

        setManualFetchLoading(true);
        setLoadingVideoStack(true);
        try {
            const cached = getCachedStack({ class_num: classNum, subject, chapter });
            if (cached?.stack) {
                setVideoStack(cached.stack);
                setActiveVideoIndex(0);
                const cachedSelected = (cached.stack.videos || []).find((v) => v.embed_url) || cached.stack.videos?.[0];
                if (cachedSelected?.video_id && cached.assists?.[cachedSelected.video_id]) {
                    setVideoAssist(cached.assists[cachedSelected.video_id]);
                }
                toast.success('Loaded cached video pack for this chapter.');
                return;
            }

            const stack = await getVideoResourceStack({
                class_num: classNum,
                subject,
                chapter,
                limit: 6,
            });
            setVideoStack(stack);
            setActiveVideoIndex(0);
            updateVideoCache({ class_num: classNum, subject, chapter, stack });

            const selected = (stack.videos || []).find((v) => v.embed_url) || stack.videos?.[0];
            let assist: VideoLearningAssistResponse | null = null;
            if (selected?.video_id || selected?.url) {
                try {
                    assist = await getVideoLearningAssist({
                        class_num: classNum,
                        subject,
                        chapter,
                        video_id: selected.video_id,
                        video_url: selected.url,
                    });
                    setVideoAssist(assist);
                    updateVideoCache({
                        class_num: classNum,
                        subject,
                        chapter,
                        assist,
                        video_id: selected.video_id,
                    });
                } catch {
                    setVideoAssist(null);
                }
            }

            const saved = saveVideoLibraryItem({
                source: 'manual',
                subject,
                chapter,
                stack,
                assist,
            });
            toast.success(saved ? 'Video fetched and saved to Video Library.' : 'Video fetched. Already present in Video Library.');
        } catch {
            toast.error('Could not fetch chapter videos right now.');
            setVideoStack(null);
        } finally {
            setManualFetchLoading(false);
            setLoadingVideoStack(false);
        }
    };

    const runAutoFetchWeakVideoLibrary = async () => {
        if (!videoAssistEnabled) {
            return;
        }
        if (!isStudyFetchWindow()) {
            return;
        }

        try {
            const analytics = await getProgressAnalytics();
            const weakTopics = (analytics.weak_topics || [])
                .filter((topic) => Number(topic.average_score || 0) <= 45 && Number(topic.total_attempts || 0) >= 2)
                .sort((left, right) => Number(left.average_score || 0) - Number(right.average_score || 0) || Number(right.total_attempts || 0) - Number(left.total_attempts || 0))
                .slice(0, 2);
            if (!weakTopics.length) {
                return;
            }

            const signature = buildWeakTopicSignature(weakTopics);
            const lastSignature = localStorage.getItem(AUTO_FETCH_SIGNATURE_KEY);
            if (lastSignature === signature) {
                return;
            }

            for (const topic of weakTopics) {
                try {
                    const topicSubject = String(topic.subject || '').trim() || subject;
                    const topicChapter = String(topic.chapter || '').trim();
                    if (!topicChapter) continue;

                    const stack = await getVideoResourceStack({
                        class_num: classNum,
                        subject: topicSubject,
                        chapter: topicChapter,
                        limit: 4,
                    });
                    updateVideoCache({ class_num: classNum, subject: topicSubject, chapter: topicChapter, stack });

                    const selected = (stack.videos || []).find((v) => v.embed_url) || stack.videos?.[0];
                    let assist: VideoLearningAssistResponse | null = null;
                    if (selected?.video_id || selected?.url) {
                        try {
                            assist = await getVideoLearningAssist({
                                class_num: classNum,
                                subject: topicSubject,
                                chapter: topicChapter,
                                video_id: selected.video_id,
                                video_url: selected.url,
                            });
                            if (assist && selected.video_id) {
                                updateVideoCache({
                                    class_num: classNum,
                                    subject: topicSubject,
                                    chapter: topicChapter,
                                    assist,
                                    video_id: selected.video_id,
                                });
                            }
                        } catch {
                            assist = null;
                        }
                    }

                    const added = saveVideoLibraryItem({
                        source: 'weak-auto',
                        subject: topicSubject,
                        chapter: topicChapter,
                        stack,
                        assist,
                    });
                    void added;
                } catch {
                    // Continue weak-topic auto-fetch even if one topic fails.
                }
            }

            localStorage.setItem(AUTO_FETCH_SIGNATURE_KEY, signature);

        } catch {
            // Silent background fetch: do not surface this to students.
        }
    };

    const saveCurrentVideoToLibrary = () => {
        if (!videoAssistEnabled) {
            toast.error('Saving to Video Library is Pro Max only.');
            return;
        }
        if (!videoStack) {
            toast.error('Fetch a video first.');
            return;
        }
        const saved = saveVideoLibraryItem({
            source: 'manual',
            subject,
            chapter,
            stack: videoStack,
            assist: videoAssist,
        });
        toast.success(saved ? 'Saved to Video Library.' : 'Already saved in Video Library.');
    };
    // 
    // const showNextVideo = () => {
    //     if (!playableVideos.length) {
    //         toast.error('No videos loaded yet. Fetch first.');
    //         return;
    //     }
    //     setActiveVideoIndex((prev) => (prev + 1) % playableVideos.length);
    // };

    useEffect(() => {
        if (!videoAssistEnabled) return;
        if (!user?.name) return;
        runAutoFetchWeakVideoLibrary();
    }, [videoAssistEnabled, user?.name]);

    useEffect(() => {
        const signature = `${videoStack?.subject || ''}::${videoStack?.chapter || ''}`;
        if (!signature) {
            lastVideoStackSignatureRef.current = '';
            return;
        }
        if (!lastVideoStackSignatureRef.current) {
            lastVideoStackSignatureRef.current = signature;
            return;
        }
        if (lastVideoStackSignatureRef.current === signature) {
            return;
        }

        lastVideoStackSignatureRef.current = signature;
        setActiveVideoIndex(0);
        setVideoAssist(null);
        setPlaybackSeconds(0);
        setActiveMomentIndex(0);
        setQuizChoices({});
        setQuizSubmitted(false);
        setShowQuiz(false);
        setConfusionNote('');
        setSelfConfidence(60);
    }, [videoStack?.chapter, videoStack?.subject]);

    useEffect(() => {
        if (activeVideoIndex >= playableVideos.length) {
            setActiveVideoIndex(0);
        }
    }, [activeVideoIndex, playableVideos.length]);

    useEffect(() => {
        if (!subjects.length) return;
        if (!subjects.includes(subject)) {
            setSubject(subjects[0]);
        }
    }, [subjects, subject]);

    useEffect(() => {
        if (!chapters.length) return;
        if (!chapters.includes(chapter)) {
            setChapter(chapters[0] || '');
        }
    }, [chapters, chapter]);

    useEffect(() => {
        if (!subject || !chapter) return;
        if (videoStack && videoStack.subject === subject && videoStack.chapter === chapter) {
            return;
        }

        const cached = getCachedStack({ class_num: classNum, subject, chapter });
        if (cached?.stack) {
            setVideoStack(cached.stack);
            setActiveVideoIndex(0);
            return;
        }

        const autoFetch = async () => {
            setLoadingVideoStack(true);
            try {
                const stack = await getVideoResourceStack({
                    class_num: classNum,
                    subject,
                    chapter,
                    limit: 6,
                });
                setVideoStack(stack);
                setActiveVideoIndex(0);
                updateVideoCache({ class_num: classNum, subject, chapter, stack });
            } catch (err) {
                console.error("Auto-fetch videos failed:", err);
            } finally {
                setLoadingVideoStack(false);
            }
        };
        autoFetch();
    }, [subject, chapter, classNum]);

    useEffect(() => {
        try {
            localStorage.setItem(STUDIO_SESSION_KEY, JSON.stringify({
                subject,
                chapter,
                activeStudioTab,
                activeVideoIndex,
                videoStack,
                videoAssist,
                savedVideoCount,
            }));
        } catch {
            // no-op
        }
    }, [subject, chapter, activeStudioTab, activeVideoIndex, videoStack, videoAssist, savedVideoCount]);

    useEffect(() => {
        if (!videoAssistEnabled || !activeVideo || !chapter) {
            setVideoAssist(null);
            return;
        }
        const loadAssist = async () => {
            setLoadingVideoAssist(true);
            const cachedAssist = getCachedStack({ class_num: classNum, subject, chapter })?.assists?.[activeVideo.video_id || ''];
            if (cachedAssist) {
                setVideoAssist(cachedAssist);
                setActiveMomentIndex(0);
                setQuizChoices({});
                setQuizSubmitted(false);
                setShowQuiz(false);
                setLoadingVideoAssist(false);
                return;
            }
            try {
                const response = await getVideoLearningAssist({
                    class_num: classNum,
                    subject,
                    chapter,
                    video_id: activeVideo.video_id,
                    video_url: activeVideo.url,
                });
                setVideoAssist(response);
                setActiveMomentIndex(0);
                setQuizChoices({});
                setQuizSubmitted(false);
                setShowQuiz(false);
                updateVideoCache({
                    class_num: classNum,
                    subject,
                    chapter,
                    assist: response,
                    video_id: activeVideo.video_id,
                });
            } catch {
                if (!cachedAssist) {
                    setVideoAssist(null);
                }
            } finally {
                setLoadingVideoAssist(false);
            }
        };
        loadAssist();
    }, [activeVideo?.video_id, activeVideo?.url, classNum, subject, chapter, videoAssistEnabled]);

    useEffect(() => {
        const moment = videoAssist?.key_moments?.[activeMomentIndex];
        if (!moment || !Number(moment.timestamp_seconds || 0)) return;
        const delta = Math.abs(playbackSeconds - Number(moment.timestamp_seconds || 0));
        if (delta <= 1) {
            setTutorPulse(true);
            const t = window.setTimeout(() => setTutorPulse(false), 850);
            return () => window.clearTimeout(t);
        }
        return undefined;
    }, [activeMomentIndex, playbackSeconds, videoAssist?.key_moments]);

    useEffect(() => {
        if (!videoAssist?.key_moments?.length) {
            setActiveMomentIndex(0);
            return;
        }
        const moments = videoAssist.key_moments;
        const hasTimestamps = moments.some(m => Number(m.timestamp_seconds || 0) > 0);
        if (!hasTimestamps) return;
        let idx = 0;
        for (let i = 0; i < moments.length; i += 1) {
            if (playbackSeconds >= moments[i].timestamp_seconds) {
                idx = i;
            } else {
                break;
            }
        }
        setActiveMomentIndex(idx);
    }, [playbackSeconds, videoAssist?.key_moments]);

    useEffect(() => {
        const stopPlaybackTimer = () => {
            if (playbackTimerRef.current) {
                window.clearInterval(playbackTimerRef.current);
                playbackTimerRef.current = null;
            }
        };

        const destroyPlayer = () => {
            stopPlaybackTimer();
            if (playerRef.current && typeof playerRef.current.destroy === 'function') {
                playerRef.current.destroy();
            }
            playerRef.current = null;
        };

        const startPlaybackTimer = () => {
            stopPlaybackTimer();
            playbackTimerRef.current = window.setInterval(() => {
                try {
                    const seconds = Number(playerRef.current?.getCurrentTime?.() || 0);
                    setPlaybackSeconds(Math.max(0, Math.floor(seconds)));
                } catch {
                    // no-op
                }
            }, 700);
        };

        const initPlayer = () => {
            if (!activeVideo?.video_id || !playerHostRef.current || !(window as any).YT?.Player) {
                return;
            }

            playerInitGuardRef.current += 1;
            const guard = playerInitGuardRef.current;
            destroyPlayer();

            // Recreate the player element inside the host container to avoid DOM removal issues
            playerHostRef.current.innerHTML = '<div class="w-full h-full aspect-video min-h-[600px]" id="clarity-yt-player-element"></div>';
            const targetEl = document.getElementById('clarity-yt-player-element');
            if (!targetEl) return;

            playerRef.current = new (window as any).YT.Player(targetEl, {
                width: '100%',
                height: '100%',
                videoId: activeVideo.video_id,
                playerVars: {
                    rel: 0,
                    modestbranding: 1,
                    playsinline: 1,
                    enablejsapi: 1,
                },
                events: {
                    onReady: () => {
                        if (guard !== playerInitGuardRef.current) return;
                        setPlaybackSeconds(0);
                    },
                    onStateChange: (event: any) => {
                        if (guard !== playerInitGuardRef.current) return;
                        const YT = (window as any).YT;
                        if (event.data === YT.PlayerState.PLAYING) {
                            startPlaybackTimer();
                        } else if (event.data === YT.PlayerState.ENDED) {
                            stopPlaybackTimer();
                            setShowQuiz(true);
                        } else {
                            stopPlaybackTimer();
                        }
                    },
                },
            });
        };

        if (!activeVideo?.video_id) {
            destroyPlayer();
            return () => destroyPlayer();
        }

        if ((window as any).YT?.Player) {
            initPlayer();
            return () => destroyPlayer();
        }

        const scriptId = 'clarity-youtube-iframe-api';
        let script = document.getElementById(scriptId) as HTMLScriptElement | null;
        if (!script) {
            script = document.createElement('script');
            script.id = scriptId;
            script.src = 'https://www.youtube.com/iframe_api';
            script.async = true;
            document.body.appendChild(script);
        }

        const waiter = window.setInterval(() => {
            if ((window as any).YT?.Player) {
                window.clearInterval(waiter);
                initPlayer();
            }
        }, 250);

        return () => {
            window.clearInterval(waiter);
            destroyPlayer();
        };
    }, [activeVideo?.video_id]);

    // Mark unused variables as read for TypeScript compiler
    void planTier;
    void loadingVideoAssist;
    void quizChoices;
    void quizSubmitted;
    void showQuiz;
    void confusionNote;
    void selfConfidence;

    return (
        <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(29,158,117,0.08),_transparent_32%),linear-gradient(180deg,_#f8fafc_0%,_#f6f8fb_48%,_#eef2f7_100%)] dark:bg-[radial-gradient(circle_at_top_left,_rgba(29,158,117,0.10),_transparent_28%),linear-gradient(180deg,_#020617_0%,_#07111f_100%)] transition-colors duration-300">
            <Navbar />
            <main className="max-w-[1600px] mx-auto px-4 md:px-6 py-6 md:py-8">
                <div className="mb-4 flex items-center justify-between gap-4 flex-wrap">
                    <div>
                        <p className="text-[11px] font-black uppercase tracking-[0.28em] text-[#1D9E75] mb-1">Workspace / Class {classNum}</p>
                        <h1 className="text-4xl font-black text-slate-900 dark:text-white">Studio</h1>
                    </div>
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 text-sm font-black border border-emerald-200 dark:border-emerald-800 shadow-sm">
                        <Sparkles size={16} />
                        Notebook Tutor Mode
                    </div>
                </div>

                <Card className="mb-6 p-4 md:p-5 bg-white/92 dark:bg-[#0f172a] border-none shadow-xl rounded-[28px] backdrop-blur-sm">
                    <div className="grid grid-cols-1 md:grid-cols-[1.1fr_1.1fr_1fr_auto] gap-3 items-end">
                        <label className="block">
                            <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-2 block">Subject</span>
                            <select
                                value={subject}
                                onChange={(e) => {
                                    setSubject(e.target.value);
                                    const nextChapters = chaptersForSubject(e.target.value);
                                    setChapter(nextChapters[0] || '');
                                    resetVideoWorkspace();
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
                                onChange={(e) => {
                                    setChapter(e.target.value);
                                    resetVideoWorkspace();
                                }}
                                className="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold"
                            >
                                {chapters.map((entry) => (
                                    <option key={entry} value={entry}>{entry}</option>
                                ))}
                            </select>
                        </label>
                        <div>
                            <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-2 block">Topic Focus</span>
                            <div className="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-semibold text-slate-700 dark:text-slate-200">
                                Auto from selected chapter
                            </div>
                        </div>
                        <div className="inline-flex items-center gap-2 px-4 py-3 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 font-black text-sm">
                            <Layers3 size={16} />
                            Create Workspace
                        </div>
                    </div>

                    <div className="mt-4 flex items-center justify-between gap-3 flex-wrap">
                        <div className="inline-flex rounded-full border border-slate-200 dark:border-slate-700 bg-white/85 dark:bg-slate-900/80 backdrop-blur-sm p-1 shadow-sm">
                            <button
                                onClick={() => setActiveStudioTab('video')}
                                className={`px-4 py-2 rounded-full text-sm font-black transition-all ${activeStudioTab === 'video' ? 'bg-[#1D9E75] text-white shadow-md' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                            >
                                Video Assistant
                            </button>
                            <button
                                onClick={() => setActiveStudioTab('mindmap')}
                                className={`px-4 py-2 rounded-full text-sm font-black transition-all ${activeStudioTab === 'mindmap' ? 'bg-[#1D9E75] text-white shadow-md' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                            >
                                Mindmap
                            </button>
                        </div>
                        <p className="text-xs font-black text-slate-500">Saved this session: {savedVideoCount} video card(s)</p>
                    </div>
                </Card>

                <section className="space-y-8">
                    {activeStudioTab === 'video' ? (
                        <Card className="p-5 md:p-6 bg-white/92 dark:bg-[#0f172a] border-none shadow-xl rounded-[34px] backdrop-blur-sm">
                            <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
                                <div>
                                    <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                                        <Youtube size={20} className="text-[#1D9E75]" />
                                        YouTube AI Assistant
                                    </h2>
                                    <p className="text-sm text-slate-500 mt-1">Pro Max only. Fetch by click and save into Video Library.</p>
                                </div>
                            </div>

                            {!videoStack && !loadingVideoStack && (
                                <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-4 mb-4">
                                    <p className="text-sm text-slate-600 dark:text-slate-300">No video loaded yet. Click <span className="font-black">Fetch Current Chapter Video</span> to start.</p>
                                </div>
                            )}

                            {loadingVideoStack ? (
                                <p className="text-sm text-slate-500">Finding best videos and preparing learning assist...</p>
                            ) : !videoStack ? (
                                <div>
                                    <p className="text-sm text-slate-500 mb-4">No video stack available for this chapter right now.</p>
                                    <button onClick={runFetchCurrentChapterVideo} disabled={manualFetchLoading} className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-[#1D9E75] text-white font-black hover:bg-[#16805d] transition-colors disabled:opacity-60">
                                        <Youtube size={20} />
                                        {manualFetchLoading ? 'Fetching video...' : 'Fetch Current Chapter Video'}
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-8">
                                    {/* Top: Massive Full-Width Video Player */}
                                    <div className="w-full">
                                        <div className="rounded-[42px] overflow-hidden border border-slate-200 dark:border-slate-700 bg-black shadow-[0_40px_120px_rgba(15,23,42,0.25)]">
                                            <div ref={playerHostRef} className="w-full aspect-video min-h-[600px]" />
                                        </div>
                                        
                                        <div className="mt-8 flex flex-col lg:flex-row gap-8 items-start">
                                            {/* Left: Video Details & Coach */}
                                            <div className="flex-1 space-y-6">
                                                <div className="px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                                    <div>
                                                        <h2 className="text-3xl font-black text-slate-900 dark:text-white">
                                                            {playableVideos[activeVideoIndex]?.title || 'Loading video...'}
                                                        </h2>
                                                        <p className="text-sm text-slate-500 mt-2 flex items-center gap-2">
                                                            <Youtube size={16} className="text-rose-500" />
                                                            {playableVideos[activeVideoIndex]?.channel || 'YouTube'}
                                                        </p>
                                                    </div>
                                                    <Button 
                                                        onClick={saveCurrentVideoToLibrary}
                                                        variant="primary"
                                                        className="rounded-2xl px-6 py-3 font-black flex items-center gap-2 shadow-lg shadow-[#1D9E75]/20 hover:scale-[1.02] active:scale-[0.98] transition-all whitespace-nowrap self-start sm:self-auto"
                                                    >
                                                        <Bookmark size={18} />
                                                        Save Video
                                                    </Button>
                                                </div>

                                                {/* Live Clarity Coach (Full Width below video) */}
                                                <div className={`rounded-[32px] border p-8 transition-all ${tutorPulse ? 'border-emerald-400 bg-emerald-100/85 dark:bg-emerald-900/30 shadow-lg shadow-emerald-500/10' : 'border-slate-200 dark:border-slate-800 bg-white/92 dark:bg-[#0f172a] shadow-xl rounded-[34px] backdrop-blur-sm'}`}>
                                                    <div className="flex items-center justify-between gap-4 mb-6">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-10 h-10 rounded-2xl bg-[#1D9E75] text-white flex items-center justify-center shadow-md">
                                                                <Brain size={20} />
                                                            </div>
                                                            <div>
                                                                <p className="text-[10px] font-black uppercase tracking-widest text-[#1D9E75]">Live Clarity Coach</p>
                                                                <h3 className="text-xl font-black text-slate-900 dark:text-white">Unexpected Tricky Points & Board Exam Traps</h3>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <div className={`w-3.5 h-3.5 rounded-full ${tutorPulse ? 'bg-emerald-500 animate-pulse' : 'bg-slate-350 dark:bg-slate-600'}`} />
                                                            <span className="text-xs font-black uppercase tracking-wider text-slate-500">Live Sync</span>
                                                        </div>
                                                    </div>

                                                    {loadingVideoAssist ? (
                                                        <div className="py-12 text-center flex flex-col items-center justify-center">
                                                            <div className="w-10 h-10 rounded-full border-4 border-[#1D9E75] border-t-transparent animate-spin mb-4" />
                                                            <p className="text-xs font-black uppercase tracking-widest text-slate-500 animate-pulse">Syncing Board Insights & Hints...</p>
                                                        </div>
                                                    ) : videoAssist?.key_moments?.[activeMomentIndex] ? (
                                                        <div className="space-y-6">
                                                            {/* Subtopic header */}
                                                            <div className="border-b border-slate-100 dark:border-slate-800/80 pb-3 flex items-center justify-between gap-3 flex-wrap">
                                                                <h4 className="text-lg font-black text-slate-950 dark:text-white">
                                                                    {videoAssist.key_moments[activeMomentIndex].subtopic}
                                                                </h4>
                                                                {videoAssist.key_moments[activeMomentIndex].timestamp_label && (
                                                                    <span className="px-3 py-1 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 text-xs font-black uppercase tracking-wider border border-indigo-200/20 dark:border-indigo-800/20">
                                                                        Timestamp: {videoAssist.key_moments[activeMomentIndex].timestamp_label}
                                                                    </span>
                                                                )}
                                                            </div>

                                                            {/* Grid of details */}
                                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                                {/* Left Panel: Hint and Explanation */}
                                                                <div className="space-y-4">
                                                                    <div className="p-5 rounded-2xl bg-[#1D9E75]/10 dark:bg-[#1D9E75]/5 border border-[#1D9E75]/35">
                                                                        <p className="text-xs font-black uppercase tracking-wider text-[#1D9E75] mb-2 flex items-center gap-1.5">
                                                                            <Sparkles size={14} className="animate-pulse" />
                                                                            Live Coach Action Tip
                                                                        </p>
                                                                        <p className="text-base font-bold text-slate-800 dark:text-slate-200 leading-relaxed italic">
                                                                            "{videoAssist.key_moments[activeMomentIndex].coach_note}"
                                                                        </p>
                                                                    </div>

                                                                    <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                                                                        <p className="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">
                                                                            Core Concept Explanation
                                                                        </p>
                                                                        <p className="text-sm font-bold text-slate-700 dark:text-slate-350 leading-relaxed">
                                                                            {videoAssist.key_moments[activeMomentIndex].important_point}
                                                                        </p>
                                                                        
                                                                        {/* Keywords */}
                                                                        {videoAssist.key_moments[activeMomentIndex].keywords && videoAssist.key_moments[activeMomentIndex].keywords.length > 0 && (
                                                                            <div className="mt-4 flex flex-wrap gap-1.5 items-center">
                                                                                <span className="text-[10px] font-black uppercase text-slate-400 mr-1">Keywords:</span>
                                                                                {videoAssist.key_moments[activeMomentIndex].keywords.map((kw: string, idx: number) => (
                                                                                    <span key={idx} className="px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 text-[10px] font-black uppercase tracking-wider border border-emerald-250 dark:border-emerald-800/50">
                                                                                        {kw}
                                                                                    </span>
                                                                                ))}
                                                                            </div>
                                                                        )}
                                                                    </div>

                                                                    {videoAssist.key_moments[activeMomentIndex].exam_answer_frame && (
                                                                        <div className="p-5 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/10 border border-indigo-100/50 dark:border-indigo-900/50">
                                                                            <p className="text-xs font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400 mb-2">
                                                                                CBSE Board Answer Frame
                                                                            </p>
                                                                            <p className="text-sm font-bold text-slate-700 dark:text-slate-350 leading-relaxed">
                                                                                {videoAssist.key_moments[activeMomentIndex].exam_answer_frame}
                                                                            </p>
                                                                        </div>
                                                                    )}
                                                                </div>

                                                                {/* Right Panel: Trap and Mnemonic */}
                                                                <div className="space-y-4">
                                                                    {videoAssist.key_moments[activeMomentIndex].common_trap && (
                                                                        <div className="p-5 rounded-2xl bg-amber-50 dark:bg-amber-950/20 border border-amber-250 dark:border-amber-800">
                                                                            <p className="text-xs font-black uppercase tracking-wider text-amber-600 dark:text-amber-400 mb-2 flex items-center gap-1.5">
                                                                                ⚠️ Common Board Exam Trap
                                                                            </p>
                                                                            <p className="text-sm font-bold text-slate-800 dark:text-slate-200 leading-relaxed">
                                                                                {videoAssist.key_moments[activeMomentIndex].common_trap}
                                                                            </p>
                                                                        </div>
                                                                    )}

                                                                    {videoAssist.key_moments[activeMomentIndex].memory_hook && (
                                                                        <div className="p-5 rounded-2xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-250/50 dark:border-rose-800/50">
                                                                            <p className="text-xs font-black uppercase tracking-wider text-rose-600 dark:text-rose-400 mb-2 flex items-center gap-1.5">
                                                                                🧠 Memory Hook & Recall Cue
                                                                            </p>
                                                                            <p className="text-sm font-bold text-slate-800 dark:text-slate-200 leading-relaxed italic">
                                                                                "{videoAssist.key_moments[activeMomentIndex].memory_hook}"
                                                                            </p>
                                                                        </div>
                                                                    )}

                                                                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 text-xs text-slate-500 font-semibold flex items-center justify-between gap-3 flex-wrap">
                                                                        <span>Live moments sync with your playback automatically.</span>
                                                                        <div className="flex gap-2">
                                                                            <button 
                                                                                disabled={activeMomentIndex === 0}
                                                                                onClick={() => {
                                                                                    const prevMoment = videoAssist.key_moments[activeMomentIndex - 1];
                                                                                    if (prevMoment) jumpToMoment(prevMoment.timestamp_seconds);
                                                                                }}
                                                                                className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 disabled:opacity-50 font-black text-[11px] uppercase tracking-wider hover:bg-slate-50 dark:hover:bg-slate-700"
                                                                            >
                                                                                Prev
                                                                            </button>
                                                                            <button 
                                                                                disabled={activeMomentIndex === videoAssist.key_moments.length - 1}
                                                                                onClick={() => {
                                                                                    const nextMoment = videoAssist.key_moments[activeMomentIndex + 1];
                                                                                    if (nextMoment) jumpToMoment(nextMoment.timestamp_seconds);
                                                                                }}
                                                                                className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 disabled:opacity-50 font-black text-[11px] uppercase tracking-wider hover:bg-slate-50 dark:hover:bg-slate-700"
                                                                            >
                                                                                Next
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="py-12 text-center flex flex-col items-center justify-center">
                                                            <Sparkles className="mx-auto text-slate-350 dark:text-slate-600 mb-4 animate-spin-slow" size={40} />
                                                            <p className="text-xs font-black uppercase tracking-widest text-slate-500">Generating smart hints...</p>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Right: Mastery Timeline (Side of Coach) */}
                                            {videoAssist?.key_moments && videoAssist.key_moments.length > 0 && (
                                                <div className="w-full lg:w-[400px] rounded-[32px] border border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-slate-900/20 p-7">
                                                    <p className="text-xs font-black uppercase tracking-wider text-slate-500 mb-5">Points to Remember</p>
                                                    <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                                                        {videoAssist.key_moments.map((moment, idx) => (
                                                            <button
                                                                key={idx}
                                                                onClick={() => {
                                                                    setActiveMomentIndex(idx);
                                                                    if (Number(moment.timestamp_seconds || 0) > 0) {
                                                                        jumpToMoment(moment.timestamp_seconds);
                                                                    }
                                                                }}
                                                                className={`w-full text-left p-4 rounded-2xl border transition-all ${activeMomentIndex === idx
                                                                    ? 'bg-white dark:bg-slate-800 border-indigo-200 dark:border-indigo-700 shadow-md ring-2 ring-indigo-500/10'
                                                                    : 'bg-transparent border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/50'
                                                                    }`}
                                                            >
                                                                <p className={`text-[10px] font-black uppercase ${activeMomentIndex === idx ? 'text-indigo-600' : 'text-slate-400'}`}>
                                                                    Point to Remember {idx + 1}{moment.timestamp_label ? ` • ${moment.timestamp_label}` : ''} • {moment.subtopic}
                                                                </p>
                                                                <p className="text-sm font-bold text-slate-900 dark:text-white mt-1 leading-tight">{moment.important_point}</p>
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Interactive Concept Check Quiz Section */}
                                    {videoAssist?.quiz && videoAssist.quiz.length > 0 && (
                                        <div className="pt-10 mt-10 border-t border-slate-250 dark:border-slate-800/80">
                                            <div className="rounded-[36px] bg-slate-950 text-white p-8 md:p-10 shadow-2xl relative overflow-hidden border border-slate-800">
                                                <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-emerald-500/10 to-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
                                                
                                                <div className="relative flex items-center justify-between gap-4 mb-8 flex-wrap">
                                                    <div>
                                                        <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-black uppercase tracking-wider border border-emerald-500/30">
                                                            Concept Check
                                                        </span>
                                                        <h3 className="text-2xl font-black mt-2">Active Learning Checkpoint</h3>
                                                        <p className="text-slate-400 text-sm mt-1">Answer these board-aligned questions based on the video lesson.</p>
                                                    </div>
                                                    
                                                    {quizSubmitted && (
                                                        <div className="px-5 py-2.5 rounded-2xl bg-white/10 border border-white/20 text-white font-black text-sm flex items-center gap-2">
                                                            <Brain size={18} className="text-emerald-400" />
                                                            Score: {
                                                                Object.keys(quizChoices).reduce((acc, qIdxStr) => {
                                                                    const qIdx = parseInt(qIdxStr);
                                                                    const correctIndex = videoAssist.quiz[qIdx].answer_index;
                                                                    return acc + (quizChoices[qIdx] === correctIndex ? 1 : 0);
                                                                }, 0)
                                                            } / {videoAssist.quiz.length} Correct
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="space-y-8 relative">
                                                    {videoAssist.quiz.map((q, qIdx) => {
                                                        const selectedOpt = quizChoices[qIdx];
                                                        const correctIndex = q.answer_index;
                                                        
                                                        return (
                                                            <div key={qIdx} className="p-6 rounded-3xl bg-white/5 border border-white/10 space-y-4">
                                                                <h4 className="text-base font-bold text-slate-100 flex items-start gap-2.5">
                                                                    <span className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs font-black shrink-0">
                                                                        {qIdx + 1}
                                                                    </span>
                                                                    {q.question}
                                                                </h4>
                                                                
                                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                                    {q.options.map((opt, optIdx) => {
                                                                        const isSelected = selectedOpt === optIdx;
                                                                        const isCorrect = correctIndex === optIdx;
                                                                        
                                                                        let btnStyle = "bg-white/5 border-white/10 text-slate-300 hover:bg-white/10";
                                                                        
                                                                        if (quizSubmitted) {
                                                                            if (isCorrect) {
                                                                                btnStyle = "bg-emerald-500/20 border-emerald-500 text-emerald-300 pointer-events-none";
                                                                            } else if (isSelected) {
                                                                                btnStyle = "bg-rose-500/20 border-rose-500 text-rose-300 pointer-events-none";
                                                                            } else {
                                                                                btnStyle = "bg-white/5 border-white/10 text-slate-500 opacity-60 pointer-events-none";
                                                                            }
                                                                        } else if (isSelected) {
                                                                            btnStyle = "bg-emerald-500/20 border-emerald-500 text-white font-bold ring-2 ring-emerald-500/20";
                                                                        }
                                                                        
                                                                        return (
                                                                            <button
                                                                                key={optIdx}
                                                                                disabled={quizSubmitted}
                                                                                onClick={() => {
                                                                                    setQuizChoices(prev => ({
                                                                                        ...prev,
                                                                                        [qIdx]: optIdx
                                                                                    }));
                                                                                }}
                                                                                className={`w-full text-left px-5 py-3.5 rounded-2xl border transition-all text-sm font-semibold flex items-center justify-between ${btnStyle}`}
                                                                            >
                                                                                <span>{opt}</span>
                                                                                {quizSubmitted && isCorrect && (
                                                                                    <span className="text-emerald-400 font-bold">✓ Correct</span>
                                                                                )}
                                                                                {quizSubmitted && isSelected && !isCorrect && (
                                                                                    <span className="text-rose-400 font-bold">✗ Incorrect</span>
                                                                                )}
                                                                            </button>
                                                                        );
                                                                    })}
                                                                </div>
                                                                
                                                                {quizSubmitted && q.explanation && (
                                                                    <div className="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-xs text-indigo-300 font-medium leading-relaxed">
                                                                        <span className="font-black block mb-1 text-slate-200">Explanation:</span>
                                                                        {q.explanation}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>

                                                <div className="mt-8 flex justify-end gap-3">
                                                    {quizSubmitted ? (
                                                        <button
                                                            onClick={() => {
                                                                setQuizChoices({});
                                                                setQuizSubmitted(false);
                                                            }}
                                                            className="px-6 py-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-black text-sm transition-all border border-white/20"
                                                        >
                                                            Reset Quiz
                                                        </button>
                                                    ) : (
                                                        <button
                                                            disabled={Object.keys(quizChoices).length < videoAssist.quiz.length}
                                                            onClick={() => setQuizSubmitted(true)}
                                                            className="px-6 py-3 rounded-2xl bg-[#1D9E75] hover:bg-[#16805d] text-white font-black text-sm transition-all disabled:opacity-50 disabled:pointer-events-none shadow-lg shadow-emerald-500/20"
                                                        >
                                                            Submit Answers
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Bottom: Massive Video Library Grid */}
                                    <div className="pt-12 border-t border-slate-200 dark:border-slate-800">
                                        <div className="flex items-end justify-between gap-4 mb-8">
                                            <div>
                                                <p className="text-xs font-black uppercase tracking-[0.2em] text-[#1D9E75] mb-2">Video Library</p>
                                                <h2 className="text-3xl font-black text-slate-900 dark:text-white">Recommended Resources</h2>
                                            </div>
                                            <button onClick={runFetchCurrentChapterVideo} disabled={manualFetchLoading} className="px-6 py-3 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-black text-xs uppercase tracking-widest hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors disabled:opacity-50">
                                                {manualFetchLoading ? 'Refreshing...' : 'Refresh Stack'}
                                            </button>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                            {playableVideos.map((video, idx) => (
                                                <button
                                                    key={video.video_id}
                                                    onClick={() => setActiveVideoIndex(idx)}
                                                    className={`group text-left rounded-[32px] border-2 transition-all overflow-hidden ${idx === activeVideoIndex
                                                        ? 'border-[#1D9E75] bg-emerald-50/50 dark:bg-emerald-900/10 shadow-xl shadow-emerald-500/10'
                                                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40 hover:border-slate-300'
                                                        }`}
                                                >
                                                    <div className="aspect-video bg-slate-100 dark:bg-slate-800 relative">
                                                        <img
                                                            src={`https://img.youtube.com/vi/${video.video_id}/maxresdefault.jpg`}
                                                            alt={video.title}
                                                            className="w-full h-full object-cover"
                                                            onError={(e) => {
                                                                (e.target as HTMLImageElement).src = `https://img.youtube.com/vi/${video.video_id}/0.jpg`;
                                                            }}
                                                        />
                                                        {idx === activeVideoIndex && (
                                                            <div className="absolute inset-0 bg-emerald-500/10 flex items-center justify-center backdrop-blur-[2px]">
                                                                <div className="w-12 h-12 rounded-full bg-white text-[#1D9E75] flex items-center justify-center shadow-lg">
                                                                    <Play fill="currentColor" size={24} />
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="p-6">
                                                        <h3 className="text-base font-black text-slate-900 dark:text-white line-clamp-2 leading-tight group-hover:text-[#1D9E75] transition-colors">
                                                            {video.title}
                                                        </h3>
                                                        <div className="mt-4 flex items-center justify-between">
                                                            <div className="flex items-center gap-2">
                                                                <Youtube size={16} className="text-rose-500" />
                                                                <span className="text-xs font-bold text-slate-500">{video.channel || 'YouTube'}</span>
                                                            </div>
                                                            <span className="text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500">
                                                                {video.duration || 'Video'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                            )}
                        </Card>
                    ) : (
                        <Card className="p-6 bg-white/92 dark:bg-[#0f172a] border-none shadow-xl rounded-[34px] backdrop-blur-sm">
                            <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
                                <div>
                                    <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                                        <Network size={20} className="text-[#1D9E75]" />
                                        Mindmap Maker
                                    </h2>
                                    <p className="text-sm text-slate-500 mt-1">Generate a visual concept graph and notebook blocks for revision.</p>
                                </div>
                                <Button className="rounded-xl" onClick={runMindmapImage} disabled={imageLoading || mindmapLoading}>
                                    <ImageIcon size={16} className="mr-1" />
                                    {imageLoading || mindmapLoading ? 'Generating...' : 'Generate Mindmap'}
                                </Button>
                            </div>
                            <div className="rounded-3xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-6 min-h-[520px] flex items-center justify-center">
                                {mindmapLoading ? (
                                    <div className="w-full max-w-xl space-y-4">
                                        <div className="h-3 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                                            <div className="h-full w-1/2 bg-gradient-to-r from-[#1D9E75] to-emerald-500 animate-pulse" />
                                        </div>
                                        <p className="text-center text-sm font-bold text-slate-600 dark:text-slate-300">Generating visual mindmap...</p>
                                    </div>
                                ) : mindmapImageUrl ? (
                                    <img src={mindmapImageUrl} alt="Mindmap visual" className="w-full rounded-2xl border border-slate-200 dark:border-slate-700" />
                                ) : (
                                    <p className="text-sm text-slate-500 text-center max-w-md">Use this as a side visual after the video, not the main deliverable.</p>
                                )}
                            </div>

                            {mindmapNotebookBlocks.length > 0 && (
                                <div className="mt-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950/40 p-4">
                                    <div className="mb-3 flex items-center justify-between gap-2">
                                        <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Notebook Mindmap Mode</p>
                                        <p className="text-xs font-semibold text-slate-400">Expandable concept boxes</p>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {mindmapNotebookBlocks.map((block, index) => (
                                            <details key={`${block.title}-${index}`} className="group rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/70 p-3" open={index === 0}>
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
                                <div className="flex justify-end mt-4">
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
                    )}
                </section>
            </main>
        </div>
    );
};
