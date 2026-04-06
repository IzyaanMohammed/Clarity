export type ParsedMarkdownTable = {
    headers: string[];
    rows: string[][];
};

const normalizeCell = (value: string) => value.trim().replace(/^\|/, '').replace(/\|$/, '').trim();

export const parseMarkdownTable = (block: string): ParsedMarkdownTable | null => {
    const lines = (block || '')
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);

    const tableLines = lines.filter((line) => line.includes('|'));
    if (tableLines.length < 2) return null;

    const headers = normalizeCell(tableLines[0])
        .split('|')
        .map((cell) => cell.trim())
        .filter(Boolean);

    const rows = tableLines
        .slice(2)
        .map((line) => normalizeCell(line).split('|').map((cell) => cell.trim()))
        .filter((row) => row.some((cell) => cell.length > 0));

    if (!headers.length || !rows.length) return null;
    return { headers, rows };
};

export const extractMarkdownSection = (content: string, section: string, nextSections: string[]) => {
    const escaped = section.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const next = nextSections
        .map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
        .join('|');
    const regex = new RegExp(`##\\s*${escaped}([\\s\\S]*?)(?=##\\s*(?:${next})|$)`, 'i');
    const match = content.match(regex);
    return (match?.[1] || '').trim();
};

export const formatQuickRecallBlock = (block: string) => {
    const lines = (block || '')
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);

    return lines
        .map((line) => {
            const cleanedLine = line.replace(/^[-*]\s*/, '');
            const normalizedLine = cleanedLine.replace(/\(\s*([^()]+?)\s*\)/g, (_, inner: string) => `$${inner.trim()}$`);
            return `- ${normalizedLine}`;
        })
        .join('\n');
};