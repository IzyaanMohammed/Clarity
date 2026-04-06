import { UserData, ChatSession, ActivityRecord, SubjectStats, BookmarkItem } from '../types';
import { FlashcardWithReview } from './spacedRepetition';

export const STORAGE_KEYS = {
  USER: 'ncertai_user',
  TOKEN: 'ncertai_token',
  HISTORY: 'ncertai_history',
  PROGRESS: 'ncertai_progress',
  ACTIVITIES: 'ncertai_activities',
  SUBJECT_STATS: 'ncertai_subject_stats',
  BOOKMARKS: 'clarity_bookmarks',
  MATERIALS: 'clarity_materials',
  FLASHCARD_REVIEWS: 'clarity_flashcard_reviews',
};

export type StudyMaterialItem = {
  id: string;
  type: 'ocr' | 'video' | 'mindmap' | 'link' | 'summary' | 'formula' | 'plan' | 'answer' | 'practice' | 'upload';
  title: string;
  subject?: string;
  chapter?: string;
  content?: string;
  url?: string;
  imageDataUrl?: string;
  createdAt: number;
  // Optional spaced repetition data for 'practice' type flashcard sets
  flashcards?: FlashcardWithReview[];
  lastReviewedAt?: number;
};

export const saveUser = (userData: UserData) => {
  localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(userData));
};

export const getUser = (): UserData | null => {
  const data = localStorage.getItem(STORAGE_KEYS.USER);
  return data ? JSON.parse(data) : null;
};

export const updateUser = (updates: Partial<UserData>) => {
  const currentUser = getUser();
  if (currentUser) {
    const updatedUser = { ...currentUser, ...updates };
    saveUser(updatedUser);
    return updatedUser;
  }
  return null;
};

export const clearUser = () => {
  localStorage.removeItem(STORAGE_KEYS.USER);
  localStorage.removeItem(STORAGE_KEYS.TOKEN);
};

export const saveAuthToken = (token: string) => {
  localStorage.setItem(STORAGE_KEYS.TOKEN, token);
};

export const getAuthToken = (): string => {
  return localStorage.getItem(STORAGE_KEYS.TOKEN) || '';
};

export const clearAuthToken = () => {
  localStorage.removeItem(STORAGE_KEYS.TOKEN);
};

export const saveChatSession = (session: ChatSession) => {
  const sessions = getChatHistory();
  sessions.push(session);
  localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(sessions));
};

export const getChatHistory = (): ChatSession[] => {
  const data = localStorage.getItem(STORAGE_KEYS.HISTORY);
  return data ? JSON.parse(data) : [];
};

export const setChatHistory = (sessions: ChatSession[]) => {
  localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(sessions || []));
};

export const addActivity = (activity: ActivityRecord) => {
  const activities = getActivities();
  activities.unshift(activity);
  if (activities.length > 100) {
    activities.pop();
  }
  localStorage.setItem(STORAGE_KEYS.ACTIVITIES, JSON.stringify(activities));
};

export const getActivities = (): ActivityRecord[] => {
  const data = localStorage.getItem(STORAGE_KEYS.ACTIVITIES);
  return data ? JSON.parse(data) : [];
};

export const setActivities = (activities: ActivityRecord[]) => {
  localStorage.setItem(STORAGE_KEYS.ACTIVITIES, JSON.stringify(activities || []));
};

export const getRecentActivities = (limit: number = 5): ActivityRecord[] => {
  const activities = getActivities();
  return activities.slice(0, limit);
};

export const updateSubjectStats = (subject: string, updates: Partial<SubjectStats>) => {
  const stats = getSubjectStats();
  const existingIndex = stats.findIndex(s => s.subject === subject);

  if (existingIndex >= 0) {
    stats[existingIndex] = { ...stats[existingIndex], ...updates };
  } else {
    stats.push({ subject, questionsAsked: 0, chaptersStudied: 0, ...updates });
  }

  localStorage.setItem(STORAGE_KEYS.SUBJECT_STATS, JSON.stringify(stats));
};

export const getSubjectStats = (): SubjectStats[] => {
  const data = localStorage.getItem(STORAGE_KEYS.SUBJECT_STATS);
  return data ? JSON.parse(data) : [];
};

export const setSubjectStats = (stats: SubjectStats[]) => {
  localStorage.setItem(STORAGE_KEYS.SUBJECT_STATS, JSON.stringify(stats || []));
};

export const resetAllData = () => {
  Object.values(STORAGE_KEYS).forEach(key => {
    localStorage.removeItem(key);
  });
};

export const incrementDailyQuestion = () => {
  const user = getUser();
  if (user) {
    const today = new Date().toDateString();
    const lastDate = localStorage.getItem('ncertai_last_question_date');

    if (lastDate !== today) {
      updateUser({ questionsToday: 1 });
      localStorage.setItem('ncertai_last_question_date', today);
    } else {
      updateUser({ questionsToday: (user.questionsToday || 0) + 1 });
    }
  }
};

export const incrementDailyUpload = () => {
  const user = getUser();
  if (user) {
    const today = new Date().toDateString();
    const lastDate = localStorage.getItem('ncertai_last_upload_date');

    if (lastDate !== today) {
      updateUser({ uploadsToday: 1 });
      localStorage.setItem('ncertai_last_upload_date', today);
    } else {
      updateUser({ uploadsToday: (user.uploadsToday || 0) + 1 });
    }
  }
};

