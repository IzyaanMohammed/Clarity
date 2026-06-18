import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Brain, ArrowRight, User, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';
import { Card } from '../components/ui/Card';
import { loginUser } from '../api';
import { saveAuthToken, saveUser } from '../utils/storage';

export const Login = () => {
    const navigate = useNavigate();
    const [name, setName] = useState('');
    const [password, setPassword] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim() || !password.trim()) {
            toast.error('Enter name and password to login.');
            return;
        }

        setIsSubmitting(true);
        try {
            const result = await loginUser({ name: name.trim(), password: password.trim() });
            saveAuthToken(result.token);
            saveUser(result.user);
            toast.success('Logged in successfully.');
            navigate('/dashboard');
        } catch {
            toast.error('Invalid credentials or account not found.');
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
                    <h1 className="text-3xl font-black text-slate-900 dark:text-white">Welcome Back</h1>
                    <p className="text-slate-600 dark:text-slate-400 font-semibold mt-1">Pick up where you left off</p>
                </div>

                <Card className="p-8 bg-white dark:bg-slate-900 border-none shadow-2xl rounded-[32px]">
                    <form onSubmit={handleLogin} className="space-y-5">
                        <div>
                            <label className="flex items-center gap-2 text-xs font-black text-slate-500 uppercase tracking-wider mb-2">
                                <User size={14} className="text-[#1D9E75]" />
                                Student Name
                            </label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-semibold outline-none focus:ring-4 focus:ring-[#1D9E75]/20 focus:border-[#1D9E75]"
                                placeholder="Enter your name"
                                autoFocus
                            />
                        </div>

                        <div>
                            <label className="flex items-center gap-2 text-xs font-black text-slate-500 uppercase tracking-wider mb-2">
                                <Sparkles size={14} className="text-[#1D9E75]" />
                                Password
                            </label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-semibold outline-none focus:ring-4 focus:ring-[#1D9E75]/20 focus:border-[#1D9E75]"
                                placeholder="••••••••"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="w-full py-4 rounded-2xl bg-[#1D9E75] text-white font-black uppercase tracking-widest text-sm shadow-lg shadow-emerald-500/20 hover:bg-[#16805d] transition-all flex items-center justify-center gap-2"
                        >
                            {isSubmitting ? 'Verifying...' : 'Login to Clarity'}
                            {!isSubmitting && <ArrowRight size={18} />}
                        </button>
                    </form>

                    <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800 text-center">
                        <p className="text-sm text-slate-500 font-bold mb-3">New to Clarity?</p>
                        <Link
                            to="/onboarding"
                            onClick={() => {
                                localStorage.removeItem('ncertai_user');
                                localStorage.removeItem('ncertai_token');
                            }}
                            className="text-[#1D9E75] font-black text-sm uppercase tracking-wider hover:underline"
                        >
                            Create Student Account
                        </Link>
                    </div>
                </Card>

                <div className="mt-8 text-center">
                    <Link to="/parent-portal" className="text-slate-400 dark:text-slate-600 text-xs font-bold hover:text-[#1D9E75] transition-colors">
                        Parent Login? Switch to Parent Portal
                    </Link>
                </div>
            </div>
        </div>
    );
};
