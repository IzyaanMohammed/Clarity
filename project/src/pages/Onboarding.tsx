import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';

export const Onboarding = () => {
    const navigate = useNavigate();
    const { user, updateProfile } = useAuth();
    const [step, setStep] = useState(1);
    
    const [classNum, setClassNum] = useState<string>('');
    const [subjects, setSubjects] = useState<string[]>([]);
    const [examDate, setExamDate] = useState<string>('');
    const [studyMode, setStudyMode] = useState<'dependent' | 'independent' | ''>('');
    const [name, setName] = useState<string>(user?.name || '');

    const handleNext = async () => {
        if (step === 1 && !classNum) { toast.error("Please select your class"); return; }
        if (step === 2 && subjects.length === 0) { toast.error("Please select at least one subject"); return; }
        if (step === 4 && !studyMode) { toast.error("Please select a study mode"); return; }
        
        if (step === 5) {
            if (!name.trim()) { toast.error("Please enter your name"); return; }
            await updateProfile({
                name,
                classNum,
                subjects,
                examDate,
                studyMode,
                onboarded: true
            });
            toast.success(`Your study space is ready, ${name}! Start by dumping your notes!`, { duration: 4000 });
            navigate('/dump');
            return;
        }
        
        setStep(s => s + 1);
    };

    const handleBack = () => {
        if (step > 1) setStep(s => s - 1);
    };

    const toggleSubject = (sub: string) => {
        if (subjects.includes(sub)) {
            setSubjects(subjects.filter(s => s !== sub));
        } else {
            setSubjects([...subjects, sub]);
        }
    };

    // Pre-filled subjects based on typical CBSE curriculum
    const availableSubjects = parseInt(classNum) > 10 
        ? ['Physics', 'Chemistry', 'Biology', 'Maths', 'Computer Science', 'English']
        : ['Science', 'Maths', 'Social Science', 'English', 'Hindi'];

    return (
        <div className="min-h-screen bg-[#fcfbf9] dark:bg-[#0f1117] flex flex-col items-center justify-center p-6 transition-colors">
            {step > 1 && (
                <button 
                    onClick={handleBack}
                    className="absolute top-8 left-8 p-3 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors text-slate-500"
                >
                    <ArrowLeft size={24} />
                </button>
            )}

            <div className="w-full max-w-2xl flex flex-col items-center">
                
                {/* Stickman / Character SVG (Friendly & Conversational) */}
                <div className="mb-10 animate-bounce-slow">
                    <svg width="120" height="120" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <circle cx="50" cy="50" r="45" fill="#1D9E75" fillOpacity="0.1"/>
                        <circle cx="50" cy="40" r="15" fill="#1D9E75"/>
                        <path d="M50 55 C50 55, 30 70, 30 90" stroke="#1D9E75" strokeWidth="6" strokeLinecap="round"/>
                        <path d="M50 55 C50 55, 70 70, 70 90" stroke="#1D9E75" strokeWidth="6" strokeLinecap="round"/>
                        <path d="M50 55 L50 80" stroke="#1D9E75" strokeWidth="6" strokeLinecap="round"/>
                        <path d="M35 60 C35 60, 50 65, 65 60" stroke="#1D9E75" strokeWidth="6" strokeLinecap="round"/>
                        <circle cx="44" cy="38" r="3" fill="#fff"/>
                        <circle cx="56" cy="38" r="3" fill="#fff"/>
                        <path d="M46 45 C46 45, 50 48, 54 45" stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                </div>

                <div className="bg-white dark:bg-slate-900 p-8 md:p-12 rounded-[32px] shadow-xl border border-slate-100 dark:border-slate-800 w-full text-center relative overflow-hidden">
                    
                    {step === 1 && (
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <h2 className="text-3xl font-black text-slate-800 dark:text-white mb-8">Hey! Which class are you in?</h2>
                            <div className="flex flex-wrap justify-center gap-4">
                                {['8', '9', '10', '11', '12'].map(c => (
                                    <button 
                                        key={c}
                                        onClick={() => setClassNum(c)}
                                        className={`w-16 h-16 rounded-2xl text-2xl font-bold transition-all ${classNum === c ? 'bg-[#1D9E75] text-white scale-110 shadow-lg shadow-[#1D9E75]/30' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
                                    >
                                        {c}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <h2 className="text-3xl font-black text-slate-800 dark:text-white mb-8">Which subjects do you need help with?</h2>
                            <div className="flex flex-wrap justify-center gap-3">
                                {availableSubjects.map(sub => (
                                    <button 
                                        key={sub}
                                        onClick={() => toggleSubject(sub)}
                                        className={`px-6 py-3 rounded-xl text-lg font-bold transition-all ${subjects.includes(sub) ? 'bg-[#1D9E75] text-white shadow-md' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
                                    >
                                        {sub}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {step === 3 && (
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <h2 className="text-3xl font-black text-slate-800 dark:text-white mb-8">When are your board exams?</h2>
                            <p className="text-slate-500 mb-6 font-medium">We'll use this to build your study countdown. You can skip this if you don't know yet.</p>
                            <input 
                                type="date" 
                                value={examDate}
                                onChange={(e) => setExamDate(e.target.value)}
                                className="px-6 py-4 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white font-bold text-xl outline-none focus:border-[#1D9E75] text-center w-full max-w-xs"
                            />
                        </div>
                    )}

                    {step === 4 && (
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <h2 className="text-3xl font-black text-slate-800 dark:text-white mb-8">How do you like to study?</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <button 
                                    onClick={() => setStudyMode('dependent')}
                                    className={`p-6 rounded-2xl text-left transition-all border-2 ${studyMode === 'dependent' ? 'border-[#1D9E75] bg-[#1D9E75]/5' : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 bg-transparent'}`}
                                >
                                    <h3 className={`text-xl font-bold mb-2 ${studyMode === 'dependent' ? 'text-[#1D9E75]' : 'text-slate-800 dark:text-white'}`}>I follow a plan</h3>
                                    <p className="text-slate-500 font-medium">Guided, structured, hand-held. Clarity tells you what to do next.</p>
                                </button>
                                <button 
                                    onClick={() => setStudyMode('independent')}
                                    className={`p-6 rounded-2xl text-left transition-all border-2 ${studyMode === 'independent' ? 'border-[#1D9E75] bg-[#1D9E75]/5' : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 bg-transparent'}`}
                                >
                                    <h3 className={`text-xl font-bold mb-2 ${studyMode === 'independent' ? 'text-[#1D9E75]' : 'text-slate-800 dark:text-white'}`}>I explore on my own</h3>
                                    <p className="text-slate-500 font-medium">Freeform. Browse, pick tools, and go at your own pace.</p>
                                </button>
                            </div>
                        </div>
                    )}

                    {step === 5 && (
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <h2 className="text-3xl font-black text-slate-800 dark:text-white mb-8">Last thing — give your profile a name!</h2>
                            <input 
                                type="text" 
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="e.g. Rahul, Priya"
                                className="px-6 py-4 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white font-bold text-xl outline-none focus:border-[#1D9E75] text-center w-full max-w-sm"
                            />
                        </div>
                    )}

                    <div className="mt-12 flex justify-center">
                        <button 
                            onClick={handleNext}
                            className="bg-[#1D9E75] hover:bg-[#168a65] text-white px-8 py-4 rounded-full font-bold text-lg flex items-center gap-2 transition-all shadow-lg hover:shadow-xl active:scale-95"
                        >
                            {step === 5 ? "Let's Go!" : (step === 3 && !examDate ? "Skip for now" : "Continue")}
                            <ChevronRight size={24} />
                        </button>
                    </div>

                    <div className="absolute bottom-0 left-0 w-full h-1 bg-slate-100 dark:bg-slate-800">
                        <div 
                            className="h-full bg-[#1D9E75] transition-all duration-500"
                            style={{ width: `${(step / 5) * 100}%` }}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};
