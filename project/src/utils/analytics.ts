/**
 * Analytics and Learning Progress Tracking
 * Collects performance metrics from all study activities for insights and recommendations
 */

export interface PerformanceMetric {
    type: 'question' | 'practice' | 'flashcard' | 'upload';
    subject: string;
    chapter: string;
    timestamp: number;
    performance: number; // 0-100 percentage score
    timeSpent: number; // milliseconds
    difficulty: 'easy' | 'medium' | 'hard';
    correct?: boolean;
    incorrectCount?: number;
    totalCount?: number;
}

export interface TopicAnalytics {
    subject: string;
    chapter: string;
    totalAttempts: number;
    averageScore: number;
    lastAttemptDate: number;
    trend: 'improving' | 'stable' | 'declining'; // 7-day trend
    timeSpent: number; // total milliseconds
    weakAreas: string[]; // sub-topics struggling with
    strengthAreas: string[]; // sub-topics excelling at
}

export interface OverallProgress {
    totalQuestions: number;
    totalPracticeAttempts: number;
    totalFlashcardReviews: number;
    totalUploads: number;
    averageScore: number;
    currentStreak: number; // days studied consecutively
    totalHoursStudied: number;
    subjectsStudied: string[];
    topicsProgressMap: Map<string, TopicAnalytics>;
    lastActivityDate: number;
    learningVelocity: number; // questions/day trend
}

export interface SmartRecommendation {
    id: string;
    title: string;
    reason: string;
    subject?: string;
    chapter?: string;
    priority: 'high' | 'medium' | 'low';
    action: 'practice' | 'ask' | 'library';
}

const classifyRecommendationAction = (
    title: string,
    reason: string,
    fallback: SmartRecommendation['action']
): SmartRecommendation['action'] => {
    const text = `${title} ${reason}`.toLowerCase();

    // User routing preference:
    // - Q&A style work -> Practice
    // - Learn new chapter -> Library
    // - Learn this question / understand question -> Ask AI
    if (/(learn\s+new\s+chapter|new\s+chapter|chapter\s+overview|chapter\s+map|chapter\s+resources|library)/.test(text)) {
        return 'library';
    }

    if (/(learn\s+this\s+question|this\s+question|understand\s+question|explain\s+question|doubt\s+clarify|ask\s*ai|clarification)/.test(text)) {
        return 'ask';
    }

    if (/(q\s*&\s*a|q\s*and\s*a|qa\b|question\s+practice|practice|drill|quiz|mcq|test|rapid\s+q\s*&\s*a)/.test(text)) {
        return 'practice';
    }

    return fallback;
};

/**
 * Track a study activity and record its performance
 */
export function recordPerformanceMetric(metric: PerformanceMetric): void {
    const metrics = getPerformanceMetrics();
    metrics.push(metric);

    // Keep only last 500 metrics (roughly 3-4 months of activity)
    if (metrics.length > 500) {
        metrics.shift();
    }

    localStorage.setItem('clarity_analytics_metrics', JSON.stringify(metrics));
}

/**
 * Get all recorded performance metrics
 */
export function getPerformanceMetrics(): PerformanceMetric[] {
    const data = localStorage.getItem('clarity_analytics_metrics');
    return data ? JSON.parse(data) : [];
}

/**
 * Get analytics for a specific topic
 */
