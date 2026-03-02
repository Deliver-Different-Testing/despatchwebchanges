/**
 * markdownToSafeHtml Unit Tests
 *
 * Tests the lightweight markdown-to-HTML converter used by the AngularJS
 * AI dialog. Validates formatting, sanitization, and edge cases.
 */

import { markdownToSafeHtml } from './markdownToHtml';

describe('markdownToSafeHtml', () => {
    describe('Edge cases', () => {
        it('returns empty string for empty input', () => {
            expect(markdownToSafeHtml('')).toBe('');
        });

        it('returns empty string for null-ish input', () => {
            expect(markdownToSafeHtml(null as unknown as string)).toBe('');
            expect(markdownToSafeHtml(undefined as unknown as string)).toBe('');
        });
    });

    describe('Plain text', () => {
        it('passes through plain text', () => {
            expect(markdownToSafeHtml('Hello world')).toBe('Hello world');
        });

        it('handles multiple plain text lines', () => {
            const result = markdownToSafeHtml('Line one\nLine two');
            expect(result).toContain('Line one');
            expect(result).toContain('Line two');
        });
    });

    describe('HTML escaping', () => {
        it('escapes HTML angle brackets', () => {
            const result = markdownToSafeHtml('<script>alert("xss")</script>');
            expect(result).not.toContain('<script>');
            expect(result).toContain('&lt;script&gt;');
        });

        it('escapes ampersands', () => {
            const result = markdownToSafeHtml('Tom & Jerry');
            expect(result).toContain('Tom &amp; Jerry');
        });

        it('escapes double quotes', () => {
            const result = markdownToSafeHtml('He said "hello"');
            expect(result).toContain('&quot;hello&quot;');
        });

        it('escapes HTML inside list items', () => {
            const result = markdownToSafeHtml('- Item with <b>html</b>');
            expect(result).toContain('&lt;b&gt;');
            expect(result).not.toContain('<b>html</b>');
        });
    });

    describe('Bold formatting', () => {
        it('converts **text** to <strong> tags', () => {
            const result = markdownToSafeHtml('This is **bold** text');
            expect(result).toContain('<strong>bold</strong>');
        });

        it('handles multiple bold segments', () => {
            const result = markdownToSafeHtml('**first** and **second**');
            expect(result).toContain('<strong>first</strong>');
            expect(result).toContain('<strong>second</strong>');
        });

        it('handles bold inside list items', () => {
            const result = markdownToSafeHtml('- **Important** item');
            expect(result).toContain('<strong>Important</strong>');
            expect(result).toContain('<li');
        });
    });

    describe('Unordered lists', () => {
        it('converts dash-prefixed items to <ul><li>', () => {
            const result = markdownToSafeHtml('- Item one\n- Item two');
            expect(result).toContain('<ul');
            expect(result).toContain('<li');
            expect(result).toContain('Item one');
            expect(result).toContain('Item two');
            expect(result).toContain('</ul>');
        });

        it('converts asterisk-prefixed items to <ul><li>', () => {
            const result = markdownToSafeHtml('* Alpha\n* Beta');
            expect(result).toContain('<ul');
            expect(result).toContain('Alpha');
            expect(result).toContain('Beta');
        });

        it('closes list when non-list content follows', () => {
            const result = markdownToSafeHtml('- Item\nPlain text');
            expect(result).toContain('</ul>');
            expect(result).toContain('Plain text');
        });
    });

    describe('Ordered lists', () => {
        it('converts numbered items to <ol><li>', () => {
            const result = markdownToSafeHtml('1. First\n2. Second\n3. Third');
            expect(result).toContain('<ol');
            expect(result).toContain('First');
            expect(result).toContain('Second');
            expect(result).toContain('Third');
            expect(result).toContain('</ol>');
        });

        it('closes ordered list when non-list content follows', () => {
            const result = markdownToSafeHtml('1. Item\nAfter list');
            expect(result).toContain('</ol>');
            expect(result).toContain('After list');
        });
    });

    describe('List type transitions', () => {
        it('transitions from unordered to ordered list', () => {
            const result = markdownToSafeHtml('- Bullet\n1. Number');
            expect(result).toContain('</ul>');
            expect(result).toContain('<ol');
        });

        it('transitions from ordered to unordered list', () => {
            const result = markdownToSafeHtml('1. Number\n- Bullet');
            expect(result).toContain('</ol>');
            expect(result).toContain('<ul');
        });
    });

    describe('Headers', () => {
        it('converts # header to styled div', () => {
            const result = markdownToSafeHtml('# Title');
            expect(result).toContain('<div style="font-weight: 600');
            expect(result).toContain('Title');
        });

        it('converts ## header to styled div', () => {
            const result = markdownToSafeHtml('## Subtitle');
            expect(result).toContain('<div style="font-weight: 600');
            expect(result).toContain('Subtitle');
        });

        it('converts ### header to styled div', () => {
            const result = markdownToSafeHtml('### Section');
            expect(result).toContain('<div style="font-weight: 600');
            expect(result).toContain('Section');
        });

        it('supports bold inside headers', () => {
            const result = markdownToSafeHtml('## **Status** Update');
            expect(result).toContain('<strong>Status</strong>');
        });
    });

    describe('Blank lines', () => {
        it('converts blank lines to <br/>', () => {
            const result = markdownToSafeHtml('Para one\n\nPara two');
            expect(result).toContain('<br/>');
        });
    });

    describe('Trailing list closure', () => {
        it('closes an open list at end of input', () => {
            const result = markdownToSafeHtml('- Last item');
            expect(result).toContain('</ul>');
        });

        it('closes an open ordered list at end of input', () => {
            const result = markdownToSafeHtml('1. Last item');
            expect(result).toContain('</ol>');
        });
    });

    describe('Complex mixed content', () => {
        it('handles a realistic AI summary', () => {
            const markdown = [
                '## **Status** — Active',
                '',
                '**Issues**',
                '- Late pickup: driver stuck in traffic',
                '- Customer complaint logged',
                '',
                '**Actions**',
                '1. Contact courier for ETA',
                '2. Update customer',
            ].join('\n');

            const result = markdownToSafeHtml(markdown);

            // Headers rendered
            expect(result).toContain('<strong>Status</strong>');
            // Blank line breaks
            expect(result).toContain('<br/>');
            // Unordered list
            expect(result).toContain('<ul');
            expect(result).toContain('Late pickup');
            // Ordered list
            expect(result).toContain('<ol');
            expect(result).toContain('Contact courier');
            // Both lists closed
            expect((result.match(/<\/ul>/g) || []).length).toBe(1);
            expect((result.match(/<\/ol>/g) || []).length).toBe(1);
        });
    });
});
