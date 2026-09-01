import { classifyChange, type ChangeType } from './changeTypes';
import { parseMrSections } from './mrSections';

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
 * A change with no description or test steps is still listed, with a marker — a
 * silently omitted change is an untested change.
 */
export function buildReleaseNotes({ mergeRequests, directCommits }: ReleaseNotesInput): ReleaseNotes {
    const changes = mergeRequests.map((mergeRequest): ReleaseChange => {
        const { what, test, risk } = parseMrSections(mergeRequest.description);

        return {
            iid: mergeRequest.iid,
            title: mergeRequest.title,
            webUrl: mergeRequest.webUrl,
            authorName: mergeRequest.authorName,
            type: classifyChange({ sourceBranch: mergeRequest.sourceBranch, labels: mergeRequest.labels }),
            headline: headlineFor(what, mergeRequest.title),
            what,
            test,
            risk,
        };
    });

    return {
        changes,
        directCommits: [...directCommits],
        missingTestSteps: changes.filter((change) => !change.test).length + directCommits.length,
    };
}

export function countByType(notes: ReleaseNotes): Record<ChangeType, number> {
    const counts: Record<ChangeType, number> = { new: 0, improved: 0, fixed: 0, internal: 0, other: 0 };
    for (const change of notes.changes) {
        counts[change.type] += 1;
    }
    return counts;
}