export function getTopicAnalytics(subject: string, chapter: string): TopicAnalytics {
    const metrics = getPerformanceMetrics();
    const topicMetrics = metrics.filter(m => m.subject === subject && m.chapter === chapter);

    if (topicMetrics.length === 0) {
        return {
            subject,
            chapter,
            totalAttempts: 0,
            averageScore: 0,
            lastAttemptDate: 0,
            trend: 'stable',
            timeSpent: 0,
            weakAreas: [],
            strengthAreas: [],
        };
    }

    // Calculate trend (compare last 7 days vs previous 7 days)
    const now = Date.now();
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
    const fourteenDaysAgo = now - 14 * 24 * 60 * 60 * 1000;

    const recentMetrics = topicMetrics.filter(m => m.timestamp > sevenDaysAgo);
    const previousMetrics = topicMetrics.filter(
        m => m.timestamp > fourteenDaysAgo && m.timestamp <= sevenDaysAgo
    );

    const recentAvg = recentMetrics.length > 0 ?
        recentMetrics.reduce((sum, m) => sum + m.performance, 0) / recentMetrics.length : 0;
    const previousAvg = previousMetrics.length > 0 ?
        previousMetrics.reduce((sum, m) => sum + m.performance, 0) / previousMetrics.length : 0;

    let trend: 'improving' | 'stable' | 'declining' = 'stable';
    if (recentAvg > previousAvg + 5) {
        trend = 'improving';
    } else if (recentAvg < previousAvg - 5) {
        trend = 'declining';
    }

    const avgScore = topicMetrics.reduce((sum, m) => sum + m.performance, 0) / topicMetrics.length;
    const totalTime = topicMetrics.reduce((sum, m) => sum + m.timeSpent, 0);
    const lastAttempt = Math.max(...topicMetrics.map(m => m.timestamp));

    // Identify weak/strong areas by difficulty
    const hardMetrics = topicMetrics.filter(m => m.difficulty === 'hard');
    const easyMetrics = topicMetrics.filter(m => m.difficulty === 'easy');

    const hardAvg = hardMetrics.length > 0 ?
        hardMetrics.reduce((sum, m) => sum + m.performance, 0) / hardMetrics.length : 50;
    const easyAvg = easyMetrics.length > 0 ?
        easyMetrics.reduce((sum, m) => sum + m.performance, 0) / easyMetrics.length : 50;

    return {
        subject,
        chapter,
        totalAttempts: topicMetrics.length,
        averageScore: Math.round(avgScore),
        lastAttemptDate: lastAttempt,
        trend,
        timeSpent: totalTime,
        weakAreas: hardAvg < 60 ? ['Hard questions', 'Complex concepts'] : [],
        strengthAreas: easyAvg > 80 ? ['Basics mastered', 'Quick recall'] : [],
    };
}

/**
 * Get comprehensive learning analytics
 */
export function getOverallAnalytics(): OverallProgress {
    const metrics = getPerformanceMetrics();

    if (metrics.length === 0) {
        return {
            totalQuestions: 0,
            totalPracticeAttempts: 0,
            totalFlashcardReviews: 0,
            totalUploads: 0,
            averageScore: 0,
            currentStreak: 0,
            totalHoursStudied: 0,
            subjectsStudied: [],
            topicsProgressMap: new Map(),
            lastActivityDate: 0,
            learningVelocity: 0,
        };
    }

    // Count by type
    const questions = metrics.filter(m => m.type === 'question').length;
    const practice = metrics.filter(m => m.type === 'practice').length;
    const flashcards = metrics.filter(m => m.type === 'flashcard').length;
    const uploads = metrics.filter(m => m.type === 'upload').length;

    // Calculate average score
    const avgScore = metrics.reduce((sum, m) => sum + m.performance, 0) / metrics.length;

    // Calculate total study time
    const totalTime = metrics.reduce((sum, m) => sum + m.timeSpent, 0);
    const totalHours = totalTime / (60 * 60 * 1000);

    // Get unique subjects
    const subjects = [...new Set(metrics.map(m => m.subject))];

    // Calculate streak
    const lastActivity = Math.max(...metrics.map(m => m.timestamp));
    const now = Date.now();
    const daysSinceLastActivity = Math.floor((now - lastActivity) / (24 * 60 * 60 * 1000));

    let streak = 0;
    if (daysSinceLastActivity <= 1) {
        // Check consecutive days
        const dates = new Set(metrics.map(m => new Date(m.timestamp).toDateString()));
        const sortedDates = Array.from(dates).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

        let consecutive = 1;
        for (let i = 1; i < sortedDates.length; i++) {
            const curr = new Date(sortedDates[i - 1]);
            const prev = new Date(sortedDates[i]);
            const diffDays = Math.floor((curr.getTime() - prev.getTime()) / (24 * 60 * 60 * 1000));
            if (diffDays === 1) {
                consecutive++;
            } else {
                break;
            }
        }
        streak = consecutive;
    }

    // Calculate learning velocity (questions/day over last 7 days)
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
    const recentMetrics = metrics.filter(m => m.timestamp > sevenDaysAgo && m.type === 'question');
    const velocity = recentMetrics.length / 7;

    // Build topics map
    const topicsProgressMap = new Map<string, TopicAnalytics>();
    const uniqueTopics = new Set(metrics.map(m => `${m.subject}|${m.chapter}`));

    uniqueTopics.forEach(topic => {
        const [subject, chapter] = topic.split('|');
        topicsProgressMap.set(topic, getTopicAnalytics(subject, chapter));
    });

    return {
        totalQuestions: questions,
        totalPracticeAttempts: practice,
        totalFlashcardReviews: flashcards,
        totalUploads: uploads,
        averageScore: Math.round(avgScore),
        currentStreak: streak,
        totalHoursStudied: Math.round(totalHours * 10) / 10,
        subjectsStudied: subjects,
        topicsProgressMap,
        lastActivityDate: lastActivity,
        learningVelocity: Math.round(velocity * 100) / 100,
    };
}

