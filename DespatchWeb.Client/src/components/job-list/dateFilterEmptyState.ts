import type {Dayjs} from 'dayjs';
import {formatDateRange, type DateRangeFormatOptions} from '../../utils/dateRangeSummary';
import type {SearchNoticeEmptyState} from './jobSearchNotice';

/**
 * The empty state for a list held to a date range, so an empty grid says the dates are why and
 * offers the way out. Undefined for all time (epoch start), where an empty list is genuinely empty.
 */
export function dateFilterEmptyState(
    filter: {startDate: Dayjs; endDate: Dayjs},
    onShowAllDates: (() => void) | undefined,
    format: DateRangeFormatOptions,
): SearchNoticeEmptyState | undefined {
    if (!onShowAllDates || filter.startDate.valueOf() === 0) return undefined;
    return {
        title: 'No jobs in these dates',
        message: `The date filter is set to ${formatDateRange(filter.startDate, filter.endDate, format)}.`,
        actionText: 'Show all dates',
        onAction: onShowAllDates,
    };
}
