import type {Dayjs} from 'dayjs';
import type {JobSearchNotice} from '../../types/dispatchJob';
import {pluralise} from '../../utils/pluralise';

/** The server stops counting out-of-window matches here and returns one more to mean "over". */
export const OUTSIDE_WINDOW_COUNT_CAP = 50;

export interface SearchNoticeEmptyState {
    title: string;
    message: string;
    actionText?: string;
    onAction?: () => void;
}

/**
 * The empty state a job search shows instead of the generic "No jobs found", so an empty grid says
 * why it is empty and offers the way out.
 */
export function searchNoticeEmptyState(
    notice: JobSearchNotice | null | undefined,
    onWidenDates?: (range: {from: Dayjs; to: Dayjs}) => void,
): SearchNoticeEmptyState | undefined {
    if (!notice) return undefined;

    if (notice.searchTooBroad) {
        return {
            title: 'Search too broad',
            message: 'Use at least 3 characters, or narrow the dates or pick a client, then search again.',
        };
    }

    const outside = notice.outsideWindowCount ?? 0;
    if (outside > OUTSIDE_WINDOW_COUNT_CAP) {
        return {
            title: 'No jobs in these dates',
            message: `Over ${OUTSIDE_WINDOW_COUNT_CAP} jobs start with ${notice.jobTerm} on other dates. Type more of the job number.`,
        };
    }
    if (outside > 0) {
        const range = notice.outsideWindowRange;
        return {
            title: 'No jobs in these dates',
            message: `${outside} ${pluralise(outside, 'job starts', 'jobs start')} with ${notice.jobTerm} outside the dates you searched.`,
            actionText: range && onWidenDates ? 'Include those dates' : undefined,
            onAction: range && onWidenDates ? () => onWidenDates(range) : undefined,
        };
    }

    return undefined;
}

/** The line above the grid naming how a job-number term matched; null when there is nothing to say. */
export function matchModeLabel(notice: JobSearchNotice | null | undefined): string | null {
    const term = notice?.jobTerm;
    if (!notice || !term) return null;
    switch (notice.matchMode) {
        case 'exact':
            return `Job number ${term} from any date, and numbers starting with it`;
        case 'prefix':
            return `Job numbers starting with ${term}`;
        default:
            return null;
    }
}
