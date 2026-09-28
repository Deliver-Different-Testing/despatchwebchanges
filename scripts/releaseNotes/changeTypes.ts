/**
 * What kind of change a merge request is, so the note can lead with what shipped
 * rather than a flat list ordered by merge request number.
 *
 * Groups mirror the mr-release-notes skill's fixed sections (Bug Fixes / New
 * features / Maintenance): a merge request written with those headings is
 * classified straight from its content — see mrSections.ts and buildNotes.ts.
 * The branch-prefix signal below is only a fallback for merge requests without
 * those headings (over the last 80 merges before this template changed: 42
 * `feat`, 33 `fix`, 2 `perf`, 1 `hotfix`). A `type::` scoped label wins when
 * someone sets one, so a mis-prefixed branch is fixable after the fact without
 * a rebase.
 */
export type ChangeType = 'new' | 'fixed' | 'maintenance';

export interface ChangeGroup {
    type: ChangeType;
    heading: string;
    /** The word used in the count line, e.g. "4 new". */
    summary: string;
}

export const CHANGE_GROUPS: readonly ChangeGroup[] = [
    { type: 'fixed', heading: 'Bug Fixes', summary: 'fixed' },
    { type: 'new', heading: 'New features', summary: 'new' },
    { type: 'maintenance', heading: 'Maintenance', summary: 'maintenance' },
];

const PREFIX_TYPES: Record<string, ChangeType> = {
    feat: 'new',
    feature: 'new',
    fix: 'fixed',
    bug: 'fixed',
    bugfix: 'fixed',
    hotfix: 'fixed',
    perf: 'maintenance',
    improvement: 'maintenance',
    build: 'maintenance',
    chore: 'maintenance',
    ci: 'maintenance',
    deps: 'maintenance',
    docs: 'maintenance',
    refactor: 'maintenance',
    style: 'maintenance',
    test: 'maintenance',
    tests: 'maintenance',
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

    return typeOfPrefix((sourceBranch ?? '').split('/')[0]) ?? 'maintenance';
}
