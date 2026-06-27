import React, { useState, useEffect, useRef } from 'react';
import { Send, Sparkles, Lock, ArrowRight } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Link } from 'react-router-dom';

export default function DemoWidget() {
    const [question, setQuestion] = useState('');
    const [isStreaming, setIsStreaming] = useState(false);
    const [answer, setAnswer] = useState('');
    const [isLocked, setIsLocked] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (localStorage.getItem('clarity_demo_used') === 'true') {
            setIsLocked(true);
        }
    }, []);

    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [answer]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!question.trim() || isStreaming || isLocked) return;

        setIsStreaming(true);
        setAnswer('');
        localStorage.setItem('clarity_demo_used', 'true');
        
        try {
            const response = await fetch('http://localhost:8000/api/v1/chat/demo-ask-stream', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    question,
                    class_num: 12,
                    subject: 'Science',
                    chapter: 'Core Concepts'
                })
            });

            if (!response.ok) throw new Error('Failed to fetch');
            
            const reader = response.body?.getReader();
            if (!reader) throw new Error('No stream');

            const decoder = new TextDecoder();
            while (true) {
                const { done, value } = await reader.read();
                if (done) {
                    setIsLocked(true);
                    break;
                }
                const chunk = decoder.decode(value);
                const lines = chunk.split('\n\n');
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.replace('data: ', ''));
                            if (data.token) {
                                setAnswer(prev => prev + data.token);
                            }
                        } catch (err) {
                            // ignore parse error for incomplete chunks
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Demo error:', error);
            setAnswer('Something went wrong. Please try signing up to continue!');
            setIsLocked(true);
        } finally {
            setIsStreaming(false);
        }
    };

    if (isLocked && !isStreaming && !answer) {
        return (
            <div className="w-full bg-[#fdfdfb] p-8 text-center flex flex-col items-center justify-center min-h-[300px] border border-[#1a1a2e]/10 rounded-2xl">
                <div className="w-12 h-12 bg-[#1a1a2e]/5 rounded-full flex items-center justify-center mb-4">
                    <Lock size={20} className="text-[#1a1a2e]" />
                </div>
                <h3 className="text-lg font-black text-[#1a1a2e] mb-2">You've seen the magic!</h3>
                <p className="text-sm text-[#1a1a2e]/60 font-semibold mb-6 max-w-sm">
                    You've already tried the live demo. Sign up for free to get unlimited step-mark AI tutoring, daily missions, and more.
                </p>
                <Link to="/onboarding" className="px-6 py-2.5 bg-[#1a1a2e] text-[#f7f5f0] text-sm font-black rounded-lg hover:bg-[#1a1a2e]/90 inline-flex items-center gap-2">
                    Start Free <ArrowRight size={14} />
                </Link>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-[#FCFAF8] min-h-[350px]">
            <div className="flex-1 p-4 overflow-y-auto" style={{ maxHeight: '400px' }}>
                {!answer && !isStreaming ? (
                    <div className="h-full flex flex-col items-center justify-center text-center px-4 space-y-3 opacity-60">
                        <Sparkles size={24} className="text-[#1a1a2e] mb-2" />
                        <p className="text-sm font-black text-[#1a1a2e]">Try the Clarity AI</p>
                        <p className="text-xs font-semibold text-[#1a1a2e]/70">Type any CBSE question below and see how we grade it with step marks instantly.</p>
                    </div>
                ) : (
                    <div className="prose prose-sm prose-p:leading-relaxed prose-pre:bg-[#1a1a2e]/5 prose-pre:text-[#1a1a2e] prose-headings:font-black prose-a:text-[#2d5af8] max-w-none text-[#1a1a2e]">
                        <ReactMarkdown>{answer}</ReactMarkdown>
                        {isStreaming && <span className="inline-block w-2 h-4 bg-[#1a1a2e] animate-pulse ml-1 align-middle" />}
                        <div ref={messagesEndRef} />
                        
                        {isLocked && !isStreaming && (
                             <div className="mt-8 p-4 bg-[#1a1a2e]/5 rounded-xl border border-[#1a1a2e]/10 flex flex-col items-center text-center">
                                <h4 className="text-sm font-black text-[#1a1a2e] mb-1">Want more answers?</h4>
                                <p className="text-xs text-[#1a1a2e]/70 mb-3">Your free demo is complete. Sign up to unlock your personal AI study OS.</p>
                                <Link to="/onboarding" className="px-5 py-2 bg-[#1a1a2e] text-[#f7f5f0] text-xs font-black rounded-lg hover:bg-[#1a1a2e]/90">
                                    Start Free
                                </Link>
                             </div>
                        )}
                    </div>
                )}
            </div>

            <div className="p-3 bg-white border-t border-[#1a1a2e]/10">
                <form onSubmit={handleSubmit} className="relative flex items-center">
                    <input
                        type="text"
                        value={question}
                        onChange={(e) => setQuestion(e.target.value)}
                        placeholder="e.g. State Ohm's Law and its limitations..."
                        disabled={isStreaming || isLocked}
                        className="w-full bg-[#fdfdfb] border border-[#1a1a2e]/15 rounded-xl pl-4 pr-12 py-3 text-sm font-medium text-[#1a1a2e] placeholder:text-[#1a1a2e]/30 focus:outline-none focus:ring-2 focus:ring-[#1a1a2e]/20 transition-all disabled:opacity-50"
                    />
                    <button
                        type="submit"
                        disabled={!question.trim() || isStreaming || isLocked}
                        className="absolute right-2 p-2 bg-[#1a1a2e] text-[#f7f5f0] rounded-lg disabled:opacity-50 hover:bg-[#1a1a2e]/90 transition-all"
                    >
                        <Send size={14} />
                    </button>
                </form>
            </div>
        </div>
    );
}
