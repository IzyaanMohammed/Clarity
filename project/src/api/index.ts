import axios from 'axios';
import { recordPerformanceMetric } from '../utils/analytics';
import { getAuthToken } from '../utils/storage';

// ── Base URL ──────────────────────────────────────────────────────────────────
// Uses VITE_API_URL env var in production, falls back to localhost:8000
// Backend main.py runs on 8000 — do NOT change to 8001
const API_BASE_URL = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api/v1`
  : '/api/v1';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach X-User-ID from localStorage to every request
apiClient.interceptors.request.use((config) => {
  const userStr = localStorage.getItem('ncertai_user');
  const token = getAuthToken();
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
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`;
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
  learner_profile?: Record<string, string>;
}

export interface AuthUserPayload {
  name: string;
  class: number;
  subjects: string[];
  school?: string;
  learningStyle?: string;
  goal?: string;
  studyHours?: string;
  focusAreas?: string;
  examBoard?: string;
  preferredLanguage?: string;
  preferredPace?: string;
  confidenceLevel?: string;
  revisionFrequency?: string;
  parentEmail?: string;
}

export interface AuthResponse {
  token: string;
  user: AuthUserPayload;
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

export interface PastPaperItem {
  id: string;
  class_num: string;
  subject: string;
  chapter: string;
  board: string;
  year: number;
  difficulty: string;
  questions: string[];
  pdf_url?: string;
  source_url?: string;
}

export interface PastPaperListResponse {
  papers: PastPaperItem[];
}

export interface PastPaperQuestionsResponse {
  paper: {
    id: string;
    year: number;
    board: string;
    subject: string;
    chapter: string;
    difficulty: string;
    pdf_url?: string;
    source_url?: string;
  };
  questions: string[];
}

export interface WorksheetItem {
  id: string;
  title: string;
  class_num: string;
  subject: string;
  chapter: string;
  question_type: 'past-paper' | 'mixed' | 'variety' | '1-mark' | '3-mark' | '5-mark';
  difficulty: string;
  num_questions: number;
  board: string;
  year: number;
  source_paper_id?: string;
  pdf_url?: string;
  source_url?: string;
  questions: string[];
}

export interface WorksheetListResponse {
  worksheets: WorksheetItem[];
}

export interface FlashcardPayload {
  class_num: string;
  subject: string;
  chapter: string;
  count: number;
}

export interface FlashcardItem {
  question: string;
  answer: string;
}

export interface FlashcardResponse {
  flashcards: FlashcardItem[];
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
  micro_explanation?: string;
  related_question?: string;
  flashcard_due?: string;
  weak_skill?: string;
}

export interface UploadResponse {
  analysis: string;
  extracted_text: string;
}

export interface OcrResponse {
  text: string;
  source: string;
}

export interface TextbookContentResponse {
  source_url: string;
  mirror_url: string;
  content: string;
}

export interface SummaryPayload {
  class_num: string;
  subject: string;
  chapter: string;
  detail_level?: 'short' | 'standard' | 'deep';
  max_points?: number;
  learner_profile?: Record<string, string>;
}

export interface ChapterSummaryResponse {
  summary: string;
}

export interface FormulaSheetResponse {
  sheet: string;
}

export interface DailyPlanPayload {
  class_num: string;
  subjects: string[];
  weak_topics?: string[];
  exam_date?: string;
  task_count?: number;
  plan_depth?: 'lite' | 'balanced' | 'intensive';
  learner_profile?: Record<string, string>;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const isRetryableStatus = (status: number) => status === 429 || status === 503 || status === 504;

const safeParseErrorDetail = async (response: Response): Promise<string> => {
  try {
    const data = await response.json() as { detail?: string; message?: string };
    return data?.detail || data?.message || '';
  } catch {
    return '';
  }
};

const streamEndpoint = async (
  path: string,
  payload: unknown,
  onToken: (token: string) => void
): Promise<void> => {
  const userStr = localStorage.getItem('ncertai_user');
  const token = getAuthToken();
  let userId = '';
  if (userStr) {
    try {
      const user = JSON.parse(userStr);
      userId = user?.name || '';
    } catch {
      userId = '';
    }
  }

  let response: Response | null = null;
  let attempts = 0;
  const maxAttempts = 3;

  while (attempts < maxAttempts) {
    attempts += 1;
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(userId ? { 'X-User-ID': userId } : {}),
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload),
    });

