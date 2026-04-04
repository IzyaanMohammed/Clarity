import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Send, Paperclip, RefreshCw, Lightbulb, Sparkles, ArrowLeft, Bot, User, BookOpen } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import toast from 'react-hot-toast';
import { Navbar } from '../components/layout/Navbar';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { PremiumModal } from '../components/PremiumModal';
import { NCERT_CHAPTERS } from '../constants/ncert';
import { getUser, incrementDailyQuestion, checkDailyLimits, addActivity, incrementDailyUpload } from '../utils/storage';
import { askQuestion, uploadFile, logProgress } from '../api';
import { Message } from '../types';

export const AskAI = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const user = getUser();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedSubject, setSelectedSubject] = useState(
    location.state?.subject || user?.subjects[0] || 'Science'
  );
  const [selectedChapter, setSelectedChapter] = useState(location.state?.chapter || '');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPremiumModal, setShowPremiumModal] = useState(false);

  // Autonomous Data Fetching
  const classKey = (user?.class || '10').toString();
  const availableChapters = NCERT_CHAPTERS[classKey]?.[selectedSubject] || [];

  useEffect(() => {
    // Auto-select first chapter if none selected or if subject changed
    if (availableChapters.length > 0 && (!selectedChapter || !availableChapters.includes(selectedChapter))) {
      setSelectedChapter(availableChapters[0]);
    }
  }, [selectedSubject, availableChapters]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const quickActions = [
    { label: 'Summarize Chapter', prompt: `Summarize the chapter "${selectedChapter}" in 5 crisp bullet points.` },
    { label: 'Most Important Qs', prompt: `What are the 3 most important questions from "${selectedChapter}" for the board exam?` },
    { label: 'Numerical Steps', prompt: `Show me the step-by-step method to solve numericals in "${selectedChapter}".` },
    { label: 'Socratic Guide', prompt: `Help me understand "${selectedChapter}" by asking me questions one by one.` },
  ];

  const handleSendMessage = async (customMessage?: string) => {
    const messageText = customMessage || input.trim();
    if (!messageText) return;

    // Autonomous fallback: Ensure a chapter is always selected
    let currentChapter = selectedChapter;
    if (!currentChapter && availableChapters.length > 0) {
      currentChapter = availableChapters[0];
      setSelectedChapter(currentChapter);
    }

    const limits = checkDailyLimits(user);
    if (!limits.canAsk) {
      setShowPremiumModal(true);
      return;
    }

    const userMessage: Message = {
      role: 'user',
      content: messageText,
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

      const response = await askQuestion({
        class_num: classKey,
        subject: selectedSubject,
        chapter: currentChapter,
        question: messageText,
        conversation_history: conversationHistory,
      });

      const aiMessage: Message = {
        role: 'assistant',
        content: response.answer,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, aiMessage]);
      incrementDailyQuestion();
      
      if (user?.name) {
        logProgress({
          user_id: user.name,
          action: 'question',
          subject: selectedSubject,
          chapter: currentChapter
        });
      }
    } catch (error: any) {
      console.error("API Error details:", error.response?.data || error);
      const errorMessage = error.response?.data?.detail || "Connection to AI server failed. Check your API key.";
      toast.error(`API Error: ${errorMessage}`);
      
      // Fallback message in the chat
      setMessages((prev) => [...prev, {
        role: 'assistant',
        content: `💡 **Tutor Nudge:** I'm having trouble with the main server. Please check if your API Key is valid or has enough credits!`,
        timestamp: Date.now()
      }]);
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

    setIsLoading(true);
    try {
      const response = await uploadFile(file, "Summarize this study material and explain key concepts.");
      
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
      incrementDailyUpload();
    } catch (error) {
      toast.error('Vision analysis failed.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-[#020617]">
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-8">
        {/* New Prominent Autonomous Header */}
        <div className="flex flex-col lg:row md:flex-row md:items-center justify-between gap-6 mb-10">
          <div className="flex items-center gap-5">
            <Button 
              variant="outline" 
              size="icon" 
              onClick={() => navigate(-1)} 
              className="rounded-2xl w-12 h-12 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-sm hover:scale-105 transition-transform"
            >
              <ArrowLeft size={20} className="text-slate-600 dark:text-slate-300" />
            </Button>
            <div>
              <h1 className="text-3xl font-black text-slate-900 dark:text-white flex items-center gap-3">
                <Sparkles className="text-[#1D9E75] animate-pulse" />
                AI Tutor Room
              </h1>
              <p className="text-sm text-slate-500 font-bold uppercase tracking-widest mt-1 flex items-center gap-2">
                <span className="w-2 h-2 bg-[#1D9E75] rounded-full" />
                Class {user?.class} • Boards Edition
              </p>
            </div>
          </div>

          {/* Prominent Context Selectors */}
          <div className="flex flex-wrap items-center gap-3 bg-white dark:bg-slate-800 p-3 rounded-[24px] shadow-lg border border-slate-100 dark:border-slate-700">
            <div className="flex items-center gap-3 px-4 py-2 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800">
              <BookOpen size={16} className="text-[#1D9E75]" />
              <select
                value={selectedSubject}
                onChange={(e) => {
                  setSelectedSubject(e.target.value);
                  setSelectedChapter('');
                }}
                className="bg-transparent border-none text-sm font-black text-slate-800 dark:text-slate-100 focus:ring-0 outline-none cursor-pointer min-w-[100px]"
              >
                {user?.subjects.map((sub: string) => <option key={sub} value={sub}>{sub}</option>)}
              </select>
            </div>
            
            <div className="flex items-center gap-3 px-4 py-2 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Chapter</span>
              <select
                value={selectedChapter}
                onChange={(e) => setSelectedChapter(e.target.value)}
                className="bg-transparent border-none text-sm font-black text-[#1D9E75] focus:ring-0 outline-none cursor-pointer max-w-[220px]"
              >
                {availableChapters.map((ch: string) => <option key={ch} value={ch}>{ch}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 h-[calc(100vh-220px)]">
          <div className="lg:col-span-3 flex flex-col gap-4">
            <Card className="flex-1 flex flex-col bg-white dark:bg-[#0f172a] border-none shadow-2xl rounded-[40px] overflow-hidden border border-white/50">
              <div className="flex-1 overflow-y-auto p-6 md:p-10 space-y-10 scrollbar-hide">
                {messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center max-w-lg mx-auto space-y-8 animate-in fade-in zoom-in duration-500">
                    <div className="relative">
                      <div className="w-24 h-24 bg-[#1D9E75]/10 rounded-[32px] flex items-center justify-center animate-bounce">
                        <Bot className="text-[#1D9E75]" size={48} />
                      </div>
                      <div className="absolute -top-2 -right-2 w-8 h-8 bg-yellow-400 rounded-full flex items-center justify-center shadow-lg border-4 border-white dark:border-[#0f172a]">
                        <Zap size={14} className="text-white fill-current" />
                      </div>
                    </div>
                    <div>
                      <h3 className="text-3xl font-black text-slate-900 dark:text-white mb-3 tracking-tight">
                        I'm ready for <span className="text-[#1D9E75]">{selectedChapter}</span>
                      </h3>
                      <p className="text-slate-500 font-medium leading-relaxed">
                        I've loaded the NCERT curriculum. What should we tackle first?
                      </p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
                      {quickActions.map((action) => (
                        <button
                          key={action.label}
                          onClick={() => handleSendMessage(action.prompt)}
                          className="p-5 text-left bg-slate-50 dark:bg-slate-800/50 hover:bg-[#1D9E75] hover:text-white hover:-translate-y-1 text-slate-700 dark:text-slate-200 rounded-[24px] transition-all group border border-slate-100 dark:border-slate-700 active:scale-95 shadow-sm"
                        >
                          <p className="text-xs font-black uppercase tracking-widest opacity-50 mb-1 group-hover:opacity-100">Study Goal</p>
                          <p className="text-sm font-bold">{action.label}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  messages.map((msg, index) => (
                    <div key={index} className={`flex gap-5 ${msg.role === 'user' ? 'flex-row-reverse' : ''} animate-in slide-in-from-bottom-4 duration-300`}>
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-lg ${
                        msg.role === 'user' ? 'bg-slate-900 text-white' : 'bg-[#1D9E75] text-white'
                      }`}>
                        {msg.role === 'user' ? <User size={24} /> : <Bot size={24} />}
                      </div>
                      <div className={`max-w-[85%] p-6 rounded-[32px] shadow-sm ${
                        msg.role === 'user'
                          ? 'bg-[#1D9E75] text-white rounded-tr-none shadow-emerald-200 dark:shadow-none'
                          : 'bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-tl-none border border-slate-100 dark:border-slate-700'
                      }`}>
                        <div className="prose dark:prose-invert max-w-none text-inherit leading-relaxed font-medium">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {msg.content}
                          </ReactMarkdown>
                        </div>
                      </div>
                    </div>
                  ))
                )}
                {isLoading && (
                  <div className="flex gap-5 animate-pulse">
                    <div className="w-12 h-12 bg-[#1D9E75]/20 rounded-2xl" />
                    <div className="w-48 h-16 bg-slate-100 dark:bg-slate-800 rounded-[24px]" />
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Redesigned Input Bar */}
              <div className="p-8 bg-slate-50/50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800 backdrop-blur-xl">
                <div className="relative max-w-4xl mx-auto group">
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute left-4 top-1/2 -translate-y-1/2 p-3 text-slate-400 hover:text-[#1D9E75] transition-all bg-white dark:bg-slate-800 rounded-2xl shadow-sm hover:scale-110 active:scale-90 border border-slate-100 dark:border-slate-700"
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
                    className="w-full pl-20 pr-20 py-6 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-[32px] shadow-2xl border border-slate-200 dark:border-slate-700 focus:ring-8 focus:ring-[#1D9E75]/10 outline-none transition-all font-bold text-lg placeholder:text-slate-400"
                  />
                  <button
                    onClick={() => handleSendMessage()}
                    disabled={!input.trim() || isLoading}
                    className="absolute right-4 top-1/2 -translate-y-1/2 p-4 bg-[#1D9E75] text-white rounded-[24px] hover:bg-[#16805d] disabled:opacity-50 disabled:grayscale transition-all active:scale-90 shadow-lg shadow-[#1D9E75]/30 group-hover:rotate-3"
                  >
                    <Send size={24} />
                  </button>
                </div>
              </div>
            </Card>
          </div>

          {/* Sidebar Tools */}
          <div className="hidden lg:flex flex-col gap-6">
            <Card className="p-8 bg-gradient-to-br from-slate-900 to-slate-800 text-white border-none rounded-[32px] shadow-2xl relative overflow-hidden group">
              <div className="relative z-10">
                <div className="w-12 h-12 bg-yellow-400 rounded-2xl flex items-center justify-center mb-6">
                  <Award className="text-slate-900" size={28} />
                </div>
                <h4 className="font-black text-xl mb-3 tracking-tight">Board Predictor</h4>
                <p className="text-slate-400 text-sm mb-6 font-medium leading-relaxed">
                  Based on last 10 years, **{selectedChapter}** has a 75% chance of appearing in 5-mark section.
                </p>
                <div className="p-4 bg-white/10 rounded-2xl border border-white/20 text-xs italic font-bold text-yellow-300">
                  "Focus on: Diagram of Electrolysis"
                </div>
              </div>
              <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-[#1D9E75]/20 rounded-full blur-[40px] group-hover:scale-125 transition-transform" />
            </Card>

            <Card className="p-8 bg-white dark:bg-[#0f172a] border-none shadow-xl flex-1 border border-slate-100 dark:border-slate-800">
              <h4 className="font-black text-slate-900 dark:text-white mb-6 uppercase tracking-widest text-xs opacity-50">Tutor Toolbox</h4>
              <div className="space-y-4">
                {[
                  { icon: <RefreshCw />, label: 'Flashcards', desc: 'AI Revision', prompt: `Generate 5 flashcards for the chapter "${selectedChapter}" in Question: Answer format.` },
                  { icon: <BookOpen />, label: 'NCERT Solver', desc: 'Step-by-step', prompt: `Show me step-by-step solutions for the most difficult NCERT exercises in "${selectedChapter}".` },
                  { icon: <Zap />, label: 'Cheat Sheet', desc: 'Formulas', prompt: `Create a one-page cheat sheet for "${selectedChapter}" including all formulas and key definitions.` },
                  { icon: <Sparkles />, label: 'Vision Scan', desc: 'Handwritten Notes', action: () => fileInputRef.current?.click() },
                ].map((tool, i) => (
                  <button 
                    key={i} 
                    onClick={() => tool.prompt ? handleSendMessage(tool.prompt) : tool.action?.()}
                    className="w-full p-5 rounded-[24px] border border-slate-50 dark:border-slate-800 hover:border-[#1D9E75] hover:bg-[#1D9E75]/5 text-left transition-all group flex items-center gap-4"
                  >
                    <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-2xl group-hover:bg-[#1D9E75] group-hover:text-white transition-all shadow-sm">
                      {tool.icon}
                    </div>
                    <div>
                      <span className="font-black text-sm text-slate-800 dark:text-slate-200 block">{tool.label}</span>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">{tool.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </div>
      <PremiumModal isOpen={showPremiumModal} onClose={() => setShowPremiumModal(false)} />
    </div>
  );
};

import { Award, Zap, ClipboardList } from 'lucide-react';