/**
 * Get weak topics that need attention (score < 60% or declining trend)
 */
export function getWeakTopics(): TopicAnalytics[] {
    const analytics = getOverallAnalytics();
    const weakTopics: TopicAnalytics[] = [];

    analytics.topicsProgressMap.forEach((topic) => {
        if (topic.totalAttempts > 0 && (topic.averageScore < 60 || topic.trend === 'declining')) {
            weakTopics.push(topic);
        }
    });

    return weakTopics.sort((a, b) => a.averageScore - b.averageScore);
}

/**
 * Get topics that would benefit from more practice
 */
export function getTopicsNeedingPractice(): TopicAnalytics[] {
    const analytics = getOverallAnalytics();
    const topicsNeedingPractice: TopicAnalytics[] = [];
    const now = Date.now();
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

    analytics.topicsProgressMap.forEach((topic) => {
        // Topics not practiced in 30 days or score between 60-75
        if (
            topic.lastAttemptDate < thirtyDaysAgo ||
            (topic.averageScore >= 60 && topic.averageScore <= 75 && topic.totalAttempts < 5)
        ) {
            topicsNeedingPractice.push(topic);
        }
    });

    return topicsNeedingPractice.sort((a, b) => a.averageScore - b.averageScore);
}

/**
 * Get recommended topics to study next
 */
export function getRecommendedTopics(): TopicAnalytics[] {
    const weak = getWeakTopics();
    const needsPractice = getTopicsNeedingPractice();

    // Combine and deduplicate
    const recommended = [...weak, ...needsPractice];
    const unique = Array.from(
        new Map(recommended.map(t => [`${t.subject}|${t.chapter}`, t])).values()
    );

    return unique.slice(0, 10); // Top 10 recommendations
}

/**
 * Get learning insights and tips
 */
export function getLearningInsights(): string[] {
    const analytics = getOverallAnalytics();
    const insights: string[] = [];

    if (analytics.currentStreak >= 7) {
        insights.push(`🔥 You're on a ${analytics.currentStreak}-day study streak! Keep it up!`);
    }

    if (analytics.learningVelocity > 10) {
        insights.push(`📈 Great pace! You're averaging ${Math.round(analytics.learningVelocity)} questions per day.`);
    }

    if (analytics.averageScore > 80) {
        insights.push('✨ Excellent performance! You\'re mastering the material.');
    } else if (analytics.averageScore < 60) {
        insights.push('💡 Try focusing on weaker topics first—they need more attention.');
    }

    const weakTopics = getWeakTopics();
    if (weakTopics.length > 0) {
        insights.push(`⚠️ ${weakTopics[0].chapter} needs work: averaging ${weakTopics[0].averageScore}%.`);
    }

    if (analytics.totalHoursStudied > 50) {
        insights.push(`⏰ You've invested ${analytics.totalHoursStudied} hours! Rest is important too.`);
    }

    return insights;
}