    if (response.ok && response.body) {
      break;
    }

    if (!isRetryableStatus(response.status) || attempts >= maxAttempts) {
      const detail = await safeParseErrorDetail(response);
      const reason = detail || `Streaming request failed (${response.status}).`;
      throw new Error(reason);
    }

    const retryAfter = Number(response.headers.get('Retry-After') || 0);
    const baseDelay = retryAfter > 0 ? retryAfter * 1000 : 800 * attempts;
    await sleep(baseDelay);
  }

  if (!response || !response.ok || !response.body) {
    throw new Error('Streaming request failed.');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split('\n\n');
    buffer = events.pop() || '';

    for (const event of events) {
      if (!event.startsWith('data: ')) continue;
      const jsonStr = event.replace('data: ', '').trim();
      if (!jsonStr) continue;

      const parsed = JSON.parse(jsonStr) as { token: string; done: boolean };
      if (parsed.token) onToken(parsed.token);
      if (parsed.done) return;
    }
  }
};

const streamAsTyping = async (
  text: string,
  onToken: (token: string) => void,
  chunkSize = 20,
  delayMs = 12
): Promise<void> => {
  if (!text) return;
  for (let i = 0; i < text.length; i += chunkSize) {
    onToken(text.slice(i, i + chunkSize));
    await sleep(delayMs);
  }
};

const getCurrentUsername = (): string => {
  const userStr = localStorage.getItem('ncertai_user');
  if (!userStr) {
    throw new Error('User not found. Please login again.');
  }
  try {
    const user = JSON.parse(userStr) as { name?: string };
    if (!user?.name) {
      throw new Error('User not found. Please login again.');
    }
    return user.name;
  } catch {
    throw new Error('User not found. Please login again.');
  }
};

export interface DailyPlanResponse {
  plan: string;
}

export interface VideoStoryboardPayload {
  class_num: string;
  subject: string;
  chapter: string;
  topic: string;
  duration_seconds?: number;
  style?: string;
  broll_mode?: 'minimal' | 'balanced' | 'aggressive';
  montage_level?: 'single' | 'light' | 'dynamic';
  min_external_segments?: number;
}

export interface GeneratedVideoResult {
  blob: Blob;
  meta: {
    externalVideoCount: number;
    montageSegments: number;
    brollMode: string;
    montageLevel: string;
    minExternalSegments: number;
  };
}

export interface MindmapPayload {
  class_num: string;
  subject: string;
  chapter: string;
  topic: string;
  depth?: 'lite' | 'balanced' | 'deep';
  image_style?: string;
}

export interface StatsResponse {
  total_questions: number;
  questions_today: number;
  subjects_studied: string[];
  weak_topics: string[];
  streak_days: number;
  total_practice_attempts?: number;
  avg_practice_score?: number;
  accuracy_rate?: number;
  estimated_study_minutes?: number;
  recent_activity: Array<{
    action: string;
    subject: string;
    chapter: string;
    timestamp: string;
    score?: number;
  }>;
}

export interface DailyMissionTask {
  id: string;
  kind: 'learn' | 'practice' | 'review';
  title: string;
  reason: string;
  subject: string;
  chapter: string;
  readiness_score?: number;
  priority?: 'high' | 'medium' | 'low' | string;
  duration_minutes: number;
  destination: 'library' | 'practice' | 'ask';
  route: '/library' | '/practice' | '/ask';
  route_state: Record<string, unknown>;
}

export interface ChapterRankingItem {
  chapter: string;
  readiness_score: number;
  accuracy: number;
  recency: number;
  speed: number;
  confidence: number;
  priority: 'high' | 'medium' | 'low';
}

export interface DailyMissionResponse {
  mission_id: string;
  date: string;
  headline: string;
  summary: string;
  confidence: 'high' | 'medium' | 'focused';
  estimated_total_minutes: number;
  chapter_ranking?: ChapterRankingItem[];
  tasks: DailyMissionTask[];
}

export interface ChapterReadinessResponse {
  chapter: string;
  readiness_score: number;
  accuracy: number;
  recency: number;
  speed: number;
  confidence: number;
  priority: 'high' | 'medium' | 'low';
}

export interface ResourceStackResponse {
  chapter: string;
  subject: string;
  textbook_section: string;
  explanation: string;
  worksheet: {
    title: string;
    question_type: string;
    num_questions: number;
    route: string;
    state: Record<string, unknown>;
  };
  test: {
    title: string;
    question_type: string;
    num_questions: number;
    route: string;
    state: Record<string, unknown>;
  };
}

