/** @jest-environment node */
import { buildReleaseNotes, type ReleaseMergeRequest, type ReleaseNotes } from './buildNotes';
import {
    buildDetailPost,
    buildDirectCommitPost,
    buildReleasePost,
    buildSummaryBlocks,
    chunkForSlack,
    slackDate,
    summaryText,
    toSlackMrkdwn,
    SLACK_SECTION_LIMIT,
    type SlackBlock,
} from './slackMessage';

const projectUrl = 'https://git.customd.com/urgent-couriers/despatchweb';
const sha = 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678';

const mr = (overrides: Partial<ReleaseMergeRequest> = {}): ReleaseMergeRequest => ({
    iid: 1152,
    title: 'Let DF Admin decide which dashboards a Network Partner can open',
    webUrl: `${projectUrl}/-/merge_requests/1152`,
    authorName: 'Jacob T',
    sourceBranch: 'feat/np-dashboard-visibility',
    labels: [],
    description: [
        '## New features',
        'DF Admin can now choose which dashboards a Network Partner sees.',
        '',
        '## What to test',
        'Log in as DF Admin and untick a dashboard.',
    ].join('\n'),
    ...overrides,
});

const notesFor = (mergeRequests: ReleaseMergeRequest[], directCommits: { id: string; title: string }[] = []) =>
    buildReleaseNotes({ mergeRequests, directCommits });

const summary = (notes: ReleaseNotes, overrides: Record<string, unknown> = {}): SlackBlock[] =>
    buildSummaryBlocks({
        environmentLabel: 'Production',
        environmentEmoji: '🚀',
        tenantCount: 8,
        deployedAt: '2026-09-02T04:12:00Z',
        sha,
        pipelineUrl: `${projectUrl}/-/pipelines/145503`,
        compareUrl: `${projectUrl}/-/compare/oldsha...${sha}`,
        notes,
        ...overrides,
    } as Parameters<typeof buildSummaryBlocks>[0]);

const textOf = (blocks: SlackBlock[]) =>
    blocks.map((block) => block.text?.text ?? block.elements?.[0].text ?? '').join('\n');

describe('toSlackMrkdwn', () => {
    it('converts markdown headings, bold and links into Slack mrkdwn', () => {
        const markdown = [
            '### Background',
            '_Jacob T · [view MR](https://git.customd.com/mr/1148)_',
            '**How to test**',
            '- Export a POD',
        ].join('\n');

        expect(toSlackMrkdwn(markdown)).toBe(
            [
                '*Background*',
                '_Jacob T · <https://git.customd.com/mr/1148|view MR>_',
                '*How to test*',
                '- Export a POD',
            ].join('\n'),
        );
    });

    it('leaves blockquotes, code spans and warning markers alone', () => {
        expect(toSlackMrkdwn('> ⚠️ 2 item(s) missing `rc-2026.09.1`')).toBe('> ⚠️ 2 item(s) missing `rc-2026.09.1`');
    });

    it('escapes angle brackets so Slack does not swallow component names', () => {
        expect(toSlackMrkdwn('Rebuilt on <DialogShell> & <DialogFooter>')).toBe(
            'Rebuilt on &lt;DialogShell&gt; &amp; &lt;DialogFooter&gt;',
        );
    });
});

describe('chunkForSlack', () => {
    it('keeps a short note in a single chunk', () => {
        expect(chunkForSlack('one\n\ntwo')).toEqual(['one\n\ntwo']);
    });

    it('splits on blank lines, packing each chunk under the Slack section limit', () => {
        const paragraph = 'x'.repeat(1400);
        const chunks = chunkForSlack([paragraph, paragraph, paragraph].join('\n\n'));

        expect(chunks).toHaveLength(2);
        chunks.forEach((chunk) => expect(chunk.length).toBeLessThanOrEqual(SLACK_SECTION_LIMIT));
        expect(chunks.join('').replace(/\n/g, '')).toBe('x'.repeat(4200));
    });

    it('hard-splits a single paragraph longer than the limit rather than dropping the overflow', () => {
        const chunks = chunkForSlack('y'.repeat(SLACK_SECTION_LIMIT + 500));

        expect(chunks).toHaveLength(2);
        expect(chunks[0]).toHaveLength(SLACK_SECTION_LIMIT);
        expect(chunks[1]).toHaveLength(500);
    });

    it('returns nothing for an empty note', () => {
        expect(chunkForSlack('')).toEqual([]);
    });
});

