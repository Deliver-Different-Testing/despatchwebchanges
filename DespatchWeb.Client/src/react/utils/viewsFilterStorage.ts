/**
 * Persisted dashboard-"views" selection, shared by the pages that have one.
 *
 * Dispatch and Nationwide both store the operator's selected page views under
 * their own localStorage key with identical semantics (server order, an
 * explicitly-cleared selection stays cleared, stale stored ids fall away).
 * This is the one implementation; callers supply their own key.
 */

import type {DfrntPageViewModel} from '../../interfaces/dfrnt-page-view-model.interface';

function hasStoredKey(key: string): boolean {
    try {
        return localStorage.getItem(key) != null;
    } catch {
        return false;
    }
}

/** Read the persisted selected view ids. Returns [] when nothing is stored or parsing fails. */
export function loadSelectedViewIdsFrom(key: string): number[] {
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return [];
        const views = JSON.parse(raw) as Array<{id: number; selected?: boolean}>;
        if (!Array.isArray(views)) return [];
        return views.filter(v => v && (v.selected === undefined || v.selected)).map(v => v.id);
    } catch {
        return [];
    }
}

/** Read the full selected view objects (with centre coordinates), for map recentring. */
export function loadSelectedViewsFrom(key: string): DfrntPageViewModel[] {
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return [];
        const views = JSON.parse(raw) as DfrntPageViewModel[];
        if (!Array.isArray(views)) return [];
        return views.filter(v => v && (v.selected === undefined || v.selected));
    } catch {
        return [];
    }
}

/** True once the operator has made (or explicitly cleared) a view selection. */
export function hasStoredViewSelectionAt(key: string): boolean {
    return hasStoredKey(key);
}

/**
 * Write the selected views. Stores the full objects (not just ids) because the
 * map reads their centre coordinates back via `loadSelectedViewsFrom`. An empty
 * array is written as `[]` rather than removing the key — a present but empty
 * selection is what makes "cleared" stick across reloads.
 */
export function persistSelectedViewsTo(key: string, views: DfrntPageViewModel[]): void {
    try {
        localStorage.setItem(key, JSON.stringify(views));
    } catch { /* private browsing — ignore */ }
}

/**
 * Resolve which views start selected. Selection is rebuilt from the fresh
 * server list so stored ids the server no longer returns fall away, and the
 * first view is only auto-selected on a genuine first visit — an explicitly
 * cleared selection (`hasStoredState` with nothing stored) stays cleared.
 *
 * A stored selection whose ids have ALL gone stale is not a cleared selection:
 * it is a user whose view list changed under them. Those land on the first
 * view they can see, since an empty selection can mean an empty job grid.
 */
export function resolveInitialViewSelection(
    serverViews: DfrntPageViewModel[],
    storedIds: number[],
    hasStoredState: boolean,
): number[] {
    if (serverViews.length === 0) return [];
    const stored = new Set(storedIds);
    const selected = serverViews.filter(v => stored.has(v.id)).map(v => v.id);
    if (selected.length === 0 && (!hasStoredState || storedIds.length > 0)) {
        return [serverViews[0].id];
    }
    return selected;
}