export interface StudyNotificationItem {
  title: string;
  message: string;
  severity: 'high' | 'medium' | 'low';
  action: string;
}

export interface StudyNotificationResponse {
  notifications: StudyNotificationItem[];
}

export interface MockScheduleResponse {
  next_mock_date: string;
  difficulty: 'easy' | 'medium' | 'hard';
  readiness_score: number;
  weak_skills: string[];
  recovery_plan: string[];
}

export interface CurriculumCatalogResponse {
  catalog: Record<string, Record<string, string[]>>;
}

// ── Analytics Helpers ────────────────────────────────────────────────────────

/**
 * Helper to automatically record study activity performance
 */
export function recordStudyActivity(
  type: 'question' | 'practice' | 'flashcard' | 'upload',
  subject: string,
  chapter: string,
  performance: number = 75, // 0-100
  timeSpent: number = 300000, // milliseconds, default 5 min
  difficulty: 'easy' | 'medium' | 'hard' = 'medium'
): void {
  try {
    recordPerformanceMetric({
      type,
      subject,
      chapter,
      timestamp: Date.now(),
      performance,
      timeSpent,
      difficulty,
    });
  } catch (error) {
    console.error('Failed to record analytics:', error);
  }
}

// ── API Functions ─────────────────────────────────────────────────────────────

export const askQuestion = async (
  payload: AskQuestionPayload
): Promise<AskQuestionResponse> => {
  const response = await apiClient.post('/chat/ask', payload);
  return response.data;
};

export const registerUser = async (payload: {
  profile: AuthUserPayload;
  password: string;
}): Promise<AuthResponse> => {
  const response = await apiClient.post('/auth/register', payload);
  return response.data;
};

export const loginUser = async (payload: {
  name: string;
  password: string;
}): Promise<AuthResponse> => {
  const response = await apiClient.post('/auth/login', payload);
  return response.data;
};

export const getMyProfile = async (): Promise<AuthUserPayload> => {
  const response = await apiClient.get('/auth/me');
  return response.data;
};

export const updateMyProfile = async (profile: AuthUserPayload): Promise<{ status: string }> => {
  const response = await apiClient.put('/auth/me', profile);
  return response.data;
};

export const logoutUser = async (): Promise<{ status: string }> => {
  const response = await apiClient.post('/auth/logout');
  return response.data;
};

export const getCurriculumCatalog = async (): Promise<CurriculumCatalogResponse> => {
  const response = await apiClient.get('/auth/curriculum');
  return response.data;
};

export const saveMaterialToDatabase = async (payload: {
  id: string;
  type: string;
  title: string;
  subject?: string;
  chapter?: string;
  content?: string;
  url?: string;
  imageDataUrl?: string;
  createdAt: number;
}): Promise<{ status: string }> => {
  const response = await apiClient.post('/auth/materials', payload);
  return response.data;
};

export const getMaterialsFromDatabase = async (): Promise<{ materials: Array<Record<string, unknown>> }> => {
  const response = await apiClient.get('/auth/materials');
  return response.data;
};

export const syncUserSnapshot = async (payload: Record<string, unknown>): Promise<{ status: string }> => {
  const response = await apiClient.post('/auth/snapshot', { payload });
  return response.data;
};

export const getUserSnapshot = async (): Promise<{ payload: Record<string, unknown> }> => {
  const response = await apiClient.get('/auth/snapshot');
  return response.data;
};

export const askQuestionStream = async (
  payload: AskQuestionPayload,
  onToken: (token: string) => void
): Promise<void> => {
  try {
    await streamEndpoint('/chat/ask-stream', payload, onToken);
  } catch {
    const fallback = await askQuestion(payload);
    await streamAsTyping(
      fallback.answer || 'I could not stream the response, but here is the best available answer.',
      onToken
    );
  }
};

export const generatePractice = async (
  payload: PracticePayload
): Promise<PracticeResponse> => {
  const response = await apiClient.post('/practice/generate', payload);
  return response.data;
};

export const generatePracticeStream = async (
  payload: PracticePayload,
  onToken: (token: string) => void
): Promise<void> => {
  try {
    await streamEndpoint('/practice/generate-stream', payload, onToken);
  } catch {
    const fallback = await generatePractice(payload);
    const text = fallback.questions.map((q, i) => `${i + 1}. ${q}`).join('\n');
    await streamAsTyping(text, onToken);
  }
};