describe('slackDate', () => {
    it('emits a date token so every reader sees their own timezone, with a UTC fallback', () => {
        expect(slackDate('2026-09-02T04:12:00Z')).toBe(
            '<!date^1788322320^{date_short_pretty} at {time}|2026-09-02 04:12 UTC>',
        );
    });
});

describe('summaryText', () => {
    it('reads as a notification preview, counting only user-visible changes', () => {
        const notes = notesFor([
            mr({ iid: 1, sourceBranch: 'feat/a' }),
            mr({ iid: 2, sourceBranch: 'fix/b', description: '' }),
            mr({ iid: 3, sourceBranch: 'chore/c', description: '' }),
        ]);

        expect(summaryText('Production', notes)).toBe('Live on Production — 2 changes (1 fixed, 1 new)');
    });

    it('gets the singular right, and says so when nothing shipped', () => {
        expect(summaryText('Staging', notesFor([mr()]))).toBe('Live on Staging — 1 change (1 new)');
        expect(summaryText('Staging', notesFor([]))).toBe('Live on Staging — no changes found');
    });
});

describe('buildSummaryBlocks', () => {
    it('leads with the environment, then the count, then one bullet per change grouped by kind', () => {
        const blocks = summary(
            notesFor([
                mr({ iid: 1152 }),
                mr({
                    iid: 1146,
                    sourceBranch: 'fix/pod-images-on-scheduled-jobs',
                    webUrl: `${projectUrl}/-/merge_requests/1146`,
                    description: '## Bug Fixes\nPOD images now appear on exports for scheduled jobs.',
                }),
            ]),
        );

        expect(blocks[0]).toEqual({
            type: 'header',
            text: { type: 'plain_text', text: '🚀 Live on Production', emoji: true },
        });
        expect(blocks[1].elements?.[0].text).toBe('8 tenants · <!date^1788322320^{date_short_pretty} at {time}|2026-09-02 04:12 UTC>');
        expect(blocks[2].text?.text).toBe('*2 changes*  ·  1 fixed · 1 new');
        expect(blocks[3]).toEqual({ type: 'divider' });

        const body = textOf(blocks);
        expect(body).toContain(
            `*Bug Fixes*\n• POD images now appear on exports for scheduled jobs.  <${projectUrl}/-/merge_requests/1146|!1146>`,
        );
        expect(body).toContain(
            `*New features*\n• DF Admin can now choose which dashboards a Network Partner sees.  <${projectUrl}/-/merge_requests/1152|!1152>`,
        );
    });

    it('lists maintenance work as its own group instead of collapsing it to a count', () => {
        const body = textOf(
            summary(
                notesFor([
                    mr({ iid: 1, sourceBranch: 'feat/a' }),
                    mr({ iid: 2, sourceBranch: 'chore/b', description: '## Maintenance\nBumped NuGet packages.' }),
                ]),
            ),
        );

        expect(body).toContain('*1 change*  ·  1 new');
        expect(body).toContain(`*Maintenance*\n• Bumped NuGet packages.  <${projectUrl}/-/merge_requests/1152|!2>`);
    });

    it('puts the commit, links and any missing test steps in a quiet footer, not at the top', () => {
        const blocks = summary(notesFor([mr({ description: '## Bug Fixes\nSomething.' })]));
        const footer = blocks.at(-1)?.elements?.[0].text ?? '';

        expect(footer).toBe(
            `\`a1b2c3d4\` · <${projectUrl}/-/pipelines/145503|pipeline> · <${projectUrl}/-/compare/oldsha...${sha}|compare> · ⚠️ 1 change has no test steps`,
        );
        expect(blocks[2].text?.text).not.toContain('⚠️');
    });

    it('drops the compare link and the warning when there is nothing to say', () => {
        const footer = summary(notesFor([mr()]), { compareUrl: null }).at(-1)?.elements?.[0].text ?? '';

        expect(footer).toBe(`\`a1b2c3d4\` · <${projectUrl}/-/pipelines/145503|pipeline>`);
    });

    it('omits the tenant count and timestamp on a single-environment stage', () => {
        const blocks = summary(notesFor([mr()]), { tenantCount: 1, deployedAt: null });

        expect(blocks[1].type).toBe('section');
    });

    it('says so plainly when a deployment carried no merge requests', () => {
        expect(textOf(summary(notesFor([])))).toContain('_No merge requests in this deployment._');
    });

    it('says so when everything in the deployment was maintenance', () => {
        const body = textOf(
            summary(notesFor([mr({ sourceBranch: 'chore/bump', description: '## Maintenance\nBumped dependencies.' })])),
        );

        expect(body).toContain('*No user-visible changes* in this deployment.');
        expect(body).toContain('*Maintenance*\n• Bumped dependencies.');
    });
});

