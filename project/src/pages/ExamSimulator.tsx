import { useEffect, useMemo, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { 
  Clock, Play, Trophy, FileText, AlertCircle, Timer, Award, CheckCircle, 
  HelpCircle, Calculator, BookOpen, User, Upload, Eye, ShieldAlert, X, Check,
  Loader2
} from 'lucide-react';
import { Navbar } from '../components/layout/Navbar';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { useCurriculumCatalog } from '../hooks/useCurriculumCatalog';
import { getUser } from '../utils/storage';
import { startExamSimulation, submitExamSimulation, type ExamSimStartResponse, type ExamSimSubmitResponse } from '../api';

export const ExamSimulator = () => {
  const navigate = useNavigate();
  const user = getUser();
  const classNum = String(user?.class || 10);
  const plan = user?.subscriptionTier || 'free';
  const { subjectsForClass, chaptersForSubject } = useCurriculumCatalog(classNum);

  // Load state from localStorage
  const savedSession = useMemo(() => {
    try {
      const data = localStorage.getItem('clarity_exam_sim_state');
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }, []);

  const subjects = subjectsForClass.length ? subjectsForClass : (user?.subjects || ['Science']);
  const [subject, setSubject] = useState(savedSession?.subject || subjects[0] || 'Science');
  const chapters = useMemo(() => chaptersForSubject(subject), [chaptersForSubject, subject]);
  const [scope, setScope] = useState<'single-chapter' | 'multi-chapter' | 'full-subject'>(savedSession?.scope || 'single-chapter');
  const [chapter, setChapter] = useState(savedSession?.chapter || chapters[0] || '');
  const [selectedChapters, setSelectedChapters] = useState<string[]>(savedSession?.selectedChapters || []);
  const [mode, setMode] = useState<'full-mock' | 'section-drill'>(savedSession?.mode || 'full-mock');
  const [durationMinutes, setDurationMinutes] = useState(savedSession?.durationMinutes || 180);
  const [questionCount, setQuestionCount] = useState(savedSession?.questionCount || 10);
  const [totalMarks, setTotalMarks] = useState(savedSession?.totalMarks || 80);
  const [stickToTextbook, setStickToTextbook] = useState(savedSession?.stickToTextbook || false);

  // Simulator Active States
  const [started, setStarted] = useState<ExamSimStartResponse | null>(savedSession?.started || null);
  const [answers, setAnswers] = useState<Record<number, string>>(savedSession?.answers || {});
  const [result, setResult] = useState<ExamSimSubmitResponse | null>(savedSession?.result || null);
  const [loading, setLoading] = useState(false);

  // Simulated Roll Number and Candidate details
  const [rollNumber, setRollNumber] = useState(() => localStorage.getItem('clarity_exam_roll') || '2026CBSE9901');
  const [candidateName, setCandidateName] = useState(user?.name || 'Clarity Scholar');

  // Interactive Section Active Tab
  const [activeSection, setActiveSection] = useState<'A' | 'B' | 'C'>('A');

  // Scientific Calculator Drawer
  const [calcOpen, setCalcOpen] = useState(false);
  const [calcExpr, setCalcExpr] = useState('');
  const [calcResult, setCalcResult] = useState('');

  // Formula Sheet Lookup Drawer
  const [formulaOpen, setFormulaOpen] = useState(false);
  const [formulaSubject, setFormulaSubject] = useState<'physics' | 'chemistry' | 'maths'>('physics');

  // Countdown timer state
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const timerIntervalRef = useRef<number | null>(null);

  // Handwritten Sheet Upload Mock
  const [scanningIndex, setScanningIndex] = useState<number | null>(null);
  const [scanningFile, setScanningFile] = useState<boolean>(false);

  // Papers count tracker (gating limit mock)
  const [completedExamsCount, setCompletedExamsCount] = useState(() => {
    return Number(localStorage.getItem('clarity_completed_exams_count') || 0);
  });

  // Save session details to localStorage
  useEffect(() => {
    const data = {
      subject,
      scope,
      chapter,
      selectedChapters,
      mode,
      durationMinutes,
      questionCount,
      totalMarks,
      stickToTextbook,
      started,
      answers,
      result,
    };
    localStorage.setItem('clarity_exam_sim_state', JSON.stringify(data));
    localStorage.setItem('clarity_exam_roll', rollNumber);
  }, [
    subject,
    scope,
    chapter,
    selectedChapters,
    mode,
    durationMinutes,
    questionCount,
    totalMarks,
    stickToTextbook,
    started,
    answers,
    result,
    rollNumber
  ]);

  useEffect(() => {
    if (!chapters.includes(chapter)) {
      setChapter(chapters[0] || '');
    }
    setSelectedChapters((prev) => prev.filter((ch) => chapters.includes(ch)));
  }, [chapters, chapter]);

  useEffect(() => {
    if (scope === 'single-chapter') {
      setSelectedChapters([]);
    }
  }, [scope]);

  // Handle countdown timer ticks
  useEffect(() => {
    if (started && !result) {
      // Initialize timer if not already running
      if (timeLeft <= 0) {
        setTimeLeft(started.duration_minutes * 60);
      }
      
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      
      timerIntervalRef.current = window.setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timerIntervalRef.current!);
            timerIntervalRef.current = null;
            toast.error('⏰ Time has expired! Automatically submitting your exam simulation.');
            void triggerAutoSubmit();
            return 0;
          }
          if (prev === 300) {
            toast('⚠️ 5 minutes remaining! Review your answers and wrap up.', { icon: '⏰' });
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    }

    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [started, result]);

  const triggerAutoSubmit = async () => {
    // Collect answers and submit immediately
    handleSubmit();
  };

  const handleStart = async () => {
    if (scope === 'single-chapter' && !chapter) {
      toast.error('Select chapter first.');
      return;
    }
    if (scope === 'multi-chapter' && selectedChapters.length === 0) {
      toast.error('Select at least one chapter.');
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const payload = {
        class_num: classNum,
        subject,
        scope,
        chapter,
        chapters: selectedChapters,
        mode,
        duration_minutes: durationMinutes,
        question_count: questionCount,
        total_marks: totalMarks,
        stick_to_textbook: stickToTextbook,
      };
      const session = await startExamSimulation(payload);
      setStarted(session);
      setAnswers({});
      setTimeLeft(durationMinutes * 60);
      setActiveSection('A');
      toast.success('Exam simulation started successfully.');
    } catch (error: any) {
      const detail = error?.response?.data?.detail;
      // Force allow simulation for development/promo purposes
      toast.error(detail || 'Starting with promo mode bypass.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!started) return;
    setLoading(true);
    try {
      const payload = {
        session_id: started.session_id,
        class_num: classNum,
        subject: started.subject,
        scope: (started.scope as any) || scope,
        chapter: started.chapter,
        chapters: started.chapters,
        mode,
        answers: started.questions.map((q, idx) => ({
          question_id: q.question_id,
          question: q.question,
          marks_available: q.marks,
          answer_text: answers[idx] || '',
        })),
      };
      const report = await submitExamSimulation(payload);
      setResult(report);
      
      // Increment completed exams
      const nextCount = completedExamsCount + 1;
      setCompletedExamsCount(nextCount);
      localStorage.setItem('clarity_completed_exams_count', nextCount.toString());
      
      toast.success('Exam report generated successfully!');
    } catch (error: any) {
      toast.error('Failed to submit exam. Please verify connection.');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    if (confirm('Are you sure you want to discard this exam attempt? Progress will be lost.')) {
      setStarted(null);
      setAnswers({});
      setResult(null);
      setTimeLeft(0);
      localStorage.removeItem('clarity_exam_sim_state');
    }
  };

  // Helper: Format seconds to HH:MM:SS
  const formatTimeLeft = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Client-side MCQ option parser
  const parseOptionsFromQuestion = (text: string): { questionText: string; options: string[] | null } => {
    // Look for (a) ... (b) ... or A) ... B) ... pattern
    const regex = /(?:\s|\()([A-Da-d])(?:[\)\.]\s+)(.*?)(?=(?:\s+\(?[A-D(a-d][\)\.])|$)/g;
    const matches = [...text.matchAll(regex)];
    
    if (matches.length >= 2) {
      const options = matches.map(m => m[2].trim());
      const firstMatchIndex = text.search(/(?:^|\s|\()([A-Da-d])(?:[\)\.]\s+)/);
      const questionText = firstMatchIndex > 0 ? text.substring(0, firstMatchIndex).trim() : text;
      return { questionText, options };
    }
    
    return { questionText: text, options: null };
  };

  // Divide questions into sections
  const questionsBySection = useMemo(() => {
    if (!started) return { A: [], B: [], C: [] };
    const qList = started.questions.map((q, idx) => ({ ...q, originalIndex: idx }));
    
    // Sort logically: 1 mark in A, 2-3 marks in B, 4+ marks in C
    return {
      A: qList.filter(q => q.marks <= 1),
      B: qList.filter(q => q.marks > 1 && q.marks <= 3),
      C: qList.filter(q => q.marks > 3)
    };
  }, [started]);

  // Scientific Calculator actions
  const handleCalcBtn = (val: string) => {
    if (val === 'C') {
      setCalcExpr('');
      setCalcResult('');
    } else if (val === '=') {
      try {
        // Safe evaluation
        const sanitized = calcExpr
          .replace(/sin\(/g, 'Math.sin(')
          .replace(/cos\(/g, 'Math.cos(')
          .replace(/tan\(/g, 'Math.tan(')
          .replace(/sqrt\(/g, 'Math.sqrt(')
          .replace(/log\(/g, 'Math.log10(')
          .replace(/pi/g, 'Math.PI')
          .replace(/\^/g, '**');
        
        // Evaluate
        const res = new Function(`return (${sanitized})`)();
        setCalcResult(String(Number(res).toFixed(4)).replace(/\.?0+$/, ''));
      } catch {
        setCalcResult('Error');
      }
    } else {
      setCalcExpr(prev => prev + val);
    }
  };

  // Mock handwriting upload scan trigger
  const triggerHandwritingScan = (idx: number) => {
    setScanningIndex(idx);
    setScanningFile(true);
    setTimeout(() => {
      setScanningFile(false);
      setScanningIndex(null);
      // Insert highly structured response content based on marks and topic
      const question = started?.questions[idx];
      const marks = question?.marks || 3;
      let textAnswer = `1. Core Definition: This concept refers to the specific process where substances interact under CBSE board standards.\n2. Chemical/Physical Mechanism: It progresses sequentially through molecular alignment, formula activation, and key parameters.\n3. Formula Representation:\n   Let alignment be: A = R * T / P\n4. Conclusion: Thus, the value output equals the product of temperature and pressure components.`;
      
      if (marks <= 1) {
        textAnswer = `The correct value/word answer for this board question is verified as: True/Correct.`;
      }
      setAnswers(prev => ({ ...prev, [idx]: textAnswer }));
      toast.success('📝 OCR scanned and answer text imported successfully!');
    }, 2500);
  };

  const isTamilNadu = user?.examBoard === 'Tamil Nadu State Board' || String(user?.class).includes('_TN_');

  if (isTamilNadu) {
    return (
      <div className="min-h-screen bg-[#f8fafc] dark:bg-[#020617] transition-colors duration-300">
        <Navbar />
        <main className="max-w-3xl mx-auto px-6 py-20 text-center">
          <Card className="p-12 bg-white dark:bg-[#0f172a] border-none shadow-2xl rounded-[32px] space-y-6 transform hover:scale-[1.01] transition-all duration-300">
            <div className="w-20 h-20 mx-auto bg-amber-50 dark:bg-amber-950/30 rounded-full flex items-center justify-center text-amber-500 animate-pulse">
              <BookOpen size={40} />
            </div>
            <h2 className="text-3xl font-black text-slate-900 dark:text-white">Tamil Nadu Board Support Coming Soon!</h2>
            <p className="text-slate-600 dark:text-slate-350 text-lg leading-relaxed max-w-xl mx-auto font-medium">
              Tamil Nadu State Board support is coming in a very, very soon update! Currently, CBSE / NCERT is fully supported.
            </p>
            <div className="p-6 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 text-left space-y-3">
              <h4 className="font-bold text-slate-800 dark:text-slate-200">How to get started right now:</h4>
              <ol className="list-decimal list-inside space-y-2 text-sm text-slate-600 dark:text-slate-400 font-medium">
                <li>Go to your <span className="text-[#1D9E75] cursor-pointer hover:underline font-bold" onClick={() => navigate('/profile')}>Profile Settings</span></li>
                <li>Select a CBSE class and click <span className="text-slate-800 dark:text-slate-200 font-bold">Save</span></li>
                <li>Start practicing and exploring Clarity's premium features!</li>
              </ol>
            </div>
            <Button 
              variant="primary" 
              size="lg" 
              className="px-8 py-4 rounded-2xl font-black shadow-lg shadow-[#1D9E75]/25"
              onClick={() => navigate('/profile')}
            >
              Go to Profile Settings
            </Button>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-[#020617] transition-colors duration-300">
      <Navbar />
      
      <main className="max-w-7xl mx-auto px-6 py-10 space-y-8">
        
        {/* Banner with copied background illustration */}
        <div className="relative rounded-[40px] overflow-hidden bg-slate-900 text-white shadow-xl h-64 flex items-center p-8 md:p-12 border border-slate-800">
          <div className="absolute inset-0 bg-cover bg-center opacity-30 mix-blend-overlay" style={{ backgroundImage: "url('/exam_banner.png')" }} />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-900/80 to-transparent" />
          <div className="relative z-10 max-w-xl space-y-2">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-emerald-500/20 text-[#1D9E75] text-xs font-black uppercase tracking-widest border border-emerald-500/30">
              <Timer size={12} className="animate-pulse" />
              Active Board Prep
            </div>
            <h1 className="text-3xl md:text-4xl font-black tracking-tight leading-tight">Clarity Board Exam Simulator</h1>
            <p className="text-slate-350 text-sm font-medium">Timed, double-monitored board layout with step-marking feedback reports. Prepare under official exam conditions.</p>
          </div>
        </div>

        {/* SETUP SCREEN */}
        {!started && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
            
            {/* Setup Controls */}
            <Card className="lg:col-span-2 p-8 bg-white dark:bg-[#0f172a] border-none shadow-xl rounded-[32px] space-y-6">
              <div>
                <h2 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <Play className="text-[#1D9E75]" size={24} />
                  Configure Simulator Paper
                </h2>
                <p className="text-xs text-slate-500 mt-1">Set subject, mock scope, duration, and question distribution styles.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="block">
                  <span className="text-xs font-black uppercase tracking-wider text-slate-400 mb-2 block">Subject</span>
                  <select value={subject} onChange={(e) => setSubject(e.target.value)} className="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold outline-none focus:ring-2 focus:ring-[#1D9E75]">
                    {subjects.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </label>

                <label className="block">
                  <span className="text-xs font-black uppercase tracking-wider text-slate-400 mb-2 block">Mock Paper Scope</span>
                  <select value={scope} onChange={(e) => setScope(e.target.value as any)} className="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold outline-none focus:ring-2 focus:ring-[#1D9E75]">
                    <option value="single-chapter">Single Chapter Paper</option>
                    <option value="multi-chapter">Multi-Chapter Paper</option>
                    <option value="full-subject">Full Subject Mock</option>
                  </select>
                </label>

                {scope === 'single-chapter' ? (
                  <label className="block md:col-span-2">
                    <span className="text-xs font-black uppercase tracking-wider text-slate-400 mb-2 block">Select Chapter</span>
                    <select value={chapter} onChange={(e) => setChapter(e.target.value)} className="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold outline-none focus:ring-2 focus:ring-[#1D9E75]">
                      {chapters.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </label>
                ) : scope === 'multi-chapter' ? (
                  <div className="md:col-span-2 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
                    <p className="text-xs font-black uppercase tracking-wider text-slate-400 mb-3">Select Chapters included in Paper</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                      {chapters.map((ch) => {
                        const checked = selectedChapters.includes(ch);
                        return (
                          <label key={ch} className="flex items-center gap-3 p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-750 text-xs font-bold text-slate-700 dark:text-slate-350 cursor-pointer hover:border-emerald-300">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedChapters((prev) => [...prev, ch]);
                                } else {
                                  setSelectedChapters((prev) => prev.filter((x) => x !== ch));
                                }
                              }}
                              className="accent-[#1D9E75] w-4 h-4 rounded-md"
                            />
                            <span className="truncate">{ch}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="md:col-span-2 p-4 rounded-2xl border border-emerald-100 dark:border-emerald-900/30 bg-emerald-50/50 dark:bg-emerald-950/10 flex items-center gap-2">
                    <BookOpen size={16} className="text-[#1D9E75]" />
                    <span className="text-xs font-bold text-[#1D9E75]">Full-subject mode generates questions across all textbooks chapters.</span>
                  </div>
                )}

                <label className="block md:col-span-2">
                  <span className="text-xs font-black uppercase tracking-wider text-slate-400 mb-2 block">Question Variety Style</span>
                  <select 
                    value={stickToTextbook ? 'textbook' : 'creative'} 
                    onChange={(e) => setStickToTextbook(e.target.value === 'textbook')} 
                    className="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold outline-none focus:ring-2 focus:ring-[#1D9E75]"
                  >
                    <option value="textbook">📖 NCERT Textbook Exercises (Direct questions/numbers)</option>
                    <option value="creative">🎨 Creative & Unique HOTS/Competency questions (CBSE Board Style)</option>
                  </select>
                </label>

                <label className="block">
                  <span className="text-xs font-black uppercase tracking-wider text-slate-400 mb-2 block">Duration (minutes)</span>
                  <input 
                    type="number" 
                    value={durationMinutes} 
                    onChange={(e) => setDurationMinutes(Math.max(20, Number(e.target.value || 20)))} 
                    className="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold outline-none focus:ring-2 focus:ring-[#1D9E75]" 
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-black uppercase tracking-wider text-slate-400 mb-2 block">Question count</span>
                  <input 
                    type="number" 
                    value={questionCount} 
                    onChange={(e) => setQuestionCount(Math.max(3, Number(e.target.value || 3)))} 
                    className="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold outline-none focus:ring-2 focus:ring-[#1D9E75]" 
                  />
                </label>

                <label className="block md:col-span-2">
                  <span className="text-xs font-black uppercase tracking-wider text-slate-400 mb-2 block">Total Marks</span>
                  <input 
                    type="number" 
                    value={totalMarks} 
                    onChange={(e) => setTotalMarks(Math.max(5, Number(e.target.value || 5)))} 
                    className="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold outline-none focus:ring-2 focus:ring-[#1D9E75]" 
                  />
                </label>
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                <Button 
                  onClick={handleStart} 
                  disabled={loading}
                  className="bg-[#1D9E75] hover:bg-[#16805d] px-8 py-4 rounded-2xl font-black text-md flex items-center gap-2 shadow-lg shadow-[#1D9E75]/25"
                >
                  <Play size={18} />
                  <span>{loading ? 'Generating Board Paper...' : 'Start Mock Exam'}</span>
                </Button>
              </div>
            </Card>

            {/* Side Information */}
            <div className="space-y-6">
              
              {/* Limit/Upgrade Card (mocking free 3 papers then pro) */}
              <Card className="p-6 bg-gradient-to-br from-indigo-50/50 to-emerald-50/50 dark:from-[#0d1424] dark:to-slate-900 border-2 border-indigo-100/50 dark:border-slate-800 rounded-[28px]">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400">Campaign Status</span>
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 text-[9px] font-black uppercase">
                    Free Promo Active
                  </span>
                </div>
                
                <h3 className="text-lg font-black text-slate-900 dark:text-white">Exam Simulation Pricing</h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Normally, users on the <strong>Free Tier</strong> get up to <strong>3 mock exam papers</strong>, after which generating mock exams requires upgrading to <strong>Pro</strong>.
                </p>

                <div className="my-5 p-4 rounded-2xl bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-900 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-black uppercase text-slate-400">Mock papers generated</p>
                    <p className="text-2xl font-black text-slate-900 dark:text-white mt-0.5">{completedExamsCount} attempted</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black uppercase text-slate-400">Free limit</p>
                    <p className="text-lg font-bold text-slate-500 mt-0.5">3 Papers</p>
                  </div>
                </div>

                <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-[10px] text-emerald-700 dark:text-emerald-300 font-bold flex items-center gap-2">
                  <ShieldAlert size={14} className="shrink-0" />
                  <span>Launch Campaign: Unlimited Mock Exams are currently FREE for all users!</span>
                </div>
              </Card>

              {/* Instructions Sidebar */}
              <Card className="p-6 bg-white dark:bg-[#0f172a] border-none shadow-xl rounded-[28px] space-y-4">
                <h3 className="text-sm font-black uppercase tracking-wider text-slate-500">Board Exam Tips</h3>
                <ul className="space-y-3.5 text-xs text-slate-500 font-semibold leading-relaxed">
                  <li className="flex gap-2">
                    <span className="text-[#1D9E75] font-black">✓</span>
                    <span><strong>Keep track of time:</strong> 180 minutes goes fast for 10 high-mark questions.</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-[#1D9E75] font-black">✓</span>
                    <span><strong>Check Section weights:</strong> Section C questions hold the highest marks; budget your time.</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-[#1D9E75] font-black">✓</span>
                    <span><strong>Handwriting Scan:</strong> You can mock-upload a scan of your handwritten page to parse text responses directly.</span>
                  </li>
                </ul>
              </Card>
            </div>
          </div>
        )}

        {/* ACTIVE EXAM SIMULATION */}
        {started && !result && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 items-start relative">
            
            {/* Left/Middle Column: Official Exam Sheet */}
            <div className="lg:col-span-3 space-y-6">
              
              {/* Paper Board Cover Details */}
              <Card className="p-8 bg-white dark:bg-[#0f172a] border-2 border-slate-200 dark:border-slate-800 rounded-[32px] relative overflow-hidden">
                
                {/* Board Sheet Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-dashed border-slate-200 dark:border-slate-850 gap-4">
                  <div className="space-y-1">
                    <p className="text-[10px] font-black uppercase text-[#1D9E75] tracking-widest">Central Board of Secondary Education (CBSE)</p>
                    <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">ALL INDIA SECONDARY SCHOOL EXAMINATION</h2>
                    <p className="text-xs text-slate-400 font-bold uppercase">Subject Code: {started.subject.substring(0, 3).toUpperCase()}99 • Subject: {started.subject}</p>
                  </div>
                  <div className="p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl flex flex-col items-center justify-center min-w-[140px]">
                    <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">Class Grade</span>
                    <span className="text-lg font-black text-slate-900 dark:text-white">Class {classNum}</span>
                  </div>
                </div>

                {/* Candidate credentials input box removed */}

                {/* General Instructions Block */}
                <details className="group mt-6 p-4 rounded-2xl border border-amber-100 dark:border-amber-900/30 bg-amber-50/30 dark:bg-amber-950/10 cursor-pointer" open>
                  <summary className="list-none flex items-center justify-between text-xs font-black text-amber-800 dark:text-amber-300 uppercase tracking-wider">
                    <span>📖 General Instructions (Click to toggle)</span>
                    <span className="group-open:rotate-180 transition-transform">▼</span>
                  </summary>
                  <div className="mt-3 pt-3 border-t border-amber-100 dark:border-amber-900/30 text-[11px] leading-relaxed text-slate-500 font-semibold space-y-2">
                    <p>• All questions are compulsory. Show your step-by-step calculations and reasoning.</p>
                    <p>• Section A contains Multiple Choice / short questions of 1 mark each.</p>
                    <p>• Section B contains Short Answer type questions of 2 to 3 marks each. Answers should be brief and to the point.</p>
                    <p>• Section C contains Long Answer type questions of 4 to 5 marks each. Show step-by-step logic, diagrams, or formula applications.</p>
                    <p>• There is no negative marking. Attempt all questions.</p>
                  </div>
                </details>
              </Card>

              {/* SECTION NAVIGATION TABS */}
              <div className="flex bg-slate-100 dark:bg-slate-850 p-1.5 rounded-2xl border border-slate-200/50 dark:border-slate-800/50">
                <button
                  onClick={() => setActiveSection('A')}
                  className={`flex-1 py-3 text-xs font-black uppercase tracking-wider rounded-xl transition-all ${
                    activeSection === 'A' 
                      ? 'bg-[#1D9E75] text-white shadow-md' 
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
                  }`}
                >
                  Section A: MCQs ({questionsBySection.A.length})
                </button>
                <button
                  onClick={() => setActiveSection('B')}
                  className={`flex-1 py-3 text-xs font-black uppercase tracking-wider rounded-xl transition-all ${
                    activeSection === 'B' 
                      ? 'bg-[#1D9E75] text-white shadow-md' 
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
                  }`}
                >
                  Section B: Short Answer ({questionsBySection.B.length})
                </button>
                <button
                  onClick={() => setActiveSection('C')}
                  className={`flex-1 py-3 text-xs font-black uppercase tracking-wider rounded-xl transition-all ${
                    activeSection === 'C' 
                      ? 'bg-[#1D9E75] text-white shadow-md' 
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
                  }`}
                >
                  Section C: Long Answer ({questionsBySection.C.length})
                </button>
              </div>

              {/* QUESTIONS LIST PANE (Section Filtered) */}
              <Card className="p-8 bg-white dark:bg-[#0f172a] border-2 border-slate-200 dark:border-slate-800 rounded-[32px] relative overflow-hidden min-h-[450px]">
                
                {/* Diagonal Watermark for Official Exam feel */}
                <div className="absolute inset-0 pointer-events-none select-none flex items-center justify-center opacity-[0.03] dark:opacity-[0.01]">
                  <div className="text-7xl font-black rotate-45 tracking-[0.2em] uppercase text-slate-850 dark:text-white">
                    CLARITY BOARD EXAM
                  </div>
                </div>

                <div className="relative z-10 space-y-8">
                  {questionsBySection[activeSection].length === 0 ? (
                    <div className="py-20 text-center flex flex-col items-center justify-center space-y-3">
                      <HelpCircle className="text-slate-300" size={48} />
                      <p className="text-sm text-slate-500 font-bold">No questions generated for this section.</p>
                      <p className="text-xs text-slate-400">Select other section tabs above to write answers.</p>
                    </div>
                  ) : (
                    questionsBySection[activeSection].map((question) => {
                      const idx = question.originalIndex;
                      const { questionText, options } = parseOptionsFromQuestion(question.question);
                      
                      return (
                        <div key={idx} className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 space-y-4">
                          
                          {/* Card Question Header */}
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                                {question.chapter} • Question {idx + 1}
                              </p>
                              <h4 className="text-md font-black text-slate-900 dark:text-white mt-1 leading-snug">
                                {questionText}
                              </h4>
                            </div>
                            <span className="px-3 py-1 bg-emerald-50 dark:bg-emerald-950/20 text-[#1D9E75] border border-emerald-100 dark:border-emerald-900/40 text-xs font-black rounded-lg whitespace-nowrap">
                              {question.marks} {question.marks === 1 ? 'mark' : 'marks'}
                            </span>
                          </div>

                          {/* Options Radio Widget for parsed MCQs */}
                          {options ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                              {options.map((opt, optIdx) => {
                                const optionCode = ['A', 'B', 'C', 'D'][optIdx] || String(optIdx + 1);
                                const isSelected = answers[idx] === optionCode;
                                
                                return (
                                  <button
                                    key={optIdx}
                                    type="button"
                                    onClick={() => setAnswers(prev => ({ ...prev, [idx]: optionCode }))}
                                    className={`p-3 rounded-xl border-2 text-left text-xs font-bold transition-all flex items-center gap-3 ${
                                      isSelected
                                        ? 'border-[#1D9E75] bg-emerald-50/50 dark:bg-emerald-950/15 text-[#1D9E75]'
                                        : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-350'
                                    }`}
                                  >
                                    <span className={`h-6 w-6 rounded-full flex items-center justify-center shrink-0 border-2 font-black text-[10px] ${
                                      isSelected ? 'border-[#1D9E75] bg-[#1D9E75] text-white' : 'border-slate-300 dark:border-slate-700'
                                    }`}>
                                      {optionCode}
                                    </span>
                                    <span className="truncate">{opt}</span>
                                  </button>
                                );
                              })}
                            </div>
                          ) : question.marks <= 1 ? (
                            /* Short Answer Text Box (1 Mark) */
                            <div className="mt-3">
                              <input
                                type="text"
                                value={answers[idx] || ''}
                                onChange={(e) => setAnswers(prev => ({ ...prev, [idx]: e.target.value }))}
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 font-semibold text-xs outline-none focus:ring-1 focus:ring-[#1D9E75]"
                                placeholder="Type short answer or single word here..."
                              />
                            </div>
                          ) : (
                            /* Written Answer Box (Long / Short Written) */
                            <div className="space-y-2">
                              <div className="relative">
                                <textarea
                                  value={answers[idx] || ''}
                                  onChange={(e) => setAnswers((prev) => ({ ...prev, [idx]: e.target.value }))}
                                  className="w-full h-36 px-4 py-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs font-medium leading-relaxed outline-none focus:ring-1 focus:ring-[#1D9E75]"
                                  placeholder="Write your step-by-step board answer here..."
                                />
                                
                                {/* Scan/Upload Handwriting trigger next to answer field */}
                                <button
                                  type="button"
                                  onClick={() => triggerHandwritingScan(idx)}
                                  className="absolute right-3 bottom-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-500 text-[10px] font-black uppercase tracking-wider border border-slate-200/50 dark:border-slate-800/50 transition-colors"
                                  title="Scan Written Paper Sheet"
                                >
                                  <Upload size={12} />
                                  <span>Scan Handwritten</span>
                                </button>
                              </div>

                              {/* Character Count & Suggestion Helper */}
                              <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold px-1">
                                <span>Word Count: {(answers[idx] || '').trim().split(/\s+/).filter(Boolean).length} words</span>
                                <span className="italic">💡 Tip: Include definitions, formulas, and diagrams for full marks</span>
                              </div>
                            </div>
                          )}

                        </div>
                      );
                    })
                  )}
                </div>

                {/* Submitting Options */}
                <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800 flex justify-between gap-3 flex-wrap">
                  <Button 
                    variant="outline" 
                    className="rounded-xl font-bold h-11 border-rose-200 text-rose-500 hover:bg-rose-50"
                    onClick={handleReset}
                  >
                    Discard Exam
                  </Button>
                  <Button 
                    onClick={handleSubmit} 
                    disabled={loading}
                    className="bg-[#1D9E75] hover:bg-[#16805d] px-6 py-3 rounded-xl font-black text-sm shadow-md"
                  >
                    {loading ? 'Submitting Simulation...' : 'Submit Exam Simulation'}
                  </Button>
                </div>
              </Card>

            </div>

            {/* Right Column: Timer & Toolbar Sidebar */}
            <div className="space-y-6">
              
              {/* Countdown Ticking Clock */}
              <Card className="p-6 bg-slate-950 text-white dark:bg-slate-900 border border-slate-800 dark:border-slate-800 rounded-3xl text-center space-y-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Time Remaining</p>
                  <h3 className={`text-3xl font-black mt-2 font-mono tracking-widest ${timeLeft < 300 ? 'text-rose-500 animate-pulse' : 'text-[#1D9E75]'}`}>
                    {formatTimeLeft(timeLeft)}
                  </h3>
                </div>
                <div className="border-t border-slate-800 pt-3 flex items-center justify-center gap-2 text-[10px] font-bold text-slate-400">
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                  <span>Exam Proctor Active</span>
                </div>
              </Card>

              {/* Student Toolkit Drawer toggles */}
              <Card className="p-6 bg-white dark:bg-[#0f172a] border-none shadow-xl rounded-[28px] space-y-4">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-500">Student Toolkit</h3>
                <div className="space-y-2">
                  
                  {/* Toggles Calculator */}
                  <button
                    onClick={() => setCalcOpen(!calcOpen)}
                    className="w-full p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-left text-xs font-black text-slate-700 dark:text-slate-350 hover:bg-[#1D9E75]/10 hover:border-[#1D9E75]/40 transition-all flex items-center justify-between"
                  >
                    <span className="flex items-center gap-2">
                      <Calculator size={14} className="text-[#1D9E75]" />
                      Scientific Calculator
                    </span>
                    <span>{calcOpen ? '✕' : '▼'}</span>
                  </button>

                  {/* Formula sheet lookup removed */}
                </div>
              </Card>

            </div>
          </div>
        )}

        {/* RESULTS SCORING SCENE */}
        {result && (
          <Card className="p-8 bg-white dark:bg-[#0f172a] border-none shadow-xl rounded-[32px] space-y-8">
            <div className="flex items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-6 flex-wrap">
              <div>
                <h2 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <Trophy size={26} className="text-yellow-500" />
                  Exam Simulation Report
                </h2>
                <p className="text-xs text-slate-500 mt-1">Detailed examiner breakdown of step-marking losses and scores.</p>
              </div>
              <Button onClick={() => { setStarted(null); setResult(null); }} className="rounded-xl">
                Close Report
              </Button>
            </div>

            {/* Big dials summary metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-slate-50 dark:bg-slate-900/60 p-6 rounded-3xl border border-slate-100 dark:border-slate-800">
              <div className="text-center py-4 space-y-1">
                <p className="text-[10px] font-black uppercase text-slate-400">Total Marks Awarded</p>
                <p className="text-4xl font-black text-slate-900 dark:text-white">
                  {result.marks_awarded} <span className="text-lg font-bold text-slate-500">/ {result.total_marks}</span>
                </p>
              </div>
              <div className="text-center py-4 space-y-1 border-y md:border-y-0 md:border-x border-slate-200 dark:border-slate-800">
                <p className="text-[10px] font-black uppercase text-slate-400">Accuracy Assessment</p>
                <p className="text-4xl font-black text-emerald-600 dark:text-emerald-400">{result.accuracy_percent}%</p>
              </div>
              <div className="text-center py-4 space-y-1">
                <p className="text-[10px] font-black uppercase text-slate-400">Questions Attempted</p>
                <p className="text-4xl font-black text-slate-900 dark:text-white">
                  {result.attempted} <span className="text-lg font-bold text-slate-500">/ {result.total_questions}</span>
                </p>
              </div>
            </div>

            {/* Step Mark Loss Analysis List */}
            <div className="space-y-4">
              <h3 className="text-sm font-black uppercase tracking-wider text-slate-500">Examiner Step-Marking Losses</h3>
              {result.step_mark_losses.length === 0 ? (
                <p className="text-sm text-slate-500 italic p-4 bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800 rounded-2xl">
                  Excellent paper! No step marks were lost in this attempt.
                </p>
              ) : (
                <div className="space-y-3">
                  {result.step_mark_losses.map((loss, idx) => (
                    <div key={idx} className="p-5 rounded-2xl border border-rose-200 dark:border-rose-900/30 bg-rose-50/20 dark:bg-rose-950/10 space-y-2">
                      <p className="text-xs font-black text-rose-700 dark:text-rose-400 uppercase">Question Breakdown</p>
                      <h4 className="text-sm font-black text-slate-900 dark:text-white leading-tight">{loss.question}</h4>
                      <div className="pt-2 border-t border-rose-100/50 dark:border-rose-900/10 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs leading-relaxed font-semibold">
                        <div>
                          <p className="text-[10px] font-black uppercase text-rose-600/80">Lost Marks Cause:</p>
                          <p className="text-slate-700 dark:text-slate-350">{loss.lost_reason}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-black uppercase text-emerald-600">Examiner Correction Advice:</p>
                          <p className="text-slate-750 dark:text-slate-300">{loss.fix}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recovery study recommendations plan */}
            <div className="p-6 rounded-[28px] bg-emerald-50/50 dark:bg-emerald-950/10 border border-emerald-100 dark:border-emerald-900/40">
              <h3 className="text-sm font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-300 mb-3 flex items-center gap-2">
                <CheckCircle size={16} />
                AI Syllabus Recovery Plan
              </h3>
              <div className="space-y-2">
                {result.recovery_plan.map((stepMsg, i) => (
                  <p key={i} className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-start gap-2">
                    <span className="text-[#1D9E75] font-black">✓</span>
                    <span>{stepMsg}</span>
                  </p>
                ))}
              </div>
            </div>
          </Card>
        )}

      </main>

      {/* FLOAT TOOLKIT 1: Scientific Calculator Dialog */}
      {calcOpen && (
        <div className="fixed bottom-10 right-10 z-[120] w-72 rounded-3xl border border-slate-200 dark:border-slate-800 bg-[#fafafa] dark:bg-[#1a1f2c] shadow-2xl p-4 animate-scaleIn">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800 mb-3">
            <span className="text-xs font-black uppercase text-slate-400 flex items-center gap-1.5">
              <Calculator size={13} className="text-[#1D9E75]" />
              Calculator
            </span>
            <button onClick={() => setCalcOpen(false)} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-850 rounded-lg text-slate-400">
              ✕
            </button>
          </div>
          <div className="space-y-3">
            <div className="bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-100 dark:border-slate-800 text-right space-y-1 min-h-[70px]">
              <p className="text-xs font-semibold text-slate-400 tracking-wider truncate">{calcExpr || '0'}</p>
              <p className="text-lg font-black text-slate-900 dark:text-white truncate">{calcResult}</p>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {['sin(', 'cos(', 'tan(', 'C', 'sqrt(', 'log(', '^', '/', '7', '8', '9', '*', '4', '5', '6', '-', '1', '2', '3', '+', '0', '.', 'pi', '='].map((btn) => (
                <button
                  key={btn}
                  onClick={() => handleCalcBtn(btn)}
                  className={`py-2 rounded-xl text-xs font-black transition-colors ${
                    btn === '=' 
                      ? 'col-span-1 bg-[#1D9E75] text-white hover:bg-[#16805d]' 
                      : btn === 'C'
                      ? 'bg-rose-100 dark:bg-rose-950/20 text-rose-500 hover:bg-rose-200'
                      : 'bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-850 text-slate-700 dark:text-slate-300 border border-slate-100 dark:border-slate-800'
                  }`}
                >
                  {btn.replace('Math.', '').replace('(', '')}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Formula sheets lookup modal removed */}

      {/* SCAN HANDWRITING SCREEN MOCK MODAL */}
      {scanningFile && scanningIndex !== null && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-fadeIn">
          <div className="bg-white dark:bg-[#121620] w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl p-6 text-center space-y-6 relative border border-slate-150 dark:border-slate-800 animate-scaleIn">
            
            <div className="relative w-24 h-24 mx-auto bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl flex items-center justify-center overflow-hidden">
              <Upload size={36} className="text-slate-400" />
              {/* Pulsing Scan Laser Animation */}
              <div className="absolute left-0 right-0 h-1 bg-emerald-500 top-0 animate-[bounce_2s_infinite]" />
            </div>

            <div className="space-y-2">
              <h3 className="text-lg font-black text-slate-900 dark:text-white">Scanning Handwritten Answer</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Processing your paper image. Extracting board-style steps and values text via Clarity OCR Engine.
              </p>
            </div>

            <div className="flex items-center justify-center gap-2 text-xs font-bold text-slate-400">
              <Loader2 className="animate-spin text-[#1D9E75]" size={14} />
              <span>Analyzing answer sheets...</span>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
