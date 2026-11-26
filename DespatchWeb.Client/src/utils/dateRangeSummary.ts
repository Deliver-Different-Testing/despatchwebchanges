import dayjs, {type Dayjs} from 'dayjs';
import {formatLongDate, formatShortDate} from './dateUtils';

export interface DateRangeFormatOptions {
    isUs?: boolean;
    /** Clock override for tests; decides whether the year is worth naming. */
    now?: Dayjs;
}

/**
 * "21/Nov to 23/Nov" (or "Nov/21 to Nov/23" for US tenants). The date picker saves each day as
 * midnight in the browser's zone, so the days are read there, as the picker showed them. The year
 * is named when the range is not in the current year.
 */
export function formatDateRange(start: Dayjs, end: Dayjs, {isUs, now = dayjs()}: DateRangeFormatOptions): string {
    const from = start.local();
    const to = end.local();
    if (from.isSame(to, 'day')) {
        return from.isSame(now, 'year') ? formatShortDate(from, isUs) : formatLongDate(from, isUs);
    }
    if (!from.isSame(now, 'year') || !to.isSame(now, 'year')) {
        return `${formatLongDate(from, isUs)} to ${formatLongDate(to, isUs)}`;
    }
    return `${formatShortDate(from, isUs)} to ${formatShortDate(to, isUs)}`;
}

export function expiredRangeMessage(
    range: {startDate: Dayjs; endDate: Dayjs},
    options: DateRangeFormatOptions,
): string {
    return `Your saved date range (${formatDateRange(range.startDate, range.endDate, options)}) has ended. Showing all dates.`;
}
