/**
 * Persisted date-range filter, shared by the pages that have one.
 *
 * Dispatch and Nationwide both stored a range under their own key with the same
 * "all time" recomputation rule, in two separate implementations. This is the
 * one implementation; callers supply their own key.
 */

import dayjs, {Dayjs} from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import setDateFilterDefaults from './setDateFilterDefaults';

// Self-contained: this module calls `.tz()`, so it must not rely on another
// module having extended dayjs first.
dayjs.extend(utc);
dayjs.extend(timezone);

export interface StoredDateFilter {
    startDate: Dayjs;
    endDate: Dayjs;
    useTime: boolean;
}

export interface LoadedDateFilter extends StoredDateFilter {
    /** The stored custom range that ended before today and so was not restored. */
    expiredRange?: {startDate: Dayjs; endDate: Dayjs};
}

export interface LoadDateFilterOptions {
    /**
     * Zone to resolve the recomputed "all time" end in. Affects only how the
     * resulting Dayjs formats, not the instant. Nationwide passes the page
     * timezone; Dispatch does not.
     */
    timeZone?: string;
    /** Clock override for tests. */
    now?: Dayjs;
}

function defaults(timeZone?: string): StoredDateFilter {
    const d = setDateFilterDefaults(timeZone);
    return {startDate: d.startDate, endDate: d.endDate, useTime: d.useTime ?? false};
}

/**
 * Read the persisted range, falling back to `setDateFilterDefaults()` when
 * nothing is stored or the stored value cannot be parsed.
 *
 * An epoch start means "all time", in which case the stored end is stale by
 * definition and is recomputed to now+24h so future jobs stay in range.
 *
 * A custom range that ended before today (in `timeZone`) is not restored: it
 * would silently empty the grid on every load. Defaults come back with
 * `expiredRange` set. Storage is left alone so this stays pure; the page
 * persists the reset.
 */
export function loadDateFilterFrom(
    key: string,
    options: LoadDateFilterOptions = {},
): LoadedDateFilter {
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return defaults();

        const parsed = JSON.parse(raw) as {startDate: string; endDate: string; useTime?: boolean};
        const startDate = dayjs(parsed.startDate);
        let endDate = dayjs(parsed.endDate);
        if (!startDate.isValid() || !endDate.isValid()) return defaults();

        const now = options.now ?? dayjs();
        if (startDate.valueOf() === 0) {
            endDate = (options.timeZone ? now.tz(options.timeZone) : now).add(24, 'hours');
        } else {
            const startOfToday = (options.timeZone ? now.tz(options.timeZone) : now).startOf('day');
            if (endDate.isBefore(startOfToday)) {
                return {...defaults(options.timeZone), expiredRange: {startDate, endDate}};
            }
        }

        return {startDate, endDate, useTime: parsed.useTime ?? false};
    } catch (error) {
        console.error('Error loading date filter from storage:', error);
        return defaults();
    }
}

/** Persist the range. A storage failure is logged, never thrown. */
export function saveDateFilterTo(key: string, filter: StoredDateFilter): void {
    if (!filter) return;

    try {
        localStorage.setItem(key, JSON.stringify(filter));
    } catch (error) {
        console.error('Error saving date filter to storage:', error);
    }
}
