import { useEffect, useState } from 'react';
import { Trophy, Medal, Globe, MapPin, Compass, Search, Award, TrendingUp, ArrowLeft, Loader2, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getLeaderboard, type LeaderboardUser } from '../api';
import { getUser } from '../utils/storage';
import { Card } from '../components/ui/Card';

export const Leaderboard = () => {
    const currentUser = getUser();
    const [leaderboard, setLeaderboard] = useState<LeaderboardUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [scope, setScope] = useState<'worldwide' | 'country' | 'state' | 'city' | 'class'>('worldwide');
    
    // Filters based on current user's profile info
    const userCountry = currentUser?.country || 'India';
    const userState = currentUser?.state || 'Tamil Nadu';
    const userCity = currentUser?.city || 'Chennai';
    const userClass = currentUser?.class || '10';

    useEffect(() => {
        let active = true;
        const fetchBoard = async () => {
            setLoading(true);
            try {
                const params: any = {};
                if (scope === 'class') {
                    params.class_num = userClass;
                } else if (scope === 'country') {
                    params.country = userCountry;
                } else if (scope === 'state') {
                    params.state = userState;
                } else if (scope === 'city') {
                    params.city = userCity;
                }

                const res = await getLeaderboard(params);
                if (active) {
                    setLeaderboard(res.leaderboard || []);
                }
            } catch (err) {
                console.error('Failed to load leaderboard', err);
            } finally {
                if (active) setLoading(false);
            }
        };

        fetchBoard();
        return () => { active = false; };
    }, [scope, userClass, userCountry, userState, userCity]);

    // Find current user's rank in this list
    const myRankEntry = leaderboard.find(u => u.username === currentUser?.name);

    return (
        <div className="min-h-screen bg-[#FCFAF8] text-[#2C241B] py-8 px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto space-y-8">
                
                {/* Header */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <Link to="/dashboard" className="inline-flex items-center gap-1 text-sm font-semibold text-[#8C5A35] hover:underline mb-2">
                            <ArrowLeft size={16} /> Back to Dashboard
                        </Link>
                        <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-amber-600 via-[#8C5A35] to-indigo-600 bg-clip-text text-transparent flex items-center gap-2">
                            Clarity Leaderboard <Sparkles size={24} className="text-amber-500 animate-pulse" />
                        </h1>
                        <p className="text-stone-500 text-sm mt-1">
                            Compete with students worldwide, countrywide, or locally. Points are earned by asking questions, active recall, and practicing questions.
                        </p>
                    </div>
                </div>

                {/* Filters */}
                <div className="flex flex-wrap gap-2 p-1.5 bg-[#E8E4DB]/60 backdrop-blur rounded-2xl border border-stone-200 ">
                    <button
                        onClick={() => setScope('worldwide')}
                        className={`flex-1 min-w-[120px] py-3 px-4 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${scope === 'worldwide'
                            ? 'bg-[#8C5A35] text-white shadow-lg shadow-amber-500/20'
                            : 'text-stone-600 hover:bg-[#F2EFE9] :bg-stone-800/50'
                            }`}
                    >
                        <Globe size={14} /> Worldwide
                    </button>
                    <button
                        onClick={() => setScope('class')}
                        className={`flex-1 min-w-[120px] py-3 px-4 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${scope === 'class'
                            ? 'bg-[#8C5A35] text-white shadow-lg shadow-amber-500/20'
                            : 'text-stone-600 hover:bg-[#F2EFE9] :bg-stone-800/50'
                            }`}
                    >
                        <Award size={14} /> Grade {String(userClass).replace('_TN_EN', ' (TN Eng)').replace('_TN_TM', ' (TN Tamil)')}
                    </button>
                    <button
                        onClick={() => setScope('country')}
                        className={`flex-1 min-w-[120px] py-3 px-4 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${scope === 'country'
                            ? 'bg-[#8C5A35] text-white shadow-lg shadow-amber-500/20'
                            : 'text-stone-600 hover:bg-[#F2EFE9] :bg-stone-800/50'
                            }`}
                    >
                        <Compass size={14} /> {userCountry}
                    </button>
                    <button
                        onClick={() => setScope('state')}
                        className={`flex-1 min-w-[120px] py-3 px-4 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${scope === 'state'
                            ? 'bg-[#8C5A35] text-white shadow-lg shadow-amber-500/20'
                            : 'text-stone-600 hover:bg-[#F2EFE9] :bg-stone-800/50'
                            }`}
                    >
                        <MapPin size={14} /> {userState}
                    </button>
                    <button
                        onClick={() => setScope('city')}
                        className={`flex-1 min-w-[120px] py-3 px-4 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${scope === 'city'
                            ? 'bg-[#8C5A35] text-white shadow-lg shadow-amber-500/20'
                            : 'text-stone-600 hover:bg-[#F2EFE9] :bg-stone-800/50'
                            }`}
                    >
                        <MapPin size={14} /> {userCity}
                    </button>
                </div>

                {/* Top 3 Cards Showcase */}
                {!loading && leaderboard.length >= 1 && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
                        {/* 2nd Place */}
                        {leaderboard[1] && (
                            <div className="order-2 md:order-1 bg-[#FCFAF8] border border-stone-200 rounded-3xl p-6 flex flex-col items-center text-center relative overflow-hidden shadow-md">
                                <div className="absolute top-0 right-0 w-24 h-24 bg-[#F2EFE9] rounded-full transtone-x-8 -transtone-y-8 flex items-end justify-start p-4 text-stone-300 font-black text-3xl">2</div>
                                <div className="p-3 bg-[#F2EFE9] rounded-2xl text-stone-500 mb-4 ring-4 ring-stone-100 ">
                                    <Medal size={28} />
                                </div>
                                <h3 className="font-extrabold text-[#3E352B] text-lg truncate max-w-full">
                                    {leaderboard[1].username}
                                </h3>
                                <p className="text-xs text-stone-400 font-semibold mt-1">
                                    {leaderboard[1].city}, {leaderboard[1].state}
                                </p>
                                <div className="mt-4 px-4 py-1.5 bg-[#F2EFE9] rounded-full text-[#8C5A35] font-black text-sm">
                                    {leaderboard[1].points} pts
                                </div>
                            </div>
                        )}

                        {/* 1st Place */}
                        <div className="order-1 md:order-2 bg-gradient-to-br from-amber-550/10 via-white to-indigo-500/10 border-2 border-amber-500/30 rounded-3xl p-8 flex flex-col items-center text-center relative overflow-hidden shadow-xl scale-105 transform">
                            <div className="absolute top-0 right-0 w-28 h-28 bg-yellow-500/10 rounded-full transtone-x-8 -transtone-y-8 flex items-end justify-start p-4 text-yellow-500/30 font-black text-4xl">1</div>
                            <div className="p-4 bg-yellow-100 rounded-2xl text-yellow-500 mb-4 ring-4 ring-yellow-100/50 animate-pulse">
                                <Trophy size={32} />
                            </div>
                            <h3 className="font-black text-[#2C241B] text-xl truncate max-w-full">
                                {leaderboard[0].username}
                            </h3>
                            <p className="text-xs text-stone-400 font-semibold mt-1">
                                {leaderboard[0].city}, {leaderboard[0].state}
                            </p>
                            <div className="mt-4 px-5 py-2 bg-gradient-to-r from-amber-500 to-indigo-500 text-white rounded-full font-black text-sm shadow-md shadow-amber-500/10">
                                {leaderboard[0].points} pts
                            </div>
                        </div>

                        {/* 3rd Place */}
                        {leaderboard[2] && (
                            <div className="order-3 bg-[#FCFAF8] border border-stone-200 rounded-3xl p-6 flex flex-col items-center text-center relative overflow-hidden shadow-md">
                                <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full transtone-x-8 -transtone-y-8 flex items-end justify-start p-4 text-amber-500/10 font-black text-3xl">3</div>
                                <div className="p-3 bg-amber-100/50 rounded-2xl text-amber-600 mb-4 ring-4 ring-amber-100/20 ">
                                    <Medal size={28} />
                                </div>
                                <h3 className="font-extrabold text-[#3E352B] text-lg truncate max-w-full">
                                    {leaderboard[2].username}
                                </h3>
                                <p className="text-xs text-stone-400 font-semibold mt-1">
                                    {leaderboard[2].city}, {leaderboard[2].state}
                                </p>
                                <div className="mt-4 px-4 py-1.5 bg-[#F2EFE9] rounded-full text-[#8C5A35] font-black text-sm">
                                    {leaderboard[2].points} pts
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Main Rankings List */}
                <Card className="p-6">
                    <h2 className="text-lg font-black text-[#3E352B] mb-4 flex items-center gap-2 uppercase tracking-wide">
                        <TrendingUp size={18} className="text-[#8C5A35]" /> Leaderboard Rankings
                    </h2>

                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-12 gap-2 text-stone-400">
                            <Loader2 className="animate-spin text-[#8C5A35]" size={32} />
                            <p className="text-xs font-semibold">Fetching rank database...</p>
                        </div>
                    ) : leaderboard.length === 0 ? (
                        <div className="text-center py-12 text-stone-400">
                            <Trophy size={48} className="mx-auto text-stone-300 mb-3" />
                            <p className="text-sm font-semibold">No entries in this segment yet.</p>
                            <p className="text-xs">Start practicing, recalling, and asking questions to rank first!</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b border-stone-200 text-xs text-stone-400 uppercase font-black tracking-wider">
                                        <th className="py-3 px-4 w-16 text-center">Rank</th>
                                        <th className="py-3 px-4">Student</th>
                                        <th className="py-3 px-4 w-28">Grade</th>
                                        <th className="py-3 px-4">Location</th>
                                        <th className="py-3 px-4 text-right w-24">Points</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-stone-100 text-sm">
                                    {leaderboard.map((user) => {
                                        const isMe = user.username === currentUser?.name;
                                        return (
                                            <tr
                                                key={user.username}
                                                className={`transition-colors ${isMe
                                                    ? 'bg-amber-50/40 font-bold'
                                                    : 'hover:bg-[#FCFAF8] :bg-stone-900/40'
                                                    }`}
                                            >
                                                <td className="py-4 px-4 text-center">
                                                    {user.rank <= 3 ? (
                                                        <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full font-black text-xs ${user.rank === 1
                                                            ? 'bg-yellow-100 text-yellow-750 '
                                                            : user.rank === 2
                                                                ? 'bg-[#F2EFE9] text-stone-700 '
                                                                : 'bg-amber-105 text-amber-700 '
                                                            }`}>
                                                            {user.rank}
                                                        </span>
                                                    ) : (
                                                        <span className="text-stone-500 font-bold">{user.rank}</span>
                                                    )}
                                                </td>
                                                <td className="py-4 px-4 flex items-center gap-2">
                                                    <span className="font-extrabold text-[#3E352B] ">
                                                        {user.username}
                                                    </span>
                                                    {isMe && (
                                                        <span className="px-2 py-0.5 bg-amber-150 text-amber-700 text-[10px] font-black rounded-full uppercase tracking-wider">
                                                            You
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="py-4 px-4 text-stone-500 font-bold">
                                                    Class {String(user.class_num || '').replace('_TN_EN', ' (TN EN)').replace('_TN_TM', ' (TN TM)')}
                                                </td>
                                                <td className="py-4 px-4 text-xs font-semibold text-stone-500">
                                                    📍 {user.city}, {user.state}, {user.country}
                                                </td>
                                                <td className="py-4 px-4 text-right font-black text-[#8C5A35]">
                                                    {user.points}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </Card>

                {/* Self Placement Card */}
                {myRankEntry && (
                    <div className="p-4 rounded-3xl bg-gradient-to-r from-amber-500 to-indigo-600 text-white shadow-xl flex flex-col sm:flex-row justify-between items-center gap-4">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-[#FCFAF8]/10 rounded-2xl">
                                <Trophy size={28} />
                            </div>
                            <div>
                                <h3 className="font-extrabold text-lg">Your Current Placement</h3>
                                <p className="text-xs text-white/85">
                                    Active Rank: <span className="font-black">#{myRankEntry.rank}</span> overall in {scope === 'worldwide' ? 'Worldwide' : scope}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="text-right">
                                <p className="text-[10px] uppercase font-bold text-white/80 tracking-wide">Total Points</p>
                                <p className="font-black text-2xl">{myRankEntry.points} pts</p>
                            </div>
                            <div className="w-px h-10 bg-[#FCFAF8]/20" />
                            <Link
                                to="/practice"
                                className="px-4 py-2 bg-[#FCFAF8] text-[#2C241B] font-extrabold text-xs rounded-xl shadow-md hover:bg-[#FCFAF8] transition-colors"
                            >
                                Gain More Points
                            </Link>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
