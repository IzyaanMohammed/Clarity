import { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { FileText, Image as ImageIcon, Video, Headphones, AlignLeft, Sparkles, Plus, Download, X, Search, MoreVertical, ArrowRight } from 'lucide-react';
import { Navbar } from '../components/layout/Navbar';
import { Card } from '../components/ui/Card';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { apiClient } from '../api';
import { askClarifi } from '../lib/ai';

type FileType = 'pdf' | 'image' | 'audio' | 'video' | 'note';

interface DumpItem {
    id: string;
    name: string;
    type: FileType;
    subjectTag: string;
    date: string;
    summary?: string;
    content?: string; // Base64 or text content for mocked local storage
}

export const Dump = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [items, setItems] = useState<DumpItem[]>([]);
    const [activeTab, setActiveTab] = useState<FileType | 'all'>('all');
    const [isProcessing, setIsProcessing] = useState(false);
    
    const isOnboarding = items.length === 0 || location.search.includes('onboarding=true');

    // Load items from local storage for the mock
    useEffect(() => {
        if (user) {
            const stored = localStorage.getItem(`clarity_dump_${user.id}`);
            if (stored) {
                try {
                    setItems(JSON.parse(stored));
                } catch (e) {
                    console.error("Failed to load dump items");
                }
            }
        }
    }, [user]);

    // Save items to local storage
    const saveItems = (newItems: DumpItem[]) => {
        setItems(newItems);
        if (user) {
            localStorage.setItem(`clarity_dump_${user.id}`, JSON.stringify(newItems));
        }
    };

    const onDrop = useCallback(async (acceptedFiles: File[]) => {
        setIsProcessing(true);
        const newItems = [...items];
        
        for (const file of acceptedFiles) {
            let type: FileType = 'note';
            if (file.type.includes('pdf')) type = 'pdf';
            if (file.type.includes('image')) type = 'image';
            if (file.type.includes('audio')) type = 'audio';
            if (file.type.includes('video')) type = 'video';

            let summary = `This is an AI-generated summary for ${file.name}.`;
            try {
                // Read text if it's an image or pdf using the OCR endpoint
                const formData = new FormData();
                formData.append('file', file);
                const ocrRes = await apiClient.post('/upload/ocr', formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                
                if (ocrRes.data && ocrRes.data.text) {
                    // Summarize using Clarifi
                    summary = await askClarifi(
                        `Please summarize these personal notes into 3-5 concise bullet points covering the main concepts:\n\n${ocrRes.data.text}`,
                        [],
                        String(user?.class || 10)
                    );
                }
            } catch (error) {
                console.error("Failed to analyze dump file", error);
            }
            
            newItems.unshift({
                id: Math.random().toString(36).substring(7),
                name: file.name,
                type,
                subjectTag: 'Uncategorized',
                date: new Date().toISOString().split('T')[0],
                summary: summary
            });
        }

        saveItems(newItems);
        setIsProcessing(false);
        toast.success(`Successfully dumped ${acceptedFiles.length} file(s)!`);
    }, [items, user]);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop });

    const filteredItems = items.filter(item => activeTab === 'all' || item.type === activeTab);

    const getIcon = (type: FileType) => {
        switch (type) {
            case 'pdf': return <FileText className="text-red-500" />;
            case 'image': return <ImageIcon className="text-blue-500" />;
            case 'audio': return <Headphones className="text-purple-500" />;
            case 'video': return <Video className="text-pink-500" />;
            case 'note': return <AlignLeft className="text-emerald-500" />;
        }
    };

    return (
        <div className="flex min-h-screen bg-[#fcfbf9] dark:bg-[#0f1117] transition-colors relative">
            <Navbar />
            
            {/* Background Image Setup */}
            <div 
                className="absolute inset-0 z-0 opacity-40 pointer-events-none"
                style={{
                    backgroundImage: 'url(/desk_notebook.png)',
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    backgroundAttachment: 'fixed'
                }}
            />

            <main className="flex-1 lg:pl-72 flex flex-col relative z-10 items-center justify-center py-10">
                <div className="p-8 lg:p-12 max-w-4xl w-full bg-[#fdfaf5]/90 dark:bg-[#1a1c23]/95 backdrop-blur-md rounded-[40px] shadow-2xl border border-[#e8dfc8] dark:border-slate-800">
                    
                    <div className="mb-10 text-center">
                        <h1 className="text-4xl font-black text-[#3d3224] dark:text-white flex items-center justify-center gap-3 font-serif">
                            <Download className="text-[#8c7355]" size={36} />
                            Your Brain Dump
                        </h1>
                        <p className="text-[#8c7355] font-medium mt-3 text-lg">Dump your personal notes, PDFs, and links. Clarity will organize and summarize them.</p>
                    </div>

                    {/* Upload Zone */}
                    <div 
                        {...getRootProps()} 
                        className={`border-4 border-dashed rounded-[32px] p-12 text-center cursor-pointer transition-all ${isDragActive ? 'border-[#8c7355] bg-[#8c7355]/10 scale-[0.98]' : 'border-[#d4c8b4] dark:border-slate-700 hover:border-[#8c7355]/50 bg-white/60 dark:bg-slate-900/60'}`}
                    >
                        <input {...getInputProps()} />
                        <div className="w-20 h-20 bg-[#8c7355]/10 rounded-full flex items-center justify-center mx-auto mb-6">
                            {isProcessing ? (
                                <div className="w-8 h-8 border-4 border-[#8c7355]/30 border-t-[#8c7355] rounded-full animate-spin" />
                            ) : (
                                <Plus className="text-[#8c7355] w-10 h-10" />
                            )}
                        </div>
                        <h3 className="text-2xl font-bold text-[#3d3224] dark:text-white mb-2 font-serif">
                            {isProcessing ? "Processing with AI..." : "Drag & Drop files here"}
                        </h3>
                        <p className="text-[#8c7355] font-medium max-w-md mx-auto">
                            Upload PDFs, images, or notes. We'll summarize them right away.
                        </p>
                    </div>

                    {/* Tabs */}
                    <div className="flex gap-2 overflow-x-auto pb-4 mt-12 hide-scrollbar">
                        {(['all', 'pdf', 'image', 'audio', 'video', 'note'] as const).map(tab => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`px-5 py-2.5 rounded-full font-bold whitespace-nowrap transition-all ${activeTab === tab ? 'bg-slate-800 dark:bg-white text-white dark:text-slate-900' : 'bg-white dark:bg-slate-900 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                            >
                                {tab.charAt(0).toUpperCase() + tab.slice(1)}s
                            </button>
                        ))}
                    </div>

                    {/* Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
                        {filteredItems.map(item => (
                            <Card key={item.id} className="p-6 bg-white dark:bg-slate-900 rounded-[24px] border border-slate-100 dark:border-slate-800 hover:shadow-xl transition-all group">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="w-12 h-12 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center">
                                        {getIcon(item.type)}
                                    </div>
                                    <button className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                                        <MoreVertical size={20} />
                                    </button>
                                </div>
                                <h4 className="font-bold text-slate-900 dark:text-white mb-1 truncate">{item.name}</h4>
                                <div className="flex items-center gap-3 text-sm text-slate-500 mb-4">
                                    <span className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg font-semibold">{item.subjectTag}</span>
                                    <span>{item.date}</span>
                                </div>
                                
                                {item.summary && (
                                    <div className="bg-[#1D9E75]/5 border border-[#1D9E75]/20 p-4 rounded-xl mb-4">
                                        <div className="flex items-center gap-2 text-[#1D9E75] font-bold text-sm mb-2">
                                            <Sparkles size={14} /> AI Summary
                                        </div>
                                        <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-3">{item.summary}</p>
                                    </div>
                                )}

                                <div className="flex gap-2">
                                    <button className="flex-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 py-2.5 rounded-xl font-bold text-sm transition-colors">
                                        View
                                    </button>
                                    <button className="flex-1 bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 py-2.5 rounded-xl font-bold text-sm transition-colors">
                                        Ask Doubt
                                    </button>
                                </div>
                            </Card>
                        ))}

                        {filteredItems.length === 0 && (
                            <div className="col-span-full py-16 text-center">
                                <div className="w-24 h-24 bg-white/50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-6">
                                    <Search className="text-[#8c7355] dark:text-slate-600" size={40} />
                                </div>
                                <h3 className="text-xl font-bold text-[#3d3224] dark:text-slate-300 mb-2">No items found</h3>
                                <p className="text-[#8c7355]">Your dump is empty for this category.</p>
                            </div>
                        )}
                    </div>

                    {isOnboarding && (
                        <div className="mt-12 text-center">
                            <button 
                                onClick={() => navigate('/onboarding')}
                                className="bg-[#3d3224] hover:bg-[#2b2218] text-[#fdfaf5] px-8 py-4 rounded-full font-bold text-lg inline-flex items-center gap-2 shadow-xl transition-transform hover:scale-105"
                            >
                                Continue to Setup
                                <ArrowRight size={20} />
                            </button>
                        </div>
                    )}

                </div>
            </main>
        </div>
    );
};
