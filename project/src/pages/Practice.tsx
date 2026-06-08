import { useEffect, useState, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { CheckCircle2, AlertCircle, ArrowRight, Award, Zap, Clock, Target, BookOpen, ArrowLeft, TrendingUp, Brain, Lightbulb, type LucideIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import { Navbar } from '../components/layout/Navbar';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { MarkdownContent } from '../components/ui/MarkdownContent';
import { PremiumModal } from '../components/PremiumModal';
import { getUser, addActivity, saveStudyMaterialIfNew, type StudyMaterialItem } from '../utils/storage';
import {
  generatePracticeStream,
  gradeAnswerStream,
  explainQuestion,
  logProgress,
  saveMaterialToDatabase,
  type GradeResponse,
} from '../api';
import { useCurriculumCatalog } from '../hooks/useCurriculumCatalog';

const parsePracticeBlocks = (raw: string): string[] => {
  const text = (raw || '').replace(/\r/g, '');
  const matches = [...text.matchAll(/(?:^|\n)\s*(\d{1,2})[\.)]\s+([\s\S]*?)(?=(?:\n\s*\d{1,2}[\.)]\s+)|$)/g)];
  if (matches.length > 0) {
    return matches
      .map((match) => (match[2] || '').trim())
      .filter((entry) => entry.length > 20)
      .filter((entry) => !/^\*{0,2}\s*(multiple\s+choice\s+question|question\s*\(?\d*-?mark)/i.test(entry));
  }

  return text
    .split(/\n+/)
    .map((line) => line.replace(/^\s*[-*•]\s*/, '').trim())
    .filter((line) => line.length > 20)
    .filter((line) => !/^\*{0,2}\s*(multiple\s+choice\s+question|question\s*\(?\d*-?mark)/i.test(line));
};

const parseMcq = (qText: string) => {
  try {
    const lines = qText.split('\n').map(l => l.trim()).filter(Boolean);
    let prompt = '';
    const options: { label: string; text: string }[] = [];
    let answer = '';

    for (const line of lines) {
      const mcqMatch = line.match(/^([A-D])[\)\.]\s*(.*)$/i);
      const ansMatch = line.match(/^(?:Answer|Correct Answer):\s*([A-D])/i);
      if (mcqMatch) {
        options.push({ label: mcqMatch[1].toUpperCase(), text: mcqMatch[2] });
      } else if (ansMatch) {
        answer = ansMatch[1].toUpperCase();
      } else {
        if (!prompt) {
          prompt = line;
        } else {
          prompt += '\n' + line;
        }
      }
    }

    prompt = prompt.replace(/(?:Answer|Correct Answer):\s*[A-D]/i, '').trim();

    if (options.length === 4 && answer) {
      return { prompt, options, answer };
    }
  } catch (e) {
    console.error("Failed to parse MCQ", e);
  }
  return null;
};

const parseBlank = (qText: string) => {
  try {
    const lines = qText.split('\n').map(l => l.trim()).filter(Boolean);
    let prompt = '';
    let answer = '';

    for (const line of lines) {
      const ansMatch = line.match(/^(?:Answer|Correct Answer):\s*(.*)$/i);
      if (ansMatch) {
        answer = ansMatch[1].trim();
      } else {
        if (!prompt) {
          prompt = line;
        } else {
          prompt += '\n' + line;
        }
      }
    }

    prompt = prompt.replace(/(?:Answer|Correct Answer):\s*.*$/i, '').trim();

    if (answer) {
      return { prompt, answer };
    }
  } catch (e) {
    console.error("Failed to parse blank", e);
  }
  return null;
};

const parseMatch = (qText: string) => {
  try {
    const lines = qText.split('\n').map(l => l.trim()).filter(Boolean);
    let prompt = '';
    const columnA: string[] = [];
    const columnB: string[] = [];
    const matches: Record<string, string> = {};
    let isColA = false;
    let isColB = false;

    for (const line of lines) {
      const lineLower = line.toLowerCase();
      
      if (lineLower.startsWith('column a')) {
        isColA = true;
        isColB = false;
        continue;
      }
      if (lineLower.startsWith('column b')) {
        isColB = true;
        isColA = false;
        continue;
      }
      
      const ansMatch = line.match(/^(?:Answer|Correct Answer):\s*(.*)$/i);
      if (ansMatch) {
        const matchesStr = ansMatch[1];
        const pairs = matchesStr.split(',');
        for (const p of pairs) {
          const split = p.split('-');
          if (split.length === 2) {
            matches[split[0].trim()] = split[1].trim().toUpperCase();
          }
        }
        continue;
      }

      if (isColA) {
        const itemMatch = line.match(/^(\d+)[\)\.]\s*(.*)$/);
        if (itemMatch) {
          columnA.push(line);
        } else {
          isColA = false;
        }
      }
      
      if (isColB) {
        const itemMatch = line.match(/^([A-Z])[\)\.]\s*(.*)$/i);
        if (itemMatch) {
          columnB.push(line);
        } else {
          isColB = false;
        }
      }

      if (!isColA && !isColB) {
        if (!prompt) {
          prompt = line;
        } else {
          prompt += '\n' + line;
        }
      }
    }

    prompt = prompt.replace(/(?:Answer|Correct Answer):\s*.*$/i, '').trim();

    if (columnA.length > 0 && columnB.length > 0 && Object.keys(matches).length > 0) {
      return { prompt, columnA, columnB, matches };
    }
  } catch (e) {
    console.error("Failed to parse match", e);
  }
  return null;
};

