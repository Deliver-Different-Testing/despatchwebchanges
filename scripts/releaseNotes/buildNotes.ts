import { classifyChange, type ChangeType } from './changeTypes';
import { parseMrSections, type MrSections } from './mrSections';

export interface ReleaseMergeRequest {
    iid: number;
    title: string;
    webUrl: string;
    authorName: string;
    description: string | null;
    sourceBranch?: string | null;
    labels?: readonly string[] | null;
}

export interface ReleaseDirectCommit {
    id: string;
    title: string;
}

export interface ReleaseChange {
    iid: number;
    title: string;
    webUrl: string;
    authorName: string;
    type: ChangeType;
    /** One plain-English sentence for the channel summary. */
    headline: string;
    what: string;
    test: string;
    risk: string;
}

export interface ReleaseNotes {
    changes: ReleaseChange[];
    directCommits: ReleaseDirectCommit[];
    /** Changes a tester cannot sign off unaided — no test steps, or no merge request at all. */
    missingTestSteps: number;
}

export interface ReleaseNotesInput {
    mergeRequests: readonly ReleaseMergeRequest[];
    directCommits: readonly ReleaseDirectCommit[];
}

const HEADLINE_LIMIT = 140;

/**
 * The first real sentence of "What changed", which the merge request template asks
 * authors to write in plain English. The merge request title is the fallback — it is
 * usually serviceable, and a headline is better wrong than absent.
 */
export function headlineFor(what: string, title: string): string {
    const firstLine = what
        .split('\n')
        .map((line) => line.trim())
        .find((line) => line && !/^[#>|]/.test(line) && !/^[-*_]{3,}$/.test(line));

    if (!firstLine) {
        return title;
    }

    const text = firstLine.replace(/^([-*+]|\d+[.)])\s+/, '').trim();
    const sentence = (/^(.+?[.!?])(\s|$)/.exec(text)?.[1] ?? text).trim();

    if (!sentence) {
        return title;
    }

    return sentence.length > HEADLINE_LIMIT ? `${sentence.slice(0, HEADLINE_LIMIT - 1).trimEnd()}…` : sentence;
}

/**
 * The type and "what changed" body for a merge request. A merge request written
 * with the mr-release-notes skill's headings is classified from whichever of
 * Bug Fixes / New features / Maintenance it filled in — content across more than
 * one of those still all reaches the reader, just under a single group, in that
 * priority order. Only a merge request with none of them falls back to guessing
 * from the branch prefix, for ones opened before the template changed.
 */
function typeAndWhat(mergeRequest: ReleaseMergeRequest, sections: MrSections): { type: ChangeType; what: string } {
    const structured = (
        [
            { type: 'fixed', body: sections.bugFixes },
            { type: 'new', body: sections.newFeatures },
            { type: 'maintenance', body: sections.maintenance },
        ] as const
    ).filter((entry) => entry.body);

    if (structured.length) {
        return { type: structured[0].type, what: structured.map((entry) => entry.body).join('\n\n') };
    }

    return {
        type: classifyChange({ sourceBranch: mergeRequest.sourceBranch, labels: mergeRequest.labels }),
        what: sections.legacyWhat,
    };
}

/**
 * A change with no description or test steps is still listed, with a marker — a
 * silently omitted change is an untested change.
 */
export function buildReleaseNotes({ mergeRequests, directCommits }: ReleaseNotesInput): ReleaseNotes {
    const changes = mergeRequests.map((mergeRequest): ReleaseChange => {
        const sections = parseMrSections(mergeRequest.description);
        const { type, what } = typeAndWhat(mergeRequest, sections);

        return {
            iid: mergeRequest.iid,
            title: mergeRequest.title,
            webUrl: mergeRequest.webUrl,
            authorName: mergeRequest.authorName,
            type,
            headline: headlineFor(what, mergeRequest.title),
            what,
            test: sections.test,
            risk: sections.risk,
        };
    });

    return {
        changes,
        directCommits: [...directCommits],
        missingTestSteps: changes.filter((change) => !change.test).length + directCommits.length,
    };
}

export function countByType(notes: ReleaseNotes): Record<ChangeType, number> {
    const counts: Record<ChangeType, number> = { new: 0, fixed: 0, maintenance: 0 };
    for (const change of notes.changes) {
        counts[change.type] += 1;
    }
    return counts;
}
