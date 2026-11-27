import type {Dayjs} from 'dayjs';
import {formatDateRange, type DateRangeFormatOptions} from '../../utils/dateRangeSummary';
import {isAllTimeStart} from '../../utils/dateFilterStorage';
import type {SearchNoticeEmptyState} from './jobSearchNotice';

export interface DateFilterEmptyStateOptions extends DateRangeFormatOptions {
    /** Views narrow the list too, so the dates may not be the whole story. */
    viewsSelected?: boolean;
}

/**
 * The empty state for a list held to a date range, so an empty grid says the dates are why and
 * offers the way out. Undefined for all time (epoch start), where an empty list is genuinely empty.
 */
export function dateFilterEmptyState(
    filter: {startDate: Dayjs; endDate: Dayjs},
    onShowAllDates: (() => void) | undefined,
    {viewsSelected, ...format}: DateFilterEmptyStateOptions,
): SearchNoticeEmptyState | undefined {
    if (!onShowAllDates || isAllTimeStart(filter)) return undefined;
    const range = formatDateRange(filter.startDate, filter.endDate, format);
    return {
        title: 'No jobs in these dates',
        message: `The date filter is set to ${range}.${viewsSelected ? ' Your selected views may also be hiding jobs.' : ''}`,
        actionText: 'Show all dates',
        onAction: onShowAllDates,
    };
}
