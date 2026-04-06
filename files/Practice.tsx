import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { BookOpen, CheckCircle2, AlertCircle, ArrowRight, Award } from 'lucide-react';
import toast from 'react-hot-toast';
import { Navbar } from '../components/layout/Navbar';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { PremiumModal } from '../components/PremiumModal';
import { NCERT_CHAPTERS } from '../constants/ncert';
import { getUser, addActivity } from '../utils/storage';
import { generatePractice, gradeAnswer, logProgress } from '../api';

export const Practice = () => {
  const location = useLocation();
  const user = getUser();

  const [selectedSubject, setSelectedSubject] = useState(
    location.state?.subject || user?.subjects[0] || ''
  );
  const [selectedChapter, setSelectedChapter] = useState('');
  const [questionType, setQuestionType] = useState('1-mark');
  const [numQuestions, setNumQuestions] = useState(3);

  const [questions, setQuestions] = useState<string[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswer, setUserAnswer] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGrading, setIsGrading] = useState(false);
  const [gradeResult, setGradeResult] = useState<any>(null);
  const [sessionFinished, setSessionFinished] = useState(false);
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [score, setScore] = useState(0);

  const chapters = selectedSubject
    ? NCERT_CHAPTERS[user?.class.toString() || '10']?.[selectedSubject] || []
    : [];

  const handleStartSession = async () => {
    if (!selectedSubject || !selectedChapter) {
      toast.error('Please select a subject and chapter first!');
      return;
    }

    setIsLoading(true);
    try {
      const response = await generatePractice({
        class_num: (user?.class || '10').toString(),
        subject: selectedSubject,
        chapter: selectedChapter,
        question_type: questionType,
        num_questions: numQuestions,
      });

      setQuestions(response.questions);
      setCurrentQuestionIndex(0);
      setGradeResult(null);
      setSessionFinished(false);
      setScore(0);
    } catch (error) {
      toast.error('Failed to generate questions. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGradeAnswer = async () => {
    if (!userAnswer.trim()) return;

    setIsGrading(true);
    try {
      const marksAvailable =
        questionType === '1-mark' ? 1 : questionType === '3-mark' ? 3 : 5;

      const response = await gradeAnswer({
        question: questions[currentQuestionIndex],
        user_answer: userAnswer,
        class_num: (user?.class || '10').toString(),
        subject: selectedSubject,
        marks_available: marksAvailable,
      });

      setGradeResult(response);
      setScore((prev) => prev + response.marks_awarded);

      if (user?.name) {
        logProgress({
          user_id: user.name,
          action: 'practice',
          subject: selectedSubject,
          chapter: selectedChapter,
          score: Math.round((response.marks_awarded / response.total_marks) * 100),
        });
      }
    } catch (error) {
      toast.error('Grading failed. Please try again.');
    } finally {
      setIsGrading(false);
    }
  };

  const handleNextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex((prev) => prev + 1);
      setUserAnswer('');
      setGradeResult(null);
    } else {
      setSessionFinished(true);
      addActivity({
        type: 'practice',
        subject: selectedSubject,
        chapter: selectedChapter,
        timestamp: Date.now(),
        description: `Completed ${questions.length} ${questionType} questions`,
      });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0f1117]">
      <Navbar />
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Practice Hub
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Master every chapter with AI-graded practice sessions.
          </p>
        </div>

        {questions.length === 0 ? (
          <Card className="p-8 bg-white dark:bg-[#1a1d26] border-none shadow-xl rounded-2xl">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div className="space-y-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Subject
                </label>
                <select
                  value={selectedSubject}
                  onChange={(e) => {
                    setSelectedSubject(e.target.value);
                    setSelectedChapter('');
                  }}
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-[#252a36] text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-[#1D9E75]"
                >
                  <option value="">Select Subject</option>
                  {user?.subjects.map((subject: string) => (
                    <option key={subject} value={subject}>
                      {subject}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Chapter
                </label>
                <select
                  value={selectedChapter}
                  onChange={(e) => setSelectedChapter(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-[#252a36] text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-[#1D9E75]"
                  disabled={!selectedSubject}
                >
                  <option value="">Select Chapter</option>
                  {chapters.map((chapter: string, index: number) => (
                    <option key={index} value={chapter}>
                      {chapter}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Question Type
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {['1-mark', '3-mark', '5-mark', 'mixed'].map((type) => (
                    <button
                      key={type}
                      onClick={() => setQuestionType(type)}
                      className={`px-4 py-2 rounded-xl border text-sm font-medium transition-all ${
                        questionType === type
                          ? 'border-[#1D9E75] bg-[#1D9E75]/10 text-[#1D9E75]'
                          : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Number of Questions
                </label>
                <div className="flex items-center space-x-4">
                  {[3, 5, 10].map((num) => (
                    <button
                      key={num}
                      onClick={() => setNumQuestions(num)}
                      className={`w-12 h-12 rounded-xl border flex items-center justify-center font-medium transition-all ${
                        numQuestions === num
                          ? 'border-[#1D9E75] bg-[#1D9E75]/10 text-[#1D9E75]'
                          : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400'
                      }`}
                    >
                      {num}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <Button
              className="w-full py-4 text-lg font-bold bg-[#1D9E75] hover:bg-[#16805d]"
              onClick={handleStartSession}
              disabled={isLoading}
            >
              {isLoading ? 'Generating Questions...' : 'Start Practice Session'}
            </Button>
          </Card>
        ) : sessionFinished ? (
          <Card className="p-12 text-center bg-white dark:bg-[#1a1d26] border-none shadow-xl rounded-2xl">
            <div className="w-20 h-20 bg-yellow-100 dark:bg-yellow-900/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <Award className="text-yellow-600" size={40} />
            </div>
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              Session Complete!
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-8">
              Great job! You've completed your practice on {selectedChapter}.
            </p>
            <div className="grid grid-cols-2 gap-4 max-w-sm mx-auto mb-8">
              <div className="p-4 bg-gray-50 dark:bg-[#252a36] rounded-2xl">
                <p className="text-sm text-gray-500 mb-1">Total Score</p>
                <p className="text-2xl font-bold text-[#1D9E75]">{score}</p>
              </div>
              <div className="p-4 bg-gray-50 dark:bg-[#252a36] rounded-2xl">
                <p className="text-sm text-gray-500 mb-1">Questions</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {questions.length}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              className="px-8 py-3"
              onClick={() => {
                setQuestions([]);
                setSessionFinished(false);
              }}
            >
              New Session
            </Button>
          </Card>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <span className="px-3 py-1 bg-[#1D9E75]/10 text-[#1D9E75] text-xs font-bold rounded-full uppercase tracking-wider">
                  Question {currentQuestionIndex + 1} of {questions.length}
                </span>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {selectedSubject} • {selectedChapter}
                </span>
              </div>
            </div>

            <Card className="p-8 bg-white dark:bg-[#1a1d26] border-none shadow-xl rounded-2xl">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6">
                {questions[currentQuestionIndex]}
              </h3>

              {!gradeResult ? (
                <div className="space-y-4">
                  <textarea
                    value={userAnswer}
                    onChange={(e) => setUserAnswer(e.target.value)}
                    placeholder="Write your answer here..."
                    className="w-full h-48 p-4 bg-gray-50 dark:bg-[#252a36] text-gray-900 dark:text-white rounded-xl border border-transparent focus:ring-2 focus:ring-[#1D9E75] outline-none transition-all resize-none"
                  />
                  <div className="flex justify-end">
                    <Button
                      className="px-8 py-3 bg-[#1D9E75] hover:bg-[#16805d]"
                      onClick={handleGradeAnswer}
                      disabled={isGrading || !userAnswer.trim()}
                    >
                      {isGrading ? 'Grading...' : 'Submit Answer'}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div
                    className={`p-4 rounded-xl flex items-center justify-between ${
                      gradeResult.marks_awarded === gradeResult.total_marks
                        ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200'
                        : 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-200'
                    }`}
                  >
                    <div className="flex items-center">
                      <CheckCircle2 size={20} className="mr-3" />
                      <span className="font-bold">
                        Score: {gradeResult.marks_awarded} / {gradeResult.total_marks}
                      </span>
                    </div>
                    <span className="text-sm font-medium">CBSE Style Grade</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-6 bg-emerald-50 dark:bg-emerald-900/20 rounded-[24px] border border-emerald-100 dark:border-emerald-800">
                      <h4 className="font-black text-[#1D9E75] text-xs mb-3 uppercase tracking-widest flex items-center">
                        <CheckCircle2 size={16} className="mr-2" />
                        Teacher's Praise
                      </h4>
                      <p className="text-sm text-emerald-800 dark:text-emerald-300 font-medium leading-relaxed">
                        {gradeResult.feedback.split('Missing:')[0].replace('Good: ', '')}
                      </p>
                    </div>
                    <div className="p-6 bg-red-50 dark:bg-red-900/20 rounded-[24px] border border-red-100 dark:border-red-800">
                      <h4 className="font-black text-red-600 dark:text-red-400 text-xs mb-3 uppercase tracking-widest flex items-center">
                        <AlertCircle size={16} className="mr-2" />
                        Needs Attention
                      </h4>
                      <p className="text-sm text-red-800 dark:text-red-300 font-medium leading-relaxed">
                        {gradeResult.feedback.split('Missing:')[1] ||
                          'Nothing major missing! Keep it up.'}
                      </p>
                    </div>
                  </div>

                  <div className="p-8 bg-slate-900 text-white rounded-[32px] shadow-2xl relative overflow-hidden">
                    <div className="relative z-10">
                      <h4 className="font-black text-xs uppercase tracking-[0.2em] text-[#1D9E75] mb-4">
                        Model Answer by AI Tutor
                      </h4>
                      <p className="text-sm text-slate-300 font-medium leading-loose whitespace-pre-line">
                        {gradeResult.model_answer}
                      </p>
                    </div>
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                      <Award size={80} />
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Button
                      className="px-8 py-3 bg-[#1D9E75] hover:bg-[#16805d] flex items-center"
                      onClick={handleNextQuestion}
                    >
                      {currentQuestionIndex < questions.length - 1 ? (
                        <>
                          <span>Next Question</span>
                          <ArrowRight size={18} className="ml-2" />
                        </>
                      ) : (
                        'Finish Session'
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          </div>
        )}
      </div>

      {/* Fixed: feature prop is now always passed */}
      <PremiumModal
        isOpen={showPremiumModal}
        onClose={() => setShowPremiumModal(false)}
        feature="Unlimited Practice Sessions"
      />
    </div>
  );
};
