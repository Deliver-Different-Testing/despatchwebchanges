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
import {StaffPreferenceKey} from '../../../enums/staff-preference-key.enum';
import {getPreference, savePreference} from '../../services/preferencesApi';

const CATEGORIES: readonly JobCategory[] = ['all', 'needs-dispatch', 'in-progress', 'delivered'];

/** A list's column layout — order, widths, and hidden set — saved as one StaffPreference blob. */
export interface JobListColumnPreferences {
    columnOrder: string[];
    columnWidths: Record<string, number>;
    hiddenColumns: string[];
}

/**
 * Maps each list's `storagePrefix` to its `StaffPreferenceKey` — kept as an
 * explicit table, rather than derived by string-casing, so the two sides
 * can't silently drift apart. The enum itself mirrors the backend's
 * `Enums/StaffPreferenceKey.cs`.
 */
const COLUMN_PREFERENCE_KEYS: Record<string, StaffPreferenceKey> = {
    dispatchJobList: StaffPreferenceKey.JobListColumnsDispatchJobList,
    dispatchCurrentWork: StaffPreferenceKey.JobListColumnsDispatchCurrentWork,
    jobSearchJobList: StaffPreferenceKey.JobListColumnsJobSearchJobList,
    jobSearchBulkList: StaffPreferenceKey.JobListColumnsJobSearchBulkList,
    nwNewJobList: StaffPreferenceKey.JobListColumnsNwNewJobList,
    nwPodJobList: StaffPreferenceKey.JobListColumnsNwPodJobList,
    nwRepriceJobList: StaffPreferenceKey.JobListColumnsNwRepriceJobList,
};

function columnPreferenceKey(storagePrefix: string): StaffPreferenceKey | null {
    return COLUMN_PREFERENCE_KEYS[storagePrefix] ?? null;
}

/**
 * Reads this list's saved column layout from the server, or null if none is
 * saved yet (or `storagePrefix` isn't one of the known lists — e.g. an
 * unnamed/default instance, which has no server-side preference key).
 */
export async function loadJobListColumnsFromServer(storagePrefix: string): Promise<JobListColumnPreferences | null> {
    const key = columnPreferenceKey(storagePrefix);
    if (!key) return null;

    const json = await getPreference(key);
    if (!json) return null;
    try {
        return JSON.parse(json) as JobListColumnPreferences;
    } catch {
        return null;
    }
}

/**
 * Pushes this list's column layout to the server. Fire-and-forget, same as
 * the Auto-mate settings sync — a failed sync is logged rather than
 * surfaced, since the local value driving the table is already correct.
 * A no-op when `storagePrefix` isn't one of the known lists.
 */
export function persistJobListColumnsToServer(storagePrefix: string, prefs: JobListColumnPreferences): void {
    const key = columnPreferenceKey(storagePrefix);
    if (!key) return;

    void savePreference(key, JSON.stringify(prefs)).catch(error =>
        console.error(`Failed to sync job list columns (${storagePrefix}) to server:`, error),
    );
}

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
