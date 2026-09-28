/**
 * Works out what is actually in a release from the commit range between two tags.
 *
 * Only the first-parent chain counts: commits a merge brought in belong to that
 * merge request, while a single-parent commit sitting on the chain was pushed
 * straight to the default branch and would otherwise be invisible to testers.
 */
export const MR_REF_PATTERN = /See merge request\s+\S*!(\d+)/i;

export interface RangeCommit {
    id: string;
    title: string;
    message?: string;
    parent_ids?: string[];
}

export interface ReleaseCommits {
    mergeRequestIids: number[];
    directCommits: RangeCommit[];
}

export function mergeRequestIidFromMessage(message: string | null | undefined): number | null {
    const match = MR_REF_PATTERN.exec(message ?? '');
    return match ? Number(match[1]) : null;
}

function firstParentChain(commits: readonly RangeCommit[], headSha: string): RangeCommit[] {
    const byId = new Map(commits.map((commit) => [commit.id, commit]));
    const chain: RangeCommit[] = [];
    const seen = new Set<string>();

    let current = byId.get(headSha);
    while (current && !seen.has(current.id)) {
        seen.add(current.id);
        chain.push(current);
        const parent = current.parent_ids?.[0];
        current = parent ? byId.get(parent) : undefined;
    }

    return chain.reverse();
}

export function collectFromCommits(commits: readonly RangeCommit[], headSha: string): ReleaseCommits {
    if (!commits.length) {
        return { mergeRequestIids: [], directCommits: [] };
    }

    // Some API/compare responses omit parent ids; without the graph, all we can do
    // is harvest merge request references and say nothing about direct commits.
    const hasParents = commits.some((commit) => commit.parent_ids?.length);
    const walk = hasParents ? firstParentChain(commits, headSha) : [...commits].reverse();

    const iids: number[] = [];
    const directCommits: RangeCommit[] = [];

    for (const commit of walk) {
        const iid = mergeRequestIidFromMessage(commit.message ?? commit.title);
        if (iid !== null) {
            if (!iids.includes(iid)) {
                iids.push(iid);
            }
            continue;
        }

        if (hasParents) {
            directCommits.push(commit);
        }
    }

    return { mergeRequestIids: iids, directCommits };
}
