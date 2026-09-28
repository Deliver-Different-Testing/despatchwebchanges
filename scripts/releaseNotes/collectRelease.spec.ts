/** @jest-environment node */
import { collectFromCommits, mergeRequestIidFromMessage } from './collectRelease';

const commit = (id: string, title: string, parents: string[], message?: string) => ({
    id,
    title,
    message: message ?? title,
    parent_ids: parents,
});

describe('mergeRequestIidFromMessage', () => {
    it('reads the iid off a GitLab merge commit footer', () => {
        expect(
            mergeRequestIidFromMessage(
                "Merge branch 'feat/x' into 'master'\n\nAdd x\n\nSee merge request urgent-couriers/despatchweb!1148\n",
            ),
        ).toBe(1148);
    });

    it('returns null when there is no footer', () => {
        expect(mergeRequestIidFromMessage("Merge branch 'feat/x' into 'master'")).toBeNull();
        expect(mergeRequestIidFromMessage('')).toBeNull();
    });
});

describe('collectFromCommits', () => {
    // master: base <- m1(!11) <- direct <- m2(!12), with branch commits hanging off each merge.
    const commits = [
        commit('m2', "Merge branch 'b2'", ['direct', 'b2'], "Merge branch 'b2'\n\nSee merge request group/proj!12"),
        commit('b2', 'branch two work', ['direct']),
        commit('direct', 'Bump nuget packages', ['m1']),
        commit('m1', "Merge branch 'b1'", ['base', 'b1'], "Merge branch 'b1'\n\nSee merge request group/proj!11"),
        commit('b1', 'branch one work', ['base']),
    ];

    it('returns merge request iids oldest first and ignores branch commits pulled in by a merge', () => {
        expect(collectFromCommits(commits, 'm2').mergeRequestIids).toEqual([11, 12]);
    });

    it('surfaces commits pushed straight to the default branch', () => {
        expect(collectFromCommits(commits, 'm2').directCommits.map((c) => c.id)).toEqual(['direct']);
    });

    it('treats a merge commit with no merge request footer as a direct commit rather than dropping it', () => {
        const withOrphanMerge = [commit('m3', 'Merge branch of unknown origin', ['m2', 'b3']), ...commits];
        expect(collectFromCommits(withOrphanMerge, 'm3').directCommits.map((c) => c.id)).toEqual(['direct', 'm3']);
    });

    it('deduplicates a merge request referenced by more than one commit', () => {
        const duplicated = [
            commit('m2b', "Merge branch 'b2'", ['m2'], 'See merge request group/proj!12'),
            ...commits,
        ];
        expect(collectFromCommits(duplicated, 'm2b').mergeRequestIids).toEqual([11, 12]);
    });

    it('falls back to scanning every commit when the API omits parent ids', () => {
        const noParents = commits.map(({ id, title, message }) => ({ id, title, message }));
        const result = collectFromCommits(noParents, 'm2');
        expect(result.mergeRequestIids).toEqual([11, 12]);
        expect(result.directCommits).toEqual([]);
    });

    it('returns nothing for an empty range', () => {
        expect(collectFromCommits([], 'head')).toEqual({ mergeRequestIids: [], directCommits: [] });
    });
});
