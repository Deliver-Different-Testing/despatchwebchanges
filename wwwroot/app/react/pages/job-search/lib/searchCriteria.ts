import dayjs, {Dayjs} from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import JobSearchDateRange from '../../../../components/jobSearch/enums/JobSearchDateRange';
import {ISuggestion} from '../../../../interfaces/job.interface';
import {getIanaTimezone} from '../../../utils/dateUtils';

dayjs.extend(utc);
dayjs.extend(timezone);

export function toSelectedIds(items: ISuggestion[] | undefined): number[] | undefined {
    const ids = (items ?? [])
        .map(c => c.id)
        .filter((id): id is number => typeof id === 'number');
    return ids.length > 0 ? ids : undefined;
}

/** Courier suggestions read "{Code} ({Name} {Surname})" — the code is the first token. */
function hasCourierCode(suggestion: {text?: string}, code: string): boolean {
    return !!suggestion.text && suggestion.text.split(/[\s(]/)[0] === code;
}

export function filterCouriersForNumericSearch<T extends {text?: string}>(
    results: T[],
    searchText: string,
): T[] {
    const trimmed = searchText.trim();
    if (!/^\d+$/.test(trimmed)) return results;

    const exactMatches = results.filter(r => hasCourierCode(r, trimmed));
    return exactMatches.length > 0 ? exactMatches : results;
}

/**
 * The single form a search date takes once it reaches a request. Mirrors what
 * `useSearchCriteria` stores, so a date handed straight to an action produces
 * the same request as the same date read back from committed state.
 */
export function normalizeSearchDate(date: Dayjs | undefined): Dayjs | undefined {
    return date?.isValid() ? date.startOf('day') : undefined;
}

export interface DateRangeResolution {
    from_date: Dayjs;
    to_date: Dayjs;
}

export function resolveDateRange(
    range: JobSearchDateRange,
    tenantTimeZoneName: string,
    now: Dayjs = dayjs(),
): DateRangeResolution | null {
    const tenantTz = getIanaTimezone(tenantTimeZoneName);
    const tzNow = now.tz(tenantTz);

    switch (range) {
        case JobSearchDateRange.Today:
            return {from_date: tzNow, to_date: tzNow};
        case JobSearchDateRange.Fortnight:
            return {from_date: tzNow.subtract(7, 'day'), to_date: tzNow.add(7, 'day')};
        case JobSearchDateRange.Month:
            return {from_date: tzNow.startOf('month'), to_date: tzNow.endOf('month')};
        case JobSearchDateRange.Custom:
            return null;
    }
}
