import dayjs, {Dayjs} from 'dayjs';
import {ContactID} from '../../../../contants';
import {AppPage as LegacyAppPage} from '../../../../enums/app-pages.enum';
import setDateFilterDefaults from '../../../../functions/setDateFilterDefaults';
import type {DfrntPageViewModel} from '../../../../interfaces/dfrnt-page-view-model.interface';

/**
 * Dispatch toolbar filters that scope the job list and driver locations:
 * the selected page-view ids and the date range. Persisted by the AngularJS
 * dispatch toolbar (and the dispatchV2 route controller) under the same
 * localStorage keys the V1 home controller uses, so V1 and V2 share selection.
 */
export interface DispatchFilters {
    despatchViewIds: number[];
    startDate: Dayjs;
    endDate: Dayjs;
    useTime?: boolean;
}

export const SELECTED_VIEWS_KEY = `selectedViews-${LegacyAppPage.Dispatch}-${ContactID}`;
export const DATE_FILTER_KEY = `dateFilter-${LegacyAppPage.Dispatch}-${ContactID}`;
export const REFRESH_INTERVAL_KEY = `refreshInterval-${LegacyAppPage.Dispatch}-${ContactID}`;
export const DRIVER_LOCATION_REFRESH_KEY = `driverLocationRefreshInterval-${LegacyAppPage.Dispatch}-${ContactID}`;
export const TASK_REFRESH_KEY = `taskRefreshInterval-${LegacyAppPage.Dispatch}-${ContactID}`;

/** Auto-refresh intervals in ms (React Query refetchInterval); `false` = off. */
export interface DispatchRefreshIntervals {
    jobsMs: number | false;
    driverLocationsMs: number | false;
    tasksMs: number | false;
}

function readIntervalSeconds(key: string): number {
    try {
        const raw = localStorage.getItem(key);
        const seconds = raw == null ? 0 : parseInt(raw, 10);
        return Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
    } catch {
        return 0;
    }
}

function hasStoredKey(key: string): boolean {
    try {
        return localStorage.getItem(key) != null;
    } catch {
        return false;
    }
}

/**
 * Read the persisted auto-refresh intervals (V1 stores seconds; 0 = Disabled).
 * Mirrors home.controller's `loadSavedRefreshInterval` /
 * `loadSavedDriverLocationRefreshInterval`. The Tasks panel keeps its own
 * independent interval so it can refresh on a different cadence to the job list.
 *
 * On first run (the Tasks key has never been written) the Tasks panel inherits
 * the job-list cadence, so existing users keep an active refresh instead of
 * silently defaulting to Off. Once the user picks a Tasks cadence — even "Off"
 * (a stored 0) — that choice sticks.
 */
export function loadRefreshIntervals(): DispatchRefreshIntervals {
    const jobs = readIntervalSeconds(REFRESH_INTERVAL_KEY);
    const driver = readIntervalSeconds(DRIVER_LOCATION_REFRESH_KEY);
    const tasks = hasStoredKey(TASK_REFRESH_KEY)
        ? readIntervalSeconds(TASK_REFRESH_KEY)
        : jobs;
    return {
        jobsMs: jobs > 0 ? jobs * 1000 : false,
        driverLocationsMs: driver > 0 ? driver * 1000 : false,
        tasksMs: tasks > 0 ? tasks * 1000 : false,
    };
}

/**
 * Read the dispatcher's selected page-view ids from localStorage. Returns []
 * when nothing is selected — callers treat that as "no views" (V1 fetches
 * nothing for driver locations and an empty view scope for the job list).
 */
export function loadSelectedViewIds(): number[] {
    try {
        const raw = localStorage.getItem(SELECTED_VIEWS_KEY);
        if (!raw) return [];
        const views = JSON.parse(raw) as Array<{id: number; selected?: boolean}>;
        if (!Array.isArray(views)) return [];
        // The toolbar stores only the selected views, but tolerate a mixed array.
        return views.filter(v => v && (v.selected === undefined || v.selected)).map(v => v.id);
    } catch {
        return [];
    }
}

