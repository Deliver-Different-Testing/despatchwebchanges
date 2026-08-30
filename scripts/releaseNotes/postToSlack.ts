/**
 * CI entrypoint: post the generated release note to #dfrnt-releases.
 *
 *   SLACK_RELEASE_WEBHOOK        incoming webhook, masked + protected
 *   CI_COMMIT_TAG, CI_PROJECT_URL
 *   RELEASE_NOTES_OUTPUT         optional input path (default release-notes.md)
 *   DRY_RUN=1                    print the payload instead of posting
 *
 * A failure here exits non-zero on purpose: a silently missing release note is
 * worse than a red pipeline.
 */
import { readFileSync } from 'node:fs';
import { buildSlackBlocks } from './slackMessage';

function requireEnv(name: string): string {
    const value = process.env[name];
    if (!value) {
        throw new Error(`${name} is not set. Protected CI variables are only exposed to protected tags — check that rc-* is a protected tag.`);
    }
    return value;
}

async function main(): Promise<void> {
    const tag = requireEnv('CI_COMMIT_TAG');
    const projectUrl = requireEnv('CI_PROJECT_URL');
    const notes = readFileSync(process.env.RELEASE_NOTES_OUTPUT || 'release-notes.md', 'utf8');

    const payload = {
        text: `Release candidate ${tag} is ready for testing`,
        blocks: buildSlackBlocks({ tag, projectUrl, notes }),
    };

    if (process.env.DRY_RUN) {
        console.log(JSON.stringify(payload, null, 2));
        return;
    }

    const response = await fetch(requireEnv('SLACK_RELEASE_WEBHOOK'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });

    const body = await response.text();
    if (!response.ok) {
        throw new Error(`Slack webhook returned ${response.status}: ${body}`);
    }

    console.error(`Posted ${payload.blocks.length} block(s) to Slack (${body})`);
}

main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
});
