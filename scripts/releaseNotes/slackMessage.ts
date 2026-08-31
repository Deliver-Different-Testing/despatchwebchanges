/**
 * Slack mrkdwn is not markdown: `###` headings and `**bold**` render literally,
 * and a section block caps at 3000 characters with 50 blocks per message.
 */
export const SLACK_SECTION_LIMIT = 2900;
export const SLACK_BLOCK_LIMIT = 50;

export interface SlackText {
    type: 'mrkdwn' | 'plain_text';
    text: string;
    emoji?: boolean;
}

export interface SlackBlock {
    type: 'header' | 'section' | 'divider' | 'context';
    text?: SlackText;
    elements?: SlackText[];
}

export function toSlackMrkdwn(markdown: string): string {
    return markdown
        .replace(/^#{1,6}[ \t]*(.+?)[ \t]*$/gm, '*$1*')
        .replace(/\*\*(.+?)\*\*/g, '*$1*')
        .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<$2|$1>');
}

export function chunkForSlack(text: string, limit = SLACK_SECTION_LIMIT): string[] {
    const chunks: string[] = [];
    let current = '';

    const push = (value: string) => {
        for (let start = 0; start < value.length; start += limit) {
            chunks.push(value.slice(start, start + limit));
        }
    };

    for (const paragraph of text.split('\n\n')) {
        const candidate = current ? `${current}\n\n${paragraph}` : paragraph;
        if (candidate.length > limit && current) {
            push(current);
            current = paragraph;
        } else {
            current = candidate;
        }
    }

    if (current) {
        push(current);
    }

    return chunks;
}

export interface SlackMessageInput {
    environmentLabel: string;
    sha: string;
    pipelineUrl: string;
    compareUrl: string | null;
    notes: string;
}

export function buildSlackBlocks({
    environmentLabel,
    sha,
    pipelineUrl,
    compareUrl,
    notes,
}: SlackMessageInput): SlackBlock[] {
    const context = [`\`${sha.slice(0, 8)}\``, `<${pipelineUrl}|pipeline>`];
    if (compareUrl) {
        context.push(`<${compareUrl}|changes>`);
    }

    const moreUrl = compareUrl ?? pipelineUrl;
    const blocks: SlackBlock[] = [
        { type: 'header', text: { type: 'plain_text', text: `Deployed to ${environmentLabel}`, emoji: true } },
        { type: 'context', elements: [{ type: 'mrkdwn', text: context.join(' · ') }] },
        { type: 'divider' },
    ];

    const parts = chunkForSlack(toSlackMrkdwn(notes));
    const room = SLACK_BLOCK_LIMIT - blocks.length;
    const truncated = parts.length > room;

    for (const part of parts.slice(0, truncated ? room - 1 : room)) {
        blocks.push({ type: 'section', text: { type: 'mrkdwn', text: part } });
    }

    if (truncated) {
        blocks.push({
            type: 'section',
            text: {
                type: 'mrkdwn',
                text: `_This deployment is too long to post in full — <${moreUrl}|read the rest in GitLab>._`,
            },
        });
    }

    return blocks;
}
