/**
 * What kind of change a merge request is, so the note can lead with what shipped
 * rather than a flat list ordered by merge request number.
 *
 * The signal is the source branch prefix, which is already near-universal here —
 * over the last 80 merges, 42 `feat`, 33 `fix`, 2 `perf`, 1 `hotfix`. A `type::`
 * scoped label wins when someone sets one, so a mis-prefixed branch is fixable
 * after the fact without a rebase.
 */
export type ChangeType = 'new' | 'improved' | 'fixed' | 'internal' | 'other';

export interface ChangeGroup {
    type: ChangeType;
    heading: string;
    /** The word used in the count line, e.g. "4 new". */
    summary: string;
}

/** `internal` is deliberately absent: it collapses to a single line, not a group. */
export const CHANGE_GROUPS: readonly ChangeGroup[] = [
    { type: 'new', heading: '✨ New', summary: 'new' },
    { type: 'improved', heading: '⚡ Improved', summary: 'improved' },
    { type: 'fixed', heading: '🛠 Fixed', summary: 'fixed' },
    { type: 'other', heading: '📋 Other changes', summary: 'other' },
];

const PREFIX_TYPES: Record<string, ChangeType> = {
    feat: 'new',
    feature: 'new',
    fix: 'fixed',
    bug: 'fixed',
    bugfix: 'fixed',
    hotfix: 'fixed',
    perf: 'improved',
    improvement: 'improved',
    build: 'internal',
    chore: 'internal',
    ci: 'internal',
    deps: 'internal',
    docs: 'internal',
    refactor: 'internal',
    style: 'internal',
    test: 'internal',
    tests: 'internal',
};

export interface ClassifiableChange {
    sourceBranch?: string | null;
    labels?: readonly string[] | null;
}

function typeOfPrefix(value: string): ChangeType | null {
    return PREFIX_TYPES[value.trim().toLowerCase()] ?? null;
}

export function classifyChange({ sourceBranch, labels }: ClassifiableChange): ChangeType {
    for (const label of labels ?? []) {
        const match = /^type::(.+)$/i.exec(label.trim());
        const labelled = match ? typeOfPrefix(match[1]) : null;
        if (labelled) {
            return labelled;
        }
    }

    return typeOfPrefix((sourceBranch ?? '').split('/')[0]) ?? 'other';
}
