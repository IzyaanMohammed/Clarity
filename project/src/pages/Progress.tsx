import { useMemo } from 'react';
import { AlertCircle, Star, Flame, Clock, BookOpen, BarChart3, Download, TrendingUp } from 'lucide-react';
import { Navbar } from '../components/layout/Navbar';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import {
    getOverallAnalytics,
    getWeakTopics,
    getRecommendedTopics,
    getLearningInsights,
    exportAnalyticsData,
} from '../utils/analytics';
import toast from 'react-hot-toast';

export const Progress = () => {
    const analytics = useMemo(() => getOverallAnalytics(), []);
    const weakTopics = useMemo(() => getWeakTopics(), []);
    const recommendations = useMemo(() => getRecommendedTopics(), []);
    const insights = useMemo(() => getLearningInsights(), []);

    const getTrendColor = (trend: string) => {
        if (trend === 'improving') return 'text-green-600 bg-green-50 dark:bg-green-900/20';
        if (trend === 'declining') return 'text-red-600 bg-red-50 dark:bg-red-900/20';
        return 'text-blue-600 bg-blue-50 dark:bg-blue-900/20';
    };

    const handleExport = () => {
        try {
            const data = exportAnalyticsData();
            const blob = new Blob([data], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `clarity-progress-${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            URL.revokeObjectURL(url);
            toast.success('Progress data exported');
        } catch (error) {
            toast.error('Failed to export data');
        }
    };

    const topicsBySubject = useMemo(() => {
        const bySubject = new Map<string, typeof analytics.topicsProgressMap>();
        analytics.topicsProgressMap.forEach((topic, key) => {
            if (!bySubject.has(topic.subject)) {
                bySubject.set(topic.subject, new Map());
            }
            bySubject.get(topic.subject)?.set(key, topic);
        });
        return bySubject;
    }, [analytics]);

    return (
        <div className="min-h-screen bg-[#f8fafc] dark:bg-[#020617] transition-colors duration-300">
            <Navbar />
            <main className="max-w-7xl mx-auto px-6 py-10">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-3xl md:text-4xl font-black text-slate-900 dark:text-white">
                            Learning Progress
                        </h1>
                        <p className="text-slate-500 mt-2 font-medium">
                            Track your performance, identify weak areas, and optimize your study routine.
                        </p>
                    </div>
                    <Button
                        onClick={handleExport}
                        className="rounded-xl bg-slate-700 hover:bg-slate-800"
                    >
                        <Download size={16} className="mr-2" />
                        Export Data
                    </Button>
                </div>

                {/* Learning Insights */}
                {insights.length > 0 && (
                    <Card className="p-6 md:p-8 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-slate-800 dark:to-slate-900 border border-amber-100 dark:border-slate-700 rounded-3xl mb-8">
                        <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">💡 Learning Insights</h2>
                        <div className="space-y-2">
                            {insights.map((insight, idx) => (
                                <p key={idx} className="text-sm text-slate-700 dark:text-slate-200">
                                    {insight}
                                </p>
                            ))}
                        </div>
                    </Card>
                )}

                {/* Key Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                    <Card className="p-6 bg-white dark:bg-[#0f172a] border-none shadow-lg rounded-3xl">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs font-black uppercase tracking-wider text-slate-500 mb-1">
                                    Average Score
                                </p>
                                <p className="text-4xl font-black text-slate-900 dark:text-white">
                                    {analytics.averageScore}%
                                </p>
                            </div>
                            <BarChart3 className="text-[#1D9E75] opacity-20" size={32} />
                        </div>
                    </Card>

                    <Card className="p-6 bg-white dark:bg-[#0f172a] border-none shadow-lg rounded-3xl">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs font-black uppercase tracking-wider text-slate-500 mb-1">
                                    Study Streak
                                </p>
                                <p className="text-4xl font-black text-slate-900 dark:text-white">
                                    {analytics.currentStreak}d
                                </p>
                            </div>
                            <Flame className="text-orange-500 opacity-20" size={32} />
                        </div>
                    </Card>

                    <Card className="p-6 bg-white dark:bg-[#0f172a] border-none shadow-lg rounded-3xl">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs font-black uppercase tracking-wider text-slate-500 mb-1">
                                    Hours Studied
                                </p>
                                <p className="text-4xl font-black text-slate-900 dark:text-white">
                                    {analytics.totalHoursStudied}h
                                </p>
                            </div>
                            <Clock className="text-blue-500 opacity-20" size={32} />
                        </div>
                    </Card>

                    <Card className="p-6 bg-white dark:bg-[#0f172a] border-none shadow-lg rounded-3xl">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs font-black uppercase tracking-wider text-slate-500 mb-1">
                                    Questions/Day
                                </p>
                                <p className="text-4xl font-black text-slate-900 dark:text-white">
                                    {analytics.learningVelocity}
                                </p>
                            </div>
                            <TrendingUp className="text-green-500 opacity-20" size={32} />
                        </div>
                    </Card>
                </div>

                {/* Activity Breakdown */}
                <Card className="p-6 md:p-8 bg-white dark:bg-[#0f172a] border-none shadow-xl rounded-3xl mb-8">
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6">Activity Breakdown</h2>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-violet-50 dark:bg-violet-900/20 p-4 rounded-xl border border-violet-100 dark:border-violet-800">
                            <p className="text-xs font-black uppercase text-violet-600 mb-2">Questions Asked</p>
                            <p className="text-3xl font-bold text-violet-700 dark:text-violet-400">
                                {analytics.totalQuestions}
                            </p>
                        </div>
                        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-800">
                            <p className="text-xs font-black uppercase text-blue-600 mb-2">Practice Sets</p>
                            <p className="text-3xl font-bold text-blue-700 dark:text-blue-400">
                                {analytics.totalPracticeAttempts}
                            </p>
                        </div>
                        <div className="bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-xl border border-emerald-100 dark:border-emerald-800">
                            <p className="text-xs font-black uppercase text-emerald-600 mb-2">Flashcard Reviews</p>
                            <p className="text-3xl font-bold text-emerald-700 dark:text-emerald-400">
                                {analytics.totalFlashcardReviews}
                            </p>
                        </div>
                        <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-xl border border-orange-100 dark:border-orange-800">
                            <p className="text-xs font-black uppercase text-orange-600 mb-2">Files Uploaded</p>
                            <p className="text-3xl font-bold text-orange-700 dark:text-orange-400">
                                {analytics.totalUploads}
                            </p>
                        </div>
                    </div>
                </Card>

                {/* Weak Topics */}
                {weakTopics.length > 0 && (
                    <Card className="p-6 md:p-8 bg-white dark:bg-[#0f172a] border-none shadow-xl rounded-3xl mb-8">
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                            <AlertCircle size={20} className="text-red-600" />
                            Topics Needing Attention
                        </h2>
                        <div className="space-y-4">
                            {weakTopics.slice(0, 5).map((topic, idx) => (
                                <div
                                    key={idx}
                                    className="p-4 rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20"
                                >
                                    <div className="flex items-start justify-between mb-3">
                                        <div>
                                            <p className="font-bold text-slate-900 dark:text-white">
                                                {topic.chapter}
                                            </p>
                                            <p className="text-xs text-slate-500 mt-1">{topic.subject}</p>
                                        </div>
                                        <span className="px-3 py-1 rounded-lg bg-red-200 dark:bg-red-800 text-red-800 dark:text-red-200 font-bold text-sm">
                                            {topic.averageScore}%
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-4 text-sm text-slate-700 dark:text-slate-300">
                                        <span>Attempts: {topic.totalAttempts}</span>
                                        <span className={`font-bold ${getTrendColor(topic.trend)}`}>
                                            {topic.trend === 'improving' && '📈 Improving'}
                                            {topic.trend === 'declining' && '📉 Declining'}
                                            {topic.trend === 'stable' && '➡️ Stable'}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </Card>
                )}

                {/* Recommendations */}
                {recommendations.length > 0 && (
                    <Card className="p-6 md:p-8 bg-white dark:bg-[#0f172a] border-none shadow-xl rounded-3xl mb-8">
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                            <Star size={20} className="text-amber-600" />
                            Recommended Topics to Study
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {recommendations.slice(0, 6).map((topic, idx) => (
                                <div
                                    key={idx}
                                    className="p-4 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20"
                                >
                                    <p className="font-bold text-slate-900 dark:text-white">{topic.chapter}</p>
                                    <p className="text-xs text-slate-500 mt-1">{topic.subject}</p>
                                    <div className="mt-3 flex items-center gap-3 text-sm">
                                        <span className="font-bold text-amber-700 dark:text-amber-300">
                                            Score: {topic.averageScore}%
                                        </span>
                                        <span className="text-slate-600 dark:text-slate-400">
                                            {topic.totalAttempts} attempts
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </Card>
                )}

                {/* Subject Breakdown */}
                {topicsBySubject.size > 0 && (
                    <Card className="p-6 md:p-8 bg-white dark:bg-[#0f172a] border-none shadow-xl rounded-3xl">
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                            <BookOpen size={20} className="text-[#1D9E75]" />
                            Performance by Subject
                        </h2>
                        <div className="space-y-6">
                            {Array.from(topicsBySubject.entries()).map(([subject, topics]) => {
                                const subjectMetrics = Array.from(topics.values());
                                const avgScore =
                                    subjectMetrics.reduce((sum, t) => sum + t.averageScore, 0) / subjectMetrics.length;

                                return (
                                    <div key={subject}>
                                        <p className="font-bold text-slate-900 dark:text-white mb-3">
                                            {subject} ({subjectMetrics.length} topics)
                                        </p>
                                        <div
                                            className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-3 overflow-hidden"
                                        >
                                            <div
                                                className="h-full bg-gradient-to-r from-[#1D9E75] to-[#16805d] rounded-full transition-all"
                                                style={{
                                                    width: `${Math.min(avgScore, 100)}%`,
                                                }}
                                            />
                                        </div>
                                        <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
                                            Average: {Math.round(avgScore)}%
                                        </p>
                                    </div>
                                );
                            })}
                        </div>
                    </Card>
                )}

                {/* Empty State */}
                {analytics.totalQuestions === 0 && (
                    <Card className="p-12 bg-white dark:bg-[#0f172a] border-none shadow-xl rounded-3xl text-center">
                        <BarChart3 size={48} className="mx-auto text-slate-300 dark:text-slate-700 mb-4" />
                        <p className="text-lg font-bold text-slate-900 dark:text-white">No activity yet</p>
                        <p className="text-slate-500 mt-2 max-w-md mx-auto">
                            Start studying to see your progress, trends, and personalized recommendations here.
                        </p>
                    </Card>
                )}
            </main>
        </div>
    );
};
