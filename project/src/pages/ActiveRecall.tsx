import { useEffect, useState, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { 
  Mic, 
  MicOff, 
  RotateCcw, 
  CheckCircle2, 
  Brain, 
  BookOpen, 
  Sparkles, 
  ChevronRight, 
  Loader2, 
  AlertCircle, 
  RefreshCw,
  X,
  ArrowLeft
} from 'lucide-react';
import { Navbar } from '../components/layout/Navbar';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { getUser, getAuthToken } from '../utils/storage';
import { getStudyResources } from '../utils/studyResources';
import { getChapterText, evaluateActiveRecall, askQuestionStream, getCustomTextbooks, logProgress, type ActiveRecallEvaluateResponse } from '../api';
import toast from 'react-hot-toast';
import { MarkdownContent } from '../components/ui/MarkdownContent';

export const ActiveRecall = () => {
  const location = useLocation();
  const user = getUser();
  const referencedChapter = (location.state?.chapter as string | undefined) || '';

  // AI Selection States
  const [highlightedText, setHighlightedText] = useState('');
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | null>(null);
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const [aiPanelTitle, setAiPanelTitle] = useState('');
  const [aiPanelText, setAiPanelText] = useState('');
  const [aiPanelLoading, setAiPanelLoading] = useState(false);

  // PDF Viewer States for active recall
  const [viewerPdfUrl, setViewerPdfUrl] = useState('');
  const [viewerPdfLoading, setViewerPdfLoading] = useState(false);
  const [viewerPdfError, setViewerPdfError] = useState('');
  const [readerOpen, setReaderOpen] = useState(false);
  const [layoutMode, setLayoutMode] = useState<'split' | 'pdf' | 'text'>('split');

  const fetchPdfBlob = async (apiPath: string): Promise<string> => {
    const token = getAuthToken();
    const res = await fetch(apiPath, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error(`PDF fetch failed: ${res.status} ${res.statusText}`);
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  };

  const getBookCode = (url: string): string => {
    const match = url.match(/[?&]([a-z0-9]+)=/i);
    return match ? match[1] : '';
  };

  const loadPdfForChapter = async () => {
    setViewerPdfLoading(true);
    setViewerPdfError('');
    setViewerPdfUrl('');

    try {
      // 1. Try custom textbooks first
      const customRes = await getCustomTextbooks({
        class_num: Number(classFilter),
        subject: subjectFilter
      });
      const customBooks = customRes.textbooks || [];
      const matchingCustom = customBooks.find(
        (b) => b.chapter.toLowerCase() === selectedChapter.toLowerCase()
      );

      if (matchingCustom) {
        const token = getAuthToken();
        const fallbackUrl = `/api/v1/upload/custom-textbook/${matchingCustom.id}/pdf?token=${token}`;
        setViewerPdfUrl(fallbackUrl);
        setViewerPdfLoading(false);
        return;
      }
    } catch (err) {
      console.error("Failed to load custom textbooks for active recall PDF", err);
    }

    // 2. Fall back to NCERT PDF
    const book = resources.textbooks[0];
    if (!book) {
      setViewerPdfError('No PDF available for this course.');
      setViewerPdfLoading(false);
      return;
    }

    const chapterIdx = Math.max(1, resources.chapters.indexOf(selectedChapter) + 1);
    const bookCode = getBookCode(book.url);
    const apiPath = `/api/v1/upload/ncert-pdf-proxy?book_code=${bookCode}&chapter_num=${chapterIdx}`;

    setViewerPdfUrl(apiPath);
    setViewerPdfLoading(false);
  };

  // Revoke blob URL on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      if (viewerPdfUrl.startsWith('blob:')) {
        URL.revokeObjectURL(viewerPdfUrl);
      }
    };
  }, [viewerPdfUrl]);

  // 1. Core Selection States
  const [classFilter, setClassFilter] = useState(() => {
    const saved = localStorage.getItem('clarity_recall_class');
    return saved || (user?.class || '10').toString();
  });

  const [subjectFilter, setSubjectFilter] = useState(() => {
    const saved = localStorage.getItem('clarity_recall_subject');
    const resources = getStudyResources(classFilter, '');
    return saved || resources.subject;
  });

  const resources = getStudyResources(classFilter, subjectFilter);

  const [selectedChapter, setSelectedChapter] = useState(() => {
    const saved = localStorage.getItem('clarity_recall_chapter');
    if (saved && resources.chapters.includes(saved)) return saved;
    if (referencedChapter && resources.chapters.includes(referencedChapter)) return referencedChapter;
    return resources.chapters[0] || '';
  });

  // 2. Wizard & Content States
  const [activeStep, setActiveStep] = useState<number>(() => {
    const saved = localStorage.getItem('clarity_recall_step');
    return saved ? Number(saved) : 1; // 1: Read, 2: Recall, 3: Scorecard
  });

  const [readerContent, setReaderContent] = useState<string>(() => {
    return localStorage.getItem('clarity_recall_reader_content') || '';
  });
  const [readerLoading, setReaderLoading] = useState(false);
  const [readerError, setReaderError] = useState('');

  // 3. Audio & ASR SpeechRecognition States
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState<string>(() => {
    return localStorage.getItem('clarity_recall_transcript') || '';
  });
  const [interimText, setInterimText] = useState('');
  const [recordingSeconds, setRecordingSeconds] = useState(0);

  // 4. Scorecard Evaluation States
  const [evaluating, setEvaluating] = useState(false);
  const [scorecard, setScorecard] = useState<ActiveRecallEvaluateResponse | null>(() => {
    const saved = localStorage.getItem('clarity_recall_scorecard');
    return saved ? JSON.parse(saved) : null;
  });

  const recognitionRef = useRef<any>(null);
  const timerRef = useRef<number | null>(null);

  // Update curriculum when class filter changes
  useEffect(() => {
    const nextResources = getStudyResources(classFilter, '');
    setSubjectFilter(nextResources.subject);
  }, [classFilter]);

  // Sync basic configurations to localStorage
  useEffect(() => {
    localStorage.setItem('clarity_recall_class', classFilter);
    localStorage.setItem('clarity_recall_subject', subjectFilter);
    localStorage.setItem('clarity_recall_chapter', selectedChapter);
    localStorage.setItem('clarity_recall_step', activeStep.toString());
    localStorage.setItem('clarity_recall_transcript', transcript);
    localStorage.setItem('clarity_recall_reader_content', readerContent);
    if (scorecard) {
      localStorage.setItem('clarity_recall_scorecard', JSON.stringify(scorecard));
    } else {
      localStorage.removeItem('clarity_recall_scorecard');
    }
  }, [classFilter, subjectFilter, selectedChapter, activeStep, transcript, readerContent, scorecard]);

  // Load Textbook Chapter Text
  const loadChapter = async () => {
    if (!selectedChapter) return;
    setReaderLoading(true);
    setReaderError('');

    // Load PDF instantly in parallel so the user can start reading immediately
    loadPdfForChapter();

    try {
      const res = await getChapterText({
        class_num: classFilter,
        subject: subjectFilter,
        chapter: selectedChapter
      });
      setReaderContent(res.content);
    } catch (err: any) {
      setReaderError(err?.response?.data?.detail || 'Failed to fetch textbook text. Ensure the server is running or try uploading a custom textbook.');
    } finally {
      setReaderLoading(false);
    }
  };

  // Auto load chapter text if not already loaded when at step 1
  useEffect(() => {
    if (activeStep === 1 && !readerContent && selectedChapter) {
      loadChapter();
    }
  }, [selectedChapter, activeStep]);

  // Speech Recognition Instantiation
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = 'en-US'; // Default English speech transcription

      rec.onstart = () => {
        setIsRecording(true);
        startTimer();
      };

      rec.onresult = (event: any) => {
        let finalText = '';
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalText += event.results[i][0].transcript + ' ';
          } else {
            interim += event.results[i][0].transcript;
          }
        }
        setInterimText(interim);
        if (finalText) {
          setTranscript((prev) => (prev + ' ' + finalText).trim());
        }
      };

      rec.onerror = (e: any) => {
        console.error('Speech Recognition Error', e);
        if (e.error !== 'no-speech') {
          toast.error(`ASR Mic Error: ${e.error}`);
          stopRecording();
        }
      };

      rec.onend = () => {
        setIsRecording(false);
        stopTimer();
      };

      recognitionRef.current = rec;
    }
  }, []);

  // Timer helper functions
  const startTimer = () => {
    setRecordingSeconds(0);
    timerRef.current = window.setInterval(() => {
      setRecordingSeconds((prev) => prev + 1);
    }, 1000);
  };

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const startRecording = () => {
    if (!recognitionRef.current) {
      toast.error('Speech recognition is not supported in this browser. Please use Chrome, Safari or Edge.');
      return;
    }
    try {
      setInterimText('');
      recognitionRef.current.start();
    } catch (err) {
      console.error(err);
    }
  };

  const stopRecording = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (err) {
        console.error(err);
      }
    }
    setIsRecording(false);
    stopTimer();
  };

  const resetRecallAttempt = () => {
    stopRecording();
    setTranscript('');
    setInterimText('');
    setRecordingSeconds(0);
  };

  const handleTextSelection = (e: React.MouseEvent) => {
    const selection = window.getSelection();
    const text = selection ? selection.toString().trim() : '';
    if (text) {
      setHighlightedText(text);
      if (e.button === 0) { // left click mouseup
        setMenuPosition({ x: e.clientX, y: e.clientY });
      }
    } else {
      const target = e.target as HTMLElement;
      if (!target.closest('.ai-context-menu')) {
        setMenuPosition(null);
      }
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    const selection = window.getSelection();
    const text = selection ? selection.toString().trim() : '';
    if (text) {
      e.preventDefault();
      setHighlightedText(text);
      setMenuPosition({ x: e.clientX, y: e.clientY });
    }
  };

  const handleAiAction = async (action: 'explain' | 'summarize' | 'points' | 'trick') => {
    if (!highlightedText) return;
    setMenuPosition(null);
    setAiPanelOpen(true);
    setAiPanelLoading(true);
    setAiPanelText('');

    let actionTitle = '';
    let questionPrompt = '';

    if (action === 'explain') {
      actionTitle = 'Ask Meaning';
      questionPrompt = `Explain the exact meaning of the highlighted term or passage in simple, student-friendly words, providing a clear contextual example:\n\n"${highlightedText}"`;
    } else if (action === 'summarize') {
      actionTitle = 'Summarize Passage';
      questionPrompt = `Provide a crisp, bulleted summary of this passage containing key value points for CBSE board exams:\n\n"${highlightedText}"`;
    } else if (action === 'points') {
      actionTitle = 'Convert to Points';
      questionPrompt = `Convert this passage into structured, easy-to-study bullet points/key takeaways for CBSE exam revision:\n\n"${highlightedText}"`;
    } else {
      actionTitle = 'Tricks to Memorize';
      questionPrompt = `Provide a clever mnemonic, memory hook, or trick to remember the details in this passage easily:\n\n"${highlightedText}"`;
    }

    setAiPanelTitle(actionTitle);

    try {
      const payload = {
        class_num: classFilter,
        subject: subjectFilter,
        chapter: selectedChapter,
        question: questionPrompt,
      };

      await askQuestionStream(payload, (token) => {
        setAiPanelText((prev) => prev + token);
        setAiPanelLoading(false);
      });
    } catch (err) {
      setAiPanelText('Error generating explanation from AI. Please try again.');
      setAiPanelLoading(false);
    }
  };

  // Evaluate Recall Summary via LLM
  const handleRecallSubmit = async () => {
    if (!transcript.trim()) {
      toast.error('Please record or type your summary first!');
      return;
    }
    stopRecording();
    setEvaluating(true);
    try {
      const scorecardResult = await evaluateActiveRecall({
        class_num: classFilter,
        subject: subjectFilter,
        chapter: selectedChapter,
        recall_text: transcript
      });
      setScorecard(scorecardResult);
      setActiveStep(3);
      logProgress({
        action: 'recall',
        subject: subjectFilter,
        chapter: selectedChapter,
        score: scorecardResult.accuracy_score
      }).catch(e => console.error('Failed to log recall progress:', e));
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to grade recall attempt. Please retry.');
    } finally {
      setEvaluating(false);
    }
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const startOverWizard = () => {
    resetRecallAttempt();
    setScorecard(null);
    setReaderContent('');
    setReaderOpen(false);
    setActiveStep(1);
    loadChapter();
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-[#020617] transition-colors duration-300">
      <Navbar />
      <main className="max-w-7xl mx-auto px-6 py-10">
        
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-6">
          <div>
            <h1 className="text-4xl font-black text-slate-900 dark:text-white mb-2 tracking-tight flex items-center gap-3">
              <Brain className="text-[#1D9E75] h-10 w-10 animate-pulse" />
              Active Recall Board
            </h1>
            <p className="text-slate-500 font-medium">Read chapter text, hide the page, state everything you remember out loud, and get detailed key points coaching.</p>
          </div>

          {/* Setup Selectors */}
          {activeStep === 1 && (
            <div className="flex flex-wrap items-center gap-2 bg-white dark:bg-slate-800 p-2 rounded-2xl border border-slate-100 dark:border-slate-700">
              <select 
                value={classFilter} 
                onChange={(e) => {
                  setClassFilter(e.target.value);
                  setReaderContent('');
                }}
                className="bg-transparent text-sm font-black text-slate-700 dark:text-slate-200 outline-none px-3 py-1.5"
              >
                {['8', '9', '10', '11', '12'].map(c => (
                  <option key={c} value={c} className="dark:bg-slate-900">Class {c}</option>
                ))}
              </select>

              <select 
                value={subjectFilter} 
                onChange={(e) => {
                  setSubjectFilter(e.target.value);
                  setReaderContent('');
                }}
                className="bg-transparent text-sm font-black text-slate-700 dark:text-slate-200 outline-none px-3 py-1.5 border-l border-slate-100 dark:border-slate-700"
              >
                {resources.subjects.map(s => (
                  <option key={s} value={s} className="dark:bg-slate-900">{s}</option>
                ))}
              </select>

              <select 
                value={selectedChapter} 
                onChange={(e) => {
                  setSelectedChapter(e.target.value);
                  setReaderContent('');
                }}
                className="bg-transparent text-sm font-black text-slate-700 dark:text-slate-200 outline-none px-3 py-1.5 border-l border-slate-100 dark:border-slate-700 max-w-[200px]"
              >
                {resources.chapters.map(ch => (
                  <option key={ch} value={ch} className="dark:bg-slate-900">{ch}</option>
                ))}
              </select>
              
              <button 
                onClick={loadChapter}
                title="Reload Chapter"
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors border-l border-slate-100 dark:border-slate-700"
              >
                <RefreshCw size={14} className={readerLoading ? 'animate-spin' : ''} />
              </button>
            </div>
          )}
        </div>

        {/* Step Wizard Bar */}
        <div className="flex items-center justify-center gap-2 mb-10 max-w-lg mx-auto bg-white dark:bg-slate-800/60 p-2 rounded-2xl border border-slate-100 dark:border-slate-800">
          <div className={`flex-1 text-center py-2 rounded-xl text-xs font-black transition-all ${activeStep === 1 ? 'bg-[#1D9E75] text-white shadow-sm' : 'text-slate-400 dark:text-slate-500'}`}>
            1. Read Chapter
          </div>
          <ChevronRight size={14} className="text-slate-300 dark:text-slate-700" />
          <div className={`flex-1 text-center py-2 rounded-xl text-xs font-black transition-all ${activeStep === 2 ? 'bg-[#1D9E75] text-white shadow-sm' : 'text-slate-400 dark:text-slate-500'}`}>
            2. Audio Recall
          </div>
          <ChevronRight size={14} className="text-slate-300 dark:text-slate-700" />
          <div className={`flex-1 text-center py-2 rounded-xl text-xs font-black transition-all ${activeStep === 3 ? 'bg-[#1D9E75] text-white shadow-sm' : 'text-slate-400 dark:text-slate-500'}`}>
            3. Scorecard
          </div>
        </div>

        {/* STEP 1: READ CHAPTER */}
        {activeStep === 1 && (
          <>
            {!readerOpen ? (
              <Card className="p-8 bg-white dark:bg-[#0f172a] border-none shadow-xl rounded-[32px] text-center max-w-2xl mx-auto my-6 animate-fadeIn">
                <Brain className="text-[#1D9E75] h-14 w-14 mx-auto mb-4 animate-pulse" />
                <h3 className="text-xl font-black text-slate-900 dark:text-white mb-2">Start Active Recall Study Session</h3>
                <p className="text-slate-500 dark:text-slate-400 font-semibold mb-6 text-sm">
                  Select your class, subject, and chapter using the filters at the top, then open the full-screen textbook viewer. Read the concepts, memorize them, and then proceed to state what you remember.
                </p>
                <div className="flex justify-center gap-3">
                  <Button 
                    onClick={() => {
                      setReaderOpen(true);
                      setLayoutMode('split');
                      if (!readerContent) {
                        loadChapter();
                      }
                    }}
                    className="bg-[#1D9E75] hover:bg-[#16805d] rounded-2xl font-black h-12 px-8 shadow-lg shadow-[#1D9E75]/25 flex items-center gap-2 text-sm"
                  >
                    <BookOpen size={18} />
                    <span>Open Full-Screen Reader</span>
                  </Button>
                </div>
              </Card>
            ) : (
              <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-0 transition-all animate-fadeIn">
                <div className="bg-white dark:bg-slate-900 w-full h-full flex flex-col overflow-hidden shadow-2xl relative animate-scaleIn">
                  {/* Header */}
                  <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/50 dark:bg-slate-900/50">
                    <div>
                      <h3 className="text-lg font-black text-slate-900 dark:text-white truncate max-w-lg">
                        {selectedChapter}
                      </h3>
                      <p className="text-xs text-slate-500 font-medium">
                        Class {classFilter} • {subjectFilter}
                      </p>
                    </div>
                    
                    <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
                      {/* Layout Mode Toggles */}
                      <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                        <button
                          onClick={() => setLayoutMode('split')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                            layoutMode === 'split'
                              ? 'bg-[#1D9E75] text-white shadow-sm'
                              : 'text-slate-600 dark:text-slate-350 hover:bg-slate-200 dark:hover:bg-slate-700'
                          }`}
                        >
                          Split View
                        </button>
                        <button
                          onClick={() => setLayoutMode('pdf')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                            layoutMode === 'pdf'
                              ? 'bg-[#1D9E75] text-white shadow-sm'
                              : 'text-slate-600 dark:text-slate-355 hover:bg-slate-200 dark:hover:bg-slate-700'
                          }`}
                        >
                          Original PDF
                        </button>
                        <button
                          onClick={() => setLayoutMode('text')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                            layoutMode === 'text'
                              ? 'bg-[#1D9E75] text-white shadow-sm'
                              : 'text-slate-600 dark:text-slate-355 hover:bg-slate-200 dark:hover:bg-slate-700'
                          }`}
                        >
                          Interactive Text
                        </button>
                      </div>

                      <Button 
                        onClick={() => {
                          setReaderOpen(false);
                          setActiveStep(2);
                        }}
                        className="bg-[#1D9E75] hover:bg-[#16805d] rounded-xl font-black h-11 px-6 shadow-md shadow-[#1D9E75]/10 flex items-center gap-2"
                        disabled={!readerContent}
                      >
                        <span>Ready to Recall</span>
                        <ChevronRight size={16} />
                      </Button>
                      
                      <button
                        onClick={() => setReaderOpen(false)}
                        className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-500 hover:text-slate-800 dark:hover:text-white transition-all font-bold"
                        title="Close Reader"
                      >
                        ✕
                      </button>
                    </div>
                  </div>

                  {/* Split Content */}
                  <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative border-t border-slate-100 dark:border-slate-800 min-h-[60vh]">
                    {/* Left Panel: PDF Viewer (shown if layoutMode !== 'text') */}
                    <div className={`flex flex-col relative border-r border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 transition-all duration-300 ${
                      layoutMode === 'split' ? 'w-full h-1/2 md:h-full md:w-1/2' : layoutMode === 'pdf' ? 'w-full h-full' : 'hidden'
                    }`}>
                      {viewerPdfLoading ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-slate-500 bg-white dark:bg-slate-900">
                          <Loader2 className="animate-spin text-[#1D9E75]" size={32} />
                          <p className="text-xs font-bold">Loading textbook PDF...</p>
                        </div>
                      ) : viewerPdfError ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-500 p-6 bg-white dark:bg-slate-900 text-center">
                          <AlertCircle className="text-rose-500" size={24} />
                          <p className="text-xs font-bold">{viewerPdfError}</p>
                        </div>
                      ) : viewerPdfUrl ? (
                        <iframe
                          src={viewerPdfUrl}
                          className="w-full h-full border-none"
                          title="Active Recall PDF Viewer"
                        />
                      ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-400 bg-white dark:bg-slate-900">
                          <BookOpen size={32} className="opacity-30" />
                          <p className="text-xs font-bold">PDF loading...</p>
                        </div>
                      )}
                    </div>

                    {/* Right Panel: Interactive Text & AI Context help (shown if layoutMode !== 'pdf') */}
                    <div className={`h-full flex flex-col md:flex-row overflow-hidden bg-white dark:bg-[#0c0e14] transition-all duration-300 ${
                      layoutMode === 'split' ? 'w-full h-1/2 md:h-full md:w-1/2' : layoutMode === 'text' ? 'w-full h-full' : 'hidden'
                    }`}>
                      {/* Left Text Column */}
                      <div 
                        className="flex-1 overflow-y-auto p-6 select-text"
                        onMouseUp={handleTextSelection}
                        onContextMenu={handleContextMenu}
                      >
                        {readerLoading ? (
                          <div className="flex flex-col items-center justify-center py-20 gap-3">
                            <Loader2 className="animate-spin text-[#1D9E75]" size={28} />
                            <p className="text-xs font-bold text-slate-400">Extracting text for interactive study...</p>
                            <p className="text-[10px] text-slate-400">You can already read the PDF on the left</p>
                          </div>
                        ) : readerError ? (
                          <div className="text-center py-20 max-w-sm mx-auto">
                            <AlertCircle className="text-rose-500 mx-auto mb-2" size={24} />
                            <p className="text-xs font-bold text-slate-800 dark:text-slate-200">Interactive reader offline</p>
                            <p className="text-[10px] text-slate-500 mb-4">{readerError}</p>
                          </div>
                        ) : (
                          <div className="max-w-none">
                            <div className="p-3 bg-emerald-50/50 dark:bg-emerald-950/10 border border-emerald-100 dark:border-emerald-900/30 rounded-xl mb-4 text-[10px] font-bold text-[#1D9E75] flex items-center gap-2">
                              <Sparkles size={12} className="shrink-0 animate-pulse" />
                              <span>Highlight text to summon Clarity AI CBSE board help!</span>
                            </div>

                            <article className="font-serif text-slate-850 dark:text-slate-100 text-base leading-relaxed select-text selection:bg-[#1D9E75]/25">
                              {readerContent ? (
                                <MarkdownContent content={readerContent} />
                              ) : (
                                "Select a valid class and subject, then hit reload. Or upload your custom textbooks in the Textbook Hub."
                              )}
                            </article>
                          </div>
                        )}
                      </div>

                      {/* Right Column: AI Panel Drawer */}
                      {aiPanelOpen && (
                        <div className="w-full md:w-64 border-t md:border-t-0 md:border-l border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0c0e14] flex flex-col h-full overflow-hidden shadow-2xl relative z-10 animate-in slide-in-from-bottom md:slide-in-from-right duration-200">
                          <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900">
                            <h4 className="font-black text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
                              <Sparkles size={12} className="text-[#1D9E75] animate-pulse" />
                              {aiPanelTitle}
                            </h4>
                            <button
                              onClick={() => setAiPanelOpen(false)}
                              className="p-1 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            >
                              <X size={14} />
                            </button>
                          </div>

                          <div className="flex-1 overflow-y-auto p-4 select-text">
                            <div className="bg-white dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800 p-3 rounded-xl shadow-sm mb-3">
                              <p className="text-[9px] font-black uppercase text-slate-400 dark:text-slate-550 tracking-wider mb-1">Quote</p>
                              <blockquote className="text-[11px] italic font-medium text-slate-600 dark:text-slate-305 border-l-2 border-[#1D9E75] pl-2 py-0.5 line-clamp-3">
                                "{highlightedText}"
                              </blockquote>
                            </div>

                            {aiPanelLoading && !aiPanelText ? (
                              <div className="flex flex-col items-center justify-center py-6 gap-2">
                                <Loader2 className="animate-spin text-[#1D9E75]" size={16} />
                                <p className="text-[10px] font-bold text-slate-500">Generating...</p>
                              </div>
                            ) : (
                              <MarkdownContent className="text-xs leading-relaxed" content={aiPanelText} />
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* STEP 2: ACTIVE VOICE RECALL */}
        {activeStep === 2 && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Recorder Interface */}
            <Card className="lg:col-span-2 p-8 bg-white dark:bg-[#0f172a] border-none shadow-xl rounded-[32px] flex flex-col justify-between min-h-[500px]">
              <div>
                <h3 className="text-xl font-black text-slate-900 dark:text-white mb-2">Explain Everything You Remember</h3>
                <p className="text-slate-400 text-sm font-semibold mb-6">Hit start and summarize the concepts in your own words. We will evaluate how many key textbook terms you remembered!</p>

                {/* Recorder layout */}
                <div className="flex flex-col items-center justify-center py-10 bg-slate-50 dark:bg-slate-900/60 rounded-[24px] border border-slate-100 dark:border-slate-800/80 mb-6">
                  {isRecording ? (
                    <div className="relative flex items-center justify-center mb-6">
                      <span className="absolute inline-flex h-24 w-24 rounded-full bg-[#1D9E75]/20 animate-ping"></span>
                      <button 
                        onClick={stopRecording}
                        className="relative bg-rose-500 hover:bg-rose-600 text-white rounded-full p-6 shadow-lg transition-transform active:scale-95 z-10"
                      >
                        <MicOff size={28} />
                      </button>
                    </div>
                  ) : (
                    <button 
                      onClick={startRecording}
                      className="bg-[#1D9E75] hover:bg-[#16805d] text-white rounded-full p-6 shadow-lg shadow-[#1D9E75]/20 mb-6 transition-transform active:scale-95"
                    >
                      <Mic size={28} />
                    </button>
                  )}

                  <span className={`text-xs font-black uppercase tracking-wider ${isRecording ? 'text-rose-500' : 'text-[#1D9E75]'}`}>
                    {isRecording ? `Recording • ${formatTime(recordingSeconds)}` : 'Click Microphone to Start'}
                  </span>
                </div>

                {/* Live Transcript Box */}
                <div>
                  <label className="block text-xs font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider mb-2">Recall Transcript</label>
                  <div className="w-full min-h-[120px] max-h-[220px] overflow-y-auto p-4 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl text-slate-800 dark:text-slate-100 text-sm font-medium leading-relaxed">
                    {transcript || interimText ? (
                      <>
                        <span className="text-slate-900 dark:text-white">{transcript}</span>
                        {interimText && <span className="text-slate-400 italic"> {interimText}</span>}
                      </>
                    ) : (
                      <span className="text-slate-400 italic">Spoken transcript will appear here in real-time...</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex flex-wrap items-center justify-between gap-4 mt-8 pt-4 border-t border-slate-100 dark:border-slate-800">
                <Button 
                  variant="outline" 
                  className="rounded-2xl font-bold h-11 px-5"
                  onClick={resetRecallAttempt}
                  disabled={evaluating || (!transcript && !isRecording)}
                >
                  <RotateCcw size={16} className="mr-2" />
                  Reset Recording
                </Button>

                <div className="flex items-center gap-2">
                  <Button 
                    variant="ghost" 
                    className="rounded-2xl font-bold h-11 px-5"
                    onClick={() => setActiveStep(1)}
                    disabled={evaluating}
                  >
                    Go Back to Text
                  </Button>
                  <Button 
                    className="bg-[#1D9E75] hover:bg-[#16805d] rounded-2xl font-black h-11 px-6 flex items-center gap-2 shadow-md shadow-[#1D9E75]/10"
                    onClick={handleRecallSubmit}
                    disabled={evaluating || !transcript.trim()}
                  >
                    {evaluating ? (
                      <>
                        <Loader2 className="animate-spin" size={16} />
                        <span>Evaluating...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 size={16} />
                        <span>Submit recall</span>
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </Card>

            {/* Instruction Sidebar */}
            <Card className="p-6 bg-white dark:bg-[#0f172a] border-none shadow-xl rounded-[32px] flex flex-col justify-between">
              <div>
                <h4 className="font-black text-slate-950 dark:text-white text-sm mb-4">Active Recall Tips</h4>
                <ul className="space-y-4 text-xs font-semibold text-slate-500 leading-relaxed">
                  <li className="flex items-start gap-2.5">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-950/20 text-[#1D9E75] shrink-0 font-bold">1</span>
                    <span>Explain concepts as if you are teaching them to a beginner. This forces your brain to structure the information logically.</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-950/20 text-[#1D9E75] shrink-0 font-bold">2</span>
                    <span>Speak clearly and use official CBSE/NCERT terms (e.g. say "chlorophyll" or "anaerobic respiration") because they are heavily weighted in board criteria.</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-950/20 text-[#1D9E75] shrink-0 font-bold">3</span>
                    <span>Don't worry about minor grammar slips. Focus on recalling structure, processes, exceptions, and formulas.</span>
                  </li>
                </ul>
              </div>

              <div className="mt-8 p-4 bg-emerald-50/50 dark:bg-emerald-950/10 border border-emerald-100 dark:border-emerald-900/30 rounded-2xl">
                <h5 className="font-bold text-[#1D9E75] text-xs flex items-center gap-1.5 mb-1.5">
                  <Sparkles size={14} />
                  CBSE Grading Focus
                </h5>
                <p className="text-[10px] text-slate-500 font-semibold leading-relaxed">Examiners search for specific "Value Points" in board answers. Our AI checks your speech against these exact points to calculate your recall accuracy.</p>
              </div>
            </Card>
          </div>
        )}

        {/* STEP 3: SCORECARD */}
        {activeStep === 3 && scorecard && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Left Main Card: Results Scorecard */}
            <Card className="lg:col-span-2 p-8 bg-white dark:bg-[#0f172a] border-none shadow-xl rounded-[32px] flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
                  <div>
                    <h3 className="text-xl font-black text-slate-900 dark:text-white">CBSE Active Recall Scorecard</h3>
                    <p className="text-xs text-slate-400 font-semibold">Evaluation for {selectedChapter}</p>
                  </div>
                  <div className="px-4 py-2 bg-emerald-50 dark:bg-emerald-950/20 rounded-xl text-xs font-black text-[#1D9E75] uppercase">
                    Attempt Complete
                  </div>
                </div>

                {/* Score Dial and Metrics */}
                <div className="flex flex-col md:flex-row items-center justify-around bg-slate-50 dark:bg-slate-900/50 p-6 rounded-3xl border border-slate-100 dark:border-slate-800/80 mb-8 gap-6">
                  {/* Accuracy Dial */}
                  <div className="relative flex items-center justify-center">
                    <svg className="w-32 h-32 transform -rotate-90">
                      <circle cx="64" cy="64" r="52" strokeWidth="10" stroke="currentColor" className="text-slate-200 dark:text-slate-800" fill="transparent" />
                      <circle cx="64" cy="64" r="52" strokeWidth="10" stroke="#1D9E75" fill="transparent"
                        strokeDasharray={2 * Math.PI * 52}
                        strokeDashoffset={2 * Math.PI * 52 * (1 - scorecard.accuracy_score / 100)}
                        strokeLinecap="round"
                      />
                    </svg>
                    <div className="absolute text-center">
                      <span className="text-3xl font-black text-slate-900 dark:text-white">{scorecard.accuracy_score}%</span>
                      <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider">Accuracy</p>
                    </div>
                  </div>

                  {/* Summary of points */}
                  <div className="space-y-3 flex-1 max-w-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-slate-500">Recalled Keywords:</span>
                      <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">{scorecard.recalled_keywords.length}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-slate-500">Missed Concepts:</span>
                      <span className="text-sm font-black text-rose-500">{scorecard.missed_concepts.length}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-slate-500">Grade Level Assessment:</span>
                      <span className="text-sm font-black text-slate-900 dark:text-white">
                        {scorecard.accuracy_score >= 85 ? 'Excellent Board Prep' : scorecard.accuracy_score >= 65 ? 'Good Progress' : 'Requires Review'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Keywords comparison lists */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                  {/* Recalled Keywords */}
                  <div className="p-5 bg-emerald-50/20 dark:bg-emerald-950/5 border border-emerald-100/50 dark:border-emerald-900/10 rounded-2xl">
                    <p className="text-xs font-black uppercase text-emerald-700 dark:text-emerald-400 tracking-wider mb-3 flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
                      Recalled Terms/Phrases
                    </p>
                    {scorecard.recalled_keywords.length === 0 ? (
                      <p className="text-xs text-slate-400 italic">No specific textbook keywords identified.</p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {scorecard.recalled_keywords.map((word, i) => (
                          <span key={i} className="px-2.5 py-1 bg-emerald-100/70 dark:bg-emerald-950/35 text-emerald-700 dark:text-emerald-300 text-xs font-bold rounded-lg border border-emerald-200/30">
                            {word}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Missed Concepts */}
                  <div className="p-5 bg-rose-50/20 dark:bg-rose-950/5 border border-rose-100/50 dark:border-rose-900/10 rounded-2xl">
                    <p className="text-xs font-black uppercase text-rose-700 dark:text-rose-400 tracking-wider mb-3 flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-rose-500"></span>
                      Missed Core Concepts
                    </p>
                    {scorecard.missed_concepts.length === 0 ? (
                      <p className="text-xs text-slate-400 italic">Perfect recall! No major concepts missed.</p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {scorecard.missed_concepts.map((word, i) => (
                          <span key={i} className="px-2.5 py-1 bg-rose-100/70 dark:bg-rose-950/35 text-rose-700 dark:text-rose-300 text-xs font-bold rounded-lg border border-rose-200/30">
                            {word}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Coach Notes */}
                <div className="p-6 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl">
                  <h4 className="text-sm font-black text-slate-900 dark:text-white mb-2 flex items-center gap-1.5">
                    <Sparkles size={16} className="text-[#1D9E75]" />
                    AI Tutor Coaching
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-350 leading-relaxed whitespace-pre-wrap font-medium">
                    {scorecard.feedback_notes}
                  </p>
                </div>
              </div>

              {/* Action Footer */}
              <div className="flex flex-wrap justify-end gap-3 mt-8 pt-4 border-t border-slate-100 dark:border-slate-800">
                <Button 
                  variant="outline" 
                  className="rounded-2xl font-bold h-11 px-5"
                  onClick={() => {
                    setScorecard(null);
                    setTranscript('');
                    setActiveStep(2);
                  }}
                >
                  Recall Again
                </Button>
                <Button 
                  className="bg-[#1D9E75] hover:bg-[#16805d] rounded-2xl font-black h-11 px-6 shadow-md shadow-[#1D9E75]/10"
                  onClick={startOverWizard}
                >
                  Start Over (New Chapter)
                </Button>
              </div>
            </Card>

            {/* Transcript Summary Sidebar */}
            <Card className="p-6 bg-white dark:bg-[#0f172a] border-none shadow-xl rounded-[32px] overflow-hidden flex flex-col">
              <h4 className="font-black text-slate-950 dark:text-white text-sm mb-4">Your Attempt Transcript</h4>
              <div className="flex-1 overflow-y-auto p-4 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl text-xs font-medium text-slate-600 dark:text-slate-400 leading-relaxed max-h-[400px]">
                "{transcript}"
              </div>
            </Card>
          </div>
        )}

      </main>

      {/* Right Click Floating Menu */}
      {menuPosition && (
        <>
          <div 
            className="fixed inset-0 z-[150]" 
            onClick={() => setMenuPosition(null)}
            onContextMenu={(e) => {
              e.preventDefault();
              setMenuPosition(null);
            }}
          />
          <div
            className="fixed bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl p-2.5 z-[160] flex flex-col gap-1 min-w-[200px] backdrop-blur-md ai-context-menu"
            style={{ left: `${menuPosition.x}px`, top: `${menuPosition.y}px` }}
          >
            <p className="px-3 py-1.5 text-[9px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-widest border-b border-slate-100 dark:border-slate-700 mb-1">Clarity AI Highlight</p>
            <button
              onClick={() => handleAiAction('explain')}
              className="w-full text-left px-3 py-2 text-xs font-black text-slate-700 dark:text-slate-200 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 hover:text-[#1D9E75] rounded-xl transition-all flex items-center gap-2"
            >
              🔍 Ask Meaning
            </button>
            <button
              onClick={() => handleAiAction('summarize')}
              className="w-full text-left px-3 py-2 text-xs font-black text-slate-700 dark:text-slate-200 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 hover:text-[#1D9E75] rounded-xl transition-all flex items-center gap-2"
            >
              📝 Summarize Passage
            </button>
            <button
              onClick={() => handleAiAction('points')}
              className="w-full text-left px-3 py-2 text-xs font-black text-slate-700 dark:text-slate-200 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 hover:text-[#1D9E75] rounded-xl transition-all flex items-center gap-2"
            >
              📌 Convert to Points
            </button>
            <button
              onClick={() => handleAiAction('trick')}
              className="w-full text-left px-3 py-2 text-xs font-black text-slate-700 dark:text-slate-200 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 hover:text-[#1D9E75] rounded-xl transition-all flex items-center gap-2"
            >
              💡 Tricks to Memorize
            </button>
          </div>
        </>
      )}
    </div>
  );
};
