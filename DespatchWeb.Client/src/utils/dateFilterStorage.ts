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
import {getContactId} from '../api/session';

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
    /**
     * The date menu's page (its `appPage`). When given, only a range saved under the
     * Custom dates option can expire; a preset such as Today re-derives its own range.
     */
    appPage?: string;
    /** Clock override for tests. */
    now?: Dayjs;
}

/** An epoch start is "all time": no restriction on which days a list covers. */
export function isAllTimeStart(filter: {startDate: Dayjs} | null | undefined): boolean {
    return filter?.startDate.valueOf() === 0;
}

/** The date menu's saved option for `appPage`: per user, falling back to the older per-browser key. */
function savedRangeOption(appPage: string): string | null {
    try {
        return localStorage.getItem(`dateRangeOption-${appPage}-${getContactId()}`)
            ?? localStorage.getItem(`dateRangeOption-${appPage}`);
    } catch {
        return null;
    }
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
 * A custom range that ended before today is not restored: it would silently
 * empty the grid on every load. The picker saves days as browser-local
 * midnights, so both the end and today are browser-local calendar days. Defaults come back with
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
        if (isAllTimeStart({startDate})) {
            endDate = (options.timeZone ? now.tz(options.timeZone) : now).add(24, 'hours');
        } else if (!options.appPage || savedRangeOption(options.appPage) === 'custom_date') {
            if (endDate.local().format('YYYY-MM-DD') < now.local().format('YYYY-MM-DD')) {
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
