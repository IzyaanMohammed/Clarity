import { UserData, ChatSession, ActivityRecord, SubjectStats } from '../types';

export const STORAGE_KEYS = {
  USER: 'ncertai_user',
  HISTORY: 'ncertai_history',
  PROGRESS: 'ncertai_progress',
  ACTIVITIES: 'ncertai_activities',
  SUBJECT_STATS: 'ncertai_subject_stats',
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
