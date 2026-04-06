export interface UserData {
  name: string;
  class: number;
  subjects: string[];
  school?: string;
  examBoard?: string;
  preferredLanguage?: string;
  preferredPace?: string;
  confidenceLevel?: string;
  revisionFrequency?: string;
  parentEmail?: string;
  isPremium?: boolean;
  questionsToday?: number;
  uploadsToday?: number;
  streak?: number;
  totalQuestions?: number;
  chaptersStudied?: number;
  averageScore?: number;
  learningStyle?: string;
  goal?: string;
  studyHours?: string;
  focusAreas?: string;
}

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  examTip?: string;
  timestamp: number;
}

export interface ChatSession {
  subject: string;
  chapter: string;
  messages: Message[];
  timestamp: number;
}

export interface PracticeTest {
  subject: string;
  chapter: string;
  questionType: string;
  questions: Array<{
    question: string;
    marks: number;
    userAnswer?: string;
    feedback?: string;
    marksAwarded?: number;
    modelAnswer?: string;
  }>;
  currentQuestion: number;
  score?: number;
  completed: boolean;
}

export interface ActivityRecord {
  type: 'question' | 'practice' | 'upload';
  subject: string;
  chapter?: string;
  timestamp: number;
  description: string;
}

export interface SubjectStats {
  subject: string;
  questionsAsked: number;
  chaptersStudied: number;
  averageScore?: number;
}

export interface BookmarkItem {
  id: string;
  type: 'answer' | 'flashcard' | 'summary' | 'formula' | 'plan' | 'practice' | 'upload';
  subject: string;
  chapter: string;
  question?: string;
  answer: string;
  createdAt: number;
}