/**
 * Build prioritized recommendations from engagement + performance analytics.
 */
export function getSmartRecommendations(limit = 6): SmartRecommendation[] {
    const analytics = getOverallAnalytics();
    const weakTopics = getWeakTopics();
    const needsPractice = getTopicsNeedingPractice();
    const recs: SmartRecommendation[] = [];

    // 1) Weakest topic gets immediate high-priority action.
    if (weakTopics.length > 0) {
        const t = weakTopics[0];
        recs.push({
            id: `weak-practice-${t.subject}-${t.chapter}`,
            title: `Practice ${t.chapter}`,
            reason: `${t.subject} average is ${t.averageScore}%. Targeted board practice needed.`,
            subject: t.subject,
            chapter: t.chapter,
            priority: 'high',
            action: 'practice',
        });
        recs.push({
            id: `weak-library-${t.subject}-${t.chapter}`,
            title: `Learn new chapter resources: ${t.chapter}`,
            reason: 'Open Library to review chapter resources before your next attempt.',
            subject: t.subject,
            chapter: t.chapter,
            priority: 'medium',
            action: 'library',
        });
    }

    // 2) Stale topics should be revived from archive + Q&A.
    if (needsPractice.length > 0) {
        const stale = needsPractice[0];
        recs.push({
            id: `stale-ask-${stale.subject}-${stale.chapter}`,
            title: `Learn this question from ${stale.chapter}`,
            reason: 'Use Ask AI mode for quick explanation before restarting practice.',
            subject: stale.subject,
            chapter: stale.chapter,
            priority: 'medium',
            action: 'ask',
        });
    }

    // 3) Low velocity recommendation.
    if (analytics.learningVelocity < 2) {
        recs.push({
            id: 'velocity-boost',
            title: 'Do a 10-minute rapid Q&A sprint',
            reason: 'Q&A sprint is routed to Practice for quick scored attempts.',
            priority: 'medium',
            action: 'practice',
        });
    }

    // 4) Strong score but low breadth recommendation.
    if (analytics.averageScore >= 75 && analytics.subjectsStudied.length <= 1) {
        recs.push({
            id: 'breadth-library',
            title: 'Learn new chapter in Library',
            reason: 'You are performing well. Expand chapter breadth for exam balance.',
            priority: 'low',
            action: 'library',
        });
    }

    // 5) Fallback recommendation when history is sparse.
    if (recs.length === 0) {
        recs.push({
            id: 'start-plan',
            title: 'Start with one mixed practice set',
            reason: 'Build baseline analytics to unlock personalized recommendations.',
            priority: 'high',
            action: 'practice',
        });
    }

    const priorityRank: Record<SmartRecommendation['priority'], number> = {
        high: 3,
        medium: 2,
        low: 1,
    };

    return recs
        .map((rec) => ({
            ...rec,
            action: classifyRecommendationAction(rec.title, rec.reason, rec.action),
        }))
        .sort((a, b) => priorityRank[b.priority] - priorityRank[a.priority])
        .slice(0, Math.max(1, limit));
}

/**
 * Clear all analytics data (for testing or user request)
 */
export function clearAnalytics(): void {
    localStorage.removeItem('clarity_analytics_metrics');
}

/**
 * Export analytics data as JSON
 */
export function exportAnalyticsData(): string {
    const metrics = getPerformanceMetrics();
    const analytics = getOverallAnalytics();
    return JSON.stringify({ metrics, analytics }, null, 2);
}

/**
 * Import analytics data from JSON
 */
export function importAnalyticsData(jsonData: string): boolean {
    try {
        const { metrics } = JSON.parse(jsonData);
        if (!Array.isArray(metrics)) return false;
        localStorage.setItem('clarity_analytics_metrics', JSON.stringify(metrics));
        return true;
    } catch {
        return false;
    }
}
