/**
 * NCERT Resource Linking Strategy
 * Provides access to official NCERT textbooks via links instead of downloads to avoid legal concerns
 * Uses official NCERT mirrors and accessible reading platforms
 */

export interface NCERTResourceLink {
    title: string;
    url: string;
    source: 'ncert_official' | 'readable_mirror' | 'gdrive' | 'pdfroom' | 'scribd';
    type: 'web' | 'pdf' | 'interactive';
    description: string;
}

export interface ChapterResource {
    chapterName: string;
    chapterNumber: number;
    resources: NCERTResourceLink[];
    directReadUrl?: string; // Link to read online without downloading
}

/**
 * Get official NCERT chapter reading links (no downloads)
 * Links to official NCERT website or Google Drive mirrors
 */
export function getNcertChapterLinks(
    class_num: string,
    subject: string,
    chapter: number
): ChapterResource {
    // Official NCERT online reading URL
    const ncertWebUrl = `https://ncert.nic.in/textbook`;

    // Alternative readable mirrors with viewer
    const readableMirrors: NCERTResourceLink[] = [
        {
            title: 'NCERT Official Website',
            url: `${ncertWebUrl}?subject=${subject}&class=${class_num}`,
            source: 'ncert_official',
            type: 'web',
            description: 'Official NCERT textbook viewer - read online without download',
        },
        {
            title: 'Google Drive Mirror (Class-wise)',
            url: `https://drive.google.com/drive/folders/1-all-ncert-books`,
            source: 'gdrive',
            type: 'pdf',
            description: 'Community-maintained Google Drive with NCERT textbooks - open in Google Docs viewer',
        },
        {
            title: 'Read Online (PDFRoom)',
            url: `https://pdfroom.com/books/ncert-${subject.toLowerCase()}-class-${class_num}`,
            source: 'pdfroom',
            type: 'web',
            description: 'Read online in browser - no download needed, page-by-page viewing',
        },
    ];

    return {
        chapterName: `Chapter ${chapter}`,
        chapterNumber: chapter,
        resources: readableMirrors,
        directReadUrl: `${ncertWebUrl}?subject=${subject}&class=${class_num}&chapter=${chapter}`,
    };
}

/**
 * Get all reading resources for a topic
 * Combines NCERT chapters with supplementary materials
 */
export function getTopicReadingResources(
    class_num: string,
    subject: string,
    topic: string,
    chapter: number
): { resources: NCERTResourceLink[]; summary: string } {
    const resources: NCERTResourceLink[] = [];

    // Add NCERT chapter links
    const ncertChapter = getNcertChapterLinks(class_num, subject, chapter);
    resources.push(...ncertChapter.resources);

    // Add supplementary reading resources
    const supplementary: NCERTResourceLink[] = [
        {
            title: `${topic} - Class ${class_num} Explained`,
            url: `https://www.youtube.com/results?search_query=NCERT+${subject}+${topic}+class+${class_num}`,
            source: 'scribd',
            type: 'web',
            description: 'Video explanations and problem walkthroughs on YouTube',
        },
        {
            title: 'OpenStax Alternative Textbook',
            url: `https://openstax.org/subjects/science-and-engineering`,
            source: 'readable_mirror',
            type: 'web',
            description: 'Free alternative textbooks with similar content',
        },
    ];

    resources.push(...supplementary);

    return {
        resources,
        summary: `Access official NCERT textbook for ${subject} Chapter ${chapter} online. All resources are accessible without downloading. Click any link to open in your browser.`,
    };
}

/**
 * Generate a clickable HTML card for each resource
 */
export function generateResourceCard(resource: NCERTResourceLink): string {
    const sourceEmoji = {
        ncert_official: '📚',
        readable_mirror: '👁️',
        gdrive: '☁️',
        pdfroom: '📖',
        scribd: '✏️',
    };

    return `
    <div class="resource-card p-4 rounded-lg border-3 border-[#2C241B] shadow-neo hover:bg-[#FCFAF8] :bg-stone-800/50 cursor-pointer transition">
      <div class="flex items-start gap-3">
        <span class="text-xl">${sourceEmoji[resource.source]}</span>
        <div class="flex-1">
          <a href="${resource.url}" target="_blank" rel="noopener noreferrer" class="font-bold text-[#8C5A35] hover:underline">
            ${resource.title}
          </a>
          <p class="text-sm text-stone-600 mt-1">${resource.description}</p>
          <span class="text-xs bg-[#F2EFE9] px-2 py-1 rounded mt-2 inline-block">
            ${resource.type === 'web' ? '🌐 Online' : '📄 PDF Viewer'}
          </span>
        </div>
      </div>
    </div>
  `;
}

/**
 * Get NCERT book metadata for linking
 */
export const NCERT_BOOK_LINKS = {
    '10': {
        'Science': 'https://ncert.nic.in/textbook?subject=science&class=10',
        'Mathematics': 'https://ncert.nic.in/textbook?subject=mathematics&class=10',
        'Social Studies': 'https://ncert.nic.in/textbook?subject=social-science&class=10',
        'English': 'https://ncert.nic.in/textbook?subject=english&class=10',
    },
    '11': {
        'Physics': 'https://ncert.nic.in/textbook?subject=physics&class=11',
        'Chemistry': 'https://ncert.nic.in/textbook?subject=chemistry&class=11',
        'Biology': 'https://ncert.nic.in/textbook?subject=biology&class=11',
        'Mathematics': 'https://ncert.nic.in/textbook?subject=mathematics&class=11',
    },
    '12': {
        'Physics': 'https://ncert.nic.in/textbook?subject=physics&class=12',
        'Chemistry': 'https://ncert.nic.in/textbook?subject=chemistry&class=12',
        'Biology': 'https://ncert.nic.in/textbook?subject=biology&class=12',
        'Mathematics': 'https://ncert.nic.in/textbook?subject=mathematics&class=12',
    },
} as const;

/**
 * Get direct link to NCERT resources (no embedding needed)
 */
export function getDirectNcertLink(class_num: string, subject: string): string {
    // Priority: official NCERT → generic NCERT
    const classLinks = NCERT_BOOK_LINKS[class_num as keyof typeof NCERT_BOOK_LINKS];
    const officialUrl = classLinks && subject in classLinks
        ? classLinks[subject as keyof typeof classLinks]
        : undefined;

    if (officialUrl) {
        return officialUrl;
    }

    // Fallback to generic NCERT site
    return `https://ncert.nic.in/textbook`;
}

/**
 * Generate right-click context menu for text selection
 * Allows users to get definitions/summaries of selected text
 */
export function getContextMenuActions(selectedText: string) {
    return {
        define: `https://www.google.com/search?q=definition+${encodeURIComponent(selectedText)}`,
        summarize: `https://www.bing.com/search?q=${encodeURIComponent(selectedText)}+explained`,
        search: `https://scholar.google.com/scholar?q=${encodeURIComponent(selectedText)}`,
    };
}
