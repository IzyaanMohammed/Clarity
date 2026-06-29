import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Check, Sparkles } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { getUser, saveUser } from '../utils/storage';
import { updateMyProfile } from '../api';
import { useCurriculumCatalog } from '../hooks/useCurriculumCatalog';
import toast from 'react-hot-toast';

export const SchoolFocus = () => {
    const navigate = useNavigate();
    const user = getUser();
    const [focusChapters, setFocusChapters] = useState<Record<string, string[]>>(user?.focusChapters || {});
    const [isSubmitting, setIsSubmitting] = useState(false);

    const selectedClass = (user?.class || '10').toString();
    const selectedSubjects = user?.subjects || [];
    
    const { chaptersForSubject } = useCurriculumCatalog(selectedClass);

    // If no user, redirect to login
    useEffect(() => {
        if (!user) {
            navigate('/login');
        }
    }, [user, navigate]);

    if (!user) return null;

    const handleSave = async () => {
        setIsSubmitting(true);
        try {
            const updatedProfile = {
                ...user,
                focusChapters
            };
            await updateMyProfile(updatedProfile);
            saveUser(updatedProfile);
            toast.success('School focus updated!');
            navigate('/dashboard');
        } catch (error) {
            toast.error('Failed to save focus. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen relative bg-gradient-to-br from-[#8C5A35]/5 via-stone-50 to-amber-50/30 flex items-center justify-center p-4 md:p-8">
            <Link to="/dashboard" className="absolute top-6 left-6 md:top-8 md:left-8 flex items-center gap-2 text-stone-500 hover:text-[#8C5A35] font-bold text-sm transition-colors z-50">
                <ArrowLeft size={16} />
                Back to Dashboard
            </Link>
            
            <div className="w-full max-w-3xl mt-10 md:mt-0">
                <div className="mb-8">
                    <div className="flex items-end justify-between gap-4 mb-3">
                        <div>
                            <h1 className="text-3xl md:text-4xl font-black text-[#2C241B] ">School Focus</h1>
                            <p className="text-stone-600 font-semibold mt-1">Select current chapters for this week</p>
                        </div>
                    </div>
                </div>

                <Card className="p-6 md:p-10 bg-[#FCFAF8] border-none shadow-2xl rounded-[32px]">
                    <div className="space-y-6">
                        <div className="rounded-2xl border border-[#8C5A35]/30 bg-amber-50 p-4">
                            <p className="text-sm font-bold text-[#2C241B] ">What are you studying in school this week?</p>
                            <p className="text-xs text-stone-500 mt-1">This helps the AI prioritize your daily missions and practice sets.</p>
                        </div>
                        
                        <div className="space-y-6 max-h-[500px] overflow-y-auto pr-2">
                            {selectedSubjects.map((subject) => (
                                <div key={subject} className="space-y-3">
                                    <div className="flex items-center justify-between border-b border-stone-150 pb-1.5 mb-2">
                                        <h3 className="text-sm font-black text-[#8C5A35] uppercase tracking-wider">{subject}</h3>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const allChapters = chaptersForSubject(subject);
                                                const currentFocused = focusChapters[subject] || [];
                                                const isAllSelected = allChapters.length > 0 && allChapters.every(c => currentFocused.includes(c));
                                                setFocusChapters(prev => ({
                                                    ...prev,
                                                    [subject]: isAllSelected ? [] : allChapters
                                                }));
                                            }}
                                            className="text-xs font-black text-[#8C5A35] hover:text-[#70482B] hover:underline transition-colors cursor-pointer"
                                        >
                                            {(() => {
                                                const allChapters = chaptersForSubject(subject);
                                                const currentFocused = focusChapters[subject] || [];
                                                const isAllSelected = allChapters.length > 0 && allChapters.every(c => currentFocused.includes(c));
                                                return isAllSelected ? 'Deselect All' : 'Select All';
                                            })()}
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-1 gap-2">
                                        {chaptersForSubject(subject).map((chapter) => {
                                            const isFocused = (focusChapters[subject] || []).includes(chapter);
                                            return (
                                                <button
                                                    key={chapter}
                                                    onClick={() => {
                                                        setFocusChapters(prev => {
                                                            const current = prev[subject] || [];
                                                            const next = isFocused
                                                                ? current.filter(c => c !== chapter)
                                                                : [...current, chapter];
                                                            return { ...prev, [subject]: next };
                                                        });
                                                    }}
                                                    className={`p-3 rounded-xl border-2 text-left text-sm font-bold transition-all ${isFocused
                                                        ? 'border-[#8C5A35] bg-amber-50 text-[#8C5A35]'
                                                        : 'border-stone-200 text-stone-600 hover:border-[#8C5A35]/30'
                                                        }`}
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <span>{chapter}</span>
                                                        {isFocused && <Check size={14} />}
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </Card>

                <div className="mt-6 flex justify-end">
                    <button
                        onClick={handleSave}
                        disabled={isSubmitting}
                        className="px-6 py-3 rounded-xl bg-gradient-to-r from-[#8C5A35] to-amber-600 text-white font-black hover:from-[#178764] hover:to-amber-700 flex items-center gap-2 "
                    >
                        {isSubmitting ? 'Saving...' : 'Save Focus'}
                        <Check size={18} />
                    </button>
                </div>
            </div>
        </div>
    );
};
