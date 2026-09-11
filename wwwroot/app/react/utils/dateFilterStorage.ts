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
import setDateFilterDefaults from '../../functions/setDateFilterDefaults';

// Self-contained: this module calls `.tz()`, so it must not rely on another
// module having extended dayjs first.
dayjs.extend(utc);
dayjs.extend(timezone);

export interface StoredDateFilter {
    startDate: Dayjs;
    endDate: Dayjs;
    useTime: boolean;
}

export interface LoadDateFilterOptions {
    /**
     * Zone to resolve the recomputed "all time" end in. Affects only how the
     * resulting Dayjs formats, not the instant. Nationwide passes the page
     * timezone; Dispatch does not.
     */
    timeZone?: string;
}

function defaults(): StoredDateFilter {
    const d = setDateFilterDefaults();
    return {startDate: d.startDate, endDate: d.endDate, useTime: d.useTime ?? false};
}

/**
 * Read the persisted range, falling back to `setDateFilterDefaults()` when
 * nothing is stored or the stored value cannot be parsed.
 *
 * An epoch start means "all time", in which case the stored end is stale by
 * definition and is recomputed to now+24h so future jobs stay in range.
 */
export function loadDateFilterFrom(
    key: string,
    options: LoadDateFilterOptions = {},
): StoredDateFilter {
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return defaults();

        const parsed = JSON.parse(raw) as {startDate: string; endDate: string; useTime?: boolean};
        const startDate = dayjs(parsed.startDate);
        let endDate = dayjs(parsed.endDate);

        if (startDate.valueOf() === 0) {
            const now = options.timeZone ? dayjs().tz(options.timeZone) : dayjs();
            endDate = now.add(24, 'hours');
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
