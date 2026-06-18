import React, { useState } from 'react';
import { Navbar } from '../components/layout/Navbar';
import { apiClient } from '../api';
import { CheckCircle, AlertTriangle, BookOpen, Send, Loader2, Award, ArrowRight } from 'lucide-react';

export function AnswerChecker() {
  const [classNum, setClassNum] = useState('10');
  const [subject, setSubject] = useState('Science');
  const [chapter, setChapter] = useState('');
  const [marks, setMarks] = useState(3);
  const [userInput, setUserInput] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');

  const subjects = ['Science', 'Mathematics', 'Social Science', 'English', 'Physics', 'Chemistry', 'Biology'];

  const handleCheck = async () => {
    if (!chapter.trim() || !userInput.trim()) {
      setError('Please fill in all fields before checking.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const response = await apiClient.post('/practice/check-answer', {
        class_num: classNum,
        subject,
        chapter,
        marks,
        user_input: userInput,
      });
      setResult(response.data);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to check answer. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-[#fcfbf9] transition-colors">
      <Navbar />
      <main className="flex-1 lg:pl-72 flex flex-col items-center">
        <div className="w-full max-w-4xl p-6 lg:p-10">
          <div className="mb-8">
            <h1 className="text-3xl font-black text-[#2C241B] flex items-center gap-3">
              <CheckCircle className="text-[#8C5A35] w-8 h-8" />
              Board Exam Answer Checker
            </h1>
            <p className="mt-2 text-stone-600 font-medium">
              Paste your answer. Get a CBSE step-marking score and learn what keywords you missed.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Form Section */}
            <div className="lg:col-span-5 space-y-6">
              <div className="bg-[#FCFAF8] border-3 border-[#2C241B] shadow-neo rounded-2xl p-6  space-y-5">
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-stone-500 mb-2">Class</label>
                  <select 
                    value={classNum} 
                    onChange={(e) => setClassNum(e.target.value)}
                    className="w-full bg-[#FCFAF8] border-none rounded-xl px-4 py-3 text-sm font-bold outline-none ring-2 ring-transparent focus:ring-[#8C5A35]/30 transition-all"
                  >
                    {[9, 10, 11, 12].map(c => <option key={c} value={c}>Class {c}</option>)}
                  </select>
                </div>
                
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-stone-500 mb-2">Subject</label>
                  <select 
                    value={subject} 
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full bg-[#FCFAF8] border-none rounded-xl px-4 py-3 text-sm font-bold outline-none ring-2 ring-transparent focus:ring-[#8C5A35]/30 transition-all"
                  >
                    {subjects.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-stone-500 mb-2">Chapter Name</label>
                  <input 
                    type="text"
                    placeholder="e.g. Chemical Reactions"
                    value={chapter}
                    onChange={(e) => setChapter(e.target.value)}
                    className="w-full bg-[#FCFAF8] border-none rounded-xl px-4 py-3 text-sm font-bold outline-none ring-2 ring-transparent focus:ring-[#8C5A35]/30 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-stone-500 mb-2">Question Type</label>
                  <div className="flex gap-3">
                    {[1, 3, 5].map(m => (
                      <button
                        key={m}
                        onClick={() => setMarks(m)}
                        className={`flex-1 py-3 rounded-xl font-black text-sm border-2 transition-all ${
                          marks === m 
                            ? "border-[#8C5A35] bg-[#8C5A35]/10 text-[#8C5A35]" 
                            : "border-stone-100 text-stone-400 hover:border-stone-200"
                        }`}
                      >
                        {m} Mark
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Input & Output Section */}
            <div className="lg:col-span-7 flex flex-col gap-6">
              <div className="flex-1 flex flex-col bg-[#FCFAF8] border-3 border-[#2C241B] shadow-neo rounded-2xl  overflow-hidden">
                <div className="p-4 border-b border-stone-100 bg-[#FCFAF8] ">
                  <h3 className="text-sm font-black text-[#3E352B] flex items-center gap-2">
                    <BookOpen size={16} />
                    Your Answer
                  </h3>
                </div>
                <div className="p-4 flex-1 flex flex-col">
                  <textarea
                    placeholder="Paste the question and your answer here..."
                    className="w-full flex-1 min-h-[200px] resize-none border-none bg-transparent outline-none text-stone-700 placeholder:text-stone-400 leading-relaxed font-medium"
                    value={userInput}
                    onChange={(e) => setUserInput(e.target.value)}
                  />
                  {error && <p className="text-red-500 text-xs font-bold mt-2">{error}</p>}
                </div>
                <div className="p-4 border-t border-stone-100 bg-[#FCFAF8] flex justify-end">
                  <button
                    onClick={handleCheck}
                    disabled={loading}
                    className="flex items-center gap-2 bg-[#8C5A35] hover:bg-[#15825f] text-white px-6 py-2.5 rounded-xl font-black text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    Check Answer
                  </button>
                </div>
              </div>

              {/* Result Section */}
              {result && (
                <div className="bg-[#FCFAF8] border-3 border-[#2C241B] shadow-neo rounded-2xl  p-6 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xs font-black uppercase tracking-widest text-stone-400 mb-1">CBSE Score</h3>
                      <div className="flex items-baseline gap-1">
                        <span className={`text-4xl font-black ${
                          result.score >= result.max_marks * 0.8 ? "text-amber-500" :
                          result.score >= result.max_marks * 0.5 ? "text-yellow-500" : "text-red-500"
                        }`}>
                          {result.score}
                        </span>
                        <span className="text-stone-400 font-bold">/ {result.max_marks}</span>
                      </div>
                    </div>
                    {result.score >= result.max_marks && (
                      <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center text-yellow-600">
                        <Award className="w-6 h-6" />
                      </div>
                    )}
                  </div>

                  {result.missing_keywords && result.missing_keywords.length > 0 && (
                    <div className="bg-red-50 border border-red-100 rounded-xl p-4">
                      <h4 className="text-xs font-black uppercase text-red-800 flex items-center gap-2 mb-3">
                        <AlertTriangle size={14} /> Missing Concepts & Keywords
                      </h4>
                      <ul className="space-y-2">
                        {result.missing_keywords.map((kw: string, i: number) => (
                          <li key={i} className="text-sm font-semibold text-red-900 flex items-start gap-2">
                            <span className="mt-1 text-red-500">•</span>
                            {kw}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="space-y-3">
                    <h4 className="text-xs font-black uppercase tracking-wider text-stone-400">Examiner Feedback</h4>
                    <p className="text-sm text-stone-700 leading-relaxed font-medium bg-[#FCFAF8] p-4 rounded-xl">
                      {result.feedback}
                    </p>
                  </div>

                  <div className="space-y-3">
                    <h4 className="text-xs font-black uppercase tracking-wider text-[#8C5A35]">Perfect Model Answer</h4>
                    <div className="p-4 bg-[#8C5A35]/5 border border-[#8C5A35]/20 rounded-xl text-sm font-medium leading-relaxed text-stone-700 ">
                      {result.model_answer}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
