/** @jest-environment node */
import { buildReleaseNotes, type ReleaseMergeRequest } from './buildNotes';

const mr = (overrides: Partial<ReleaseMergeRequest> = {}): ReleaseMergeRequest => ({
    iid: 1148,
    title: 'POD report: items, weight and job history',
    webUrl: 'https://git.customd.com/urgent-couriers/despatchweb/-/merge_requests/1148',
    authorName: 'Jacob T',
    description: [
        '## What changed',
        'The POD report now lists items and weight.',
        '',
        '## How to test',
        'Export a POD for a completed job.',
    ].join('\n'),
    ...overrides,
});

describe('buildReleaseNotes', () => {
    it('renders a heading, the range and one entry per merge request', () => {
        const notes = buildReleaseNotes({
            title: 'Deployed to Production',
            sinceRef: 'a1b2c3d',
            mergeRequests: [mr()],
            directCommits: [],
        });

        expect(notes).toContain('# Deployed to Production');
        expect(notes).toContain('Changes since `a1b2c3d`');
        expect(notes).toContain('### !1148 — POD report: items, weight and job history');
        expect(notes).toContain(
            '_Jacob T · [view MR](https://git.customd.com/urgent-couriers/despatchweb/-/merge_requests/1148)_',
        );
        expect(notes).toContain('The POD report now lists items and weight.');
        expect(notes).toContain('**How to test**');
        expect(notes).toContain('Export a POD for a completed job.');
        expect(notes).not.toContain('⚠️');
    });

    it('warns per missing section and counts incomplete items at the top instead of skipping them', () => {
        const notes = buildReleaseNotes({
            title: 'Deployed to Production',
            sinceRef: 'a1b2c3d',
            mergeRequests: [
                mr({ iid: 1, description: '' }),
                mr({ iid: 2, description: '## What changed\nSomething.' }),
            ],
            directCommits: [],
        });

        // A blank line before the blockquote, or markdown folds it into the paragraph above.
        expect(notes).toContain(
            [
                'Changes since `a1b2c3d`',
                '',
                '> ⚠️ 3 item(s) in this deployment are missing description or test steps.',
                '',
                '### !1',
            ].join('\n'),
        );
        expect(notes).toContain('⚠️ **No description supplied**');
        expect(notes).toContain('⚠️ **No test steps supplied**');
        expect(notes).toContain('### !1 — POD report: items, weight and job history');
        expect(notes).toContain('### !2 — POD report: items, weight and job history');
    });

    it('includes the optional risk section only when the author supplied one', () => {
        const withRisk = buildReleaseNotes({
            title: 'Deployed to Production',
            sinceRef: null,
            mergeRequests: [
                mr({ description: `${mr().description}\n\n## Risk / areas touched\nCheck the exports.` }),
            ],
            directCommits: [],
        });

        expect(withRisk).toContain('**Also check**');
        expect(withRisk).toContain('Check the exports.');
        expect(
            buildReleaseNotes({
                title: 'Deployed to Production',
                sinceRef: null,
                mergeRequests: [mr()],
                directCommits: [],
            }),
        ).not.toContain('**Also check**');
    });

    it('says so when the environment has no previous deployment or no changes at all', () => {
        const firstRun = buildReleaseNotes({
            title: 'Deployed to Production',
            sinceRef: null,
            mergeRequests: [],
            directCommits: [],
        });

        expect(firstRun).toContain('Changes in this deployment (no previous deployment found)');
        expect(firstRun).toContain('_No merge requests found for this deployment._');
    });

    it('lists commits pushed straight to master with a warning', () => {
        const notes = buildReleaseNotes({
            title: 'Deployed to Production',
            sinceRef: 'a1b2c3d',
            mergeRequests: [mr()],
            directCommits: [{ id: 'abc1234def', title: 'Bump nuget packages' }],
        });

        expect(notes).toContain('### ⚠️ Commits with no merge request');
        expect(notes).toContain('`abc1234` Bump nuget packages');
    });
});
