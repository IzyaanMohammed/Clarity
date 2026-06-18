import { apiClient } from '../api';

/**
 * Builds the exact system prompt for Clarifi, the AI Tutor, injecting the student's 
 * dumped personal notes as context.
 */
export function buildClarifiSystemPrompt(userSummaries: string[] = [], userClass?: string): string {
  const summaryContext = userSummaries.length > 0
    ? `\n\nThe student has uploaded the following personal study materials. Reference them when relevant:\n${userSummaries.map((s, i) => `${i + 1}. ${s}`).join('\n')}`
    : '';

  return `You are Clarifi, a friendly and expert NCERT tutor for CBSE Class 9–12 students.${userClass ? ` This student is in Class ${userClass}.` : ''}

Rules you always follow:
1. Always reference the exact NCERT chapter name and class when explaining a concept.
2. Structure answers the way CBSE mark schemes expect: Define → Explain → Example.
3. If the student's understanding is correct but their phrasing wouldn't get full marks in a board exam, say: "You're right! But for board exams, write it as: [exact CBSE phrasing]"
4. Keep a warm, encouraging tone. Never make the student feel stupid.
5. For numerical problems, always show step-by-step working with units.
6. End every response with: "Does this help? Or should I explain it differently? 🙂"
7. Never give a generic answer when a CBSE-specific answer exists.${summaryContext}`;
}

/**
 * Sends a chat message to the backend AI system (which handles OpenRouter / OpenAI fallback securely).
 */
export async function askClarifi(
  question: string,
  classNum: string,
  subject: string,
  chapter: string,
  userSummaries: string[] = []
): Promise<string> {
  const customPrompt = buildClarifiSystemPrompt(userSummaries, classNum);
  
  // We send the question to our secure backend endpoint
  // The backend already handles OpenRouter and fallback logic.
  const response = await apiClient.post('/chat/ask', {
    class_num: classNum,
    subject,
    chapter,
    question,
    teacher_personality: customPrompt // We piggyback on the teacher_personality field to inject the system prompt
  });
  
  return response.data.answer;
}