/**
 * Read the full selected page-view objects (with centre coordinates) from the
 * same localStorage key the toolbar writes. The map uses the coordinates to
 * recentre/zoom on the selected region (V1 `updateMapForSelectedViews`).
 */
export function loadSelectedViews(): DfrntPageViewModel[] {
    try {
        const raw = localStorage.getItem(SELECTED_VIEWS_KEY);
        if (!raw) return [];
        const views = JSON.parse(raw) as DfrntPageViewModel[];
        if (!Array.isArray(views)) return [];
        return views.filter(v => v && (v.selected === undefined || v.selected));
    } catch {
        return [];
    }
}

/** True once the dispatcher has made (or explicitly cleared) a view selection. */
export function hasStoredViewSelection(): boolean {
    return hasStoredKey(SELECTED_VIEWS_KEY);
}

/**
 * Write the dispatcher's selected views. Stores the full objects (not just ids)
 * because the map reads their centre coordinates back via `loadSelectedViews`.
 * An empty array is written as `[]` rather than removing the key — a present but
 * empty selection is what makes "cleared" stick across reloads.
 */
export function persistSelectedViews(views: DfrntPageViewModel[]): void {
    try {
        localStorage.setItem(SELECTED_VIEWS_KEY, JSON.stringify(views));
    } catch { /* private browsing — ignore */ }
}

/**
 * Resolve which views start selected, mirroring home.controller's
 * `initializeViews`. Selection is rebuilt from the fresh server list so stored
 * ids the server no longer returns fall away, and the first view is only
 * auto-selected on a genuine first visit — an explicitly cleared selection
 * (`hasStoredState`) stays cleared.
 */
export function resolveInitialViewSelection(
    serverViews: DfrntPageViewModel[],
    storedIds: number[],
    hasStoredState: boolean,
): number[] {
    if (serverViews.length === 0) return [];
    const stored = new Set(storedIds);
    const selected = serverViews.filter(v => stored.has(v.id)).map(v => v.id);
    if (selected.length === 0 && !hasStoredState) return [serverViews[0].id];
    return selected;
}

/**
 * Read the persisted date filter, mirroring home.controller.ts
 * `loadDateFilterFromStorage`: when "all time" (epoch start) is stored, the end
 * is recomputed to now+24h so future jobs stay in range. Falls back to
 * `setDateFilterDefaults()` when nothing is stored or parsing fails.
 */
export function loadDateFilter(): {startDate: Dayjs; endDate: Dayjs; useTime: boolean} {
    const defaults = setDateFilterDefaults();
    try {
        const raw = localStorage.getItem(DATE_FILTER_KEY);
        if (!raw) {
            return {startDate: defaults.startDate, endDate: defaults.endDate, useTime: defaults.useTime ?? false};
        }
        const parsed = JSON.parse(raw) as {startDate: string; endDate: string; useTime?: boolean};
        const startDate = dayjs(parsed.startDate);
        let endDate = dayjs(parsed.endDate);
        if (startDate.valueOf() === 0) {
            endDate = dayjs().add(24, 'hours');
        }
        return {startDate, endDate, useTime: parsed.useTime ?? false};
    } catch {
        return {startDate: defaults.startDate, endDate: defaults.endDate, useTime: defaults.useTime ?? false};
    }
}

/** Build the initial filters from persisted view selection + date range. */
export function loadDispatchFilters(): DispatchFilters {
    const date = loadDateFilter();
    return {
        despatchViewIds: loadSelectedViewIds(),
        startDate: date.startDate,
        endDate: date.endDate,
        useTime: date.useTime,
    };
}

/** Stable key for remounting data views when the filters change. */
export function filtersKey(filters: DispatchFilters): string {
    return [
        filters.despatchViewIds.join(','),
        filters.startDate.valueOf(),
        filters.endDate.valueOf(),
        filters.useTime ? 1 : 0,
    ].join('|');
}
