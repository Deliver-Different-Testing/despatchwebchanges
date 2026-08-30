import { parseMrSections } from './mrSections';

export interface ReleaseMergeRequest {
    iid: number;
    title: string;
    webUrl: string;
    authorName: string;
    description: string | null;
}

export interface ReleaseDirectCommit {
    id: string;
    title: string;
}

export interface ReleaseNotesInput {
    tag: string;
    previousTag: string | null;
    mergeRequests: readonly ReleaseMergeRequest[];
    directCommits: readonly ReleaseDirectCommit[];
}

/**
 * A change with no description or test steps is still listed, with a marker — a
 * silently omitted change is an untested change.
 */
export function buildReleaseNotes({ tag, previousTag, mergeRequests, directCommits }: ReleaseNotesInput): string {
    const header = previousTag
        ? `Changes since \`${previousTag}\``
        : 'Changes in this release (no previous RC tag found)';

    const lines: string[] = [`# Release candidate ${tag}`, '', header, ''];
    let incomplete = 0;

    if (!mergeRequests.length) {
        lines.push('_No merge requests found for this release._', '');
    }

    for (const mergeRequest of mergeRequests) {
        const { what, test, risk } = parseMrSections(mergeRequest.description);

        lines.push(`### !${mergeRequest.iid} — ${mergeRequest.title}`);
        lines.push(`_${mergeRequest.authorName} · [view MR](${mergeRequest.webUrl})_`);
        lines.push('');

        if (what) {
            lines.push(what);
        } else {
            lines.push('⚠️ **No description supplied** — see the MR.');
            incomplete += 1;
        }
        lines.push('');

        if (test) {
            lines.push('**How to test**', '', test);
        } else {
            lines.push('⚠️ **No test steps supplied** — check with the author before signing off.');
            incomplete += 1;
        }
        lines.push('');

        if (risk) {
            lines.push('**Also check**', '', risk, '');
        }
    }

    if (directCommits.length) {
        lines.push('### ⚠️ Commits with no merge request', '');
        lines.push('Pushed straight to the default branch, so nobody wrote test steps for them:', '');
        for (const commit of directCommits) {
            lines.push(`- \`${commit.id.slice(0, 7)}\` ${commit.title}`);
        }
        lines.push('');
        incomplete += directCommits.length;
    }

    if (incomplete) {
        lines.splice(4, 0, `> ⚠️ ${incomplete} item(s) in this release are missing description or test steps.`, '');
    }

    return `${lines.join('\n').trimEnd()}\n`;
}