export const gradeAnswer = async (
  payload: GradePayload
): Promise<GradeResponse> => {
  const response = await apiClient.post('/practice/grade', payload);
  return response.data;
};

export const gradeAnswerStream = async (
  payload: GradePayload,
  onToken: (token: string) => void
): Promise<void> => {
  try {
    await streamEndpoint('/practice/grade-stream', payload, onToken);
  } catch {
    const fallback = await gradeAnswer(payload);
    const text = [
      `MARKS: ${fallback.marks_awarded}/${fallback.total_marks}`,
      `WHAT WAS GOOD: ${fallback.feedback.split('Missing:')[0].replace(/^Good:\s*/i, '').trim()}`,
      `WHAT WAS MISSING: ${fallback.feedback.split('Missing:')[1]?.trim() || 'Review chapter concepts and key terms.'}`,
      `MODEL ANSWER: ${fallback.model_answer}`,
    ].join('\n');
    await streamAsTyping(text, onToken);
  }
};

export const explainQuestion = async (payload: {
  question: string;
  chapter: string;
  subject: string;
}): Promise<{ explanation: string }> => {
  const response = await apiClient.get('/practice/explain-question', { params: payload });
  return response.data;
};

export const generateFlashcards = async (
  payload: FlashcardPayload
): Promise<FlashcardResponse> => {
  const response = await apiClient.post('/practice/flashcards', payload);
  return response.data;
};

