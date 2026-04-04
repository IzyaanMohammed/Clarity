import axios from 'axios';

const API_BASE_URL = 'http://localhost:8001/api/v1';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add interceptor to include X-User-ID from localStorage
apiClient.interceptors.request.use((config) => {
  const userStr = localStorage.getItem('ncertai_user');
  if (userStr) {
    try {
      const user = JSON.parse(userStr);
      if (user.name) {
        config.headers['X-User-ID'] = user.name;
      }
    } catch (e) {
      console.error('Error parsing user data', e);
    }
  }
  return config;
});

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

export const askQuestion = async (payload: AskQuestionPayload): Promise<AskQuestionResponse> => {
  const response = await apiClient.post('/chat/ask', payload);
  return response.data;
};

export const generatePractice = async (payload: PracticePayload): Promise<PracticeResponse> => {
  const response = await apiClient.post('/practice/generate', payload);
  return response.data;
};

export const gradeAnswer = async (payload: GradePayload): Promise<GradeResponse> => {
  const response = await apiClient.post('/practice/grade', payload);
  return response.data;
};

export const uploadFile = async (file: File, question: string): Promise<UploadResponse> => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('question', question);

  const response = await apiClient.post('/upload/analyze', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
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

export const getStats = async (user_id: string) => {
  const response = await apiClient.get(`/progress/stats/${user_id}`);
  return response.data;
};
