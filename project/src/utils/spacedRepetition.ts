/**
 * Spaced Repetition (SM-2 Algorithm) implementation for flashcards
 * Based on the SuperMemo 2 algorithm: https://www.supermemo.com/en/blog/application-of-a-computer-to-improve-the-results-obtainable-in-working-with-the-learning-process
 */

export interface FlashcardReview {
    cardId: string;
    reviewedAt: number;
    quality: 0 | 1 | 2 | 3 | 4 | 5; // 0=complete blackout, 5=perfect response
    easeFactor: number;
    interval: number; // days until next review
    repetitions: number;
}

export interface FlashcardWithReview {
    id: string;
    question: string;
    answer: string;
    // SM-2 state tracking
    easeFactor: number; // 1.3-2.6, default 2.5
    interval: number; // days until next review
    repetitions: number; // number of times reviewed
    nextReviewAt: number; // timestamp when card is due
}

export interface FlashcardSetMetadata {
    id: string;
    title: string;
    subject: string;
    chapter: string;
    cards: FlashcardWithReview[];
    createdAt: number;
    lastReviewedAt?: number;
    totalReviews: number;
}

/**
 * SM-2 Algorithm for calculating next review interval
 * 
 * Based on: https://www.supermemo.com/en/blog/application-of-a-computer-to-improve-the-results-obtainable-in-working-with-the-learning-process
 * 
 * Formula for ease factor: EF' = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
 * where:
 * - EF = current ease factor (default 2.5)
 * - q = quality of response (0-5)
 * - EF' = new ease factor
 * 
 * Intervals:
 * - After 1st repetition: 1 day
 * - After 2nd repetition: 3 days
 * - After n-th repetition: previous_interval * ease_factor
 */

export class SM2Algorithm {
    /**
     * Calculate new ease factor based on quality of response
     * @param currentEaseFactor - Current ease factor (default 2.5)
     * @param quality - Quality of response (0-5)
     * @returns New ease factor (min 1.3)
     */
    static calculateNewEaseFactor(currentEaseFactor: number, quality: number): number {
        const newEF = currentEaseFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
        return Math.max(1.3, newEF);
    }

    /**
     * Calculate next review interval
     * @param repetitions - Number of times the card has been reviewed
     * @param easeFactor - Current ease factor
     * @param quality - Quality of response (0-5)
     * @returns Number of days until next review
     */
    static calculateNextInterval(repetitions: number, easeFactor: number, quality: number): number {
        // If quality < 3, reset to 1 (card needs more practice)
        if (quality < 3) {
            return 1;
        }

        // First review: 1 day
        if (repetitions === 0) {
            return 1;
        }

        // Second review: 3 days
        if (repetitions === 1) {
            return 3;
        }

        // Subsequent reviews: previous_interval * ease_factor
        // For simplicity, we calculate it directly
        let interval = 1;
        for (let i = 2; i < repetitions; i++) {
            interval = Math.round(interval * easeFactor);
        }
        return Math.round(interval * easeFactor);
    }

    /**
     * Process a card review and return updated card state
     */
    static updateCardAfterReview(
        card: FlashcardWithReview,
        quality: number
    ): FlashcardWithReview {
        const newEaseFactor = this.calculateNewEaseFactor(card.easeFactor, quality);
        const newInterval = this.calculateNextInterval(card.repetitions, card.easeFactor, quality);
        const nextReviewAt = Date.now() + newInterval * 24 * 60 * 60 * 1000;

        return {
            ...card,
            easeFactor: newEaseFactor,
            interval: newInterval,
            repetitions: card.repetitions + 1,
            nextReviewAt,
        };
    }
}

/**
 * Initialize a flashcard with SM-2 state
 */
export function initializeFlashcard(
    id: string,
    question: string,
    answer: string
): FlashcardWithReview {
    return {
        id,
        question,
        answer,
        easeFactor: 2.5, // Default ease factor
        interval: 0,
        repetitions: 0,
        nextReviewAt: Date.now(), // Review immediately
    };
}

/**
 * Sort flashcards by review status (due now, then by next review date)
 */
export function sortFlashcardsByDueDate(cards: FlashcardWithReview[]): FlashcardWithReview[] {
    return [...cards].sort((a, b) => {
        const aDue = a.nextReviewAt <= Date.now();
        const bDue = b.nextReviewAt <= Date.now();

        // Due cards come first
        if (aDue && !bDue) return -1;
        if (!aDue && bDue) return 1;

        // Sort by next review date
        return a.nextReviewAt - b.nextReviewAt;
    });
}

/**
 * Get cards that are due for review
 */
export function getDueCards(cards: FlashcardWithReview[]): FlashcardWithReview[] {
    const now = Date.now();
    return cards.filter(card => card.nextReviewAt <= now);
}

/**
 * Get review statistics for a card set
 */
export interface ReviewStats {
    total: number;
    reviewed: number;
    due: number;
    dueToday: number;
    dueThisWeek: number;
    dueThisMonth: number;
    averageEaseFactor: number;
    averageInterval: number;
}

export function getReviewStats(cards: FlashcardWithReview[]): ReviewStats {
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;
    const sevenDays = 7 * oneDay;
    const thirtyDays = 30 * oneDay;

    const due = cards.filter(c => c.nextReviewAt <= now).length;
    const dueToday = cards.filter(c => c.nextReviewAt <= now && c.nextReviewAt > now - oneDay).length;
    const dueThisWeek = cards.filter(c => c.nextReviewAt <= now + sevenDays && c.nextReviewAt > now).length;
    const dueThisMonth = cards.filter(c => c.nextReviewAt <= now + thirtyDays && c.nextReviewAt > now + sevenDays).length;
    const reviewed = cards.filter(c => c.repetitions > 0).length;
    const avgEaseFactor = cards.length > 0 ? cards.reduce((sum, c) => sum + c.easeFactor, 0) / cards.length : 2.5;
    const avgInterval = cards.length > 0 ? cards.reduce((sum, c) => sum + c.interval, 0) / cards.length : 0;

    return {
        total: cards.length,
        reviewed,
        due,
        dueToday,
        dueThisWeek,
        dueThisMonth,
        averageEaseFactor: Math.round(avgEaseFactor * 100) / 100,
        averageInterval: Math.round(avgInterval * 10) / 10,
    };
}

/**
 * Format time until next review
 */
export function formatTimeUntilReview(nextReviewAt: number): string {
    const now = Date.now();
    const diff = nextReviewAt - now;

    if (diff <= 0) {
        return 'Due for review';
    }

    const days = Math.floor(diff / (24 * 60 * 60 * 1000));
    const hours = Math.floor((diff % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
    const minutes = Math.floor((diff % (60 * 60 * 1000)) / (60 * 1000));

    if (days > 0) {
        return `Review in ${days}d${hours > 0 ? ` ${hours}h` : ''}`;
    } else if (hours > 0) {
        return `Review in ${hours}h${minutes > 0 ? ` ${minutes}m` : ''}`;
    } else {
        return `Review in ${minutes}m`;
    }
}
