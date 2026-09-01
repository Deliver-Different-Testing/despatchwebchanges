import { CHANGE_GROUPS } from './changeTypes';
import { countByType, type ReleaseChange, type ReleaseDirectCommit, type ReleaseNotes } from './buildNotes';

/**
 * Slack mrkdwn is not markdown: `###` headings and `**bold**` render literally,
 * and a section block caps at 3000 characters.
 *
 * The message is deliberately split in two. The channel gets a scannable summary —
 * what shipped, where, grouped — because that is all most readers need. The test
 * steps go in a thread, one reply per change, which is what testers work from and
 * also means no single message can approach Slack's 50-block cap.
 */
export const SLACK_SECTION_LIMIT = 2900;

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

export interface SlackPost {
    text: string;
    blocks: SlackBlock[];
}

/** Slack eats `<…>` as link syntax, and merge request prose is full of `<DialogShell>`. */
export function escapeSlack(text: string): string {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function toSlackMrkdwn(markdown: string): string {
    return escapeSlack(markdown)
        .replace(/^&gt;(?=\s|$)/gm, '>')
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

const section = (text: string): SlackBlock => ({ type: 'section', text: { type: 'mrkdwn', text } });
export const contextBlock = (text: string): SlackBlock => ({ type: 'context', elements: [{ type: 'mrkdwn', text }] });
const sections = (text: string): SlackBlock[] => chunkForSlack(text).map(section);

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/** Renders in each reader's own timezone — tenants span NZ and the US. */
export function slackDate(isoTimestamp: string): string {
    const at = new Date(isoTimestamp);
    const epoch = Math.floor(at.getTime() / 1000);
    const fallback = `${at.toISOString().replace('T', ' ').slice(0, 16)} UTC`;

    return `<!date^${epoch}^{date_short_pretty} at {time}|${fallback}>`;
}

export interface ReleaseTally {
    userVisible: number;
    internal: number;
    /** "3 new · 1 fixed", omitting the groups nothing landed in. */
    breakdown: string;
}

export function tally(notes: ReleaseNotes): ReleaseTally {
    const counts = countByType(notes);

    return {
        userVisible: notes.changes.length - counts.internal,
        internal: counts.internal,
        breakdown: CHANGE_GROUPS.filter((group) => counts[group.type] > 0)
            .map((group) => `${counts[group.type]} ${group.summary}`)
            .join(' · '),
    };
}

export function summaryText(environmentLabel: string, notes: ReleaseNotes): string {
    if (!notes.changes.length) {
        return `Live on ${environmentLabel} — no changes found`;
    }

    const { userVisible, breakdown } = tally(notes);
    const headline = plural(userVisible, 'change', 'changes');

    return breakdown
        ? `Live on ${environmentLabel} — ${headline} (${breakdown.replace(/ · /g, ', ')})`
        : `Live on ${environmentLabel} — ${headline}`;
}

export interface SummaryInput {
    environmentLabel: string;
    environmentEmoji: string;
    /** How many environments the stage covers; null or 1 for a single-environment stage. */
    tenantCount: number | null;
    deployedAt: string | null;
    sha: string;
    pipelineUrl: string;
    compareUrl: string | null;
    notes: ReleaseNotes;
}

function summaryBody(notes: ReleaseNotes): SlackBlock[] {
    if (!notes.changes.length) {
        return [section('_No merge requests in this deployment._')];
    }

    const { userVisible, internal, breakdown } = tally(notes);
    const blocks: SlackBlock[] = [
        section(
            userVisible
                ? `*${plural(userVisible, 'change', 'changes')}*${breakdown ? `  ·  ${breakdown}` : ''}`
                : '*No user-visible changes* in this deployment.',
        ),
        { type: 'divider' },
    ];

    for (const group of CHANGE_GROUPS) {
        const inGroup = notes.changes.filter((change) => change.type === group.type);
        if (!inGroup.length) {
            continue;
        }

        const bullets = inGroup
            .map((change) => `• ${escapeSlack(change.headline)}  <${change.webUrl}|!${change.iid}>`)
            .join('\n');
        blocks.push(...sections(`*${group.heading}*\n${bullets}`));
    }

    if (internal) {
        blocks.push(
            section(
                `_Plus ${plural(internal, 'internal change', 'internal changes')} — dependencies, refactors and tooling, with no user-visible effect._`,
            ),
        );
    }

    return blocks;
}

export function buildSummaryBlocks({
    environmentLabel,
    environmentEmoji,
    tenantCount,
    deployedAt,
    sha,
    pipelineUrl,
    compareUrl,
    notes,
}: SummaryInput): SlackBlock[] {
    const blocks: SlackBlock[] = [
        {
            type: 'header',
            text: { type: 'plain_text', text: `${environmentEmoji} Live on ${environmentLabel}`, emoji: true },
        },
    ];

    const where: string[] = [];
    if (tenantCount && tenantCount > 1) {
        where.push(plural(tenantCount, 'tenant', 'tenants'));
    }
    if (deployedAt) {
        where.push(slackDate(deployedAt));
    }
    if (where.length) {
        blocks.push(contextBlock(where.join(' · ')));
    }

    blocks.push(...summaryBody(notes));

    const footer = [`\`${sha.slice(0, 8)}\``, `<${pipelineUrl}|pipeline>`];
    if (compareUrl) {
        footer.push(`<${compareUrl}|compare>`);
    }
    if (notes.missingTestSteps) {
        footer.push(`⚠️ ${plural(notes.missingTestSteps, 'change has', 'changes have')} no test steps`);
    }
    blocks.push(contextBlock(footer.join(' · ')));

    return blocks;
}

export function buildDetailPost(change: ReleaseChange): SlackPost {
    const blocks: SlackBlock[] = [
        section(
            `*!${change.iid} — ${escapeSlack(change.title)}*\n_${escapeSlack(change.authorName)} · <${change.webUrl}|view MR>_`,
        ),
    ];

    blocks.push(
        ...(change.what
            ? sections(toSlackMrkdwn(change.what))
            : [section('⚠️ *No description supplied* — see the MR.')]),
    );

    blocks.push(
        ...(change.test
            ? sections(`*How to test*\n${toSlackMrkdwn(change.test)}`)
            : [section('⚠️ *No test steps supplied* — check with the author before signing off.')]),
    );

    if (change.risk) {
        blocks.push(...sections(`*Also check*\n${toSlackMrkdwn(change.risk)}`));
    }

    return { text: `!${change.iid} — ${change.title}`, blocks };
}

export function buildDirectCommitPost(commits: readonly ReleaseDirectCommit[]): SlackPost {
    const lines = commits.map((commit) => `• \`${commit.id.slice(0, 7)}\` ${escapeSlack(commit.title)}`);

    return {
        text: `${plural(commits.length, 'commit', 'commits')} with no merge request`,
        blocks: sections(
            [
                '*⚠️ Commits with no merge request*',
                'Pushed straight to the default branch, so nobody wrote test steps for them:',
                '',
                ...lines,
            ].join('\n'),
        ),
    };
}

export interface ReleasePost extends SlackPost {
    replies: SlackPost[];
    /**
     * Shown only on the webhook fallback, where there is no thread to put the
     * replies in. Absent when there is nothing to point at.
     */
    webhookNote?: string;
}

export function buildReleasePost(input: SummaryInput): ReleasePost {
    const replies = input.notes.changes.map(buildDetailPost);
    if (input.notes.directCommits.length) {
        replies.push(buildDirectCommitPost(input.notes.directCommits));
    }

    return {
        text: summaryText(input.environmentLabel, input.notes),
        blocks: buildSummaryBlocks(input),
        replies,
        webhookNote: replies.length ? '_Test steps are in each merge request linked above._' : undefined,
    };
}
