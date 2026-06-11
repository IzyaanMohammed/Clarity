import axios from 'axios';
import { recordPerformanceMetric } from '../utils/analytics';
import { getAuthToken } from '../utils/storage';

export const getBaseUrl = (): string => {
  return import.meta.env.VITE_API_URL || '';
};

const API_BASE_URL = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api/v1`
  : '/api/v1';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

const getParentAuthToken = (): string => sessionStorage.getItem('clarity_parent_token') || '';

// Attach X-User-ID from localStorage to every request
apiClient.interceptors.request.use((config) => {
  const userStr = localStorage.getItem('ncertai_user');
  const token = getAuthToken();
  const hasExplicitAuthHeader = Boolean(
    (config.headers as any)?.Authorization ||
    (config.headers as any)?.authorization
  );
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
  // Keep any request-specific Authorization header (for example parent portal token)
  // and only apply student token when no explicit auth header was provided.
  if (token && !hasExplicitAuthHeader) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  return config;
});

export interface AskQuestionPayload {
  class_num: string;
  subject: string;
  chapter: string;
  question: string;
  conversation_history?: Array<{ role: string; content: string }>;
  learner_profile?: Record<string, string>;
  teacher_personality?: string;
}

// ── Types ─────────────────────────────────────────────────────────────────────


export interface AuthUserPayload {
  name: string;
  class: number | string;
  subjects: string[];
  subscriptionTier?: 'free' | 'pro' | 'pro_max';
  subscriptionStatus?: string;
  trialStart?: string | null;
  trialEnd?: string | null;
  subscriptionEnd?: string | null;
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
  teacherPersonality?: 'Strict' | 'Kind' | 'Lenient' | 'Enthusiastic';
  focusChapters?: Record<string, string[]>;
}

export interface AuthResponse {
  token: string;
  user: AuthUserPayload;
}

export interface BillingPlanConfig {
  label: string;
  monthly: string;
  yearly: string;
}

export interface BillingConfigResponse {
  provider: string;
  enabled: boolean;
  currency: string;
  base_url?: string;
  plans: Record<'pro' | 'pro_max', BillingPlanConfig>;
}

export interface BillingCheckoutResponse {
  checkout_url: string;
  session_id?: string;
  plan: 'pro' | 'pro_max';
  provider: string;
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
  teacher_personality?: string;
  stick_to_textbook?: boolean;
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
  teacher_personality?: string;
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
  teacher_personality?: string;
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
  teacher_personality?: string;
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
    const finalPayload = typeof payload === 'object' && payload !== null
      ? { ...payload, teacher_personality: (payload as any).teacher_personality || getTeacherPersonality() }
      : payload;

    response = await fetch(`${API_BASE_URL}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(userId ? { 'X-User-ID': userId } : {}),
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(finalPayload),
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

const getTeacherPersonality = (): string => {
  const userStr = localStorage.getItem('ncertai_user');
  if (userStr) {
    try {
      const user = JSON.parse(userStr);
      return user.teacherPersonality || 'Kind';
    } catch {
      return 'Kind';
    }
  }
  return 'Kind';
};

export interface DailyPlanResponse {
  plan: string;
}

