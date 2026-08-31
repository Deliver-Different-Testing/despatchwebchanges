/** @jest-environment node */
import {
    buildSlackBlocks,
    chunkForSlack,
    toSlackMrkdwn,
    SLACK_BLOCK_LIMIT,
    SLACK_SECTION_LIMIT,
} from './slackMessage';

describe('toSlackMrkdwn', () => {
    it('converts the markdown the note generator emits into Slack mrkdwn', () => {
        const markdown = [
            '# Release candidate rc-2026.09.1',
            '### !1148 — POD report',
            '_Jacob T · [view MR](https://git.customd.com/mr/1148)_',
            '**How to test**',
            '- Export a POD',
        ].join('\n');

        expect(toSlackMrkdwn(markdown)).toBe(
            [
                '*Release candidate rc-2026.09.1*',
                '*!1148 — POD report*',
                '_Jacob T · <https://git.customd.com/mr/1148|view MR>_',
                '*How to test*',
                '- Export a POD',
            ].join('\n'),
        );
    });

    it('leaves blockquotes, code spans and warning markers alone', () => {
        expect(toSlackMrkdwn('> ⚠️ 2 item(s) missing `rc-2026.09.1`')).toBe('> ⚠️ 2 item(s) missing `rc-2026.09.1`');
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

describe('buildSlackBlocks', () => {
    const projectUrl = 'https://git.customd.com/urgent-couriers/despatchweb';
    const message = {
        environmentLabel: 'Tenant staging',
        sha: 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678',
        pipelineUrl: `${projectUrl}/-/pipelines/145503`,
        compareUrl: `${projectUrl}/-/compare/oldsha...a1b2c3d4e5f60718293a4b5c6d7e8f9012345678`,
        notes: '**All good**',
    };

    it('marks the environment in the header and the commit and range in the context line', () => {
        const blocks = buildSlackBlocks(message);

        expect(blocks[0]).toEqual({
            type: 'header',
            text: { type: 'plain_text', text: 'Deployed to Tenant staging', emoji: true },
        });

        const context = blocks[1].elements?.[0].text ?? '';
        expect(context).toContain('a1b2c3d4');
        expect(context).toContain(`<${message.pipelineUrl}|pipeline>`);
        expect(context).toContain(`<${message.compareUrl}|changes>`);
        expect(blocks[2]).toEqual({ type: 'divider' });
        expect(blocks[3]).toEqual({ type: 'section', text: { type: 'mrkdwn', text: '*All good*' } });
    });

    it('drops the range link when the environment has no previous deployment to compare against', () => {
        const context = buildSlackBlocks({ ...message, compareUrl: null })[1].elements?.[0].text ?? '';

        expect(context).not.toContain('|changes>');
        expect(context).toContain(`<${message.pipelineUrl}|pipeline>`);
    });

    it('truncates and links out rather than failing when a deployment exceeds the Slack block cap', () => {
        const notes = Array.from({ length: 200 }, (_, i) => `${'z'.repeat(2000)}${i}`).join('\n\n');
        const blocks = buildSlackBlocks({ ...message, notes });

        expect(blocks.length).toBeLessThanOrEqual(SLACK_BLOCK_LIMIT);
        expect(JSON.stringify(blocks.at(-1))).toContain('too long to post in full');
        expect(JSON.stringify(blocks.at(-1))).toContain(message.compareUrl);
    });

    it('falls back to the pipeline when a truncated deployment has no range to link', () => {
        const notes = Array.from({ length: 200 }, (_, i) => `${'z'.repeat(2000)}${i}`).join('\n\n');
        const blocks = buildSlackBlocks({ ...message, compareUrl: null, notes });

        expect(JSON.stringify(blocks.at(-1))).toContain(message.pipelineUrl);
    });
});
