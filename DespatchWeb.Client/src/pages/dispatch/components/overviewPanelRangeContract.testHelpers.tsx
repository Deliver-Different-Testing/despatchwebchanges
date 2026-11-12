import type {Dayjs} from 'dayjs';
import {screen} from '@testing-library/react';
import {MAX_OVERVIEW_PANEL_DAYS} from '../lib/overviewPanelRange';

interface RangeParams {
    startDate: Dayjs;
    endDate: Dayjs;
    despatchViewIds: number[];
}

interface OverviewPanelRangeHarness {
    renderBox: (props?: {despatchViewIds?: number[]; startDate?: Dayjs; endDate?: Dayjs}) => unknown;
    lastParams: () => RangeParams;
    startDate: Dayjs;
    endDate: Dayjs;
    startDateEpoch: Dayjs;
}

/** Contract shared by the Overview panel boxes: date range and views flow into the query, all-time is clamped. */
export function itThreadsOverviewPanelRange({renderBox, lastParams, startDate, endDate, startDateEpoch}: OverviewPanelRangeHarness) {
    it('threads the dispatch date range into the query', () => {
        renderBox();

        expect(lastParams().startDate).toBe(startDate);
        expect(lastParams().endDate).toBe(endDate);
    });

    it('threads the selected despatch views into the query, matching the main Jobs List', () => {
        renderBox({despatchViewIds: [3, 7]});

        expect(lastParams().despatchViewIds).toEqual([3, 7]);
    });

    // The toolbar's "all time" resolves to epoch-start, which the Overview endpoints were never built to answer.
    it('clamps an all-time range and tells the operator', () => {
        renderBox({startDate: startDateEpoch, endDate});

        expect(lastParams().startDate.isSame(endDate.subtract(MAX_OVERVIEW_PANEL_DAYS, 'day'))).toBe(true);
        expect(screen.getByText(new RegExp(`last ${MAX_OVERVIEW_PANEL_DAYS} days`, 'i'))).toBeInTheDocument();
    });
}
