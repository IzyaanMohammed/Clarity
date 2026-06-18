import { useState } from 'react';
import { ScanText, Upload, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import { Navbar } from '../components/layout/Navbar';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { extractOcrText, saveMaterialToDatabase } from '../api';
import { getUser, saveStudyMaterialIfNew, type StudyMaterialItem } from '../utils/storage';

export const OCR = () => {
    const user = getUser();
    const [ocrLoading, setOcrLoading] = useState(false);
    const [ocrText, setOcrText] = useState('');

    const fileToDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('Unable to read file preview.'));
        reader.readAsDataURL(file);
    });

    const onOcrFile = async (file?: File) => {
        if (!file) return;
        setOcrLoading(true);
        try {
            const response = await extractOcrText(file);
            setOcrText(response.text);
            let imageDataUrl: string | undefined;
            if (file.type.startsWith('image/') && file.size < 2_000_000) {
                try {
                    imageDataUrl = await fileToDataUrl(file);
                } catch {
                    imageDataUrl = undefined;
                }
            }

            if (response.text.trim()) {
                const material: StudyMaterialItem = {
                    id: `ocr_auto_${Date.now()}`,
                    type: 'ocr',
                    title: `OCR: ${file.name}`,
                    subject: user?.subjects?.[0] || 'General',
                    chapter: 'Uploaded Notes',
                    content: response.text,
                    imageDataUrl,
                    createdAt: Date.now(),
                };
                saveStudyMaterialIfNew(material);
                try {
                    await saveMaterialToDatabase(material);
                } catch {
                    // Keep local save if sync fails.
                }
            }
            toast.success(`OCR done (${response.source})`);
        } catch {
            toast.error('OCR extraction failed.');
        } finally {
            setOcrLoading(false);
        }
    };

    const saveMaterial = async () => {
        if (!ocrText.trim()) return;
        const material: StudyMaterialItem = {
            id: `ocr_${Date.now()}`,
            type: 'ocr',
            title: `OCR Notes ${new Date().toLocaleDateString()}`,
            subject: user?.subjects?.[0] || 'General',
            content: ocrText,
            createdAt: Date.now(),
        };
        saveStudyMaterialIfNew(material);
        try {
            await saveMaterialToDatabase(material);
        } catch {
            // Keep local save if sync fails.
        }
        toast.success('Saved to Study Materials');
    };

    return (
        <div className="min-h-screen bg-[#f8fafc] transition-colors duration-300">
            <Navbar />
            <main className="max-w-6xl mx-auto px-6 py-10">
                <div className="mb-8">
                    <h1 className="text-4xl font-black text-[#2C241B] ">OCR Workspace</h1>
                    <p className="text-stone-500 font-medium mt-2">Upload handwritten notes or scanned pages and save extracted text.</p>
                </div>

                <Card className="p-6 bg-[#FCFAF8] border-none shadow-xl rounded-3xl">
                    <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
                        <h2 className="text-xl font-black text-[#2C241B] flex items-center gap-2">
                            <ScanText size={20} className="text-[#8C5A35]" />
                            OCR Extractor
                        </h2>
                        <div className="flex gap-2">
                            <label className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#8C5A35] text-white font-black cursor-pointer hover:bg-[#70482B] border-3 border-[#2C241B] shadow-neo hover:translate-y-[2px] hover:translate-x-[2px] hover:shadow-neo-sm active:translate-x-[4px] active:translate-y-[4px] active:shadow-none transition-all transition-colors">
                                <Upload size={16} />
                                Upload for OCR
                                <input
                                    type="file"
                                    accept=".pdf,.png,.jpg,.jpeg,.webp"
                                    className="hidden"
                                    onChange={(e) => onOcrFile(e.target.files?.[0])}
                                />
                            </label>
                            <Button className="rounded-xl" onClick={saveMaterial} disabled={!ocrText.trim()}>
                                <Save size={16} className="mr-1" />
                                Save
                            </Button>
                        </div>
                    </div>
                    <textarea
                        value={ocrLoading ? 'Extracting text...' : ocrText}
                        onChange={(e) => setOcrText(e.target.value)}
                        className="w-full min-h-[320px] rounded-2xl border-3 border-[#2C241B] shadow-neo bg-[#FCFAF8] p-4 text-sm font-medium"
                        placeholder="Upload an image or PDF to extract text."
                    />
                </Card>
            </main>
        </div>
    );
};