export const generateFlashcardsStream = async (
  payload: FlashcardPayload,
  onToken: (token: string) => void
): Promise<void> => {
  try {
    await streamEndpoint('/practice/flashcards-stream', payload, onToken);
  } catch {
    const fallback = await generateFlashcards(payload);
    const text = fallback.flashcards.map((c) => `Q: ${c.question} | A: ${c.answer}`).join('\n');
    await streamAsTyping(text, onToken);
  }
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

export const extractOcrText = async (file: File): Promise<OcrResponse> => {
  const formData = new FormData();
  formData.append('file', file);
  const response = await apiClient.post('/upload/ocr', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
};

export const logProgress = async (payload: {
  action: string;
  subject: string;
  chapter: string;
  score?: number;
}) => {
  const response = await apiClient.post('/progress/log', payload);
  return response.data;
};

export const getStats = async (): Promise<StatsResponse> => {
  const username = getCurrentUsername();
  const response = await apiClient.get(`/progress/stats/${username}`);
  return response.data;
};

export const getDailyMission = async (payload: {
  class_num: string;
  subjects: string[];
  available_minutes?: number;
}): Promise<DailyMissionResponse> => {
  const response = await apiClient.post('/progress/daily-mission', payload);
  return response.data;
};

export const getParentReport = async (): Promise<{ report: string }> => {
  const username = getCurrentUsername();
  const response = await apiClient.get(`/progress/report/${username}`);
  return response.data;
};

export const getChapterReadiness = async (payload: {
  chapter: string;
}): Promise<ChapterReadinessResponse> => {
  const response = await apiClient.get('/practice/chapter-readiness', { params: payload });
  return response.data;
};

export const getResourceStack = async (payload: {
  subject: string;
  chapter: string;
}): Promise<ResourceStackResponse> => {
  const response = await apiClient.get('/practice/resource-stack', { params: payload });
  return response.data;
};

export const getMockSchedule = async (): Promise<MockScheduleResponse> => {
  const response = await apiClient.get('/practice/mock-schedule');
  return response.data;
};

export const getStudyNotifications = async (): Promise<StudyNotificationResponse> => {
  const response = await apiClient.get('/practice/notifications');
  return response.data;
};

export const sendParentReport = async (payload: {
  parent_email: string;
}): Promise<{ status: string; message: string; report: string }> => {
  const response = await apiClient.post('/progress/report/send', payload);
  return response.data;
};

export const getTextbookContent = async (
  url: string,
  maxChars = 22000,
  chapterIndex?: number
): Promise<TextbookContentResponse> => {
  const response = await apiClient.get('/upload/textbook-content', {
    params: { url, max_chars: maxChars, ...(chapterIndex ? { chapter_index: chapterIndex } : {}) },
  });
  return response.data;
};

export const generateChapterSummary = async (
  payload: SummaryPayload
): Promise<ChapterSummaryResponse> => {
  const response = await apiClient.post('/summary/chapter-summary', payload);
  return response.data;
};

export const generateChapterSummaryStream = async (
  payload: SummaryPayload,
  onToken: (token: string) => void
): Promise<void> => {
  try {
    await streamEndpoint('/summary/chapter-summary-stream', payload, onToken);
  } catch {
    const fallback = await generateChapterSummary(payload);
    await streamAsTyping(fallback.summary, onToken);
  }
};

export const generateFormulaSheet = async (
  payload: SummaryPayload & { formula_count?: number; include_examples?: boolean }
): Promise<FormulaSheetResponse> => {
  const response = await apiClient.post('/summary/formula-sheet', payload);
  return response.data;
};

export const generateFormulaSheetStream = async (
  payload: SummaryPayload & { formula_count?: number; include_examples?: boolean },
  onToken: (token: string) => void
): Promise<void> => {
  try {
    await streamEndpoint('/summary/formula-sheet-stream', payload, onToken);
  } catch {
    const fallback = await generateFormulaSheet(payload);
    await streamAsTyping(fallback.sheet, onToken);
  }
};

export const generateDailyPlan = async (
  payload: DailyPlanPayload
): Promise<DailyPlanResponse> => {
  const response = await apiClient.post('/summary/daily-plan', payload);
  return response.data;
};

export const generateDailyPlanStream = async (
  payload: DailyPlanPayload,
  onToken: (token: string) => void
): Promise<void> => {
  try {
    await streamEndpoint('/summary/daily-plan-stream', payload, onToken);
  } catch {
    const fallback = await generateDailyPlan(payload);
    await streamAsTyping(fallback.plan, onToken);
  }
};

export const generateVideoStoryboardStream = async (
  payload: VideoStoryboardPayload,
  onToken: (token: string) => void
): Promise<void> => streamEndpoint('/creative/video-script-stream', payload, onToken);

export const generateVideoRenderPackage = async (
  payload: VideoStoryboardPayload
): Promise<{ package: string }> => {
  const response = await apiClient.post('/creative/video-render-package', payload);
  return response.data;
};

export const generateVideoFile = async (
  payload: VideoStoryboardPayload
): Promise<GeneratedVideoResult> => {
  const response = await apiClient.post('/creative/video-file', payload, {
    responseType: 'blob',
  });
  const headers = response.headers || {};
  const externalVideoCount = Number(headers['x-external-video-count'] || 0);
  const montageSegments = Number(headers['x-montage-segments'] || 0);
  const brollMode = String(headers['x-broll-mode'] || payload.broll_mode || 'balanced');
  const montageLevel = String(headers['x-montage-level'] || payload.montage_level || 'single');
  return {
    blob: response.data,
    meta: {
      externalVideoCount,
      montageSegments,
      brollMode,
      montageLevel,
      minExternalSegments: Number(payload.min_external_segments || 0),
    },
  };
};

export const generateManimVideoFile = async (
  payload: VideoStoryboardPayload
): Promise<Blob> => {
  const response = await apiClient.post('/creative/video-file-manim', payload, {
    responseType: 'blob',
  });
  return response.data;
};

export const generateMindmapStream = async (
  payload: MindmapPayload,
  onToken: (token: string) => void
): Promise<void> => streamEndpoint('/creative/mindmap-stream', payload, onToken);

export const generateMindmapImage = async (
  payload: MindmapPayload
): Promise<{
  image_url: string;
  prompt: string;
  notebook_blocks?: Array<{
    title: string;
    summary: string;
    details: string[];
    exam_link: string;
  }>;
}> => {
  const response = await apiClient.post('/creative/mindmap-image', payload);
  return response.data;
};

export const getPastPapers = async (params: {
  class_num: string;
  subject: string;
  chapter?: string;
  limit?: number;
}): Promise<PastPaperListResponse> => {
  const response = await apiClient.get('/practice/past-papers', { params });
  return response.data;
};

export const getPastPaperQuestions = async (
  paperId: string
): Promise<PastPaperQuestionsResponse> => {
  const response = await apiClient.get('/practice/past-paper-questions', {
    params: { paper_id: paperId },
  });
  return response.data;
};

export const getWorksheets = async (params: {
  class_num: string;
  subject: string;
  chapter?: string;
  limit?: number;
  refresh?: boolean;
}): Promise<WorksheetListResponse> => {
  const response = await apiClient.get('/practice/worksheets', { params });
  return response.data;
};
