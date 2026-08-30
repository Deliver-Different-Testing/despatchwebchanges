/** @jest-environment node */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseMrSections, SECTION_HEADINGS } from './mrSections';

describe('parseMrSections', () => {
    it('extracts each section body, dropping the template comments', () => {
        const description = [
            '## What changed',
            '<!-- Plain English, written for a tester. -->',
            'Job search now pages over the full result set.',
            '',
            '## How to test',
            '1. Search a client over a fortnight.',
            '2. Page to the end — every row is reachable.',
            '',
            '## Risk / areas touched',
            'Regression-check archived job search.',
        ].join('\n');

        expect(parseMrSections(description)).toEqual({
            what: 'Job search now pages over the full result set.',
            test: '1. Search a client over a fortnight.\n2. Page to the end — every row is reachable.',
            risk: 'Regression-check archived job search.',
        });
    });

    // Trailing content after the last heading belongs to that section — cutting it
    // would risk dropping real test steps to save a footer line.
    it('accepts the previous template headings so merge requests already open still parse', () => {
        const description = [
            '# Fix job search paging',
            '',
            '## What I did',
            '+ Paged over the real result set',
            '',
            '## Implications',
            'Touches the archived search path.',
            '',
            '## How to test',
            '+ Search and page to the end',
            '',
            '**Task: https://example.test/T-1**',
        ].join('\n');

        expect(parseMrSections(description)).toEqual({
            what: '+ Paged over the real result set',
            test: '+ Search and page to the end\n\n**Task: https://example.test/T-1**',
            risk: 'Touches the archived search path.',
        });
    });

    it('returns empty strings for missing, comment-only and placeholder-only sections', () => {
        const description = [
            '## What changed',
            '<!-- nothing but guidance -->',
            '',
            '## How to test',
            '+ {{step 1}}',
            '+ {{step 2}}',
        ].join('\n');

        expect(parseMrSections(description)).toEqual({ what: '', test: '', risk: '' });
        expect(parseMrSections(null)).toEqual({ what: '', test: '', risk: '' });
        expect(parseMrSections('')).toEqual({ what: '', test: '', risk: '' });
    });

    it('stops a section at the next heading of any level and keeps nested content', () => {
        const description = [
            '## What changed',
            'Line one.',
            '',
            '### Detail',
            'Nested detail stays with the section.',
            '',
            '# How to test',
            'Steps.',
        ].join('\n');

        const sections = parseMrSections(description);
        expect(sections.what).toBe('Line one.\n\n### Detail\nNested detail stays with the section.');
        expect(sections.test).toBe('Steps.');
    });

    it('is the parsing contract for the checked-in merge request template', () => {
        const template = readFileSync(
            join(__dirname, '..', '..', '.gitlab', 'merge_request_templates', 'Merge-Request.md'),
            'utf8',
        );

        for (const { canonical } of Object.values(SECTION_HEADINGS)) {
            expect(template).toContain(`## ${canonical}`);
        }
        expect(parseMrSections(template)).toEqual({ what: '', test: '', risk: '' });
    });
});
