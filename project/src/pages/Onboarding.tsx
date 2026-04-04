import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Check, ArrowRight, School, User, ArrowLeft, Trash2, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { getUser, saveUser } from '../utils/storage';

const CLASSES = ['9', '10', '11', '12'];
const SUBJECTS = ['Science', 'Physics', 'Chemistry', 'Biology', 'Maths', 'English', 'Social Science', 'Computer Science'];

export const Onboarding = () => {
  const navigate = useNavigate();
  const existingUser = getUser();
  const isEditing = !!existingUser;

  const [name, setName] = useState(existingUser?.name || '');
  const [school, setSchool] = useState(existingUser?.school || '');
  const [selectedClass, setSelectedClass] = useState(existingUser?.class || '10');
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>(existingUser?.subjects || []);

  const toggleSubject = (subject: string) => {
    setSelectedSubjects((prev) =>
      prev.includes(subject)
        ? prev.filter((s) => s !== subject)
        : [...prev, subject]
    );
  };

  const handleComplete = () => {
    if (!name || selectedSubjects.length === 0) {
      toast.error('Please provide a name and select your subjects.');
      return;
    }

    saveUser({
      name,
      school,
      class: selectedClass,
      subjects: selectedSubjects,
    });

    toast.success(isEditing ? 'Autonomous Profile Updated!' : 'Welcome to NcertAI Board Prep!');
    navigate('/dashboard');
  };

  const handleReset = () => {
    if (confirm("Autonomous System: Are you sure you want to reset all data? This cannot be undone.")) {
      localStorage.clear();
      window.location.reload();
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-[#020617] flex items-center justify-center p-6 transition-colors duration-500">
      <div className="max-w-3xl w-full">
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-24 h-24 bg-[#1D9E75] rounded-[32px] shadow-2xl shadow-[#1D9E75]/30 mb-8 animate-in zoom-in duration-700">
            <BookOpen className="text-white" size={48} />
          </div>
          <h1 className="text-5xl font-black text-slate-900 dark:text-white mb-3 tracking-tight">
            {isEditing ? 'Autonomous Settings' : 'Configure your Tutor'}
          </h1>
          <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">AI-Driven Board Exam Excellence</p>
        </div>

        <Card className="p-8 md:p-12 bg-white dark:bg-[#0f172a] border-none shadow-2xl rounded-[48px] border border-white/50 relative overflow-hidden">
          <div className="relative z-10 space-y-10">
            {isEditing && (
              <div className="flex items-center justify-between mb-4">
                <button 
                  onClick={() => navigate('/dashboard')}
                  className="flex items-center gap-2 text-slate-400 hover:text-[#1D9E75] transition-all font-black text-xs uppercase tracking-widest group"
                >
                  <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
                  Return to Hub
                </button>
                <div className="flex items-center gap-2 px-3 py-1 bg-emerald-50 dark:bg-emerald-900/20 rounded-full text-[#1D9E75] text-[10px] font-black border border-emerald-100 dark:border-emerald-800 uppercase tracking-tighter">
                  <ShieldCheck size={12} />
                  System Synced
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              <div className="space-y-4">
                <label className="flex items-center gap-2 text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">
                  <User size={14} /> Full Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Ayaan_PRO"
                  className="w-full px-6 py-5 rounded-3xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 text-slate-900 dark:text-white focus:ring-8 focus:ring-[#1D9E75]/10 outline-none transition-all font-bold text-lg"
                />
              </div>

              <div className="space-y-4">
                <label className="flex items-center gap-2 text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">
                  <School size={14} /> School Name
                </label>
                <input
                  type="text"
                  value={school}
                  onChange={(e) => setSchool(e.target.value)}
                  placeholder="e.g. GEMS Modern"
                  className="w-full px-6 py-5 rounded-3xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 text-slate-900 dark:text-white focus:ring-8 focus:ring-[#1D9E75]/10 outline-none transition-all font-bold text-lg"
                />
              </div>
            </div>

            <div className="space-y-6">
              <label className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">Board Class</label>
              <div className="grid grid-cols-4 gap-4">
                {CLASSES.map((c) => (
                  <button
                    key={c}
                    onClick={() => setSelectedClass(c)}
                    className={`py-5 rounded-[24px] font-black transition-all active:scale-95 text-lg ${
                      selectedClass === c
                        ? 'bg-[#1D9E75] text-white shadow-xl shadow-[#1D9E75]/30 ring-4 ring-emerald-500/20'
                        : 'bg-slate-50 dark:bg-slate-900 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-100 dark:border-slate-800'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-6">
              <label className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">Subjects of Excellence</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {SUBJECTS.map((subject) => (
                  <button
                    key={subject}
                    onClick={() => toggleSubject(subject)}
                    className={`p-5 rounded-[24px] border-2 flex flex-col items-center gap-3 transition-all active:scale-95 ${
                      selectedSubjects.includes(subject)
                        ? 'border-[#1D9E75] bg-emerald-50 dark:bg-emerald-900/10 text-[#1D9E75]'
                        : 'border-slate-100 dark:border-slate-800 text-slate-400 hover:border-slate-200 dark:hover:border-slate-700'
                    }`}
                  >
                    <span className="text-xs font-black uppercase tracking-tighter">{subject}</span>
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${selectedSubjects.includes(subject) ? 'bg-[#1D9E75] border-[#1D9E75]' : 'border-slate-200 dark:border-slate-800'}`}>
                      {selectedSubjects.includes(subject) && <Check size={14} className="text-white" />}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 pt-6">
              <Button
                className="flex-1 py-7 rounded-[28px] text-2xl font-black bg-[#1D9E75] hover:bg-[#16805d] shadow-2xl shadow-[#1D9E75]/30 transition-all active:scale-[0.98] group"
                onClick={handleComplete}
              >
                {isEditing ? 'Update AI Core' : 'Initialize Tutor'}
                <ArrowRight className="ml-3 group-hover:translate-x-2 transition-transform" />
              </Button>
              
              {isEditing && (
                <button 
                  onClick={handleReset}
                  className="px-8 py-7 rounded-[28px] bg-red-50 dark:bg-red-900/10 text-red-500 hover:bg-red-100 transition-all border border-red-100 dark:border-red-900/20"
                >
                  <Trash2 size={24} />
                </button>
              )}
            </div>
          </div>
          
          <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 w-64 h-64 bg-[#1D9E75]/5 rounded-full blur-3xl" />
        </Card>
      </div>
    </div>
  );
};
