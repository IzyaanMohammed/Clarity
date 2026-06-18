import { useEffect, useState } from 'react';
import { AlertCircle, Star, Flame, Clock, BookOpen, BarChart3, Download, TrendingUp } from 'lucide-react';
import { Navbar } from '../components/layout/Navbar';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { getProgressAnalytics, type ProgressAnalyticsResponse } from '../api';
import toast from 'react-hot-toast';

export const Progress = () => {
    const [analytics, setAnalytics] = useState<ProgressAnalyticsResponse | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const run = async () => {
            setLoading(true);
            try {
                const data = await getProgressAnalytics();
                setAnalytics(data);
            } catch {
                toast.error('Unable to load progress analytics right now.');
                setAnalytics(null);
            } finally {
                setLoading(false);
            }
        };
        run();
    }, []);

    const getTrendColor = (trend: string) => {
        if (trend === 'improving') return 'text-green-600 bg-green-50 ';
        if (trend === 'declining') return 'text-red-600 bg-red-50 ';
        return 'text-blue-600 bg-blue-50 ';
    };

    const handleExport = () => {
        try {
            if (!analytics) {
                toast.error('No analytics data to export yet.');
                return;
            }
            const data = JSON.stringify(analytics, null, 2);
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

    const overall = analytics?.overall;
    const weakTopics = analytics?.weak_topics || [];
    const recommendations = analytics?.recommended_topics || [];
    const insights = analytics?.insights || [];
    const subjectBreakdown = analytics?.subject_breakdown || [];
    const hasActivity = analytics?.has_activity || false;

    return (
        <div className="min-h-screen bg-[#f8fafc] transition-colors duration-300">
            <Navbar />
            <main className="max-w-7xl mx-auto px-6 py-10">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-3xl md:text-4xl font-black text-[#2C241B] ">
                            Learning Progress
                        </h1>
                        <p className="text-stone-500 mt-2 font-medium">
                            Track your performance, identify weak areas, and optimize your study routine.
                        </p>
                    </div>
                    <Button
                        onClick={handleExport}
                        className="rounded-xl bg-stone-700 hover:bg-stone-800"
                    >
                        <Download size={16} className="mr-2" />
                        Export Data
                    </Button>
                </div>

                {loading && (
                    <Card className="p-8 bg-[#FCFAF8] border-none shadow-xl rounded-3xl mb-8">
                        <p className="text-sm text-stone-500">Loading real analytics...</p>
                    </Card>
                )}

                {/* Learning Insights */}
                {!loading && insights.length > 0 && (
                    <Card className="p-6 md:p-8 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-100 rounded-3xl mb-8">
                        <h2 className="text-lg font-bold text-[#2C241B] mb-4">💡 Learning Insights</h2>
                        <div className="space-y-2">
                            {insights.map((insight, idx) => (
                                <p key={idx} className="text-sm text-stone-700 ">
                                    {insight}
                                </p>
                            ))}
                        </div>
                    </Card>
                )}

                {/* Key Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                    <Card className="p-6 bg-[#FCFAF8] border-none  rounded-3xl">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs font-black uppercase tracking-wider text-stone-500 mb-1">
                                    Average Score
                                </p>
                                <p className="text-4xl font-black text-[#2C241B] ">
                                    {overall?.average_score ?? 0}%
                                </p>
                            </div>
                            <BarChart3 className="text-[#8C5A35] opacity-20" size={32} />
                        </div>
                    </Card>

                    <Card className="p-6 bg-[#FCFAF8] border-none  rounded-3xl">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs font-black uppercase tracking-wider text-stone-500 mb-1">
                                    Study Streak
                                </p>
                                <p className="text-4xl font-black text-[#2C241B] ">
                                    {overall?.study_streak_days ?? 0}d
                                </p>
                            </div>
                            <Flame className="text-orange-500 opacity-20" size={32} />
                        </div>
                    </Card>

                    <Card className="p-6 bg-[#FCFAF8] border-none  rounded-3xl">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs font-black uppercase tracking-wider text-stone-500 mb-1">
                                    Hours Studied
                                </p>
                                <p className="text-4xl font-black text-[#2C241B] ">
                                    {overall?.hours_studied ?? 0}h
                                </p>
                            </div>
                            <Clock className="text-blue-500 opacity-20" size={32} />
                        </div>
                    </Card>

                    <Card className="p-6 bg-[#FCFAF8] border-none  rounded-3xl">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs font-black uppercase tracking-wider text-stone-500 mb-1">
                                    Questions/Day
                                </p>
                                <p className="text-4xl font-black text-[#2C241B] ">
                                    {overall?.questions_per_day ?? 0}
                                </p>
                            </div>
                            <TrendingUp className="text-green-500 opacity-20" size={32} />
                        </div>
                    </Card>
                </div>

                {/* Activity Breakdown */}
                <Card className="p-6 md:p-8 bg-[#FCFAF8] border-none shadow-xl rounded-3xl mb-8">
                    <h2 className="text-xl font-bold text-[#2C241B] mb-6">Activity Breakdown</h2>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-violet-50 p-4 rounded-xl border border-violet-100 ">
                            <p className="text-xs font-black uppercase text-violet-600 mb-2">Questions Asked</p>
                            <p className="text-3xl font-bold text-violet-700 ">
                                {overall?.total_questions ?? 0}
                            </p>
                        </div>
                        <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 ">
                            <p className="text-xs font-black uppercase text-blue-600 mb-2">Practice Sets</p>
                            <p className="text-3xl font-bold text-blue-700 ">
                                {overall?.total_practice_attempts ?? 0}
                            </p>
                        </div>
                        <div className="bg-amber-50 p-4 rounded-xl border border-amber-100 ">
                            <p className="text-xs font-black uppercase text-amber-600 mb-2">Flashcard Reviews</p>
                            <p className="text-3xl font-bold text-amber-700 ">
                                {overall?.total_flashcard_reviews ?? 0}
                            </p>
                        </div>
                        <div className="bg-orange-50 p-4 rounded-xl border border-orange-100 ">
                            <p className="text-xs font-black uppercase text-orange-600 mb-2">Files Uploaded</p>
                            <p className="text-3xl font-bold text-orange-700 ">
                                {overall?.total_uploads ?? 0}
                            </p>
                        </div>
                    </div>
                </Card>

                {/* Weak Topics */}
                {weakTopics.length > 0 && (
                    <Card className="p-6 md:p-8 bg-[#FCFAF8] border-none shadow-xl rounded-3xl mb-8">
                        <h2 className="text-xl font-bold text-[#2C241B] mb-6 flex items-center gap-2">
                            <AlertCircle size={20} className="text-red-600" />
                            Topics Needing Attention
                        </h2>
                        <div className="space-y-4">
                            {weakTopics.slice(0, 5).map((topic, idx) => (
                                <div
                                    key={idx}
                                    className="p-4 rounded-xl border border-red-200 bg-red-50 "
                                >
                                    <div className="flex items-start justify-between mb-3">
                                        <div>
                                            <p className="font-bold text-[#2C241B] ">
                                                {topic.chapter}
                                            </p>
                                            <p className="text-xs text-stone-500 mt-1">{topic.subject}</p>
                                        </div>
                                        <span className="px-3 py-1 rounded-lg bg-red-200 text-red-800 font-bold text-sm">
                                            {topic.average_score}%
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-4 text-sm text-stone-700 ">
                                        <span>Attempts: {topic.total_attempts}</span>
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
                    <Card className="p-6 md:p-8 bg-[#FCFAF8] border-none shadow-xl rounded-3xl mb-8">
                        <h2 className="text-xl font-bold text-[#2C241B] mb-6 flex items-center gap-2">
                            <Star size={20} className="text-amber-600" />
                            Recommended Topics to Study
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {recommendations.slice(0, 6).map((topic, idx) => (
                                <div
                                    key={idx}
                                    className="p-4 rounded-xl border-3 border-[#2C241B] shadow-neo bg-amber-50 "
                                >
                                    <p className="font-bold text-[#2C241B] ">{topic.chapter}</p>
                                    <p className="text-xs text-stone-500 mt-1">{topic.subject}</p>
                                    <div className="mt-3 flex items-center gap-3 text-sm">
                                        <span className="font-bold text-amber-700 ">
                                            Score: {topic.average_score}%
                                        </span>
                                        <span className="text-stone-600 ">
                                            {topic.total_attempts} attempts
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </Card>
                )}

                {/* Subject Breakdown */}
                {subjectBreakdown.length > 0 && (
                    <Card className="p-6 md:p-8 bg-[#FCFAF8] border-none shadow-xl rounded-3xl">
                        <h2 className="text-xl font-bold text-[#2C241B] mb-6 flex items-center gap-2">
                            <BookOpen size={20} className="text-[#8C5A35]" />
                            Performance by Subject
                        </h2>
                        <div className="space-y-6">
                            {subjectBreakdown.map((subjectMetric) => {
                                const avgScore = Number(subjectMetric.average_score || 0);

                                return (
                                    <div key={subjectMetric.subject}>
                                        <p className="font-bold text-[#2C241B] mb-3">
                                            {subjectMetric.subject} ({subjectMetric.topic_count} topics)
                                        </p>
                                        <div
                                            className="w-full bg-[#E8E4DB] rounded-full h-3 overflow-hidden"
                                        >
                                            <div
                                                className="h-full bg-gradient-to-r from-[#8C5A35] to-[#70482B] rounded-full transition-all"
                                                style={{
                                                    width: `${Math.min(avgScore, 100)}%`,
                                                }}
                                            />
                                        </div>
                                        <p className="text-sm text-stone-600 mt-2">
                                            Average: {Math.round(avgScore)}%
                                        </p>
                                    </div>
                                );
                            })}
                        </div>
                    </Card>
                )}

                {/* Empty State */}
                {!loading && !hasActivity && (
                    <Card className="p-12 bg-[#FCFAF8] border-none shadow-xl rounded-3xl text-center">
                        <BarChart3 size={48} className="mx-auto text-stone-300 mb-4" />
                        <p className="text-lg font-bold text-[#2C241B] ">No activity yet</p>
                        <p className="text-stone-500 mt-2 max-w-md mx-auto">
                            Start studying to see your progress, trends, and personalized recommendations here.
                        </p>
                    </Card>
                )}
            </main>
        </div>
    );
};
