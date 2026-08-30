/**
 * CI entrypoint: build release-notes.md for the RC tag being built.
 *
 *   CI_API_V4_URL, CI_PROJECT_ID, CI_COMMIT_TAG   GitLab-provided
 *   NOTES_API_TOKEN                               project access token, read_api
 *   RELEASE_NOTES_SINCE                           optional ref override, for the first run
 *   RELEASE_NOTES_OUTPUT                          optional output path (default release-notes.md)
 */
import { writeFileSync } from 'node:fs';
import { buildReleaseNotes, type ReleaseMergeRequest } from './buildNotes';
import { collectFromCommits, type RangeCommit } from './collectRelease';
import { GitLabApi } from './gitlabApi';
import { previousRcTag } from './rcTags';

function requireEnv(name: string): string {
    const value = process.env[name];
    if (!value) {
        throw new Error(`${name} is not set. Protected CI variables are only exposed to protected tags — check that rc-* is a protected tag.`);
    }
    return value;
}

async function main(): Promise<void> {
    const tag = requireEnv('CI_COMMIT_TAG');
    const api = new GitLabApi({
        apiUrl: requireEnv('CI_API_V4_URL'),
        projectId: requireEnv('CI_PROJECT_ID'),
        token: requireEnv('NOTES_API_TOKEN'),
    });

    const previousTag = process.env.RELEASE_NOTES_SINCE || previousRcTag(await api.listTagNames(), tag);

    let commits: RangeCommit[];
    let headSha: string;

    if (previousTag) {
        const comparison = await api.compare(previousTag, tag);
        commits = comparison.commits ?? [];
        headSha = comparison.commit?.id ?? commits[0]?.id ?? '';
    } else {
        // First ever release candidate: no range to compare, so fall back to the most
        // recent commits on the tag. Noisy once; pass RELEASE_NOTES_SINCE to bound it.
        console.error(`No previous RC tag found — falling back to the last 100 commits on ${tag}.`);
        commits = await api.listCommits(tag);
        headSha = commits[0]?.id ?? '';
    }

    const { mergeRequestIids, directCommits } = collectFromCommits(commits, headSha);

    const mergeRequests: ReleaseMergeRequest[] = [];
    for (const iid of mergeRequestIids) {
        const mergeRequest = await api.getMergeRequest(iid);
        mergeRequests.push({
            iid: mergeRequest.iid,
            title: mergeRequest.title,
            webUrl: mergeRequest.web_url,
            authorName: mergeRequest.author?.name ?? 'unknown',
            description: mergeRequest.description,
        });
    }

    const notes = buildReleaseNotes({ tag, previousTag, mergeRequests, directCommits });
    const output = process.env.RELEASE_NOTES_OUTPUT || 'release-notes.md';
    writeFileSync(output, notes, 'utf8');

    console.error(
        `${mergeRequests.length} MR(s), ${directCommits.length} direct commit(s) written to ${output}`,
    );
}

main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
});
