import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Brain, ArrowRight, User, Mail } from 'lucide-react';
import toast from 'react-hot-toast';
import { Card } from '../components/ui/Card';
import { useAuth } from '../contexts/AuthContext';

export const Login = () => {
    const navigate = useNavigate();
    const { loginWithEmail } = useAuth();
    
    const [email, setEmail] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);



    const handleEmailLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email.trim()) {
            toast.error('Please enter your email.');
            return;
        }

        setIsSubmitting(true);
        try {
            await loginWithEmail(email.trim());
            toast.success('Logged in with Email');
            navigate('/dump');
        } catch {
            toast.error('Invalid email or account not found.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-[#1D9E75]/5 via-slate-50 to-emerald-50/30 dark:from-[#020617] dark:via-slate-950 dark:to-emerald-950/20 flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-20 h-20 rounded-[28px] bg-gradient-to-br from-[#1D9E75]/20 to-emerald-100 dark:from-emerald-900/40 dark:to-emerald-800/30 mb-6">
                        <Brain className="text-[#1D9E75]" size={38} />
                    </div>
                    <h1 className="text-3xl font-black text-slate-900 dark:text-white">Welcome to Clarity</h1>
                    <p className="text-slate-600 dark:text-slate-400 font-semibold mt-1">Study smarter, not harder</p>
                </div>

                <Card className="p-8 bg-white dark:bg-slate-900 border-none shadow-2xl rounded-[32px]">
                    <form onSubmit={handleEmailLogin} className="space-y-5">
                        <div>
                            <label className="flex items-center gap-2 text-xs font-black text-slate-500 uppercase tracking-wider mb-2">
                                <Mail size={14} className="text-[#1D9E75]" />
                                Email Address
                            </label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-semibold outline-none focus:ring-4 focus:ring-[#1D9E75]/20 focus:border-[#1D9E75]"
                                placeholder="student@example.com"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="w-full flex items-center justify-center gap-2 bg-[#1D9E75] hover:bg-[#168a65] text-white py-3.5 rounded-xl font-bold transition-all shadow-lg shadow-[#1D9E75]/25 hover:shadow-xl hover:shadow-[#1D9E75]/30 active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            {isSubmitting ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <>
                                    Continue with Email
                                    <ArrowRight size={18} />
                                </>
                            )}
                        </button>
                    </form>
                </Card>
            </div>
        </div>
    );
};
