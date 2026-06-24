import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Brain, ArrowRight, ArrowLeft, User, Sparkles } from 'lucide-react';
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
        <div className="min-h-screen relative bg-gradient-to-br from-[#8C5A35]/5 via-stone-50 to-amber-50/30 flex items-center justify-center p-4">
            <Link to="/" className="absolute top-6 left-6 md:top-8 md:left-8 flex items-center gap-2 text-stone-500 hover:text-[#8C5A35] font-bold text-sm transition-colors">
                <ArrowLeft size={16} />
                Back to Home
            </Link>
            <div className="w-full max-w-md">
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-20 h-20 rounded-[28px] bg-gradient-to-br from-[#8C5A35]/20 to-amber-100 mb-6">
                        <Brain className="text-[#8C5A35]" size={38} />
                    </div>
                    <h1 className="text-3xl font-black text-[#2C241B] ">Welcome Back</h1>
                    <p className="text-stone-600 font-semibold mt-1">Pick up where you left off</p>
                </div>

                <Card className="p-8 bg-[#FCFAF8] border-none shadow-2xl rounded-[32px]">
                    <form onSubmit={handleLogin} className="space-y-5">
                        <div>
                            <label className="flex items-center gap-2 text-xs font-black text-stone-500 uppercase tracking-wider mb-2">
                                <User size={14} className="text-[#8C5A35]" />
                                Student Name
                            </label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="w-full px-4 py-3 rounded-xl border-3 border-[#2C241B] shadow-neo bg-[#FCFAF8] text-[#2C241B] font-semibold outline-none focus:ring-4 focus:ring-[#8C5A35]/20 focus:border-[#8C5A35]"
                                placeholder="Enter your name"
                                autoFocus
                            />
                        </div>

                        <div>
                            <label className="flex items-center gap-2 text-xs font-black text-stone-500 uppercase tracking-wider mb-2">
                                <Sparkles size={14} className="text-[#8C5A35]" />
                                Password
                            </label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full px-4 py-3 rounded-xl border-3 border-[#2C241B] shadow-neo bg-[#FCFAF8] text-[#2C241B] font-semibold outline-none focus:ring-4 focus:ring-[#8C5A35]/20 focus:border-[#8C5A35]"
                                placeholder="••••••••"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="w-full py-4 rounded-2xl bg-[#8C5A35] text-white font-black uppercase tracking-widest text-sm  shadow-amber-500/20 hover:bg-[#70482B] border-3 border-[#2C241B] shadow-neo hover:translate-y-[2px] hover:translate-x-[2px] hover:shadow-neo-sm active:translate-x-[4px] active:translate-y-[4px] active:shadow-none transition-all transition-all flex items-center justify-center gap-2"
                        >
                            {isSubmitting ? 'Verifying...' : 'Login to Clarity'}
                            {!isSubmitting && <ArrowRight size={18} />}
                        </button>
                    </form>

                    <div className="mt-8 pt-6 border-t border-stone-100 text-center">
                        <p className="text-sm text-stone-500 font-bold mb-3">New to Clarity?</p>
                        <Link
                            to="/onboarding"
                            onClick={() => {
                                localStorage.removeItem('ncertai_user');
                                localStorage.removeItem('ncertai_token');
                            }}
                            className="text-[#8C5A35] font-black text-sm uppercase tracking-wider hover:underline"
                        >
                            Create Student Account
                        </Link>
                    </div>
                </Card>

                <div className="mt-8 text-center">
                    <Link to="/parent-portal" className="text-stone-400 text-xs font-bold hover:text-[#8C5A35] transition-colors">
                        Parent Login? Switch to Parent Portal
                    </Link>
                </div>
            </div>
        </div>
    );
};
