/** @jest-environment node */
import { postRelease } from './slackClient';
import type { ReleasePost } from './slackMessage';

const release: ReleasePost = {
    text: 'Live on Production — 2 changes (1 new, 1 fixed)',
    blocks: [{ type: 'section', text: { type: 'mrkdwn', text: '*2 changes*' } }],
    replies: [
        { text: '!1152 — Dashboards', blocks: [{ type: 'section', text: { type: 'mrkdwn', text: 'How to test' } }] },
        { text: '!1146 — POD images', blocks: [{ type: 'section', text: { type: 'mrkdwn', text: 'How to test' } }] },
    ],
    webhookNote: '_Test steps are in each merge request linked above._',
};

const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

const botDestination = (fetchImpl: jest.Mock) => ({
    botToken: 'xoxb-secret',
    channel: 'C123',
    apiUrl: 'https://slack.test/api',
    fetchImpl: fetchImpl as unknown as typeof fetch,
});

describe('postRelease with a bot token', () => {
    it('posts the summary, then hangs every detail off it as a thread reply', async () => {
        // A Response body can only be read once, so each call needs its own.
        const fetchImpl = jest.fn().mockImplementation(async () => ok({ ok: true, ts: '1788322320.001' }));

        expect(await postRelease(release, botDestination(fetchImpl))).toBe(3);
        expect(fetchImpl).toHaveBeenCalledTimes(3);

        const [url, init] = fetchImpl.mock.calls[0];
        expect(url).toBe('https://slack.test/api/chat.postMessage');
        expect(init.headers.Authorization).toBe('Bearer xoxb-secret');
        expect(JSON.parse(init.body)).toEqual({ channel: 'C123', text: release.text, blocks: release.blocks });

        const replies = fetchImpl.mock.calls.slice(1).map(([, call]) => JSON.parse(call.body));
        expect(replies.map((reply) => reply.thread_ts)).toEqual(['1788322320.001', '1788322320.001']);
        expect(replies.map((reply) => reply.text)).toEqual(['!1152 — Dashboards', '!1146 — POD images']);
    });

    it('fails loudly when Slack refuses, which it does with a 200 and an error in the body', async () => {
        const fetchImpl = jest.fn().mockResolvedValue(ok({ ok: false, error: 'not_in_channel' }));

        await expect(postRelease(release, botDestination(fetchImpl))).rejects.toThrow(
            'Slack chat.postMessage failed: not_in_channel.',
        );
    });

    it('reports the status code and never the token when the request itself fails', async () => {
        const fetchImpl = jest.fn().mockResolvedValue(new Response('nope', { status: 429 }));

        await expect(postRelease(release, botDestination(fetchImpl))).rejects.toThrow(
            /^Slack chat\.postMessage returned 429\.$/,
        );
    });
});

describe('postRelease with only a webhook', () => {
    it('posts the summary alone and points at the merge requests, since a webhook cannot thread', async () => {
        const fetchImpl = jest.fn().mockResolvedValue(new Response('ok', { status: 200 }));

        expect(
            await postRelease(release, {
                webhookUrl: 'https://hooks.slack.test/abc',
                fetchImpl: fetchImpl as unknown as typeof fetch,
            }),
        ).toBe(1);

        expect(fetchImpl).toHaveBeenCalledTimes(1);
        const body = JSON.parse(fetchImpl.mock.calls[0][1].body);
        expect(body.text).toBe(release.text);
        expect(body.blocks.at(-1)).toEqual({
            type: 'context',
            elements: [{ type: 'mrkdwn', text: '_Test steps are in each merge request linked above._' }],
        });
    });

    it('throws on a webhook failure', async () => {
        const fetchImpl = jest.fn().mockResolvedValue(new Response('invalid_payload', { status: 400 }));

        await expect(
            postRelease(release, {
                webhookUrl: 'https://hooks.slack.test/abc',
                fetchImpl: fetchImpl as unknown as typeof fetch,
            }),
        ).rejects.toThrow('Slack webhook returned 400: invalid_payload');
    });
});

describe('postRelease with nothing configured', () => {
    it('says which variables are missing rather than silently doing nothing', async () => {
        await expect(postRelease(release, {})).rejects.toThrow(/SLACK_BOT_TOKEN and SLACK_RELEASE_CHANNEL/);
    });
});
