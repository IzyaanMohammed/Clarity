import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Brain, ArrowRight, User, Mail } from 'lucide-react';
import toast from 'react-hot-toast';
import { Card } from '../components/ui/Card';
import { useAuth } from '../contexts/AuthContext';

export const Login = () => {
    const navigate = useNavigate();
    const { loginWithGoogle, loginWithEmail, user } = useAuth();
    
    const [email, setEmail] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleGoogleLogin = async () => {
        setIsSubmitting(true);
        try {
            await loginWithGoogle();
            toast.success('Logged in with Google');
            navigate('/dump');
        } catch {
            toast.error('Failed to login with Google');
        } finally {
            setIsSubmitting(false);
        }
    };

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
                    <div className="space-y-4 mb-6">
                        <button
                            onClick={handleGoogleLogin}
                            disabled={isSubmitting}
                            className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl border-2 border-slate-200 dark:border-slate-700 hover:border-[#1D9E75] dark:hover:border-[#1D9E75] transition-colors font-bold text-slate-700 dark:text-slate-300"
                        >
                            <svg className="w-5 h-5" viewBox="0 0 24 24">
                                <path
                                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                    fill="#4285F4"
                                />
                                <path
                                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                    fill="#34A853"
                                />
                                <path
                                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                                    fill="#FBBC05"
                                />
                                <path
                                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                                    fill="#EA4335"
                                />
                            </svg>
                            Continue with Google
                        </button>
                    </div>

                    <div className="relative mb-6">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-slate-200 dark:border-slate-800"></div>
                        </div>
                        <div className="relative flex justify-center text-sm">
                            <span className="px-2 bg-white dark:bg-slate-900 text-slate-500 font-medium">Or continue with email</span>
                        </div>
                    </div>

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
