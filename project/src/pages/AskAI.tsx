import { useState, useEffect, useRef, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Send, Paperclip, RefreshCw, Sparkles, ArrowLeft, Bot, User, BookOpen, Award, Zap, BookmarkPlus, Info } from 'lucide-react';
import toast from 'react-hot-toast';
import { Navbar } from '../components/layout/Navbar';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { MarkdownContent } from '../components/ui/MarkdownContent';
import { PremiumModal } from '../components/PremiumModal';
import { addBookmark, getUser, incrementDailyQuestion, checkDailyLimits, incrementDailyUpload, saveStudyMaterialIfNew, type StudyMaterialItem } from '../utils/storage';
import { askQuestionStream, uploadFile, logProgress, saveMaterialToDatabase } from '../api';
import { Message } from '../types';
import { useCurriculumCatalog } from '../hooks/useCurriculumCatalog';
import { buildClarifiSystemPrompt } from '../lib/ai';

export const AskAI = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const user = getUser();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const savedSession = useMemo(() => {
    if (location.state?.subject || location.state?.chapter) {
      return null;
    }
    try {
      const data = localStorage.getItem('clarity_ask_ai_state');
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }, [location.state]);

  const [selectedSubject, setSelectedSubject] = useState(
    location.state?.subject || savedSession?.selectedSubject || user?.subjects[0] || 'Science'
  );
  const [selectedChapter, setSelectedChapter] = useState(
    location.state?.chapter || savedSession?.selectedChapter || ''
  );
  const [messages, setMessages] = useState<Message[]>(savedSession?.messages || []);
  const [input, setInput] = useState(savedSession?.input || '');
  const [markMode, setMarkMode] = useState<'1-mark' | '3-mark' | '5-mark'>(savedSession?.markMode || '3-mark');
  const [isLoading, setIsLoading] = useState(false);
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [showPersonalityModal, setShowPersonalityModal] = useState(!localStorage.getItem('clarity_personality_set'));

  const handleSelectPersonality = async (personality: string) => {
    localStorage.setItem('clarity_personality_set', 'true');
    setShowPersonalityModal(false);
    toast.success(`Clarifier personality set to: ${personality}`);
    try {
      await api.put('/me', { teacherPersonality: personality });
      if (user) {
        saveUser({ ...user, teacherPersonality: personality });
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    const data = {
      selectedSubject,
      selectedChapter,
      messages,
      input,
      markMode,
    };
    localStorage.setItem('clarity_ask_ai_state', JSON.stringify(data));
  }, [selectedSubject, selectedChapter, messages, input, markMode]);

  // Autonomous Data Fetching
  const classKey = (user?.class || '10').toString();
  const { subjectsForClass, chaptersForSubject } = useCurriculumCatalog(classKey);
  const availableChapters = useMemo(
    () => chaptersForSubject(selectedSubject),
    [chaptersForSubject, selectedSubject]
  );

  useEffect(() => {
    // Auto-select first chapter if none selected or if subject changed
    if (availableChapters.length > 0 && (!selectedChapter || !availableChapters.includes(selectedChapter))) {
      setSelectedChapter(availableChapters[0]);
    }
  }, [selectedSubject, selectedChapter, availableChapters]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    const prefilled = (location.state?.prompt || '').toString().trim();
    if (prefilled) {
      setInput(prefilled);
    }
  }, [location.state]);

  const quickActions = [
    {
      label: 'Summarize Chapter',
      prompt: `Summarize the chapter "${selectedChapter}" in 5 crisp bullet points for CBSE boards.`,
    },
    {
      label: 'Most Important Qs',
      prompt: `What are the 3 most important questions from "${selectedChapter}" for the board exam? Include expected marks.`,
    },
    {
      label: 'Numerical Steps',
      prompt: `Show me the step-by-step method to solve numericals in "${selectedChapter}".`,
    },
    {
      label: 'Explain Like I\'m 14',
      prompt: `Explain "${selectedChapter}" like I am 14 years old using real-life analogies and simple language. End with one exam tip.`,
    },
    {
      label: 'Formula Drill',
      prompt: `Create a compact formula + definition sheet for "${selectedChapter}" with common mistakes students make in exams.`,
    },
    {
      label: 'Socratic Guide',
      prompt: `Help me understand "${selectedChapter}" by asking me questions one by one. Start with the basics.`,
    },
  ];

  const handleSendMessage = async (customMessage?: string) => {
    const messageText = customMessage || input.trim();
    if (!messageText) return;
    const enrichedMessage = customMessage
      ? messageText
      : `[${markMode}] ${messageText} Please answer strictly in ${markMode} CBSE format.`;

    if (!selectedSubject) {
      toast.error('Please select subject before sending your question.');
      return;
    }
    if (!selectedChapter) {
      toast.error('Please select chapter before sending your question.');
      return;
    }
    const currentChapter = selectedChapter;

    const limits = checkDailyLimits(user);
    if (!limits.canAsk) {
      setShowPremiumModal(true);
      return;
    }

    const userMessage: Message = {
      role: 'user',
      content: enrichedMessage,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const conversationHistory = messages.map((msg) => ({
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: msg.content,
      }));

      const payload = {
        class_num: classKey,
        subject: selectedSubject,
        chapter: currentChapter,
        question: enrichedMessage,
        conversation_history: conversationHistory,
        learner_profile: {
          learning_style: user?.learningStyle || '',
          goal: user?.goal || '',
          study_hours: user?.studyHours || '',
          focus_areas: user?.focusAreas || '',
          focus_chapters: JSON.stringify(user?.focusChapters || {}),
          exam_board: user?.examBoard || 'CBSE',
          preferred_language: user?.preferredLanguage || 'English',
          preferred_pace: user?.preferredPace || 'Balanced',
          confidence_level: user?.confidenceLevel || 'Average confidence',
          revision_frequency: user?.revisionFrequency || 'Alternate days',
        },
        teacher_personality: buildClarifiSystemPrompt(
          (() => {
            try {
              const dump = JSON.parse(localStorage.getItem(`clarity_dump_${user?.id}`) || '[]');
              return dump.map((d: any) => d.summary).filter(Boolean);
            } catch {
              return [];
            }
          })(),
          classKey
        ),
      };

      const aiMessage: Message = {
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, aiMessage]);
      let streamedAnswer = '';

      await askQuestionStream(payload, (token) => {
        streamedAnswer += token;
        setMessages((prev) => {
          const next = [...prev];
          const lastIndex = next.length - 1;
          if (lastIndex >= 0 && next[lastIndex].role === 'assistant') {
            next[lastIndex] = {
              ...next[lastIndex],
              content: `${next[lastIndex].content}${token}`,
            };
          }
          return next;
        });
      });

      if (streamedAnswer.trim()) {
        const material: StudyMaterialItem = {
          id: `ask_${Date.now()}`,
          type: 'answer',
          title: `AI Answer: ${selectedChapter || 'General'}`,
          subject: selectedSubject,
          chapter: currentChapter || selectedChapter || 'General',
          content: `Question:\n${enrichedMessage}\n\nAnswer:\n${streamedAnswer}`,
          createdAt: Date.now(),
        };
        saveStudyMaterialIfNew(material);
        try {
          await saveMaterialToDatabase(material);
        } catch {
          // Keep local save even if network sync fails.
        }
      }

      incrementDailyQuestion();

      if (user?.name) {
        logProgress({
          action: 'question',
          subject: selectedSubject,
          chapter: currentChapter
        });
      }
    } catch (error: unknown) {
      console.error('API Error:', error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Connection to AI server failed. Is the backend running on port 8000?';
      toast.error(errorMessage);

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `💡 **Tutor Nudge:** I'm having trouble connecting. Make sure the backend is running — \`uvicorn main:app --port 8000\``,
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const limits = checkDailyLimits(user);
    if (!limits.canUpload) {
      setShowPremiumModal(true);
      return;
    }

    if (!selectedSubject || !selectedChapter) {
      toast.error('Please select subject and chapter before uploading.');
      return;
    }

    setIsLoading(true);
    try {
      const response = await uploadFile(
        file,
        'Analyze this study material. Identify the chapter and topic, explain the key concepts, and give me exam tips.'
      );

      const userMessage: Message = {
        role: 'user',
        content: `📁 **Uploaded File:** ${file.name}\n\n*System automatically analyzing context...*`,
        timestamp: Date.now(),
      };

      const aiMessage: Message = {
        role: 'assistant',
        content: response.analysis,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, userMessage, aiMessage]);

      const material: StudyMaterialItem = {
        id: `upload_${Date.now()}`,
        type: 'upload',
        title: `Upload Analysis: ${file.name}`,
        subject: selectedSubject,
        chapter: selectedChapter || 'Uploaded Material',
        content: `Extracted Text:\n${response.extracted_text || ''}\n\nAI Analysis:\n${response.analysis}`,
        createdAt: Date.now(),
      };
      saveStudyMaterialIfNew(material);
      try {
        await saveMaterialToDatabase(material);
      } catch {
        // Keep local save if server sync temporarily fails.
      }

      incrementDailyUpload();
    } catch {
      toast.error('Vision analysis failed.');
    } finally {
      setIsLoading(false);
    }
  };

  const saveAnswerBookmark = (content: string, index: number) => {
    const added = addBookmark({
      id: `bm_${Date.now()}_${index}`,
      type: 'answer',
      subject: selectedSubject,
      chapter: selectedChapter,
      question: messages[index - 1]?.role === 'user' ? messages[index - 1].content : undefined,
      answer: content,
      createdAt: Date.now(),
    });
    if (added) {
      toast.success('Saved to Revise Later');
    } else {
      toast('Already bookmarked');
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] ">
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-8">
        {/* New Prominent Autonomous Header */}
        <div className="flex flex-col lg:row md:flex-row md:items-center justify-between gap-6 mb-10">
          <div className="flex items-center gap-5">
            <Button
              variant="outline"
              size="md"
              onClick={() => navigate(-1)}
              className="rounded-2xl w-12 h-12 bg-[#FCFAF8] border-stone-200 shadow-sm hover:scale-105 transition-transform"
            >
              <ArrowLeft size={20} className="text-stone-600 " />
            </Button>
            <div>
              <h1 className="text-3xl font-black text-[#2C241B] flex items-center gap-3">
                <Sparkles className="text-[#8C5A35] animate-pulse" />
                AI Tutor Room
              </h1>
              <p className="text-sm text-stone-500 font-bold uppercase tracking-widest mt-1 flex items-center gap-2">
                <span className="w-2 h-2 bg-[#8C5A35] rounded-full" />
                Class {user?.class} • Boards Edition
              </p>
            </div>
          </div>

          {/* Prominent Context Selectors */}
          <div className="flex flex-wrap items-center gap-3 bg-[#FCFAF8] p-3 rounded-[24px] shadow-lg border border-stone-100 ">
            <div className="flex items-center gap-3 px-4 py-2 bg-[#FCFAF8] rounded-xl border border-stone-100 ">
              <BookOpen size={16} className="text-[#8C5A35]" />
              <select
                value={selectedSubject}
                onChange={(e) => {
                  setSelectedSubject(e.target.value);
                  setSelectedChapter('');
                }}
                className="bg-transparent border-none text-sm font-black text-[#3E352B] focus:ring-0 outline-none cursor-pointer min-w-[100px]"
              >
                {(user?.subjects || subjectsForClass).map((sub: string) => <option key={sub} value={sub}>{sub}</option>)}
              </select>
            </div>

            <div className="flex items-center gap-3 px-4 py-2 bg-[#FCFAF8] rounded-xl border border-stone-100 ">
              <span className="text-[10px] font-black text-stone-400 uppercase tracking-tighter">Chapter</span>
              <select
                value={selectedChapter}
                onChange={(e) => setSelectedChapter(e.target.value)}
                className="bg-transparent border-none text-sm font-black text-[#8C5A35] focus:ring-0 outline-none cursor-pointer max-w-[220px]"
              >
                {availableChapters.map((ch: string) => <option key={ch} value={ch}>{ch}</option>)}
              </select>
            </div>

            <div className="flex items-center gap-3 px-4 py-2 bg-[#FCFAF8] rounded-xl border border-stone-100 ">
              <span className="text-[10px] font-black text-stone-400 uppercase tracking-tighter">Answer Mode</span>
              <select
                value={markMode}
                onChange={(e) => setMarkMode(e.target.value as '1-mark' | '3-mark' | '5-mark')}
                className="bg-transparent border-none text-sm font-black text-[#8C5A35] focus:ring-0 outline-none cursor-pointer"
              >
                <option value="1-mark">1 Mark</option>
                <option value="3-mark">3 Marks</option>
                <option value="5-mark">5 Marks</option>
              </select>
            </div>
          </div>
        </div>

        {/* Context Guidance Card */}
        <Card className="mb-8 p-6 bg-gradient-to-r from-amber-50 to-teal-50 border-2 border-amber-200 rounded-[32px]">
          <div className="flex gap-4 items-start">
            <div className="p-3 bg-amber-200 rounded-2xl flex-shrink-0">
              <Info className="text-amber-700 " size={24} />
            </div>
            <div className="flex-1">
              <h4 className="font-black text-amber-900 mb-3 text-lg">Mark Mode Guide</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <p className="text-sm font-bold text-amber-800 mb-2">📝 1-Mark Answers</p>
                  <p className="text-xs text-amber-700 leading-relaxed">
                    <strong>Crisp definition:</strong> "Photosynthesis is the process of converting light into chemical energy" (1-2 sentences max)
                  </p>
                </div>
                <div>
                  <p className="text-sm font-bold text-amber-800 mb-2">📋 3-Mark Answers</p>
                  <p className="text-xs text-amber-700 leading-relaxed">
                    <strong>3 Key points:</strong> Introduction + 2 main points with examples + conclusion (3-5 sentences)
                  </p>
                </div>
                <div>
                  <p className="text-sm font-bold text-amber-800 mb-2">📚 5-Mark Answers</p>
                  <p className="text-xs text-amber-700 leading-relaxed">
                    <strong>Full explanation:</strong> Intro + diagram/steps + 4+ points + real-world example + conclusion
                  </p>
                </div>
              </div>
            </div>
          </div>
        </Card>

        <div className="flex flex-col gap-4 h-[calc(100vh-220px)]">
          <div className="flex-1 flex flex-col gap-4">
            <Card className="flex-1 flex flex-col bg-[#FCFAF8] border-none shadow-2xl rounded-[40px] overflow-hidden border border-white/50">
              <div className="flex-1 overflow-y-auto p-6 md:p-10 space-y-10 scrollbar-hide">
                {messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center max-w-lg mx-auto space-y-8 animate-in fade-in zoom-in duration-500">
                    <div className="relative">
                      <div className="w-24 h-24 bg-[#8C5A35]/10 rounded-[32px] flex items-center justify-center animate-bounce">
                        <Bot className="text-[#8C5A35]" size={48} />
                      </div>
                      <div className="absolute -top-2 -right-2 w-8 h-8 bg-yellow-400 rounded-full flex items-center justify-center shadow-lg border-4 border-white ">
                        <Zap size={14} className="text-white fill-current" />
                      </div>
                    </div>
                    <div>
                      <h3 className="text-3xl font-black text-[#2C241B] mb-3 tracking-tight">
                        I'm ready for <span className="text-[#8C5A35]">{selectedChapter}</span>
                      </h3>
                      <p className="text-stone-500 font-medium leading-relaxed">
                        I've loaded the NCERT curriculum. What should we tackle first?
                      </p>
                    </div>
                  </div>
                ) : (
                  messages.map((m, i) => (
                    <div
                      key={i}
                      className={`flex gap-6 max-w-4xl ${
                        m.role === 'user' ? 'flex-row-reverse ml-auto' : 'mr-auto'
                      }`}
                    >
                      <div
                        className={`w-14 h-14 rounded-[22px] flex items-center justify-center flex-shrink-0 shadow-lg ${
                          m.role === 'user'
                            ? 'bg-stone-900 text-white '
                            : 'bg-gradient-to-tr from-[#8C5A35] to-[#2cd6a0] text-white'
                        }`}
                      >
                        {m.role === 'user' ? <User size={24} /> : <Bot size={24} />}
                      </div>
                      <div
                        className={`p-8 rounded-[32px] leading-relaxed font-bold text-[15px] border ${
                          m.role === 'user'
                            ? 'bg-[#FCFAF8] border-stone-100 text-[#3E352B] rounded-tr-none '
                            : 'bg-[#8C5A35]/5 border-[#8C5A35]/10 text-[#3E352B] rounded-tl-none'
                        }`}
                      >
                        <MarkdownContent content={m.content} className="prose prose-sm " />
                      </div>
                    </div>
                  ))
                )}

                {isLoading && (
                  <div className="flex gap-6 max-w-4xl mr-auto">
                    <div className="w-14 h-14 rounded-[22px] bg-gradient-to-tr from-[#8C5A35] to-[#2cd6a0] text-white flex items-center justify-center flex-shrink-0 shadow-lg">
                      <Bot size={24} className="animate-pulse" />
                    </div>
                    <div className="p-8 rounded-[32px] rounded-tl-none bg-[#8C5A35]/5 border border-[#8C5A35]/10 text-[#3E352B] flex items-center gap-3 font-bold text-sm">
                      <div className="animate-spin h-5 w-5 border-3 border-[#8C5A35] border-t-transparent rounded-full" />
                      Clarity AI is researching and formulating response...
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Redesigned Input Bar */}
              <div className="p-8 bg-[#FCFAF8]/50 border-t border-stone-100 backdrop-blur-xl">
                <div className="relative max-w-4xl mx-auto group">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute left-4 top-1/2 -transtone-y-1/2 p-3 text-stone-400 hover:text-[#8C5A35] transition-all bg-[#FCFAF8] rounded-2xl shadow-sm hover:scale-110 active:scale-90 border border-stone-100 "
                  >
                    <Paperclip size={22} />
                  </button>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    className="hidden"
                    accept="image/*,.pdf"
                  />
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                    placeholder="Ask boards, solve problems, or upload notes..."
                    className="w-full pl-20 pr-20 py-6 bg-[#FCFAF8] text-[#2C241B] rounded-[32px] shadow-2xl border border-stone-200 focus:ring-8 focus:ring-[#8C5A35]/10 outline-none transition-all font-bold text-lg placeholder:text-stone-400"
                  />
                  <button
                    onClick={() => handleSendMessage()}
                    disabled={!input.trim() || isLoading}
                    className="absolute right-4 top-1/2 -transtone-y-1/2 p-4 bg-[#8C5A35] text-white rounded-[24px] hover:bg-[#70482B] disabled:opacity-50 disabled:grayscale transition-all active:scale-90 shadow-lg shadow-[#8C5A35]/30 group-hover:rotate-3"
                  >
                    <Send size={24} />
                  </button>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
      <PremiumModal
        isOpen={showPremiumModal}
        onClose={() => setShowPremiumModal(false)}
        feature="Daily Upload & Request Limit Reached"
      />

      {showPersonalityModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-[#FCFAF8] border border-stone-200 rounded-3xl p-8 max-w-2xl w-full shadow-2xl space-y-6">
            <div className="text-center space-y-2">
              <div className="w-16 h-16 bg-[#8C5A35]/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Bot className="w-8 h-8 text-[#8C5A35]" />
              </div>
              <h2 className="text-2xl font-black text-[#2C241B] ">Choose my teaching style</h2>
              <p className="text-sm font-semibold text-stone-500">How do you want me to explain concepts to you?</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
              {[
                { name: 'Strict & To-The-Point', desc: 'No fluff. Direct answers and bullet points.' },
                { name: 'Socratic Coach', desc: 'Asks questions to guide you to the answer.' },
                { name: 'Encouraging & Patient', desc: 'Step-by-step with analogies. High empathy.' },
                { name: 'Conversational & Casual', desc: 'Talks like a friend, easy to understand.' },
                { name: 'Board Examiner', desc: 'Focuses strictly on marking schemes and exam traps.' },
              ].map((style, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSelectPersonality(style.name)}
                  className="p-5 border-2 border-stone-100 rounded-2xl hover:border-[#8C5A35] hover:bg-[#8C5A35]/5 transition-all text-left group"
                >
                  <p className="text-sm font-black text-[#3E352B] group-hover:text-[#8C5A35]">{style.name}</p>
                  <p className="text-xs font-medium text-stone-500 mt-1">{style.desc}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
