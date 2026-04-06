import axios from 'axios';

// ── Base URL ──────────────────────────────────────────────────────────────────
// Uses VITE_API_URL env var in production, falls back to localhost:8000
// Backend main.py runs on 8000 — do NOT change to 8001
const API_BASE_URL = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api/v1`
  : 'http://localhost:8000/api/v1';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach X-User-ID from localStorage to every request
apiClient.interceptors.request.use((config) => {
  const userStr = localStorage.getItem('ncertai_user');
  if (userStr) {
    try {
      const user = JSON.parse(userStr);
      if (user.name) {
        config.headers['X-User-ID'] = user.name;
      }
    } catch (e) {
      console.error('Error parsing user data from localStorage', e);
    }
  }
  return config;
});

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AskQuestionPayload {
  class_num: string;
  subject: string;
  chapter: string;
  question: string;
  conversation_history?: Array<{ role: string; content: string }>;
}

export interface AskQuestionResponse {
  answer: string;
  tokens_used?: number;
}

export interface PracticePayload {
  class_num: string;
  subject: string;
  chapter: string;
  question_type: string;
  num_questions: number;
}

export interface PracticeResponse {
  questions: string[];
}

export interface GradePayload {
  question: string;
  user_answer: string;
  class_num: string;
  subject: string;
  marks_available: number;
}

export interface GradeResponse {
  marks_awarded: number;
  total_marks: number;
  feedback: string;
  model_answer: string;
}

export interface UploadResponse {
  analysis: string;
  extracted_text: string;
}

export interface StatsResponse {
  total_questions: number;
  questions_today: number;
  subjects_studied: string[];
  weak_topics: string[];
  streak_days: number;
  recent_activity: Array<{
    action: string;
    subject: string;
    chapter: string;
    timestamp: string;
    score?: number;
  }>;
}

// ── API Functions ─────────────────────────────────────────────────────────────

export const askQuestion = async (
  payload: AskQuestionPayload
): Promise<AskQuestionResponse> => {
  const response = await apiClient.post('/chat/ask', payload);
  return response.data;
};

export const generatePractice = async (
  payload: PracticePayload
): Promise<PracticeResponse> => {
  const response = await apiClient.post('/practice/generate', payload);
  return response.data;
};

export const gradeAnswer = async (
  payload: GradePayload
): Promise<GradeResponse> => {
  const response = await apiClient.post('/practice/grade', payload);
  return response.data;
};

export const uploadFile = async (
  file: File,
  question: string
): Promise<UploadResponse> => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('question', question);

  const response = await apiClient.post('/upload/analyze', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
};

export const logProgress = async (payload: {
  user_id: string;
  action: string;
  subject: string;
  chapter: string;
  score?: number;
}) => {
  const response = await apiClient.post('/progress/log', payload);
  return response.data;
};

export const getStats = async (user_id: string): Promise<StatsResponse> => {
  const response = await apiClient.get(`/progress/stats/${user_id}`);
  return response.data;
};

export const getParentReport = async (user_id: string): Promise<{ report: string }> => {
  const response = await apiClient.get(`/progress/report/${user_id}`);
  return response.data;
};