export const checkDailyLimits = (user: UserData | null) => {
  if (!user || user.isPremium) return { canAsk: true, canUpload: true };

  const questionsToday = user.questionsToday || 0;
  const uploadsToday = user.uploadsToday || 0;

  return {
    canAsk: questionsToday < 10,
    canUpload: uploadsToday < 2,
    questionsLeft: Math.max(0, 10 - questionsToday),
    uploadsLeft: Math.max(0, 2 - uploadsToday),
  };
};

export const getBookmarks = (): BookmarkItem[] => {
  const data = localStorage.getItem(STORAGE_KEYS.BOOKMARKS);
  return data ? JSON.parse(data) : [];
};

export const setBookmarks = (bookmarks: BookmarkItem[]) => {
  localStorage.setItem(STORAGE_KEYS.BOOKMARKS, JSON.stringify(bookmarks || []));
};

export const addBookmark = (bookmark: BookmarkItem) => {
  const existing = getBookmarks();
  const duplicate = existing.some(
    (b) => b.type === bookmark.type && b.question === bookmark.question && b.answer === bookmark.answer
  );
  if (duplicate) return false;
  existing.unshift(bookmark);
  localStorage.setItem(STORAGE_KEYS.BOOKMARKS, JSON.stringify(existing.slice(0, 300)));
  return true;
};

export const removeBookmark = (id: string) => {
  const existing = getBookmarks();
  const next = existing.filter((b) => b.id !== id);
  localStorage.setItem(STORAGE_KEYS.BOOKMARKS, JSON.stringify(next));
};

export const getStudyMaterials = (): StudyMaterialItem[] => {
  const data = localStorage.getItem(STORAGE_KEYS.MATERIALS);
  return data ? JSON.parse(data) : [];
};

export const setStudyMaterials = (materials: StudyMaterialItem[]) => {
  localStorage.setItem(STORAGE_KEYS.MATERIALS, JSON.stringify(materials || []));
};

export const addStudyMaterial = (item: StudyMaterialItem) => {
  const existing = getStudyMaterials();
  const duplicate = existing.some((entry) =>
    entry.type === item.type
    && entry.title === item.title
    && entry.content === item.content
    && entry.url === item.url
  );
  if (duplicate) return false;
  existing.unshift(item);
  localStorage.setItem(STORAGE_KEYS.MATERIALS, JSON.stringify(existing.slice(0, 500)));

  // Write-through sync: immediately persist to backend database
  import('../api').then(api => {
    api.saveMaterialToDatabase(item).catch(err => {
      console.error('Failed to sync material to database:', err);
      // Silently fail - local storage is still updated
    });
  });

  return true;
};

export const saveStudyMaterialIfNew = (item: StudyMaterialItem) => {
  const added = addStudyMaterial(item);
  if (added) {
    // Write-through sync: immediately persist to backend database
    import('../api').then(api => {
      api.saveMaterialToDatabase(item).catch(err => {
        console.error('Failed to sync material to database:', err);
        // Silently fail - local storage is still updated
      });
    });
  }
  return added;
};

export const removeStudyMaterial = (id: string) => {
  const existing = getStudyMaterials();
  const next = existing.filter((m) => m.id !== id);
  localStorage.setItem(STORAGE_KEYS.MATERIALS, JSON.stringify(next));
};

/**
 * Spaced Repetition Helpers
 */

export const updateFlashcardSet = (materialId: string, updater: (item: StudyMaterialItem) => StudyMaterialItem) => {
  const existing = getStudyMaterials();
  const index = existing.findIndex(m => m.id === materialId);
  if (index >= 0) {
    existing[index] = updater(existing[index]);
    localStorage.setItem(STORAGE_KEYS.MATERIALS, JSON.stringify(existing));
    return existing[index];
  }
  return null;
};

export const getFlashcardSet = (materialId: string): StudyMaterialItem | null => {
  const materials = getStudyMaterials();
  return materials.find(m => m.id === materialId) || null;
};

export const getFlashcardSetsRequiringReview = (): StudyMaterialItem[] => {
  const materials = getStudyMaterials();
  return materials.filter(m => {
    if (m.type !== 'practice' || !m.flashcards) return false;
    return m.flashcards.some(card => card.nextReviewAt <= Date.now());
  });
};

export const hydrateLocalStateFromSnapshot = (snapshot: Record<string, unknown>, serverMaterials?: StudyMaterialItem[]) => {
  if (snapshot.user && typeof snapshot.user === 'object') {
    saveUser(snapshot.user as UserData);
  }
  if (Array.isArray(snapshot.activities)) {
    setActivities(snapshot.activities as ActivityRecord[]);
  }
  if (Array.isArray(snapshot.chatHistory)) {
    setChatHistory(snapshot.chatHistory as ChatSession[]);
  }
  if (Array.isArray(snapshot.subjectStats)) {
    setSubjectStats(snapshot.subjectStats as SubjectStats[]);
  }
  if (Array.isArray(snapshot.bookmarks)) {
    setBookmarks(snapshot.bookmarks as BookmarkItem[]);
  }
  if (Array.isArray(serverMaterials) && serverMaterials.length > 0) {
    setStudyMaterials(serverMaterials);
  } else if (Array.isArray(snapshot.materials)) {
    setStudyMaterials(snapshot.materials as StudyMaterialItem[]);
  }
};
