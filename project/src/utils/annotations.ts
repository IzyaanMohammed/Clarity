/**
 * Quick Notes and Highlights system for study materials
 * Allows users to annotate saved content with color-coded highlights and notes
 */

export type HighlightColor = 'yellow' | 'green' | 'blue' | 'pink' | 'purple';

export interface TextHighlight {
    id: string;
    materialId: string; // ID of the study material being annotated
    text: string; // The highlighted text
    color: HighlightColor;
    startIndex: number; // Position in original content
    endIndex: number;
    createdAt: number;
}

export interface MaterialNote {
    id: string;
    materialId: string; // ID of the study material
    content: string;
    type: 'general' | 'insight' | 'question' | 'important'; // Note category
    position?: number; // Location in content if relevant
    createdAt: number;
    updatedAt: number;
}

export interface AnnotatedMaterial {
    materialId: string;
    highlights: TextHighlight[];
    notes: MaterialNote[];
    lastAnnotatedAt: number;
}

/**
 * Create a highlight by selecting text in a material
 */
export function createHighlight(
    materialId: string,
    text: string,
    color: HighlightColor,
    startIndex: number,
    endIndex: number
): TextHighlight {
    const highlight: TextHighlight = {
        id: `hl_${materialId}_${Date.now()}`,
        materialId,
        text,
        color,
        startIndex,
        endIndex,
        createdAt: Date.now(),
    };

    addHighlight(highlight);
    return highlight;
}

/**
 * Save a highlight to storage
 */
export function addHighlight(highlight: TextHighlight): void {
    const annotations = getAnnotations(highlight.materialId);
    annotations.highlights.push(highlight);
    annotations.lastAnnotatedAt = Date.now();
    saveAnnotations(highlight.materialId, annotations);
}

/**
 * Delete a highlight
 */
export function removeHighlight(materialId: string, highlightId: string): void {
    const annotations = getAnnotations(materialId);
    annotations.highlights = annotations.highlights.filter(h => h.id !== highlightId);
    saveAnnotations(materialId, annotations);
}

/**
 * Add a note to a material
 */
export function addNote(
    materialId: string,
    content: string,
    type: 'general' | 'insight' | 'question' | 'important' = 'general',
    position?: number
): MaterialNote {
    const note: MaterialNote = {
        id: `note_${materialId}_${Date.now()}`,
        materialId,
        content,
        type,
        position,
        createdAt: Date.now(),
        updatedAt: Date.now(),
    };

    const annotations = getAnnotations(materialId);
    annotations.notes.push(note);
    annotations.lastAnnotatedAt = Date.now();
    saveAnnotations(materialId, annotations);

    return note;
}

/**
 * Update an existing note
 */
export function updateNote(materialId: string, noteId: string, content: string): MaterialNote | null {
    const annotations = getAnnotations(materialId);
    const noteIndex = annotations.notes.findIndex(n => n.id === noteId);

    if (noteIndex < 0) return null;

    annotations.notes[noteIndex].content = content;
    annotations.notes[noteIndex].updatedAt = Date.now();
    annotations.lastAnnotatedAt = Date.now();
    saveAnnotations(materialId, annotations);

    return annotations.notes[noteIndex];
}

/**
 * Delete a note
 */
export function removeNote(materialId: string, noteId: string): void {
    const annotations = getAnnotations(materialId);
    annotations.notes = annotations.notes.filter(n => n.id !== noteId);
    saveAnnotations(materialId, annotations);
}

/**
 * Get all annotations for a material
 */
export function getAnnotations(materialId: string): AnnotatedMaterial {
    const key = `clarity_annotations_${materialId}`;
    const data = localStorage.getItem(key);

    if (!data) {
        return {
            materialId,
            highlights: [],
            notes: [],
            lastAnnotatedAt: 0,
        };
    }

    return JSON.parse(data);
}

/**
 * Save annotations for a material
 */
export function saveAnnotations(materialId: string, annotations: AnnotatedMaterial): void {
    const key = `clarity_annotations_${materialId}`;
    localStorage.setItem(key, JSON.stringify(annotations));
}

