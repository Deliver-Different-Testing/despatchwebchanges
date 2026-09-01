/** @jest-environment node */
import { buildReleaseNotes, countByType, headlineFor, type ReleaseMergeRequest } from './buildNotes';

const mr = (overrides: Partial<ReleaseMergeRequest> = {}): ReleaseMergeRequest => ({
    iid: 1148,
    title: 'POD report: items, weight and job history',
    webUrl: 'https://git.customd.com/urgent-couriers/despatchweb/-/merge_requests/1148',
    authorName: 'Jacob T',
    sourceBranch: 'feat/pod-report-2.0.49',
    labels: [],
    description: [
        '## What changed',
        'The POD report now lists items and weight. It also shows job history.',
        '',
        '## How to test',
        'Export a POD for a completed job.',
    ].join('\n'),
    ...overrides,
});

describe('headlineFor', () => {
    it('takes the first sentence of the description', () => {
        expect(headlineFor('The POD report now lists items and weight. It also shows history.', 'Title')).toBe(
            'The POD report now lists items and weight.',
        );
    });

    it('skips headings and quotes, and unwraps the first bullet', () => {
        expect(headlineFor('### Background\n\n- Drivers can now be archived.\n- And restored.', 'Title')).toBe(
            'Drivers can now be archived.',
        );
        expect(headlineFor('> note\n1. Numbered lead-in.', 'Title')).toBe('Numbered lead-in.');
    });

    it('uses the merge request title when the section is empty or unusable', () => {
        expect(headlineFor('', 'POD report: items and weight')).toBe('POD report: items and weight');
        expect(headlineFor('## Only a heading', 'POD report: items and weight')).toBe('POD report: items and weight');
    });

    it('truncates a run-on sentence rather than flooding the channel summary', () => {
        const headline = headlineFor(`${'word '.repeat(60)}end.`, 'Title');

        expect(headline).toHaveLength(140);
        expect(headline.endsWith('…')).toBe(true);
    });
});

describe('buildReleaseNotes', () => {
    it('classifies each merge request and pulls out its headline and sections', () => {
        const notes = buildReleaseNotes({ mergeRequests: [mr()], directCommits: [] });

        expect(notes.changes).toHaveLength(1);
        expect(notes.changes[0]).toMatchObject({
            iid: 1148,
            type: 'new',
            headline: 'The POD report now lists items and weight.',
            test: 'Export a POD for a completed job.',
            risk: '',
        });
        expect(notes.missingTestSteps).toBe(0);
    });

    it('keeps a change with no description or test steps, and counts it as unsignable', () => {
        const notes = buildReleaseNotes({
            mergeRequests: [mr({ iid: 1, description: '' }), mr({ iid: 2, description: '## What changed\nSomething.' })],
            directCommits: [],
        });

        expect(notes.changes.map((change) => change.iid)).toEqual([1, 2]);
        expect(notes.changes[0].headline).toBe('POD report: items, weight and job history');
        expect(notes.changes[0].what).toBe('');
        expect(notes.missingTestSteps).toBe(2);
    });

    it('counts commits pushed straight to master as missing test steps too', () => {
        const notes = buildReleaseNotes({
            mergeRequests: [mr()],
            directCommits: [{ id: 'abc1234def', title: 'Bump nuget packages' }],
        });

        expect(notes.directCommits).toEqual([{ id: 'abc1234def', title: 'Bump nuget packages' }]);
        expect(notes.missingTestSteps).toBe(1);
    });

    it('keeps the optional risk section when the author supplied one', () => {
        const notes = buildReleaseNotes({
            mergeRequests: [mr({ description: `${mr().description}\n\n## Risk / areas touched\nCheck the exports.` })],
            directCommits: [],
        });

        expect(notes.changes[0].risk).toBe('Check the exports.');
    });

    it('tallies the changes by type', () => {
        const notes = buildReleaseNotes({
            mergeRequests: [
                mr({ iid: 1, sourceBranch: 'feat/a' }),
                mr({ iid: 2, sourceBranch: 'feat/b' }),
                mr({ iid: 3, sourceBranch: 'fix/c' }),
                mr({ iid: 4, sourceBranch: 'chore/d' }),
                mr({ iid: 5, sourceBranch: 'WhateverThisIs' }),
            ],
            directCommits: [],
        });

        expect(countByType(notes)).toEqual({ new: 2, improved: 0, fixed: 1, internal: 1, other: 1 });
    });
});
