/**
 * Lightweight markdown-to-HTML converter for AngularJS dialog content.
 * Handles the subset of markdown produced by our AI prompts:
 * bold, bullet/numbered lists, headers, and newlines.
 * Output is sanitized — no raw user input passes through unescaped.
 */

function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

export function markdownToSafeHtml(markdown: string): string {
    if (!markdown) return '';

    const lines = markdown.split('\n');
    const htmlLines: string[] = [];
    let inList: 'ul' | 'ol' | null = null;

    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];

        // Check for list items before escaping (need raw chars)
        const ulMatch = line.match(/^(\s*)[-*]\s+(.+)/);
        const olMatch = line.match(/^(\s*)\d+\.\s+(.+)/);
        const headerMatch = line.match(/^(#{1,3})\s+(.+)/);

        if (ulMatch) {
            if (inList !== 'ul') {
                if (inList) htmlLines.push(`</${inList}>`);
                htmlLines.push('<ul style="padding-left: 20px; margin: 4px 0;">');
                inList = 'ul';
            }
            htmlLines.push(`<li style="margin-bottom: 2px;">${formatInline(ulMatch[2])}</li>`);
            continue;
        }

        if (olMatch) {
            if (inList !== 'ol') {
                if (inList) htmlLines.push(`</${inList}>`);
                htmlLines.push('<ol style="padding-left: 20px; margin: 4px 0;">');
                inList = 'ol';
            }
            htmlLines.push(`<li style="margin-bottom: 2px;">${formatInline(olMatch[2])}</li>`);
            continue;
        }

        // Close any open list
        if (inList) {
            htmlLines.push(`</${inList}>`);
            inList = null;
        }

        if (headerMatch) {
            htmlLines.push(`<div style="font-weight: 600; margin-top: 8px; margin-bottom: 4px;">${formatInline(headerMatch[2])}</div>`);
            continue;
        }

        // Blank line
        if (line.trim() === '') {
            htmlLines.push('<br/>');
            continue;
        }

        // Regular line
        htmlLines.push(formatInline(line));
    }

    // Close any open list
    if (inList) {
        htmlLines.push(`</${inList}>`);
    }

    return htmlLines.join('\n');
}

function formatInline(text: string): string {
    // Escape HTML first
    let result = escapeHtml(text);
    // Bold: **text**
    result = result.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    return result;
}
