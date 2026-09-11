import type {Dayjs} from 'dayjs';

/**
 * The widest range the Overview panels will ask the server for. Wide enough to
 * cover any range an operator picks deliberately, narrow enough that the
 * toolbar's "all time" cannot turn a dashboard panel into a full-history scan.
 */
export const MAX_OVERVIEW_PANEL_DAYS = 90;

export interface OverviewPanelRange {
    startDate: Dayjs;
    endDate: Dayjs;
    /** True when the start was pulled forward — the panel says so in its header. */
    clamped: boolean;
}

/**
 * Narrow the dispatch toolbar's date range to something the `/overview` endpoints
 * can answer cheaply.
 *
 * The toolbar supports "all time", which `loadDateFilter` resolves to epoch-start
 * → now+24h. The Overview page only ever sent a range the user picked, so its
 * queries are not built for that span. Rather than silently paging through a
 * tenant's whole history, the panels ask for the most recent
 * `MAX_OVERVIEW_PANEL_DAYS` and report that they did.
 *
 * An inverted range is left as-is: moving the start would fabricate a window the
 * caller never asked for, and the server's empty result is the honest answer.
 */
export function clampOverviewPanelRange(startDate: Dayjs, endDate: Dayjs): OverviewPanelRange {
    if (endDate.diff(startDate, 'day') <= MAX_OVERVIEW_PANEL_DAYS) {
        return {startDate, endDate, clamped: false};
    }
    return {
        startDate: endDate.subtract(MAX_OVERVIEW_PANEL_DAYS, 'day'),
        endDate,
        clamped: true,
    };
}