/**
 * Delete all annotations for a material
 */
export function clearAnnotations(materialId: string): void {
    const key = `clarity_annotations_${materialId}`;
    localStorage.removeItem(key);
}

/**
 * Get all materials that have annotations
 */
export function getAnnotatedMaterials(): string[] {
    const keys = Object.keys(localStorage);
    return keys
        .filter(k => k.startsWith('clarity_annotations_'))
        .map(k => k.replace('clarity_annotations_', ''));
}

/**
 * Get highlight statistics for a material
 */
export function getHighlightStats(materialId: string) {
    const annotations = getAnnotations(materialId);
    const colorStats: Record<HighlightColor, number> = {
        yellow: 0,
        green: 0,
        blue: 0,
        pink: 0,
        purple: 0,
    };

    annotations.highlights.forEach(h => {
        colorStats[h.color]++;
    });

    return {
        totalHighlights: annotations.highlights.length,
        totalNotes: annotations.notes.length,
        colorStats,
        noteTypeStats: {
            general: annotations.notes.filter(n => n.type === 'general').length,
            insight: annotations.notes.filter(n => n.type === 'insight').length,
            question: annotations.notes.filter(n => n.type === 'question').length,
            important: annotations.notes.filter(n => n.type === 'important').length,
        },
    };
}

/**
 * Get highlights by color
 */
export function getHighlightsByColor(
    materialId: string,
    color: HighlightColor
): TextHighlight[] {
    const annotations = getAnnotations(materialId);
    return annotations.highlights.filter(h => h.color === color);
}

/**
 * Search highlights and notes
 */
export function searchAnnotations(materialId: string, query: string) {
    const annotations = getAnnotations(materialId);
    const lowerQuery = query.toLowerCase();

    return {
        highlights: annotations.highlights.filter(h =>
            h.text.toLowerCase().includes(lowerQuery)
        ),
        notes: annotations.notes.filter(n =>
            n.content.toLowerCase().includes(lowerQuery)
        ),
    };
}

/**
 * Export annotations as markdown
 */
export function exportAnnotationsAsMarkdown(materialId: string): string {
    const annotations = getAnnotations(materialId);
    let markdown = `# Annotations\n\n`;

    if (annotations.highlights.length > 0) {
        markdown += `## Highlights\n\n`;
        annotations.highlights.forEach(h => {
            const colorEmoji: Record<HighlightColor, string> = {
                yellow: '🟨',
                green: '🟩',
                blue: '🟦',
                pink: '🟥',
                purple: '🟪',
            };
            markdown += `${colorEmoji[h.color]} "${h.text}"\n\n`;
        });
    }

    if (annotations.notes.length > 0) {
        markdown += `## Notes\n\n`;
        annotations.notes.forEach(n => {
            const typeEmoji: Record<string, string> = {
                general: '📝',
                insight: '💡',
                question: '❓',
                important: '⭐',
            };
            markdown += `${typeEmoji[n.type]} **${n.type}**: ${n.content}\n\n`;
        });
    }

    return markdown;
}

/**
 * Get all notes across all materials
 */
export function getAllNotes(): MaterialNote[] {
    const materials = getAnnotatedMaterials();
    const allNotes: MaterialNote[] = [];

    materials.forEach(materialId => {
        const annotations = getAnnotations(materialId);
        allNotes.push(...annotations.notes);
    });

    return allNotes.sort((a, b) => b.createdAt - a.createdAt);
}

/**
 * Get recent notes (last 10)
 */
export function getRecentNotes(): MaterialNote[] {
    return getAllNotes().slice(0, 10);
}

/**
 * Get important notes across all materials
 */
export function getImportantNotes(): MaterialNote[] {
    return getAllNotes().filter(n => n.type === 'important');
}

/**
 * Get unanswered questions across all materials
 */
export function getUnansweredQuestions(): MaterialNote[] {
    return getAllNotes().filter(n => n.type === 'question');
}
