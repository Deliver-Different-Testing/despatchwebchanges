/**
 * Storage helpers for the job list's per-user preferences.
 *
 * `JobListPanel` keys everything off `${storagePrefix}_${suffix}_${ContactID}`, so
 * each panel instance (dispatch list, current work, job search) keeps its own
 * preferences. The category filter is shared out here rather than kept private to
 * the component because the pages that build a `fetchConfig` have to seed the
 * matching `statusFilter` — the panel is remounted on every view/date change, and
 * `useJobListData` only reads `initialParams` once.
 */

import type {JobCategory} from '../../interfaces/dispatchJob';

const CATEGORIES: readonly JobCategory[] = ['all', 'needs-dispatch', 'in-progress', 'delivered'];

export function jobListStorageKey(storagePrefix: string, suffix: string): string {
    return `${storagePrefix}_${suffix}_${window.ContactID ?? 0}`;
}

/** The stored category, or null when nothing valid is stored. */
export function loadJobListCategory(storagePrefix: string): JobCategory | null {
    try {
        const saved = localStorage.getItem(jobListStorageKey(storagePrefix, 'selectedCategory'));
        return CATEGORIES.includes(saved as JobCategory) ? (saved as JobCategory) : null;
    } catch {
        return null;
    }
}

export function persistJobListCategory(storagePrefix: string, category: JobCategory): void {
    try {
        localStorage.setItem(jobListStorageKey(storagePrefix, 'selectedCategory'), category);
    } catch { /* private browsing — ignore */ }
}

/** 'all' (and "nothing stored") means no server-side status filter. */
export function toStatusFilter(category: JobCategory | null): string | undefined {
    return !category || category === 'all' ? undefined : category;
}