export interface VideoStoryboardPayload {
  class_num: string;
  subject: string;
  chapter: string;
  topic?: string;
  source_url?: string;
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
    proceduralBrollCount: number;
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
  parent_note?: string;
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

export interface VideoResourceItem {
  video_id: string;
  title: string;
  url: string;
  embed_url: string;
  embed_code?: string;
  duration?: string;
  channel?: string;
  search_source: string;
  match_score: number;
}

export interface VideoResourceStackResponse {
    subject: string;
    chapter: string;
    videos: Array<{
        id: string;
        title: string;
        thumbnail: string;
        channel: string;
        duration: string;
        video_id?: string;
        url?: string;
        embed_url?: string;
        embed_code?: string;
    }>;
    clarity_booster: {
        positioning: string;
        checkpoints: string[];
        exam_traps: string[];
        class_num: string;
    };
}

export interface VideoLearningMoment {
  timestamp_seconds: number;
  timestamp_label: string;
  subtopic: string;
  important_point: string;
  keywords: string[];
  coach_note: string;
  exam_answer_frame?: string;
  common_trap?: string;
  memory_hook?: string;
}

export interface VideoLearningQuizQuestion {
  question: string;
  options: string[];
  answer_index: number;
  explanation: string;
}

export interface VideoLearningAssistResponse {
  class_num: string;
  subject: string;
  chapter: string;
  video_id: string;
  plan_tier: 'pro' | 'pro_max';
  feature_mode: 'pro' | 'pro-max';
  key_moments: VideoLearningMoment[];
  quiz: VideoLearningQuizQuestion[];
  transcript_stats: {
    segments: number;
    duration_seconds: number;
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

export interface ExamSimStartPayload {
  class_num: string;
  subject: string;
  scope: 'single-chapter' | 'multi-chapter' | 'full-subject';
  chapter?: string;
  chapters?: string[];
  mode: 'full-mock' | 'section-drill';
  duration_minutes: number;
  question_count: number;
  total_marks: number;
  stick_to_textbook?: boolean;
}

export interface ExamSimQuestion {
  question_id: string;
  question: string;
  marks: number;
  chapter: string;
}

export interface ExamSimStartResponse {
  session_id: string;
  mode: string;
  scope: 'single-chapter' | 'multi-chapter' | 'full-subject' | string;
  duration_minutes: number;
  subject: string;
  chapter: string;
  chapters: string[];
  total_marks: number;
  questions: ExamSimQuestion[];
}

export interface ExamSimSubmitPayload {
  session_id: string;
  class_num: string;
  subject: string;
  scope: 'single-chapter' | 'multi-chapter' | 'full-subject';
  chapter?: string;
  chapters?: string[];
  mode: 'full-mock' | 'section-drill';
  answers: Array<{ question_id?: string; question: string; marks_available: number; answer_text: string }>;
}

export interface ExamSimSubmitResponse {
  session_id: string;
  mode: string;
  subject: string;
  chapter: string;
  total_questions: number;
  attempted: number;
  total_marks: number;
  marks_awarded: number;
  accuracy_percent: number;
  step_mark_losses: Array<{ question: string; lost_reason: string; fix: string }>;
  recovery_plan: string[];
}

export interface ParentPortalSummaryResponse {
  student: string;
  parent_email?: string;
  students?: string[];
  readiness_score: number;
  risk_level: 'low' | 'medium' | 'high';
  subject_confidence: Array<{ subject: string; confidence: number; samples: number }>;
  weak_chapters: string[];
  recommendations: string[];
  updated_at: string;
}

export interface RecommendationItem {
  id: string;
  title: string;
  reason: string;
  subject?: string;
  chapter?: string;
  priority: 'high' | 'medium' | 'low';
  action: 'practice' | 'ask' | 'library';
}

export interface RecommendationsResponse {
  recommendations: RecommendationItem[];
}

export interface ProgressAnalyticsTopic {
  subject: string;
  chapter: string;
  average_score: number;
  total_attempts: number;
  trend: 'improving' | 'stable' | 'declining' | string;
}

export interface ProgressAnalyticsResponse {
  overall: {
    average_score: number;
    study_streak_days: number;
    hours_studied: number;
    questions_per_day: number;
    accuracy_rate: number;
    total_questions: number;
    total_practice_attempts: number;
    total_flashcard_reviews: number;
    total_uploads: number;
  };
  weak_topics: ProgressAnalyticsTopic[];
  recommended_topics: ProgressAnalyticsTopic[];
  subject_breakdown: Array<{
    subject: string;
    average_score: number;
    topic_count: number;
    attempts: number;
  }>;
  insights: string[];
  has_activity: boolean;
}

export interface ParentLoginResponse {
  token: string;
  parent: {
    email: string;
    student: string;
  };
}

export interface DiagnosticQuestionOption {
  key: string;
  text: string;
}

export interface DiagnosticQuestion {
  id: string;
  chapter: string;
  prompt: string;
  options: DiagnosticQuestionOption[];
}

export interface DiagnosticQuestionsResponse {
  diagnostic_class: string;
  diagnostic_subject: string;
  questions: DiagnosticQuestion[];
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
  const finalPayload = { 
    ...payload, 
    teacher_personality: payload.teacher_personality || getTeacherPersonality() 
  };
  const response = await apiClient.post('/chat/ask', finalPayload);
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

export const getBillingConfig = async (): Promise<BillingConfigResponse> => {
  const response = await apiClient.get('/auth/billing/config');
  return response.data;
};

export const createBillingCheckout = async (plan: 'pro' | 'pro_max'): Promise<BillingCheckoutResponse> => {
  const response = await apiClient.post('/auth/billing/checkout', { plan });
  return response.data;
};

export const startBillingTrial = async (plan: 'pro' | 'pro_max'): Promise<any> => {
  const response = await apiClient.post('/auth/billing/start-trial', { plan });
  return response.data;
};

export const submitDiagnostic = async (payload: {
  class_num: string;
  subject?: string;
  answers: Array<{ question_id: string; selected_option: string }>;
}): Promise<{ total_score: number; diagnostic_class?: string; diagnostic_subject?: string; subject_scores: Record<string, number>; strengths: string[]; weaknesses: string[]; recommended_start: string }> => {
  const response = await apiClient.post('/auth/diagnostic', payload);
  return response.data;
};

export const getDiagnosticQuestions = async (params: {
  class_num: string;
  subject?: string;
}): Promise<DiagnosticQuestionsResponse> => {
  const response = await apiClient.get('/auth/diagnostic/questions', { params });
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
  const finalPayload = { 
    ...payload, 
    teacher_personality: payload.teacher_personality || getTeacherPersonality() 
  };
  const response = await apiClient.post('/practice/generate', finalPayload);
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
  const finalPayload = { 
    ...payload, 
    teacher_personality: payload.teacher_personality || getTeacherPersonality() 
  };
  const response = await apiClient.post('/practice/grade', finalPayload);
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

export const getVideoResourceStack = async (payload: {
  class_num: string;
  subject: string;
  chapter: string;
  limit?: number;
}): Promise<VideoResourceStackResponse> => {
  const response = await apiClient.get('/practice/video-resource-stack', { params: payload });
  return response.data;
};

export const getVideoLearningAssist = async (payload: {
  class_num: string;
  subject: string;
  chapter: string;
  video_id?: string;
  video_url?: string;
}): Promise<VideoLearningAssistResponse> => {
  const response = await apiClient.get('/practice/video-learning-assist', { params: payload });
  return response.data;
};

export const getMockSchedule = async (): Promise<MockScheduleResponse> => {
  const response = await apiClient.get('/practice/mock-schedule');
  return response.data;
};

export const startExamSimulation = async (
  payload: ExamSimStartPayload
): Promise<ExamSimStartResponse> => {
  const response = await apiClient.post('/practice/exam-simulation/start', payload);
  return response.data;
};

export const submitExamSimulation = async (
  payload: ExamSimSubmitPayload
): Promise<ExamSimSubmitResponse> => {
  const response = await apiClient.post('/practice/exam-simulation/submit', payload);
  return response.data;
};

export const getParentPortalSummary = async (): Promise<ParentPortalSummaryResponse> => {
  const response = await apiClient.get('/progress/parent-portal-summary');
  return response.data;
};

export const getRecommendations = async (): Promise<RecommendationsResponse> => {
  const response = await apiClient.get('/progress/recommendations');
  return response.data;
};

export const getProgressAnalytics = async (): Promise<ProgressAnalyticsResponse> => {
  const response = await apiClient.get('/progress/analytics');
  return response.data;
};

export const parentLogin = async (payload: {
  email: string;
  password: string;
}): Promise<ParentLoginResponse> => {
  const response = await apiClient.post('/auth/parent/login', payload);
  return response.data;
};

export const parentLogout = async (): Promise<{ status: string }> => {
  const token = getParentAuthToken();
  const response = await apiClient.post('/auth/parent/logout', null, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  return response.data;
};

export const resendParentCredentials = async (): Promise<{ status: string; message: string; parent_email: string }> => {
  const response = await apiClient.post('/auth/parent/resend-credentials');
  return response.data;
};

export const getParentPortalSummaryForParent = async (): Promise<ParentPortalSummaryResponse> => {
  const token = getParentAuthToken();
  if (!token) {
    throw new Error('Parent session missing. Please login again.');
  }
  const response = await apiClient.get('/progress/parent-portal/summary', {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
};

export const getStudyNotifications = async (): Promise<StudyNotificationResponse> => {
  const response = await apiClient.get('/practice/notifications');
  return response.data;
};

export const sendParentReport = async (): Promise<{ status: string; message: string; parent_email: string; report: string }> => {
  const response = await apiClient.post('/progress/report/send');
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
  const proceduralBrollCount = Number(headers['x-procedural-broll-count'] || 0);
  const montageSegments = Number(headers['x-montage-segments'] || 0);
  const brollMode = String(headers['x-broll-mode'] || payload.broll_mode || 'balanced');
  const montageLevel = String(headers['x-montage-level'] || payload.montage_level || 'single');
  return {
    blob: response.data,
    meta: {
      externalVideoCount,
      proceduralBrollCount,
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

export interface CustomTextbookItem {
  id: number;
  username: string;
  class_num: number;
  subject: string;
  chapter: string;
  filename: string;
  filepath: string;
  created_at: string;
}

export const uploadCustomTextbook = async (formData: FormData): Promise<CustomTextbookItem> => {
  const response = await apiClient.post('/upload/custom-textbook', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};

export const getCustomTextbooks = async (params: {
  class_num?: number;
  subject?: string;
}): Promise<{ textbooks: CustomTextbookItem[] }> => {
  const response = await apiClient.get('/upload/custom-textbooks', { params });
  return response.data;
};

export const deleteCustomTextbook = async (textbookId: number): Promise<{ status: string; message: string }> => {
  const response = await apiClient.delete(`/upload/custom-textbook/${textbookId}`);
  return response.data;
};

export const getCustomTextbookContent = async (textbookId: number): Promise<{ content: string }> => {
  const response = await apiClient.get(`/upload/custom-textbook/${textbookId}/content`);
  return response.data;
};

export interface TutorChatPayload {
  question: string;
  conversation_history?: Array<{ role: string; content: string }>;
}

export const askTutor = async (payload: TutorChatPayload): Promise<{ answer: string }> => {
  const response = await apiClient.post('/chat/tutor', payload);
  return response.data;
};

export const askTutorStream = async (
  payload: TutorChatPayload,
  onToken: (token: string) => void
): Promise<void> => {
  try {
    await streamEndpoint('/chat/tutor-stream', payload, onToken);
  } catch {
    const fallback = await askTutor(payload);
    await streamAsTyping(fallback.answer, onToken);
  }
};

export const getChapterText = async (params: {
  class_num: string;
  subject: string;
  chapter: string;
}): Promise<{ content: string }> => {
  const response = await apiClient.get('/curriculum/chapter-text', { params });
  return response.data;
};

export interface ActiveRecallEvaluateResponse {
  accuracy_score: number;
  recalled_keywords: string[];
  missed_concepts: string[];
  feedback_notes: string;
}

export const evaluateActiveRecall = async (payload: {
  class_num: string;
  subject: string;
  chapter: string;
  recall_text: string;
}): Promise<ActiveRecallEvaluateResponse> => {
  const response = await apiClient.post('/curriculum/active-recall/evaluate', payload);
  return response.data;
};


export interface ParentPortalSettings {
  encouragement_note: string;
  weekly_goals: string;
}

export const getParentPortalSettings = async (): Promise<ParentPortalSettings> => {
  const token = getParentAuthToken();
  if (!token) {
    throw new Error('Parent session missing. Please login again.');
  }
  const response = await apiClient.get('/progress/parent-portal/settings', {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
};

export const updateParentPortalSettings = async (payload: {
  encouragement_note?: string;
  weekly_goals?: string;
}): Promise<{ status: string; message: string }> => {
  const token = getParentAuthToken();
  if (!token) {
    throw new Error('Parent session missing. Please login again.');
  }
  const response = await apiClient.post('/progress/parent-portal/settings', payload, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
};

export const chatWithParentAdvisor = async (
  message: string,
  history: Array<{ sender: 'parent' | 'ai'; text: string }>
): Promise<{ response: string }> => {
  const token = getParentAuthToken();
  if (!token) {
    throw new Error('Parent session missing. Please login again.');
  }
  const response = await apiClient.post(
    '/progress/parent-portal/advisor/chat',
    { message, history },
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return response.data;
};

export const switchParentStudent = async (studentUsername: string): Promise<{ status: string; active_student: string }> => {
  const token = getParentAuthToken();
  if (!token) {
    throw new Error('Parent session missing. Please login again.');
  }
  const response = await apiClient.post('/auth/parent/switch-student', { student_username: studentUsername }, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
};

export interface LeaderboardUser {
  rank: number;
  username: string;
  points: number;
  class_num: number | string;
  country: string;
  state: string;
  city: string;
}

export interface LeaderboardResponse {
  leaderboard: LeaderboardUser[];
}

export const getLeaderboard = async (params: {
  class_num?: number | string;
  country?: string;
  state?: string;
  city?: string;
} = {}): Promise<LeaderboardResponse> => {
  const response = await apiClient.get('/progress/leaderboard', { params });
  return response.data;
};