export const Practice = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const user = getUser();
  const seededQuestions = (location.state?.questions || []) as string[];

  // Load session from localStorage on start
  const savedSession = useMemo(() => {
    // If we have location.state with seeded questions/subject/chapter, we ignore savedSession
    if (location.state?.subject || location.state?.chapter || (location.state?.questions && location.state.questions.length > 0)) {
      return null;
    }
    try {
      const data = localStorage.getItem('clarity_practice_session_state');
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }, [location.state]);

  const [selectedSubject, setSelectedSubject] = useState<string>(
    location.state?.subject || savedSession?.selectedSubject || user?.subjects[0] || ''
  );
  const [selectedChapter, setSelectedChapter] = useState<string>(
    location.state?.chapter || savedSession?.selectedChapter || ''
  );
  const [questionType, setQuestionType] = useState('variety');
  const [numQuestions, setNumQuestions] = useState<number>(location.state?.numQuestions || savedSession?.numQuestions || 3);
  const [timedMode, setTimedMode] = useState<boolean>(savedSession?.timedMode ?? false);
  const [timeMinutes, setTimeMinutes] = useState(15);
  const [stickToTextbook, setStickToTextbook] = useState(false);

  const [questions, setQuestions] = useState<string[]>(
    seededQuestions.length > 0 ? seededQuestions : (savedSession?.questions || [])
  );
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(savedSession?.currentQuestionIndex || 0);
  const [userAnswer, setUserAnswer] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGrading, setIsGrading] = useState(false);
  const [gradeResult, setGradeResult] = useState<GradeResponse | null>(null);
  const [sessionFinished, setSessionFinished] = useState<boolean>(savedSession?.sessionFinished ?? false);
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [score, setScore] = useState<number>(savedSession?.score || 0);
  const [attemptedQuestions, setAttemptedQuestions] = useState<number>(savedSession?.attemptedQuestions || 0);
  const [attemptedTotalMarks, setAttemptedTotalMarks] = useState<number>(savedSession?.attemptedTotalMarks || 0);
  const [timeLeft, setTimeLeft] = useState<number>(savedSession?.timeLeft || 0);
  const [generationPreview, setGenerationPreview] = useState('');
  const [gradingPreview, setGradingPreview] = useState('');
  const [explainResult, setExplainResult] = useState('');
  const [isExplaining, setIsExplaining] = useState(false);
  const [weakSkillHistory, setWeakSkillHistory] = useState<string[]>([]);
  const [mockRecoveryPlan, setMockRecoveryPlan] = useState<string[]>([]);
  const [doubtSignal, setDoubtSignal] = useState<{
    title: string;
    clue: string;
    confidence: 'high' | 'medium';
  } | null>(null);
  const [userAnswers, setUserAnswers] = useState<Record<number, string>>(
    savedSession?.userAnswers || {}
  );
  const [allGrades, setAllGrades] = useState<Record<number, GradeResponse>>(
    savedSession?.allGrades || {}
  );
  const [isSessionGrading, setIsSessionGrading] = useState(false);

  // Save active practice session to localStorage
  useEffect(() => {
    if (questions.length > 0) {
      const sessionData = {
        selectedSubject,
        selectedChapter,
        numQuestions,
        questions,
        currentQuestionIndex,
        timedMode,
        timeLeft,
        userAnswers,
        allGrades,
        score,
        attemptedQuestions,
        attemptedTotalMarks,
        sessionFinished,
      };
      localStorage.setItem('clarity_practice_session_state', JSON.stringify(sessionData));
    } else {
      localStorage.removeItem('clarity_practice_session_state');
    }
  }, [
    selectedSubject,
    selectedChapter,
    numQuestions,
    questions,
    currentQuestionIndex,
    timedMode,
    timeLeft,
    userAnswers,
    allGrades,
    score,
    attemptedQuestions,
    attemptedTotalMarks,
    sessionFinished,
  ]);

  const fullSetTotalMarks = questions.reduce((acc, q) => {
    if (parseMcq(q)) return acc + 1;
    if (parseBlank(q)) return acc + 1;
    if (parseMatch(q)) return acc + 3;
    return acc + 5;
  }, 0);
  const classKey = String(user?.class || '10');
  const { chaptersForSubject } = useCurriculumCatalog(classKey);

  const buildMockRecoveryPlan = (accuracyPercent: number, skills: string[]) => {
    const topSkills = skills.slice(0, 2);
    const primarySkill = topSkills[0] || 'answer structure';
    const secondarySkill = topSkills[1] || 'keyword recall';
    const intensity = accuracyPercent >= 70 ? 'stabilize' : accuracyPercent >= 45 ? 'recover' : 'urgent recover';
    return [
      `Next 24h (${intensity}): revise ${selectedChapter} for 25 minutes focused on ${primarySkill}.`,
      `Next 24-36h: solve 6 board-style questions targeting ${secondarySkill} with strict timing.`,
      'Within 48h: do one mini mock (5 questions), compare with model answers, and reattempt mistakes.',
    ];
  };

  const detectDoubtSignal = (question: string, response: GradeResponse, rawAnswer: string) => {
    const scorePercent = response.total_marks > 0
      ? (response.marks_awarded / response.total_marks) * 100
      : 0;

    if (scorePercent >= 70) {
      return null;
    }

    const q = question.toLowerCase();
    const feedbackMissing = (response.feedback.split('Missing:')[1] || '').toLowerCase();
    const answerLen = rawAnswer.trim().length;

    if (/define|what is|meaning of|state/.test(q) || /definition/.test(feedbackMissing)) {
      return {
        title: 'Likely definition gap',
        clue: 'Your answer may be missing textbook keyword precision for a direct definition-style ask.',
        confidence: scorePercent < 40 ? 'high' : 'medium',
      } as const;
    }

    if (/why|how|explain|describe/.test(q) || /step|logic|structure/.test(feedbackMissing)) {
      return {
        title: 'Likely concept-flow gap',
        clue: 'The explanation flow may be incomplete. Add stepwise reasoning and one concrete chapter example.',
        confidence: scorePercent < 40 ? 'high' : 'medium',
      } as const;
    }

    if (/calculate|find|numerical|value|equation|formula/.test(q) || /unit|substitution|calculation/.test(feedbackMissing)) {
      return {
        title: 'Likely formula-application gap',
        clue: 'Check formula selection, substitution order, and units; this looks like a method error, not memory alone.',
        confidence: scorePercent < 40 ? 'high' : 'medium',
      } as const;
    }

    if (/difference|differentiate|compare|distinguish/.test(q)) {
      return {
        title: 'Likely comparison-structure gap',
        clue: 'Use a point-by-point contrast format (2-3 paired points) instead of a single paragraph.',
        confidence: scorePercent < 40 ? 'high' : 'medium',
      } as const;
    }

    if (answerLen < 40) {
      return {
        title: 'Likely depth gap',
        clue: 'The answer may be too short for the expected marks. Add required points and one supporting line.',
        confidence: 'medium',
      } as const;
    }

    return {
      title: 'Likely precision gap',
      clue: 'Your attempt is on track, but key chapter terms and answer structure need tightening for full marks.',
      confidence: 'medium',
    } as const;
  };

  const chapters = selectedSubject
    ? chaptersForSubject(selectedSubject)
    : [];

  // Parsers moved to module level

  const questionTypeGuide: Record<string, { desc: string; icon: LucideIcon; color: string; bg: string; border: string }> = {
    '1-mark': {
      desc: 'Quick definition, 1-2 sentences',
      icon: Target,
      color: 'text-blue-600 dark:text-blue-400',
      bg: 'bg-blue-50 dark:bg-blue-900/20',
      border: 'border-blue-200 dark:border-blue-800',
    },
    '3-mark': {
      desc: 'Explanation with 3 key points',
      icon: Brain,
      color: 'text-purple-600 dark:text-purple-400',
      bg: 'bg-purple-50 dark:bg-purple-900/20',
      border: 'border-purple-200 dark:border-purple-800',
    },
    '5-mark': {
      desc: 'Comprehensive answer with example',
      icon: BookOpen,
      color: 'text-orange-600 dark:text-orange-400',
      bg: 'bg-orange-50 dark:bg-orange-900/20',
      border: 'border-orange-200 dark:border-orange-800',
    },
    mixed: {
      desc: 'Mix of 1, 3, and 5-mark questions',
      icon: TrendingUp,
      color: 'text-green-600 dark:text-green-400',
      bg: 'bg-green-50 dark:bg-green-900/20',
      border: 'border-green-200 dark:border-green-800',
    },
    variety: {
      desc: 'Diverse topics from the chapter',
      icon: Lightbulb,
      color: 'text-yellow-600 dark:text-yellow-400',
      bg: 'bg-yellow-50 dark:bg-yellow-900/20',
      border: 'border-yellow-200 dark:border-yellow-800',
    },
    'past-paper': {
      desc: 'Real questions from board exams',
      icon: Award,
      color: 'text-red-600 dark:text-red-400',
      bg: 'bg-red-50 dark:bg-red-900/20',
      border: 'border-red-200 dark:border-red-800',
    },
    'mcq': {
      desc: 'Multiple choice with options A-D',
      icon: Target,
      color: 'text-teal-600 dark:text-teal-400',
      bg: 'bg-teal-50 dark:bg-teal-900/20',
      border: 'border-teal-200 dark:border-teal-800',
    },
    'fill-blanks': {
      desc: 'Fill in the missing words',
      icon: Lightbulb,
      color: 'text-indigo-600 dark:text-indigo-400',
      bg: 'bg-indigo-50 dark:bg-indigo-900/20',
      border: 'border-indigo-200 dark:border-indigo-800',
    },
    'match-following': {
      desc: 'Match column items correctly',
      icon: Brain,
      color: 'text-rose-600 dark:text-rose-400',
      bg: 'bg-rose-50 dark:bg-rose-900/20',
      border: 'border-rose-200 dark:border-rose-800',
    },
  };

  const handleStartSession = async () => {
    if (!selectedSubject || !selectedChapter) {
      toast.error('Please select a subject and chapter first!');
      return;
    }

    setIsLoading(true);
    setGenerationPreview('');
    try {
      let streamed = '';
      await generatePracticeStream({
        class_num: (user?.class || '10').toString(),
        subject: selectedSubject,
        chapter: selectedChapter,
        question_type: questionType,
        num_questions: numQuestions,
        stick_to_textbook: stickToTextbook,
      }, (token) => {
        streamed += token;
        setGenerationPreview(streamed);
      });

      const parsed = parsePracticeBlocks(streamed);

      const nextQuestions = parsed.slice(0, numQuestions);
      if (nextQuestions.length === 0) {
        throw new Error('No questions generated');
      }

      const material: StudyMaterialItem = {
        id: `practice_${Date.now()}`,
        type: 'practice',
        title: `Practice Set: ${selectedChapter}`,
        subject: selectedSubject,
        chapter: selectedChapter,
        content: nextQuestions.map((q, idx) => `${idx + 1}. ${q}`).join('\n'),
        createdAt: Date.now(),
      };
      saveStudyMaterialIfNew(material);
      try {
        await saveMaterialToDatabase(material);
      } catch {
        // Keep local save even if sync fails.
      }

      setQuestions(nextQuestions);
      setCurrentQuestionIndex(0);
      setGradeResult(null);
      setSessionFinished(false);
      setScore(0);
      setAttemptedQuestions(0);
      setAttemptedTotalMarks(0);
      setExplainResult('');
      setWeakSkillHistory([]);
      setMockRecoveryPlan([]);
      setUserAnswers({});
      setAllGrades({});
      if (timedMode) {
        setTimeLeft(timeMinutes * 60);
      } else {
        setTimeLeft(0);
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to generate questions. Please try again.';
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGradeAnswer = async (index: number, answer: string): Promise<GradeResponse | null> => {
    if (!answer.trim()) return null;

    try {
      const marksAvailable = questionType === '1-mark' ? 1 : questionType === '3-mark' ? 3 : 5;
      const payload = {
        question: questions[index],
        user_answer: answer,
        class_num: (user?.class || '10').toString(),
        subject: selectedSubject,
        marks_available: marksAvailable
      };

      let streamed = '';
      await gradeAnswerStream(payload, (token) => {
        streamed += token;
      });

      const marksMatch = streamed.match(/MARKS:\s*(\d+)\/(\d+)/i);
      const goodMatch = streamed.match(/WHAT WAS GOOD:\s*([\s\S]*?)(?=WHAT WAS MISSING:|$)/i);
      const missingMatch = streamed.match(/WHAT WAS MISSING:\s*([\s\S]*?)(?=MODEL ANSWER:|$)/i);
      const modelMatch = streamed.match(/MODEL ANSWER:\s*([\s\S]*)$/i);
      const microMatch = streamed.match(/MICRO EXPLANATION:\s*([\s\S]*?)(?=RELATED QUESTION:|FLASHCARD DUE:|WEAK SKILL:|$)/i);
      const relatedMatch = streamed.match(/RELATED QUESTION:\s*([\s\S]*?)(?=FLASHCARD DUE:|WEAK SKILL:|$)/i);
      const flashcardMatch = streamed.match(/FLASHCARD DUE:\s*([\s\S]*?)(?=WEAK SKILL:|$)/i);
      const skillMatch = streamed.match(/WEAK SKILL:\s*([\s\S]*)$/i);

      const response: GradeResponse = {
        marks_awarded: marksMatch ? Number(marksMatch[1]) : 0,
        total_marks: marksMatch ? Number(marksMatch[2]) : marksAvailable,
        feedback: `Good: ${goodMatch?.[1]?.trim() || 'Attempted the question.'}\nMissing: ${missingMatch?.[1]?.trim() || 'Review the chapter concepts.'}`,
        model_answer: modelMatch?.[1]?.trim() || 'Refer to your NCERT textbook.',
        micro_explanation: microMatch?.[1]?.trim(),
        related_question: relatedMatch?.[1]?.trim(),
        flashcard_due: flashcardMatch?.[1]?.trim(),
        weak_skill: skillMatch?.[1]?.trim(),
      };

      return response;
    } catch (error) {
      console.error('Grading failed for question', index, error);
      return null;
    }
  };

  const handleSubmitAndNext = async () => {
    if (!userAnswer.trim()) return;

    const newAnswers = { ...userAnswers, [currentQuestionIndex]: userAnswer };
    setUserAnswers(newAnswers);

    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      setUserAnswer(userAnswers[currentQuestionIndex + 1] || '');
      setGradeResult(null);
    } else {
      // Last question submitted, start grading all
      setIsSessionGrading(true);
      let totalScore = 0;
      let totalAttemptedMarks = 0;
      let totalAttemptedQs = 0;
      const grades: Record<number, GradeResponse> = {};
      const skills: string[] = [];

      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        const ans = newAnswers[i];
        let res: GradeResponse | null = null;
        
        const parsedMcq = parseMcq(q);
        const parsedBlank = parseBlank(q);
        const parsedMatch = parseMatch(q);
        
        let questionMaxMarks = 5;
        if (parsedMcq) questionMaxMarks = 1;
        else if (parsedBlank) questionMaxMarks = 1;
        else if (parsedMatch) questionMaxMarks = 3;

        if (ans) {
          if (parsedMcq) {
            const correct = parsedMcq.answer === ans.toUpperCase();
            res = {
              marks_awarded: correct ? 1 : 0,
              total_marks: 1,
              feedback: correct 
                ? `Correct! You selected Option ${ans}. Option ${parsedMcq.answer} is the correct answer.`
                : `Incorrect. You selected Option ${ans}, but the correct option is ${parsedMcq.answer}.`,
              model_answer: `Option ${parsedMcq.answer} is correct.`,
            };
          } else if (parsedBlank) {
            const correct = parsedBlank.answer.toLowerCase().trim() === ans.toLowerCase().trim();
            res = {
              marks_awarded: correct ? 1 : 0,
              total_marks: 1,
              feedback: correct
                ? `Correct! The blank should be filled with "${parsedBlank.answer}".`
                : `Incorrect. You filled with "${ans}", but the correct answer is "${parsedBlank.answer}".`,
              model_answer: parsedBlank.answer,
            };
          } else if (parsedMatch) {
            const userPairs: Record<string, string> = {};
            const pairs = ans.split(',');
            for (const p of pairs) {
              const split = p.split('-');
              if (split.length === 2) {
                userPairs[split[0].trim()] = split[1].trim().toUpperCase();
              }
            }
            
            let correctCount = 0;
            const totalPairs = Object.keys(parsedMatch.matches).length;
            for (const [key, val] of Object.entries(parsedMatch.matches)) {
              if (userPairs[key] === val) {
                correctCount += 1;
              }
            }
            
            const marksAwarded = totalPairs > 0 ? Math.round((correctCount / totalPairs) * 3) : 0;
            const isCorrect = correctCount === totalPairs;
            
            res = {
              marks_awarded: marksAwarded,
              total_marks: 3,
              feedback: isCorrect
                ? `Correct! All matching pairs are correct.`
                : `Incorrect. You matched ${correctCount} of ${totalPairs} correctly. Correct matches: ${Object.entries(parsedMatch.matches).map(([k, v]) => `${k}-${v}`).join(', ')}`,
              model_answer: Object.entries(parsedMatch.matches).map(([k, v]) => `${k} -> ${v}`).join(', '),
            };
          } else {
            res = await handleGradeAnswer(i, ans);
          }
          
          if (res) {
            grades[i] = res;
            totalScore += res.marks_awarded;
            totalAttemptedMarks += res.total_marks;
            totalAttemptedQs += 1;
            if (res.weak_skill) skills.push(res.weak_skill);
          }
        } else {
          // Unattempted question - populate anyway so it shows in review
          res = {
            marks_awarded: 0,
            total_marks: questionMaxMarks,
            feedback: "Missing: No answer was submitted.",
            model_answer: parsedMcq 
              ? `Correct Option: Option ${parsedMcq.answer}`
              : parsedBlank 
                ? `Correct Answer: ${parsedBlank.answer}`
                : parsedMatch 
                  ? `Correct Matches: ${Object.entries(parsedMatch.matches).map(([k, v]) => `${k} -> ${v}`).join(', ')}`
                  : "Refer to the textbook model answer.",
          };
          grades[i] = res;
        }
      }

      setAllGrades(grades);
      setScore(totalScore);
      setAttemptedQuestions(totalAttemptedQs);
      setAttemptedTotalMarks(totalAttemptedMarks);
      setWeakSkillHistory(skills);
      
      const accuracyPercent = totalAttemptedMarks > 0 ? Math.round((totalScore / totalAttemptedMarks) * 100) : 0;
      setMockRecoveryPlan(buildMockRecoveryPlan(accuracyPercent, skills));
      
      setIsSessionGrading(false);
      setSessionFinished(true);

      if (user?.name) {
        logProgress({
          action: 'practice',
          subject: selectedSubject,
          chapter: selectedChapter,
          score: accuracyPercent
        });
      }

      addActivity({
        type: 'practice',
        subject: selectedSubject,
        chapter: selectedChapter,
        timestamp: Date.now(),
        description: `Completed ${questions.length} ${questionType} questions`,
      });
    }
  };

  const handleExplainQuestion = async () => {
    if (!questions[currentQuestionIndex]) return;
    setIsExplaining(true);
    try {
      const result = await explainQuestion({
        question: questions[currentQuestionIndex],
        chapter: selectedChapter,
        subject: selectedSubject,
      });
      setExplainResult(result.explanation);
      const q = questions[currentQuestionIndex];
      let marksAvailable = 5;
      if (parseMcq(q) || parseBlank(q)) marksAvailable = 1;
      else if (parseMatch(q)) marksAvailable = 3;

      const explainAsWrong: GradeResponse = {
        marks_awarded: 0,
        total_marks: marksAvailable,
        feedback: 'Good: Explain mode was used before submitting an answer.\nMissing: No attempt was submitted, so this is treated as incorrect for progression.',
        model_answer: result.explanation,
      };
      setGradeResult(explainAsWrong);
      setDoubtSignal({
        title: 'Explain mode used',
        clue: 'You can now move to the next question. Come back and solve this one in a retry session.',
        confidence: 'medium',
      });
      toast.success('Explain mode ready');
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Unable to explain this question right now.';
      toast.error(msg);
    } finally {
      setIsExplaining(false);
    }
  };

  // Mark unused variables as read for TypeScript compiler
  void setIsGrading;
  void setQuestionType;
  void setGradingPreview;
  void weakSkillHistory;
  void detectDoubtSignal;

  const handleNextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex((prev) => prev + 1);
      setUserAnswer(userAnswers[currentQuestionIndex + 1] || '');
      setGradeResult(null);
      setExplainResult('');
      setDoubtSignal(null);
    } else {
      setSessionFinished(true);
    }
  };

  useEffect(() => {
    if (!seededQuestions.length) return;
    setQuestions(seededQuestions);
    setCurrentQuestionIndex(0);
    setGradeResult(null);
    setExplainResult('');
    setDoubtSignal(null);
    setSessionFinished(false);
    setScore(0);
    setAttemptedQuestions(0);
    setAttemptedTotalMarks(0);
    setWeakSkillHistory([]);
    setMockRecoveryPlan([]);
    setUserAnswers({});
    setAllGrades({});
  }, [seededQuestions]);



  useEffect(() => {
    if (!timedMode || sessionFinished || questions.length === 0 || timeLeft <= 0) return;
    const id = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(id);
          setSessionFinished(true);
          toast.success('Time up! Session auto-submitted.');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [timedMode, sessionFinished, questions.length, timeLeft]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
    const secs = (seconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-[#020617] dark:to-slate-900">
      <Navbar />
      <div className="max-w-5xl mx-auto px-4 md:px-8 py-8">
        {/* Header with back button */}
        <div className="mb-10">
          <button
            onClick={() => navigate(-1)}
            className="mb-6 flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:text-[#1D9E75] transition-colors font-bold"
          >
            <ArrowLeft size={20} />
            Back
          </button>
          <div className="flex items-center gap-4">
            <div className="p-4 bg-gradient-to-br from-[#1D9E75] to-emerald-600 rounded-3xl">
              <Target className="text-white" size={40} />
            </div>
            <div>
              <h1 className="text-4xl font-black text-slate-900 dark:text-white mb-2">Practice Hub</h1>
              <p className="text-slate-600 dark:text-slate-400 font-bold">Master every chapter with AI-graded practice sessions</p>
            </div>
          </div>
        </div>

        {questions.length === 0 ? (
          <div className="space-y-8">
            {/* Question Type Guide Card */}
            {(() => {
              const Guide = questionTypeGuide[questionType];
              return (
                <Card className={`p-8 rounded-[32px] border-2 ${Guide.bg} ${Guide.border}`}>
                  <div className="flex gap-4 items-start mb-6">
                    <div className={`p-4 rounded-2xl flex-shrink-0 ${Guide.bg}`}>
                      <Guide.icon className={Guide.color} size={28} />
                    </div>
                    <div>
                      <h3 className={`font-black text-xl ${Guide.color} mb-1`}>About "{questionType}" Questions</h3>
                      <p className={`text-sm font-medium ${Guide.color}`}>{Guide.desc}</p>
                    </div>
                  </div>
                </Card>
              );
            })()}

            {/* Settings Card */}
            <Card className="p-8 bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-[32px]">
              <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-8 flex items-center gap-3">
                <Zap size={28} className="text-[#1D9E75]" />
                Configure Your Practice Session
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                {/* Subject Selection */}
                <div className="space-y-3">
                  <label className="block text-sm font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-2">
                    <BookOpen size={16} className="text-[#1D9E75]" />
                    Subject
                  </label>
                  <select
                    value={selectedSubject}
                    onChange={(e) => {
                      setSelectedSubject(e.target.value);
                      setSelectedChapter('');
                    }}
                    className="w-full px-4 py-3 rounded-2xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white font-bold outline-none focus:ring-2 focus:ring-[#1D9E75] focus:border-transparent transition-all"
                  >
                    <option value="">Select Subject</option>
                    {user?.subjects.map((subject: string) => (
                      <option key={subject} value={subject}>{subject}</option>
                    ))}
                  </select>
                </div>

                {/* Chapter Selection */}
                <div className="space-y-3">
                  <label className="block text-sm font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-2">
                    <Brain size={16} className="text-[#1D9E75]" />
                    Chapter
                  </label>
                  <select
                    value={selectedChapter}
                    onChange={(e) => setSelectedChapter(e.target.value)}
                    className="w-full px-4 py-3 rounded-2xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white font-bold outline-none focus:ring-2 focus:ring-[#1D9E75] focus:border-transparent transition-all disabled:opacity-50"
                    disabled={!selectedSubject}
                  >
                    <option value="">Select Chapter</option>
                    {chapters.map((chapter: string, index: number) => (
                      <option key={index} value={chapter}>{chapter}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Question Type Selection removed - variety is automatically mixed */}

              {/* Number of Questions */}
              <div className="space-y-4 mb-8">
                <label className="block text-sm font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-2">
                  <TrendingUp size={16} className="text-[#1D9E75]" />
                  Number of Questions: <span className="text-[#1D9E75] ml-2">{numQuestions}</span>
                </label>
                <div className="flex flex-wrap items-center gap-3">
                  {[3, 5, 10].map((num) => (
                    <button
                      key={num}
                      onClick={() => setNumQuestions(num)}
                      className={`p-3 rounded-2xl border-2 font-black text-lg w-16 h-16 transition-all transform hover:scale-110 flex items-center justify-center ${numQuestions === num
                        ? 'border-[#1D9E75] bg-[#1D9E75]/10 text-[#1D9E75]'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                        }`}
                    >
                      {num}
                    </button>
                  ))}
                </div>
              </div>

              {/* Question Rigor / Source Selection */}
              <div className="space-y-4 mb-8 p-6 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/10 dark:to-teal-900/10 rounded-2xl border-2 border-emerald-200 dark:border-emerald-800">
                <label className="block text-sm font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-2">
                  <BookOpen size={16} className="text-[#1D9E75]" />
                  Question Variety Style
                </label>
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    type="button"
                    onClick={() => setStickToTextbook(true)}
                    className={`flex-1 p-4 rounded-2xl border-2 font-bold text-sm transition-all text-center flex flex-col justify-center items-center gap-1 ${stickToTextbook
                      ? 'border-[#1D9E75] bg-emerald-50 dark:bg-emerald-950/20 text-[#1D9E75]'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/50 hover:border-[#1D9E75]/50'
                      }`}
                  >
                    <span className="text-lg">📖</span>
                    <span>Textbook exercises</span>
                    <span className="text-[10px] opacity-75 font-medium">Syllabus & exercises strictly from NCERT</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setStickToTextbook(false)}
                    className={`flex-1 p-4 rounded-2xl border-2 font-bold text-sm transition-all text-center flex flex-col justify-center items-center gap-1 ${!stickToTextbook
                      ? 'border-[#1D9E75] bg-emerald-50 dark:bg-emerald-950/20 text-[#1D9E75]'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/50 hover:border-[#1D9E75]/50'
                      }`}
                  >
                    <span className="text-lg">🎨</span>
                    <span>Unique creative questions</span>
                    <span className="text-[10px] opacity-75 font-medium">HOTS & competency-based board questions</span>
                  </button>
                </div>
              </div>

              {/* Timed Mode */}
              <div className="space-y-4 mb-8 p-6 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 rounded-2xl border-2 border-amber-200 dark:border-amber-800">
                <label className="block text-sm font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-2">
                  <Clock size={16} className="text-amber-600" />
                  Timed Board Mode (Optional)
                </label>
                <button
                  onClick={() => setTimedMode((prev) => !prev)}
                  className={`w-full p-4 rounded-2xl border-2 font-bold transition-all ${timedMode
                    ? 'border-amber-500 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
                    : 'border-amber-300 dark:border-amber-700 text-slate-700 dark:text-slate-400'
                    }`}
                >
                  {timedMode ? '⏱️ Timed Mode: ACTIVE' : '⏱️ Timed Mode: OFF'}
                </button>
                {timedMode && (
                  <div className="flex flex-wrap gap-2">
                    {[10, 15, 20, 30].map((mins) => (
                      <button
                        key={mins}
                        onClick={() => setTimeMinutes(mins)}
                        className={`flex-1 p-3 rounded-xl border-2 font-bold text-sm transition-all ${timeMinutes === mins
                          ? 'border-amber-500 bg-amber-100 dark:bg-amber-900/30 text-amber-700'
                          : 'border-amber-300 dark:border-amber-700 text-slate-600'
                          }`}
                      >
                        {mins} min
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Start Button */}
              <Button
                className="w-full py-5 text-lg font-black bg-gradient-to-r from-[#1D9E75] to-emerald-600 hover:from-[#16805d] hover:to-emerald-700 text-white rounded-2xl shadow-2xl shadow-[#1D9E75]/30 transition-all transform hover:scale-105 active:scale-95"
                onClick={handleStartSession}
                disabled={isLoading || !selectedSubject || !selectedChapter}
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                    Generating Questions...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <Zap size={20} />
                    Start Practice Session
                  </span>
                )}
              </Button>

              {isLoading && generationPreview && (
                <div className="mt-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-4">
                  <p className="text-xs font-black uppercase tracking-wider text-[#1D9E75] mb-2">Streaming Question Builder</p>
                  <MarkdownContent content={generationPreview} className="text-sm text-slate-700 dark:text-slate-300" />
                </div>
              )}
            </Card>
          </div>
        ) : sessionFinished ? (
          <Card className="p-12 text-center bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 border-2 border-emerald-200 dark:border-emerald-800 rounded-[40px]">
            <div className="w-24 h-24 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mx-auto mb-8">
              <Award className="text-emerald-600 dark:text-emerald-400" size={48} />
            </div>
            <h2 className="text-4xl font-black text-slate-900 dark:text-white mb-4">Session Complete!</h2>
            <p className="text-lg text-slate-600 dark:text-slate-400 mb-12 font-bold">
              Amazing effort on {selectedChapter}! Your answers have been graded.
            </p>

            {timedMode && mockRecoveryPlan.length > 0 && (
              <Card className="mb-8 p-6 rounded-[24px] bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-200 dark:border-blue-800 text-left max-w-3xl mx-auto">
                <p className="text-xs font-black uppercase tracking-widest text-blue-700 dark:text-blue-300 mb-2">Performance Recovery Plan</p>
                <p className="text-sm font-bold text-blue-900 dark:text-blue-100 mb-3">48-hour recovery plan generated automatically:</p>
                <div className="space-y-2">
                  {mockRecoveryPlan.map((step) => (
                    <p key={step} className="text-sm text-blue-900 dark:text-blue-100">• {step}</p>
                  ))}
                </div>
              </Card>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl mx-auto mb-8">
              <div className="p-6 bg-white dark:bg-slate-800 rounded-3xl border-2 border-emerald-200 dark:border-emerald-800">
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-2 font-bold uppercase tracking-wider">Questions Attempted</p>
                <p className="text-4xl font-black text-[#1D9E75]">{attemptedQuestions}/{questions.length}</p>
              </div>
              <div className="p-6 bg-white dark:bg-slate-800 rounded-3xl border-2 border-emerald-200 dark:border-emerald-800">
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-2 font-bold uppercase tracking-wider">Score (Attempted)</p>
                <p className="text-4xl font-black text-slate-900 dark:text-white">{score}/{attemptedTotalMarks}</p>
              </div>
              <div className="p-6 bg-white dark:bg-slate-800 rounded-3xl border-2 border-emerald-200 dark:border-emerald-800">
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-2 font-bold uppercase tracking-wider">Score (Full Set)</p>
                <p className="text-4xl font-black text-slate-900 dark:text-white">{score}/{fullSetTotalMarks}</p>
              </div>
            </div>

            <p className="text-sm text-slate-500 dark:text-slate-400 mb-12 font-semibold">
              {timedMode
                ? 'Timed mode ended. Unattempted questions were counted as not attempted.'
                : 'Session completed. Showing both attempted score and full-set score.'}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Button
                className="px-8 py-4 bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white font-black rounded-2xl hover:bg-slate-300 dark:hover:bg-slate-600"
                onClick={() => navigate('/dashboard')}
              >
                Back to Home
              </Button>
              <Button
                className="px-8 py-4 bg-[#1D9E75] hover:bg-[#16805d] text-white font-black rounded-2xl shadow-lg"
                onClick={() => {
                  setQuestions([]);
                  setSessionFinished(false);
                  setScore(0);
                  setAttemptedQuestions(0);
                  setAttemptedTotalMarks(0);
                  setUserAnswers({});
                  setAllGrades({});
                }}
              >
                New Session
              </Button>
            </div>

            {/* Detailed Results List */}
            <div className="mt-16 space-y-12 text-left max-w-4xl mx-auto">
              <h3 className="text-2xl font-black text-slate-900 dark:text-white border-b-4 border-[#1D9E75] inline-block pb-1">Question-by-Question Review</h3>
              {questions.map((q, idx) => {
                const grade = allGrades[idx];
                const ans = userAnswers[idx];
                if (!grade) return null;
                
                return (
                  <div key={idx} className="space-y-6">
                    <div className="flex items-center gap-3">
                      <span className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-black text-sm">{idx + 1}</span>
                      <div className="h-1 flex-1 bg-slate-100 dark:bg-slate-800 rounded-full" />
                      <span className={`font-black text-sm px-3 py-1 rounded-full ${grade.marks_awarded === grade.total_marks ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                        {grade.marks_awarded} / {grade.total_marks} Marks
                      </span>
                    </div>

                    <div className="p-6 bg-white dark:bg-slate-800 rounded-2xl border-2 border-slate-100 dark:border-slate-700">
                      <p className="text-xs font-black uppercase text-slate-400 mb-2 tracking-widest">Question</p>
                      <MarkdownContent content={q} className="text-slate-900 dark:text-white font-bold" />
                    </div>

                    <div className="p-6 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border-2 border-slate-100 dark:border-slate-700">
                      <p className="text-xs font-black uppercase text-slate-400 mb-2 tracking-widest">Your Answer</p>
                      <p className="text-slate-700 dark:text-slate-300 font-medium whitespace-pre-wrap">{ans || "No answer provided."}</p>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Main Box: Model Answer */}
                      <Card className="p-6 bg-emerald-50 dark:bg-emerald-900/10 border-2 border-emerald-200 dark:border-emerald-800 rounded-3xl">
                        <div className="flex items-center gap-2 mb-4 text-emerald-700 dark:text-emerald-400">
                          <CheckCircle2 size={18} />
                          <p className="text-sm font-black uppercase tracking-widest">Model Answer</p>
                        </div>
                        <MarkdownContent content={grade.model_answer} className="text-slate-800 dark:text-slate-200 text-sm font-medium leading-relaxed" />
                      </Card>

                      {/* Feedback & Tips Box */}
                      <div className="space-y-4">
                        <Card className="p-6 bg-sky-50 dark:bg-sky-900/10 border-2 border-sky-200 dark:border-sky-800 rounded-3xl">
                          <div className="flex items-center gap-2 mb-4 text-sky-700 dark:text-sky-400">
                            <Lightbulb size={18} />
                            <p className="text-sm font-black uppercase tracking-widest">Expert Tips & Feedback</p>
                          </div>
                          <MarkdownContent content={grade.feedback} className="text-slate-800 dark:text-slate-200 text-sm font-medium leading-relaxed" />
                        </Card>

                        {grade.micro_explanation && (
                          <Card className="p-6 bg-amber-50 dark:bg-amber-900/10 border-2 border-amber-200 dark:border-amber-800 rounded-3xl">
                            <div className="flex items-center gap-2 mb-4 text-amber-700 dark:text-amber-400">
                              <Brain size={18} />
                              <p className="text-sm font-black uppercase tracking-widest">Concept Hint</p>
                            </div>
                            <p className="text-slate-800 dark:text-slate-200 text-sm font-medium leading-relaxed">{grade.micro_explanation}</p>
                          </Card>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* Progress Header */}
            <Card className="p-6 bg-gradient-to-r from-slate-900 to-slate-800 dark:from-slate-900 dark:to-slate-800 text-white rounded-[24px] border-none shadow-xl">
              <div className="flex items-center justify-between gap-6 flex-wrap">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-[#1D9E75]/20 rounded-2xl">
                    <Target className="text-[#1D9E75]" size={24} />
                  </div>
                  <div>
                    <p className="text-sm text-slate-300 font-bold uppercase tracking-wider">Question {currentQuestionIndex + 1} of {questions.length}</p>
                    <p className="text-lg font-black text-white">{selectedSubject} • {selectedChapter}</p>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  {/* Progress Bar */}
                  <div className="hidden md:flex items-center gap-3">
                    <div className="w-32 h-2 bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-[#1D9E75] to-emerald-500 transition-all"
                        style={{ width: `${((currentQuestionIndex + 1) / questions.length) * 100}%` }}
                      />
                    </div>
                    <p className="text-xs font-black text-[#1D9E75]">{Math.round(((currentQuestionIndex + 1) / questions.length) * 100)}%</p>
                  </div>

                  {/* Score Box */}
                  <div className="p-3 bg-[#1D9E75]/20 rounded-2xl text-center min-w-[80px]">
                    <p className="text-xs text-slate-300 font-bold uppercase tracking-wider">Score</p>
                    <p className="text-2xl font-black text-[#1D9E75]">{score}</p>
                  </div>

                  {/* Timer */}
                  {timedMode && (
                    <div className={`p-3 rounded-2xl text-center min-w-[80px] ${timeLeft < 60
                      ? 'bg-red-500/20'
                      : 'bg-amber-500/20'
                      }`}>
                      <p className="text-xs text-slate-300 font-bold">⏱ Time</p>
                      <p className={`text-2xl font-black ${timeLeft < 60 ? 'text-red-400' : 'text-amber-400'
                        }`}>
                        {formatTime(timeLeft)}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </Card>

            {/* Question Card */}
            <Card className="p-10 bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-[32px] shadow-xl">
              <MarkdownContent content={questions[currentQuestionIndex]} className="text-slate-900 dark:text-white mb-8" />

              {!gradeResult ? (
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-3">
                      Your Answer
                    </label>
                    {(() => {
                      const currentQuestion = questions[currentQuestionIndex];
                      const parsedMcq = parseMcq(currentQuestion);
                      if (parsedMcq) {
                        return (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {parsedMcq.options.map((opt) => {
                              const isSelected = userAnswer.toUpperCase() === opt.label;
                              return (
                                <button
                                  key={opt.label}
                                  type="button"
                                  onClick={() => setUserAnswer(opt.label)}
                                  className={`p-5 rounded-2xl border-2 font-bold text-left transition-all flex gap-4 items-center ${
                                    isSelected
                                      ? 'border-[#1D9E75] bg-[#1D9E75]/10 text-slate-900 dark:text-white ring-2 ring-[#1D9E75]'
                                      : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-[#1D9E75]/50 bg-slate-50 dark:bg-slate-900/50'
                                  }`}
                                >
                                  <span className={`w-8 h-8 rounded-full flex items-center justify-center font-black ${
                                    isSelected ? 'bg-[#1D9E75] text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                                  }`}>
                                    {opt.label}
                                  </span>
                                  <span>{opt.text}</span>
                                </button>
                              );
                            })}
                          </div>
                        );
                      }

                      const parsedBlank = parseBlank(currentQuestion);
                      if (parsedBlank) {
                        return (
                          <div className="space-y-4">
                            <p className="text-slate-600 dark:text-slate-400 text-sm italic">Type the missing word or phrase to fill in the blank:</p>
                            <input
                              type="text"
                              value={userAnswer}
                              onChange={(e) => setUserAnswer(e.target.value)}
                              placeholder="Type your answer here..."
                              className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white rounded-2xl border-2 border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-[#1D9E75] focus:border-transparent outline-none transition-all font-bold text-lg"
                            />
                          </div>
                        );
                      }

                      const parsedMatch = parseMatch(currentQuestion);
                      if (parsedMatch) {
                        const currentSelections: Record<string, string> = {};
                        const pairs = userAnswer.split(',');
                        for (const p of pairs) {
                          const split = p.split('-');
                          if (split.length === 2) {
                            currentSelections[split[0].trim()] = split[1].trim().toUpperCase();
                          }
                        }

                        const handleSelectMatch = (colAKey: string, colBVal: string) => {
                          const updated = { ...currentSelections };
                          if (colBVal) {
                            updated[colAKey] = colBVal;
                          } else {
                            delete updated[colAKey];
                          }
                          const newAnsStr = Object.entries(updated)
                            .map(([k, v]) => `${k}-${v}`)
                            .join(', ');
                          setUserAnswer(newAnsStr);
                        };

                        return (
                          <div className="space-y-6">
                            <p className="text-slate-600 dark:text-slate-400 text-sm italic">For each item in Column A, select the matching option from Column B:</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                              <div className="space-y-4">
                                <h4 className="font-black text-slate-900 dark:text-white border-b-2 pb-2">Column A</h4>
                                {parsedMatch.columnA.map((item) => {
                                  const match = item.match(/^(\d+)[\)\.]\s*(.*)$/);
                                  if (!match) return null;
                                  const key = match[1];
                                  const text = match[2];
                                  const selectedVal = currentSelections[key] || '';

                                  return (
                                    <div key={key} className="flex items-center gap-4 justify-between bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                                      <span className="font-bold text-slate-800 dark:text-slate-200">{key}. {text}</span>
                                      <select
                                        value={selectedVal}
                                        onChange={(e) => handleSelectMatch(key, e.target.value)}
                                        className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold outline-none focus:ring-2 focus:ring-[#1D9E75]"
                                      >
                                        <option value="">Select...</option>
                                        {parsedMatch.columnB.map((bItem) => {
                                          const bMatch = bItem.match(/^([A-Z])[\)\.]\s*(.*)$/i);
                                          if (!bMatch) return null;
                                          const letter = bMatch[1].toUpperCase();
                                          return (
                                            <option key={letter} value={letter}>
                                              {bItem}
                                            </option>
                                          );
                                        })}
                                      </select>
                                    </div>
                                  );
                                })}
                              </div>

                              <div className="space-y-4">
                                <h4 className="font-black text-slate-900 dark:text-white border-b-2 pb-2">Column B</h4>
                                <div className="space-y-2 bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                                  {parsedMatch.columnB.map((item, idx) => (
                                    <div key={idx} className="p-2 font-medium text-sm text-slate-700 dark:text-slate-300">
                                      {item}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      }

                      return (
                        <textarea
                          value={userAnswer}
                          onChange={(e) => setUserAnswer(e.target.value)}
                          placeholder="Write your answer here. Think carefully and provide a complete, well-structured response..."
                          className="w-full h-40 p-6 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white rounded-2xl border-2 border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-[#1D9E75] focus:border-transparent outline-none transition-all resize-none text-base font-medium"
                        />
                      );
                    })()}
                  </div>
                  <div className="flex justify-end">
                    <div className="flex flex-wrap gap-3 justify-end">
                      <Button
                        variant="outline"
                        className="px-6 py-4 font-black rounded-2xl"
                        onClick={handleExplainQuestion}
                        disabled={isExplaining || !questions[currentQuestionIndex]}
                      >
                        {isExplaining ? 'Explaining...' : 'Explain This Question'}
                      </Button>
                      <Button
                        className="px-8 py-4 bg-[#1D9E75] hover:bg-[#16805d] text-white font-black rounded-2xl shadow-lg transition-all transform hover:scale-105 active:scale-95"
                        onClick={handleSubmitAndNext}
                        disabled={isGrading || !userAnswer.trim()}
                      >
                        <span className="flex items-center gap-2">
                          <ArrowRight size={18} />
                          {currentQuestionIndex < questions.length - 1 ? 'Next Question' : 'Finish Session'}
                        </span>
                      </Button>
                    </div>
                  </div>

                  {isSessionGrading && (
                    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-6">
                      <Card className="p-10 max-w-md w-full text-center bg-white dark:bg-slate-900 rounded-[40px] shadow-2xl">
                        <div className="w-20 h-20 bg-[#1D9E75]/10 rounded-full flex items-center justify-center mx-auto mb-6">
                          <div className="animate-spin rounded-full h-10 w-10 border-4 border-[#1D9E75] border-t-transparent"></div>
                        </div>
                        <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-2">Grading your session...</h3>
                        <p className="text-slate-500 font-medium">Clarity AI is evaluating your answers based on board patterns and NCERT precision.</p>
                      </Card>
                    </div>
                  )}

                  {isGrading && gradingPreview && (
                    <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-4">
                      <p className="text-xs font-black uppercase tracking-wider text-[#1D9E75] mb-2">Streaming Evaluation</p>
                      <MarkdownContent content={gradingPreview} className="text-sm text-slate-700 dark:text-slate-300" />
                    </div>
                  )}

                  {explainResult && (
                    <Card className="p-6 bg-slate-50 dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 rounded-[24px]">
                      <p className="text-xs font-black uppercase tracking-widest text-[#1D9E75] mb-3">Explain Mode</p>
                      <MarkdownContent content={explainResult} className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed" />
                    </Card>
                  )}
                </div>
              ) : (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  {/* Score Display */}
                  <div className={`p-6 rounded-2xl border-2 flex items-center justify-between ${gradeResult.marks_awarded === gradeResult.total_marks
                    ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-200'
                    : gradeResult.marks_awarded >= gradeResult.total_marks * 0.7
                      ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-200'
                      : 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700 text-red-800 dark:text-red-200'
                    }`}>
                    <div className="flex items-center gap-3">
                      <CheckCircle2 size={24} />
                      <span className="font-black text-lg">Score: {gradeResult.marks_awarded} / {gradeResult.total_marks}</span>
                    </div>
                    <span className="text-xs font-black uppercase tracking-widest">CBSE Style Grading</span>
                  </div>

                  {/* Feedback Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="p-6 bg-emerald-50 dark:bg-emerald-900/20 rounded-[24px] border-2 border-emerald-200 dark:border-emerald-800">
                      <h4 className="font-black text-emerald-700 dark:text-emerald-300 text-sm mb-4 uppercase tracking-widest flex items-center gap-2">
                        <CheckCircle2 size={18} />
                        Teacher's Praise
                      </h4>
                      <p className="text-sm text-emerald-800 dark:text-emerald-200 font-medium leading-relaxed">
                        {gradeResult.feedback.split('Missing:')[0].replace('Good: ', '') || '✓ Great effort!'}
                      </p>
                    </div>
                    <div className="p-6 bg-red-50 dark:bg-red-900/20 rounded-[24px] border-2 border-red-200 dark:border-red-800">
                      <h4 className="font-black text-red-700 dark:text-red-300 text-sm mb-4 uppercase tracking-widest flex items-center gap-2">
                        <AlertCircle size={18} />
                        Needs Attention
                      </h4>
                      <p className="text-sm text-red-800 dark:text-red-200 font-medium leading-relaxed">
                        {gradeResult.feedback.split('Missing:')[1] || '✓ Nothing major! Keep it up.'}
                      </p>
                    </div>
                  </div>

                  {/* Model Answer */}
                  <div className="p-8 bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-[24px] shadow-xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                      <Lightbulb size={80} />
                    </div>
                    <div className="relative z-10">
                      <h4 className="font-black text-xs uppercase tracking-[0.2em] text-[#1D9E75] mb-4">✨ Model Answer by AI Tutor</h4>
                      <MarkdownContent content={gradeResult.model_answer} className="text-sm text-slate-200 font-medium leading-loose" />
                    </div>
                  </div>

                  {/* Pro Tip */}
                  <Card className="p-6 bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 border-2 border-blue-200 dark:border-blue-800 rounded-2xl">
                    <p className="text-sm font-bold text-blue-800 dark:text-blue-200 flex items-start gap-3">
                      <Lightbulb size={18} className="flex-shrink-0 mt-1 text-blue-600 dark:text-blue-400" />
                      <span>
                        💭 <strong>Reflection:</strong> Review this concept once more before your next study session to lock it into long-term memory. Consider creating a summary or flashcard.
                      </span>
                    </p>
                  </Card>

                  {(gradeResult.micro_explanation || gradeResult.related_question || gradeResult.flashcard_due || gradeResult.weak_skill) && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {gradeResult.micro_explanation && (
                        <div className="p-6 bg-sky-50 dark:bg-sky-900/20 rounded-[24px] border-2 border-sky-200 dark:border-sky-800">
                          <p className="text-xs font-black uppercase tracking-widest text-sky-700 dark:text-sky-300 mb-2">Micro Explanation</p>
                          <MarkdownContent content={gradeResult.micro_explanation} className="text-sm text-sky-900 dark:text-sky-100 font-medium leading-relaxed" />
                        </div>
                      )}
                      {gradeResult.related_question && (
                        <div className="p-6 bg-violet-50 dark:bg-violet-900/20 rounded-[24px] border-2 border-violet-200 dark:border-violet-800">
                          <p className="text-xs font-black uppercase tracking-widest text-violet-700 dark:text-violet-300 mb-2">Related Practice Question</p>
                          <MarkdownContent content={gradeResult.related_question} className="text-sm text-violet-900 dark:text-violet-100 font-medium leading-relaxed" />
                        </div>
                      )}
                      {gradeResult.flashcard_due && (
                        <div className="p-6 bg-amber-50 dark:bg-amber-900/20 rounded-[24px] border-2 border-amber-200 dark:border-amber-800">
                          <p className="text-xs font-black uppercase tracking-widest text-amber-700 dark:text-amber-300 mb-2">Flashcard Due</p>
                          <MarkdownContent content={gradeResult.flashcard_due} className="text-sm text-amber-900 dark:text-amber-100 font-medium leading-relaxed" />
                        </div>
                      )}
                      {gradeResult.weak_skill && (
                        <div className="p-6 bg-rose-50 dark:bg-rose-900/20 rounded-[24px] border-2 border-rose-200 dark:border-rose-800">
                          <p className="text-xs font-black uppercase tracking-widest text-rose-700 dark:text-rose-300 mb-2">Weak Skill</p>
                          <MarkdownContent content={gradeResult.weak_skill} className="text-sm text-rose-900 dark:text-rose-100 font-medium leading-relaxed" />
                        </div>
                      )}
                    </div>
                  )}

                  {doubtSignal && (
                    <Card className="p-6 bg-gradient-to-r from-rose-50 to-amber-50 dark:from-rose-900/20 dark:to-amber-900/20 border-2 border-rose-200 dark:border-rose-800 rounded-2xl">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div>
                          <p className="text-sm font-black text-rose-800 dark:text-rose-200">Auto Doubt Detector: {doubtSignal.title}</p>
                          <p className="text-xs text-rose-700 dark:text-rose-300 mt-1">{doubtSignal.clue}</p>
                        </div>
                        <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase ${doubtSignal.confidence === 'high' ? 'bg-rose-200 text-rose-800' : 'bg-amber-200 text-amber-800'}`}>
                          {doubtSignal.confidence}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          className="rounded-xl text-xs"
                          onClick={() => navigate('/ask', { state: { subject: selectedSubject, chapter: selectedChapter } })}
                        >
                          Learn This Question (AI)
                        </Button>
                        <Button
                          variant="outline"
                          className="rounded-xl text-xs"
                          onClick={() => navigate('/practice', { state: { subject: selectedSubject, chapter: selectedChapter, questionType, numQuestions: 3 } })}
                        >
                          Practice Similar Now
                        </Button>
                        <Button
                          variant="outline"
                          className="rounded-xl text-xs"
                          onClick={() => navigate('/library', { state: { subject: selectedSubject, chapter: selectedChapter } })}
                        >
                          Review Chapter Source
                        </Button>
                      </div>
                    </Card>
                  )}

                  {/* Next Button */}
                  <div className="flex justify-end pt-4">
                    <Button
                      className="px-8 py-4 bg-[#1D9E75] hover:bg-[#16805d] text-white font-black rounded-2xl shadow-lg transition-all transform hover:scale-105 active:scale-95 flex items-center gap-2"
                      onClick={handleNextQuestion}
                    >
                      {currentQuestionIndex < questions.length - 1 ? (
                        <>
                          <span>Next Question</span>
                          <ArrowRight size={20} />
                        </>
                      ) : (
                        <>
                          <span>Finish Session</span>
                          <Award size={20} />
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          </div>
        )}
      </div>
      <PremiumModal
        isOpen={showPremiumModal}
        onClose={() => setShowPremiumModal(false)}
        feature="Unlimited practice sessions"
      />
    </div>
  );
};