describe('buildDetailPost', () => {
    it('carries the tester detail: who, what, how to test and what else to check', () => {
        const [change] = notesFor([
            mr({ description: `${mr().description}\n\n## Risk / areas touched\nCheck the exports.` }),
        ]).changes;
        const post = buildDetailPost(change);
        const body = textOf(post.blocks);

        expect(post.text).toBe('!1152 — Let DF Admin decide which dashboards a Network Partner can open');
        expect(body).toContain(
            `*!1152 — Let DF Admin decide which dashboards a Network Partner can open*\n_Jacob T · <${projectUrl}/-/merge_requests/1152|view MR>_`,
        );
        expect(body).toContain('DF Admin can now choose which dashboards a Network Partner sees.');
        expect(body).toContain('*How to test*\nLog in as DF Admin and untick a dashboard.');
        expect(body).toContain('*Also check*\nCheck the exports.');
    });

    it('keeps the warning against the change itself when the author left a section empty', () => {
        const [change] = notesFor([mr({ description: '' })]).changes;
        const body = textOf(buildDetailPost(change).blocks);

        expect(body).toContain('⚠️ *No description supplied* — see the MR.');
        expect(body).toContain('⚠️ *No test steps supplied* — check with the author before signing off.');
    });
});

describe('buildDirectCommitPost', () => {
    it('lists commits pushed straight to master with a warning', () => {
        const body = textOf(buildDirectCommitPost([{ id: 'abc1234def', title: 'Bump nuget packages' }]).blocks);

        expect(body).toContain('*⚠️ Commits with no merge request*');
        expect(body).toContain('• `abc1234` Bump nuget packages');
    });
});

describe('buildReleasePost', () => {
    it('posts one thread reply per change, plus one for any direct commits', () => {
        const post = buildReleasePost({
            environmentLabel: 'Production',
            environmentEmoji: '🚀',
            tenantCount: 8,
            deployedAt: '2026-09-02T04:12:00Z',
            sha,
            pipelineUrl: `${projectUrl}/-/pipelines/145503`,
            compareUrl: null,
            notes: notesFor([mr({ iid: 1 }), mr({ iid: 2 })], [{ id: 'abc1234def', title: 'Bump nuget packages' }]),
        });

        expect(post.text).toBe('Live on Production — 2 changes (2 new)');
        expect(post.replies).toHaveLength(3);
        expect(post.replies.at(-1)?.text).toBe('1 commit with no merge request');
    });

    it('keeps every message well inside the 50-block cap even for a huge deployment', () => {
        const mergeRequests = Array.from({ length: 60 }, (_, i) => mr({ iid: i + 1 }));
        const post = buildReleasePost({
            environmentLabel: 'Production',
            environmentEmoji: '🚀',
            tenantCount: 8,
            deployedAt: null,
            sha,
            pipelineUrl: `${projectUrl}/-/pipelines/145503`,
            compareUrl: null,
            notes: notesFor(mergeRequests),
        });

        expect(post.blocks.length).toBeLessThan(50);
        post.replies.forEach((reply) => expect(reply.blocks.length).toBeLessThan(50));
    });
});
