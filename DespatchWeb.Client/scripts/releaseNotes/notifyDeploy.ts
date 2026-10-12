/**
 * CI entrypoint: announce a deployment to #dfrnt-releases, marked with the
 * environment it reached.
 *
 * Runs once per tenant deploy job. Tenant deploys are manual and independent, so
 * every copy of this job asks the deployments API whether its stage is now fully
 * on this commit and whether it was the last environment to get there — only that
 * one posts, which yields exactly one message per environment without a `needs:`
 * on a manual job that may never be pressed.
 *
 *   CI_API_V4_URL, CI_PROJECT_ID, CI_COMMIT_SHA, CI_PROJECT_URL, CI_PIPELINE_URL
 *   NOTES_API_TOKEN              project access token, read_api
 *   SLACK_BOT_TOKEN              bot token with chat:write, masked + protected
 *   SLACK_RELEASE_CHANNEL        channel id the bot posts to
 *   SLACK_RELEASE_WEBHOOK        incoming webhook; fallback, cannot thread
 *   RELEASE_STAGE                staging | tenants-staging | tenants-production
 *   RELEASE_ENVIRONMENT          this job's GitLab environment name
 *   RELEASE_STAGE_ENVIRONMENTS   every environment in the stage, comma separated
 *   RELEASE_NOTES_SINCE          optional ref override
 *   DRY_RUN=1                    print the payload instead of posting
 */
import { buildReleaseNotes, type ReleaseMergeRequest } from './buildNotes';
import { collectFromCommits, type RangeCommit } from './collectRelease';
import {
    environmentEmoji,
    environmentLabel,
    postingEnvironment,
    previousShaForStage,
    stageDeployedAt,
    type EnvironmentDeployments,
} from './deployStage';
import { GitLabApi } from './gitlabApi';
import { postRelease } from './slackClient';
import { buildReleasePost } from './slackMessage';

function requireEnv(name: string): string {
    const value = process.env[name];
    if (!value) {
        throw new Error(`${name} is not set. Protected CI variables are only exposed to protected refs — check the branch or tag is protected.`);
    }
    return value;
}

async function main(): Promise<void> {
    const sha = requireEnv('CI_COMMIT_SHA');
    const stage = requireEnv('RELEASE_STAGE');
    const environment = requireEnv('RELEASE_ENVIRONMENT');
    const projectUrl = requireEnv('CI_PROJECT_URL');
    const pipelineUrl = requireEnv('CI_PIPELINE_URL');

    const stageEnvironments = requireEnv('RELEASE_STAGE_ENVIRONMENTS')
        .split(',')
        .map((name) => name.trim())
        .filter(Boolean);

    const api = new GitLabApi({
        apiUrl: requireEnv('CI_API_V4_URL'),
        projectId: requireEnv('CI_PROJECT_ID'),
        token: requireEnv('NOTES_API_TOKEN'),
    });

    const deployments: EnvironmentDeployments[] = [];
    for (const name of stageEnvironments) {
        deployments.push({ environment: name, deployments: await api.listDeployments(name) });
    }

    if (postingEnvironment(deployments, sha) !== environment) {
        console.error(`${stage} is not complete on ${sha.slice(0, 8)}, or ${environment} was not the last to deploy it — nothing to post.`);
        return;
    }

    const sinceRef = process.env.RELEASE_NOTES_SINCE || previousShaForStage(deployments, sha);

    let commits: RangeCommit[];
    if (sinceRef) {
        const comparison = await api.compare(sinceRef, sha);
        commits = comparison.commits ?? [];
    } else {
        console.error(`No previous deployment across ${stage} — falling back to the last 100 commits.`);
        commits = await api.listCommits(sha);
    }

    const { mergeRequestIids, directCommits } = collectFromCommits(commits, sha);

    const mergeRequests: ReleaseMergeRequest[] = [];
    for (const iid of mergeRequestIids) {
        const mergeRequest = await api.getMergeRequest(iid);
        mergeRequests.push({
            iid: mergeRequest.iid,
            title: mergeRequest.title,
            webUrl: mergeRequest.web_url,
            authorName: mergeRequest.author?.name ?? 'unknown',
            description: mergeRequest.description,
            sourceBranch: mergeRequest.source_branch,
            labels: mergeRequest.labels,
        });
    }

    const label = environmentLabel(stage);
    const release = buildReleasePost({
        environmentLabel: label,
        environmentEmoji: environmentEmoji(stage),
        tenantCount: stageEnvironments.length,
        deployedAt: stageDeployedAt(deployments, sha),
        sha,
        pipelineUrl,
        compareUrl: sinceRef ? `${projectUrl}/-/compare/${sinceRef}...${sha}` : null,
        notes: buildReleaseNotes({ mergeRequests, directCommits }),
    });

    if (process.env.DRY_RUN) {
        console.log(JSON.stringify({ text: release.text, blocks: release.blocks }, null, 2));
        release.replies.forEach((reply, index) => {
            console.log(`--- thread reply ${index + 1} of ${release.replies.length} ---`);
            console.log(JSON.stringify(reply, null, 2));
        });
        return;
    }

    const posted = await postRelease(release, {
        botToken: process.env.SLACK_BOT_TOKEN,
        channel: process.env.SLACK_RELEASE_CHANNEL,
        webhookUrl: process.env.SLACK_RELEASE_WEBHOOK,
    });

    console.error(`Posted ${posted} message(s) for ${label}.`);
}

main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
});
