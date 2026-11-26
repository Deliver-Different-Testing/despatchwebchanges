import type {Dayjs} from 'dayjs';
import {formatLongDate, formatShortDate} from './dateUtils';

export interface DateRangeFormatOptions {
    /** IANA zone the days are read in. */
    timeZone: string;
    isUs?: boolean;
}

/** "21/Nov to 23/Nov" (or "Nov/21 to Nov/23" for US tenants), read on the tenant's calendar. */
export function formatDateRange(start: Dayjs, end: Dayjs, {timeZone, isUs}: DateRangeFormatOptions): string {
    const from = start.tz(timeZone);
    const to = end.tz(timeZone);
    if (from.isSame(to, 'day')) return formatShortDate(from, isUs);
    if (!from.isSame(to, 'year')) return `${formatLongDate(from, isUs)} to ${formatLongDate(to, isUs)}`;
    return `${formatShortDate(from, isUs)} to ${formatShortDate(to, isUs)}`;
}

export function expiredRangeMessage(
    range: {startDate: Dayjs; endDate: Dayjs},
    options: DateRangeFormatOptions,
): string {
    return `Your saved date range (${formatDateRange(range.startDate, range.endDate, options)}) has ended. Showing all dates.`;
}
