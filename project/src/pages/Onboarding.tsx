import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, ArrowRight, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';

type ChatMessage = {
    sender: 'clarifi' | 'user';
    text: string;
};

export const Onboarding = () => {
    const navigate = useNavigate();
    const { user, updateProfile } = useAuth();
    
    const [messages, setMessages] = useState<ChatMessage[]>([{
        sender: 'clarifi',
        text: "Hey! I'm Clarifi. Do you prefer following a structured, guided plan or exploring on your own?"
    }]);
    
    const [stepId, setStepId] = useState<'mode' | 'date' | 'subjects' | 'class' | 'name'>('mode');
    
    const [classNum, setClassNum] = useState<string>('');
    const [subjects, setSubjects] = useState<string[]>([]);
    const [examDate, setExamDate] = useState<string>('');
    const [studyMode, setStudyMode] = useState<'dependent' | 'independent' | ''>('');
    const [name, setName] = useState<string>(user?.name || '');
    
    const [textInput, setTextInput] = useState('');
    const bottomRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const addMessage = (sender: 'clarifi' | 'user', text: string) => {
        setMessages(prev => [...prev, { sender, text }]);
    };

    const handleOptionSelect = (val: string, displayVal?: string) => {
        const text = displayVal || val;
        addMessage('user', text);
        
        setTimeout(() => {
            processStep(val);
        }, 600);
    };

    const handleTextSubmit = () => {
        if (!textInput.trim()) return;
        const text = textInput.trim();
        setTextInput('');
        addMessage('user', text);
        setTimeout(() => {
            processStep(text);
        }, 600);
    };

    const processStep = async (val: string) => {
        if (stepId === 'mode') {
            const mode = val === 'Guided Plan' ? 'dependent' : 'independent';
            setStudyMode(mode);
            if (mode === 'dependent') {
                setStepId('date');
                addMessage('clarifi', "Got it. When are your board exams? (Pick a date below or skip)");
            } else {
                setStepId('class');
                addMessage('clarifi', "Cool! What class/grade are you currently in?");
            }
        } else if (stepId === 'date') {
            setExamDate(val);
            setStepId('class');
            addMessage('clarifi', "Awesome. And what class are you in right now?");
        } else if (stepId === 'class') {
            setClassNum(val);
            setStepId('subjects');
            addMessage('clarifi', "Almost done. Which subjects do you need the most help with? (Select below)");
        } else if (stepId === 'subjects') {
            // subjects handled via a custom multi-select UI
        } else if (stepId === 'name') {
            setName(val);
            await completeSetup(val);
        }
    };

    const handleSubjectsSubmit = () => {
        if (subjects.length === 0) {
            toast.error("Select at least one subject");
            return;
        }
        addMessage('user', subjects.join(", "));
        setTimeout(() => {
            setStepId('name');
            addMessage('clarifi', "Last thing — what should I call you?");
        }, 600);
    };

    const completeSetup = async (finalName: string) => {
        await updateProfile({
            name: finalName,
            classNum,
            subjects,
            examDate,
            studyMode,
            onboarded: true
        });
        toast.success(`Your study space is ready, ${finalName}!`);
        navigate('/dashboard');
    };

    return (
        <div className="min-h-screen bg-[#fcfbf9] dark:bg-[#0f1117] flex flex-col transition-colors relative">
            <div 
                className="absolute inset-0 z-0 opacity-20 pointer-events-none"
                style={{
                    backgroundImage: 'url(/desk_notebook.png)',
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    backgroundAttachment: 'fixed'
                }}
            />

            <div className="flex-1 max-w-2xl w-full mx-auto p-4 md:p-8 flex flex-col z-10 relative mt-10">
                {/* Clarifi SVG Header */}
                <div className="flex flex-col items-center mb-8">
                    <div className="w-24 h-24 bg-[#3d3224] rounded-full flex items-center justify-center shadow-xl animate-bounce-slow">
                        <svg width="60" height="60" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <circle cx="50" cy="40" r="15" fill="#fdfaf5"/>
                            <path d="M50 55 C50 55, 30 70, 30 90" stroke="#fdfaf5" strokeWidth="6" strokeLinecap="round"/>
                            <path d="M50 55 C50 55, 70 70, 70 90" stroke="#fdfaf5" strokeWidth="6" strokeLinecap="round"/>
                            <path d="M50 55 L50 80" stroke="#fdfaf5" strokeWidth="6" strokeLinecap="round"/>
                            <path d="M35 60 C35 60, 50 65, 65 60" stroke="#fdfaf5" strokeWidth="6" strokeLinecap="round"/>
                            <circle cx="44" cy="38" r="3" fill="#3d3224"/>
                            <circle cx="56" cy="38" r="3" fill="#3d3224"/>
                            <path d="M46 45 C46 45, 50 48, 54 45" stroke="#3d3224" strokeWidth="2" strokeLinecap="round"/>
                        </svg>
                    </div>
                    <h2 className="text-[#3d3224] dark:text-white font-black text-2xl mt-4 font-serif">Setup with Clarifi</h2>
                </div>

                {/* Chat Flow */}
                <div className="flex-1 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md rounded-[32px] p-6 shadow-2xl border border-[#e8dfc8] dark:border-slate-800 overflow-y-auto mb-6 flex flex-col gap-4">
                    {messages.map((m, i) => (
                        <div key={i} className={`flex ${m.sender === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2`}>
                            <div className={`px-5 py-3.5 rounded-2xl max-w-[80%] font-medium text-[15px] leading-relaxed shadow-sm ${
                                m.sender === 'user' 
                                    ? 'bg-[#8c7355] text-white rounded-tr-sm' 
                                    : 'bg-[#fdfaf5] border border-[#d4c8b4] text-[#3d3224] rounded-tl-sm'
                            }`}>
                                {m.text}
                            </div>
                        </div>
                    ))}
                    <div ref={bottomRef} />
                </div>

                {/* Input Area */}
                <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-md p-4 rounded-[32px] shadow-xl border border-[#e8dfc8] dark:border-slate-800">
                    {stepId === 'mode' && (
                        <div className="flex flex-col sm:flex-row gap-3">
                            <button onClick={() => handleOptionSelect('Guided Plan')} className="flex-1 bg-[#fdfaf5] hover:bg-[#8c7355] hover:text-white border border-[#d4c8b4] text-[#3d3224] py-4 rounded-xl font-bold transition-colors">Guided Plan</button>
                            <button onClick={() => handleOptionSelect('Independent Explorer')} className="flex-1 bg-[#fdfaf5] hover:bg-[#8c7355] hover:text-white border border-[#d4c8b4] text-[#3d3224] py-4 rounded-xl font-bold transition-colors">Independent Explorer</button>
                        </div>
                    )}
                    {stepId === 'date' && (
                        <div className="flex flex-col sm:flex-row gap-3 items-center">
                            <input type="date" value={textInput} onChange={e => setTextInput(e.target.value)} className="flex-1 px-4 py-3 rounded-xl border border-[#d4c8b4] bg-[#fdfaf5] text-[#3d3224] font-bold outline-none" />
                            <button onClick={handleTextSubmit} className="bg-[#8c7355] text-white p-3 rounded-xl"><ArrowRight /></button>
                            <button onClick={() => handleOptionSelect('Skipped', "I don't know yet")} className="text-sm font-bold text-[#8c7355] px-4 py-3 hover:underline">Skip</button>
                        </div>
                    )}
                    {stepId === 'class' && (
                        <div className="flex flex-wrap gap-2 justify-center">
                            {['8', '9', '10', '11', '12'].map(c => (
                                <button key={c} onClick={() => handleOptionSelect(c, `Class ${c}`)} className="w-14 h-14 bg-[#fdfaf5] hover:bg-[#8c7355] hover:text-white border border-[#d4c8b4] text-[#3d3224] rounded-xl font-bold text-lg transition-colors">{c}</button>
                            ))}
                        </div>
                    )}
                    {stepId === 'subjects' && (
                        <div className="flex flex-col gap-3">
                            <div className="flex flex-wrap gap-2">
                                {['Maths', 'Science', 'Physics', 'Chemistry', 'Biology', 'English', 'History'].map(sub => (
                                    <button 
                                        key={sub} 
                                        onClick={() => setSubjects(prev => prev.includes(sub) ? prev.filter(s => s !== sub) : [...prev, sub])}
                                        className={`px-4 py-2 rounded-xl text-sm font-bold transition-all border ${subjects.includes(sub) ? 'bg-[#8c7355] text-white border-[#8c7355]' : 'bg-[#fdfaf5] text-[#3d3224] border-[#d4c8b4] hover:border-[#8c7355]'}`}
                                    >
                                        {sub}
                                    </button>
                                ))}
                            </div>
                            <button onClick={handleSubjectsSubmit} className="bg-[#3d3224] text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2">Done <Check size={18} /></button>
                        </div>
                    )}
                    {stepId === 'name' && (
                        <div className="flex gap-2">
                            <input 
                                type="text" 
                                value={textInput}
                                onChange={e => setTextInput(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleTextSubmit()}
                                placeholder="Your name..."
                                className="flex-1 px-5 py-4 rounded-2xl border border-[#d4c8b4] bg-[#fdfaf5] text-[#3d3224] font-bold outline-none focus:border-[#8c7355]"
                            />
                            <button onClick={handleTextSubmit} className="bg-[#8c7355] hover:bg-[#3d3224] text-white px-6 rounded-2xl transition-colors">
                                <ArrowRight />
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
