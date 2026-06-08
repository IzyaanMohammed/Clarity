import { NCERT_CHAPTERS } from '../constants/ncert';
import { NCERT_BOOKS } from '../constants/books';

export interface WorksheetSet {
    id: string;
    title: string;
    chapter: string;
    questionType: '1-mark' | '3-mark' | '5-mark' | 'mixed' | 'variety' | 'past-paper';
    numQuestions: number;
    goal: string;
    difficulty: 'Easy' | 'Medium' | 'Hard';
}

export interface StudyResources {
    classNum: string;
    subject: string;
    subjects: string[];
    chapters: string[];
    textbooks: Array<{
        class: string;
        subject: string;
        title: string;
        url: string;
    }>;
    worksheets: WorksheetSet[];
}

const WORKSHEET_TEMPLATES: Array<{
    suffix: string;
    questionType: WorksheetSet['questionType'];
    numQuestions: number;
    goal: string;
    difficulty: WorksheetSet['difficulty'];
}> = [
        {
            suffix: 'Concept Warmup',
            questionType: '1-mark',
            numQuestions: 10,
            goal: 'Quick one-mark revision before deeper practice',
            difficulty: 'Easy',
        },
        {
            suffix: 'Board Core Drill',
            questionType: '3-mark',
            numQuestions: 5,
            goal: 'Structured short answers in board style',
            difficulty: 'Medium',
        },
        {
            suffix: 'Long Answer Mastery',
            questionType: '5-mark',
            numQuestions: 3,
            goal: 'Exam-grade long answers with key points',
            difficulty: 'Hard',
        },
        {
            suffix: 'Mixed Mock Set',
            questionType: 'mixed',
            numQuestions: 5,
            goal: 'Balanced set to simulate mixed sections',
            difficulty: 'Medium',
        },
        {
            suffix: 'Competency Pack',
            questionType: 'variety',
            numQuestions: 5,
            goal: 'Assertion, case-based and HOTS style coverage',
            difficulty: 'Hard',
        },
        {
            suffix: 'Past Paper Sprint',
            questionType: 'past-paper',
            numQuestions: 5,
            goal: 'Previous-year board phrasing practice',
            difficulty: 'Hard',
        },
    ];

export const getSubjectsForClass = (classNum: string): string[] => {
    return Object.keys(NCERT_CHAPTERS[classNum] || {});
};

export const getStudyResources = (classNum: string, subject: string): StudyResources => {
    const subjects = getSubjectsForClass(classNum);
    const effectiveSubject = subject && subjects.includes(subject) ? subject : subjects[0] || '';
    const chapters = NCERT_CHAPTERS[classNum]?.[effectiveSubject] || [];
    const textbooks = NCERT_BOOKS.filter(
        (book) => book.class === classNum && book.subject === effectiveSubject
    );

    const chapterPool = chapters;
    const worksheets: WorksheetSet[] = [];

    chapterPool.forEach((chapter, chapterIndex) => {
        WORKSHEET_TEMPLATES.forEach((template, templateIndex) => {
            worksheets.push({
                id: `${classNum}-${effectiveSubject}-${chapterIndex}-${templateIndex}`,
                title: `${chapter} - ${template.suffix}`,
                chapter,
                questionType: template.questionType,
                numQuestions: template.numQuestions,
                goal: template.goal,
                difficulty: template.difficulty,
            });
        });
    });

    return {
        classNum,
        subject: effectiveSubject,
        subjects,
        chapters,
        textbooks,
        worksheets,
    };
};

export const getReadableMirrorUrl = (url: string): string => {
    return url;
};

export const buildNcertChapterUrl = (baseUrl: string, chapterIndex: number): string => {
    const match = baseUrl.match(/([?&])([a-z0-9]+)=([0-9]+)-([0-9]+)/i);
    if (!match) return baseUrl;

    const key = match[2];
    const maxChapter = Number(match[4]) || chapterIndex;
    const chapter = Math.max(1, Math.min(chapterIndex, maxChapter));
    return `https://ncert.nic.in/textbook.php?${key}=${chapter}-${maxChapter}`;
};

export const getNcertBundleZipUrl = (url: string): string | null => {
    try {
        const parsed = new URL(url);
        const keys = Array.from(parsed.searchParams.keys());
        if (!keys.length) return null;
        const bookCode = keys[0];
        return `https://ncert.nic.in/textbook/pdf/${bookCode}dd.zip`;
    } catch {
        return null;
    }
};
