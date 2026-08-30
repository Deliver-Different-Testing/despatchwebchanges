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

    it('opens with the tag, a link to the release and a divider', () => {
        const blocks = buildSlackBlocks({ tag: 'rc-2026.09.1', projectUrl, notes: '**All good**' });

        expect(blocks[0]).toEqual({
            type: 'header',
            text: { type: 'plain_text', text: 'Release candidate rc-2026.09.1', emoji: true },
        });
        expect(blocks[1].elements?.[0].text).toContain(`${projectUrl}/-/releases/rc-2026.09.1`);
        expect(blocks[2]).toEqual({ type: 'divider' });
        expect(blocks[3]).toEqual({ type: 'section', text: { type: 'mrkdwn', text: '*All good*' } });
    });

    it('truncates and links out rather than failing when a release exceeds the Slack block cap', () => {
        const notes = Array.from({ length: 200 }, (_, i) => `${'z'.repeat(2000)}${i}`).join('\n\n');
        const blocks = buildSlackBlocks({ tag: 'rc-2026.09.1', projectUrl, notes });

        expect(blocks.length).toBeLessThanOrEqual(SLACK_BLOCK_LIMIT);
        expect(JSON.stringify(blocks.at(-1))).toContain('too long to post in full');
        expect(JSON.stringify(blocks.at(-1))).toContain(`${projectUrl}/-/releases/rc-2026.09.1`);
    });
});
