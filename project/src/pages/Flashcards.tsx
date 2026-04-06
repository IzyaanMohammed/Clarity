import { useMemo, useState } from 'react';
import { RefreshCw, Info, Sparkles, TrendingUp } from 'lucide-react';
import toast from 'react-hot-toast';
import { Navbar } from '../components/layout/Navbar';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { addBookmark, getUser, saveStudyMaterialIfNew, updateFlashcardSet } from '../utils/storage';
import { generateFlashcardsStream, FlashcardItem, saveMaterialToDatabase } from '../api';
import { useCurriculumCatalog } from '../hooks/useCurriculumCatalog';
import {
    SM2Algorithm,
    initializeFlashcard,
    FlashcardWithReview,
    sortFlashcardsByDueDate,
    getReviewStats,
    formatTimeUntilReview
} from '../utils/spacedRepetition';

export const Flashcards = () => {
    const user = getUser();
    const classKey = (user?.class || '10').toString();
    const { subjectsForClass, chaptersForSubject } = useCurriculumCatalog(classKey);
    const subjects = subjectsForClass.length ? subjectsForClass : (user?.subjects?.length ? user.subjects : ['Science']);

    const [selectedSubject, setSelectedSubject] = useState(subjects[0]);
    const chapters = useMemo(
        () => chaptersForSubject(selectedSubject),
        [chaptersForSubject, selectedSubject]
    );
    const [selectedChapter, setSelectedChapter] = useState(chapters[0] || '');
    const [count, setCount] = useState(8);
    const [isLoading, setIsLoading] = useState(false);
    const [cards, setCards] = useState<FlashcardWithReview[]>([]);
    const [activeIndex, setActiveIndex] = useState(0);
    const [showAnswer, setShowAnswer] = useState(false);
    const [currentMaterialId, setCurrentMaterialId] = useState<string | null>(null);

    const parseFlashcardsFromText = (raw: string): FlashcardItem[] => {
        const lines = raw.split('\n').map((line) => line.trim()).filter(Boolean);
        const parsed: FlashcardItem[] = [];
        for (const line of lines) {
            if (!line.includes('Q:') || !line.includes('| A:')) continue;
            const [qPart, aPart] = line.split('| A:', 2);
            const question = qPart.replace(/^[-*\d.\s]*/, '').replace('Q:', '').trim();
            const answer = aPart.trim();
            if (question && answer) parsed.push({ question, answer });
        }
        return parsed;
    };

    const activeCard = cards[activeIndex];
    const reviewStats = getReviewStats(cards);

    const handleGenerate = async () => {
        if (!selectedSubject || !selectedChapter) {
            toast.error('Please choose subject and chapter.');
            return;
        }

        setIsLoading(true);
        try {
            let streamed = '';
            setCards([]);
            setActiveIndex(0);
            setShowAnswer(false);

            await generateFlashcardsStream(
                {
                    class_num: classKey,
                    subject: selectedSubject,
                    chapter: selectedChapter,
                    count,
                },
                (token) => {
                    streamed += token;
                    const parsed = parseFlashcardsFromText(streamed);
                    if (parsed.length) {
                        const flashcardsWithReview: FlashcardWithReview[] = parsed
                            .slice(0, count)
                            .map((card, idx) => initializeFlashcard(`card_${Date.now()}_${idx}`, card.question, card.answer));
                        setCards(flashcardsWithReview);
                    }
                }
            );

            const parsed = parseFlashcardsFromText(streamed);
            if (parsed.length) {
                const nextCards: FlashcardWithReview[] = parsed
                    .slice(0, count)
                    .map((card, idx) => initializeFlashcard(`card_${Date.now()}_${idx}`, card.question, card.answer));
                setCards(nextCards);

                // Save with spaced repetition metadata
                const materialId = `flash_${Date.now()}`;
                setCurrentMaterialId(materialId);
                saveStudyMaterialIfNew({
                    id: materialId,
                    type: 'practice',
                    title: `Flashcard Set: ${selectedChapter}`,
                    subject: selectedSubject,
                    chapter: selectedChapter,
                    content: nextCards.map((c, idx) => `${idx + 1}. Q: ${c.question}\nA: ${c.answer}`).join('\n\n'),
                    flashcards: nextCards,
                    createdAt: Date.now(),
                    lastReviewedAt: Date.now(),
                });
                try {
                    await saveMaterialToDatabase({
                        id: materialId,
                        type: 'practice',
                        title: `Flashcard Set: ${selectedChapter}`,
                        subject: selectedSubject,
                        chapter: selectedChapter,
                        content: nextCards.map((c, idx) => `${idx + 1}. Q: ${c.question}\nA: ${c.answer}`).join('\n\n'),
                        createdAt: Date.now(),
                    });
                } catch {
                    // Keep local save if sync fails.
                }
            }
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : 'Unable to generate flashcards right now.';
            toast.error(msg);
        } finally {
            setIsLoading(false);
        }
    };

    const nextCard = () => {
        if (!cards.length) return;
        setActiveIndex((prev) => (prev + 1) % cards.length);
        setShowAnswer(false);
    };

    const prevCard = () => {
        if (!cards.length) return;
        setActiveIndex((prev) => (prev - 1 + cards.length) % cards.length);
        setShowAnswer(false);
    };

    const handleCardRating = (quality: number) => {
        if (!activeCard || !currentMaterialId) return;

        // Update card with spaced repetition algorithm
        const updatedCard = SM2Algorithm.updateCardAfterReview(activeCard, quality);

        // Update local state
        const updatedCards = [...cards];
        updatedCards[activeIndex] = updatedCard;
        const sorted = sortFlashcardsByDueDate(updatedCards);
        const newIndex = sorted.findIndex(c => c.id === activeCard.id);

        setCards(sorted);
        setActiveIndex(newIndex);
        setShowAnswer(false);

        // Save to study materials
        updateFlashcardSet(currentMaterialId, (item) => ({
            ...item,
            flashcards: sorted,
            lastReviewedAt: Date.now(),
        }));

        // User feedback
        const qualityLabels = {
            0: 'Complete blackout - card will be reviewed tomorrow',
            1: 'Incorrect - card will be reviewed tomorrow',
            2: 'Difficult - card will be reviewed in 1 day',
            3: 'Okay - card will be reviewed in 3 days',
            4: 'Good - card will be reviewed in ' + updatedCard.interval + ' days',
            5: 'Perfect! - card will be reviewed in ' + updatedCard.interval + ' days',
        };
        toast.success(qualityLabels[quality as keyof typeof qualityLabels] || 'Card rated');
    };

    const bookmarkCurrentCard = () => {
        if (!activeCard) return;
        const added = addBookmark({
            id: `bm_flash_${Date.now()}_${activeIndex}`,
            type: 'flashcard',
            subject: selectedSubject,
            chapter: selectedChapter,
            question: activeCard.question,
            answer: activeCard.answer,
            createdAt: Date.now(),
        });
        if (added) {
            toast.success('Flashcard saved');
        } else {
            toast('Already bookmarked');
        }
    };

    return (
        <div className="min-h-screen bg-[#f8fafc] dark:bg-[#020617] transition-colors duration-300">
            <Navbar />
            <main className="max-w-6xl mx-auto px-6 py-10">
                <div className="mb-8">
                    <h1 className="text-3xl md:text-4xl font-black text-slate-900 dark:text-white">
                        Flashcard Lab
                    </h1>
                    <p className="text-slate-500 mt-2 font-medium">
                        Generate rapid-revision flashcards with smart spaced repetition scheduling.
                    </p>
                </div>

                <Card className="p-5 mb-8 bg-gradient-to-r from-violet-50 to-rose-50 dark:from-slate-800 dark:to-slate-900 border border-violet-100 dark:border-slate-700 rounded-3xl">
                    <div className="flex items-start gap-3">
                        <Info className="text-violet-600 mt-0.5" size={18} />
                        <div className="text-sm text-slate-700 dark:text-slate-200">
                            <p className="font-bold">Smart Spaced Repetition:</p>
                            <p className="mt-1">Cards are automatically scheduled based on difficulty. Easy cards get longer gaps, while harder ones come back sooner. Use 6-8 cards for quick drill, 10-12 for deeper revision. Rate each card—your feedback tunes the review schedule!</p>
                        </div>
                    </div>
                </Card>

                <Card className="p-6 md:p-8 bg-white dark:bg-[#0f172a] border-none shadow-xl rounded-3xl mb-8">
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                        <div>
                            <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-2">Subject</label>
                            <select
                                value={selectedSubject}
                                onChange={(e) => {
                                    const nextSubject = e.target.value;
                                    setSelectedSubject(nextSubject);
                                    const nextChapters = chaptersForSubject(nextSubject);
                                    setSelectedChapter(nextChapters[0] || '');
                                }}
                                className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-semibold border border-slate-200 dark:border-slate-700"
                            >
                                {subjects.map((subject) => (
                                    <option key={subject} value={subject}>
                                        {subject}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <select
                            value={selectedChapter}
                            onChange={(e) => setSelectedChapter(e.target.value)}
                            className="px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-semibold border border-slate-200 dark:border-slate-700 md:col-span-2"
                        >
                            {chapters.map((chapter) => (
                                <option key={chapter} value={chapter}>
                                    {chapter}
                                </option>
                            ))}
                        </select>

                        <div>
                            <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-2">Card Count</label>
                            <select
                                value={count}
                                onChange={(e) => setCount(Number(e.target.value))}
                                className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-semibold border border-slate-200 dark:border-slate-700"
                            >
                                {[6, 8, 10, 12].map((n) => (
                                    <option key={n} value={n}>
                                        {n} cards
                                    </option>
                                ))}
                            </select>
                        </div>

                        <Button
                            onClick={handleGenerate}
                            disabled={isLoading}
                            className="w-full bg-[#1D9E75] hover:bg-[#16805d] rounded-xl font-bold"
                        >
                            {isLoading ? 'Streaming...' : 'Generate'}
                        </Button>
                    </div>
                </Card>

                {cards.length > 0 && (
                    <Card className="p-4 md:p-6 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-slate-800 dark:to-slate-900 border border-emerald-100 dark:border-slate-700 rounded-3xl mb-8">
                        <div className="flex items-center gap-2 mb-4">
                            <TrendingUp size={18} className="text-emerald-600" />
                            <p className="font-bold text-slate-900 dark:text-white">Spaced Repetition Progress</p>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-6 gap-4 text-sm">
                            <div>
                                <p className="text-xs text-slate-500 uppercase font-black mb-1">Total Cards</p>
                                <p className="text-2xl font-bold text-emerald-600">{reviewStats.total}</p>
                            </div>
                            <div>
                                <p className="text-xs text-slate-500 uppercase font-black mb-1">Reviewed</p>
                                <p className="text-2xl font-bold text-blue-600">{reviewStats.reviewed}</p>
                            </div>
                            <div>
                                <p className="text-xs text-slate-500 uppercase font-black mb-1">Due Now</p>
                                <p className="text-2xl font-bold text-orange-600">{reviewStats.due}</p>
                            </div>
                            <div>
                                <p className="text-xs text-slate-500 uppercase font-black mb-1">This Week</p>
                                <p className="text-2xl font-bold text-purple-600">{reviewStats.dueThisWeek}</p>
                            </div>
                            <div>
                                <p className="text-xs text-slate-500 uppercase font-black mb-1">Ease Factor</p>
                                <p className="text-2xl font-bold text-indigo-600">{reviewStats.averageEaseFactor}</p>
                            </div>
                            <div>
                                <p className="text-xs text-slate-500 uppercase font-black mb-1">Avg Interval</p>
                                <p className="text-2xl font-bold text-rose-600">{reviewStats.averageInterval}d</p>
                            </div>
                        </div>
                    </Card>
                )}

                <Card className="p-6 md:p-10 bg-white dark:bg-[#0f172a] border-none shadow-xl rounded-3xl min-h-[500px]">
                    {activeCard ? (
                        <div>
                            <div className="flex items-center justify-between mb-6">
                                <div>
                                    <p className="text-xs uppercase tracking-widest font-black text-slate-500">
                                        Card {activeIndex + 1} / {cards.length}
                                    </p>
                                    {activeCard.nextReviewAt && (
                                        <p className="text-xs text-slate-400 mt-1">
                                            {formatTimeUntilReview(activeCard.nextReviewAt)} • Ease: {activeCard.easeFactor.toFixed(2)} • Reps: {activeCard.repetitions}
                                        </p>
                                    )}
                                </div>
                                <Button variant="ghost" className="rounded-xl" onClick={handleGenerate}>
                                    <RefreshCw size={16} className="mr-2" />
                                    New Set
                                </Button>
                            </div>

                            <div
                                className="rounded-3xl border border-slate-200 dark:border-slate-700 p-8 md:p-12 min-h-[250px] flex items-center justify-center text-center cursor-pointer bg-gradient-to-br from-violet-50 via-white to-rose-50 dark:from-[#111827] dark:to-[#0b1220]"
                                onClick={() => setShowAnswer((prev) => !prev)}
                            >
                                <div>
                                    <p className="text-xs font-black uppercase tracking-wider text-[#1D9E75] mb-4">
                                        {showAnswer ? 'Answer' : 'Question'}
                                    </p>
                                    <p className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white leading-relaxed">
                                        {showAnswer ? activeCard.answer : activeCard.question}
                                    </p>
                                    <p className="text-xs text-slate-400 mt-5">Tap card to flip instantly</p>
                                </div>
                            </div>

                            {/* Quality Rating Buttons (only show after revealing answer) */}
                            {showAnswer && (
                                <div className="mt-8 p-4 bg-sky-50 dark:bg-slate-800 rounded-2xl border border-sky-100 dark:border-slate-700">
                                    <p className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-4">How well did you remember this?</p>
                                    <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
                                        <button
                                            onClick={() => handleCardRating(0)}
                                            className="px-3 py-2 rounded-lg bg-red-100 hover:bg-red-200 dark:bg-red-900 dark:hover:bg-red-800 text-red-700 dark:text-red-200 font-bold text-xs"
                                        >
                                            Blackout
                                        </button>
                                        <button
                                            onClick={() => handleCardRating(1)}
                                            className="px-3 py-2 rounded-lg bg-orange-100 hover:bg-orange-200 dark:bg-orange-900 dark:hover:bg-orange-800 text-orange-700 dark:text-orange-200 font-bold text-xs"
                                        >
                                            Incorrect
                                        </button>
                                        <button
                                            onClick={() => handleCardRating(2)}
                                            className="px-3 py-2 rounded-lg bg-yellow-100 hover:bg-yellow-200 dark:bg-yellow-900 dark:hover:bg-yellow-800 text-yellow-700 dark:text-yellow-200 font-bold text-xs"
                                        >
                                            Difficult
                                        </button>
                                        <button
                                            onClick={() => handleCardRating(3)}
                                            className="px-3 py-2 rounded-lg bg-amber-100 hover:bg-amber-200 dark:bg-amber-900 dark:hover:bg-amber-800 text-amber-700 dark:text-amber-200 font-bold text-xs"
                                        >
                                            Okay
                                        </button>
                                        <button
                                            onClick={() => handleCardRating(4)}
                                            className="px-3 py-2 rounded-lg bg-green-100 hover:bg-green-200 dark:bg-green-900 dark:hover:bg-green-800 text-green-700 dark:text-green-200 font-bold text-xs"
                                        >
                                            Good
                                        </button>
                                        <button
                                            onClick={() => handleCardRating(5)}
                                            className="px-3 py-2 rounded-lg bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-900 dark:hover:bg-emerald-800 text-emerald-700 dark:text-emerald-200 font-bold text-xs"
                                        >
                                            Perfect
                                        </button>
                                    </div>
                                </div>
                            )}

                            <div className="flex items-center justify-between mt-8 gap-2">
                                <Button variant="outline" className="rounded-xl flex-1" onClick={prevCard}>
                                    Previous
                                </Button>
                                <Button
                                    variant="secondary"
                                    className="rounded-xl flex-1"
                                    onClick={() => setShowAnswer((prev) => !prev)}
                                >
                                    {showAnswer ? 'Hide' : 'Reveal'} Answer
                                </Button>
                                <div className="flex items-center gap-2 flex-1">
                                    <Button variant="outline" className="rounded-xl flex-1" onClick={bookmarkCurrentCard}>
                                        Save
                                    </Button>
                                    <Button className="rounded-xl flex-1" onClick={nextCard}>
                                        Next
                                    </Button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-center text-slate-500">
                            <Sparkles size={34} className="mb-3 text-[#1D9E75]" />
                            <p className="font-semibold">No flashcards yet.</p>
                            <p className="text-sm mt-1 max-w-md">Select subject, chapter, and card count, then click Generate. Your cards will appear here ready for smart spaced repetition.</p>
                        </div>
                    )}
                </Card>
            </main>
        </div>
    );
};
