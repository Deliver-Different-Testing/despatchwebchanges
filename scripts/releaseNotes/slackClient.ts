import { contextBlock, type ReleasePost, type SlackBlock } from './slackMessage';

/**
 * Posts the release note, preferring a bot token so the tester detail can go in a
 * thread. The incoming webhook is kept as a fallback: it cannot thread, so it gets
 * the summary alone. Neither credential is ever logged, including on failure.
 */
export const SLACK_API_URL = 'https://slack.com/api';

export interface SlackDestination {
    botToken?: string;
    channel?: string;
    webhookUrl?: string;
    apiUrl?: string;
    fetchImpl?: typeof fetch;
}

interface ChatPostMessageResponse {
    ok: boolean;
    ts?: string;
    error?: string;
}

async function chatPostMessage(
    destination: Required<Pick<SlackDestination, 'botToken' | 'channel'>> & SlackDestination,
    body: Record<string, unknown>,
): Promise<string> {
    const { botToken, apiUrl = SLACK_API_URL, fetchImpl = fetch } = destination;

    const response = await fetchImpl(`${apiUrl}/chat.postMessage`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json; charset=utf-8',
            Authorization: `Bearer ${botToken}`,
        },
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        throw new Error(`Slack chat.postMessage returned ${response.status}.`);
    }

    // Slack answers 200 even when it refuses; the verdict is in the body.
    const payload = (await response.json()) as ChatPostMessageResponse;
    if (!payload.ok) {
        throw new Error(`Slack chat.postMessage failed: ${payload.error ?? 'unknown error'}.`);
    }

    return payload.ts ?? '';
}

async function postToWebhook(
    webhookUrl: string,
    fetchImpl: typeof fetch,
    body: { text: string; blocks: SlackBlock[] },
): Promise<void> {
    const response = await fetchImpl(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        throw new Error(`Slack webhook returned ${response.status}: ${await response.text()}`);
    }
}

/** Returns how many messages were posted, for the job log. */
export async function postRelease(release: ReleasePost, destination: SlackDestination): Promise<number> {
    const { botToken, channel, webhookUrl, fetchImpl = fetch } = destination;

    if (botToken && channel) {
        const threadTs = await chatPostMessage({ ...destination, botToken, channel }, {
            channel,
            text: release.text,
            blocks: release.blocks,
        });

        for (const reply of release.replies) {
            await chatPostMessage({ ...destination, botToken, channel }, {
                channel,
                thread_ts: threadTs,
                text: reply.text,
                blocks: reply.blocks,
            });
        }

        return 1 + release.replies.length;
    }

    if (webhookUrl) {
        await postToWebhook(webhookUrl, fetchImpl, {
            text: release.text,
            blocks: release.webhookNote
                ? [...release.blocks, contextBlock(release.webhookNote)]
                : release.blocks,
        });

        return 1;
    }

    throw new Error(
        'No Slack destination configured — set SLACK_BOT_TOKEN and SLACK_RELEASE_CHANNEL, or SLACK_RELEASE_WEBHOOK.',
    );
}
