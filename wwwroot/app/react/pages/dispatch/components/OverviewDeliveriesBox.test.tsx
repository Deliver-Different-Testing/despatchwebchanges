import React from 'react';
import {act, fireEvent, render, screen} from '@testing-library/react';
import dayjs from 'dayjs';
import {MantineTestProvider} from '../../../__testUtils__';
import {OverviewDeliveriesBox} from './OverviewDeliveriesBox';
import {MAX_OVERVIEW_PANEL_DAYS} from '../lib/overviewPanelRange';

jest.mock('../../../hooks/useOverviewApi', () => ({
    useOverviewJobs: jest.fn(),
}));

import {useOverviewJobs} from '../../../hooks/useOverviewApi';

const mockUseOverviewJobs = useOverviewJobs as jest.MockedFunction<typeof useOverviewJobs>;

// ContactID is 0 in setup.ts
const STATUS_KEY = 'dispatchOverviewStatus-0';
const SORT_KEY = 'dispatchOverviewSort-0';
const LIMIT_KEY = 'dispatchOverviewLimit-0';
const SEARCH_KEY = 'dispatchOverviewSearch-0';

const startDate = dayjs('2026-09-01T00:00:00');
const endDate = dayjs('2026-09-04T00:00:00');

const delivery = {
    jobId: 4242,
    jobName: 'JOB-4242',
    status: 'IN_TRANSIT',
    completion: 50,
    pickup: '01 Sep 09:00',
    delivery: '01 Sep 12:00',
    driver: 'John Smith',
    region: 'Auckland',
    childJobs: [],
};

const renderBox = (props: Partial<React.ComponentProps<typeof OverviewDeliveriesBox>> = {}) =>
    render(
        <MantineTestProvider>
            <OverviewDeliveriesBox
                startDate={startDate}
                endDate={endDate}
                onSelectJob={jest.fn()}
                {...props}
            />
        </MantineTestProvider>,
    );

const lastParams = () => mockUseOverviewJobs.mock.calls.at(-1)?.[0] as any;

describe('OverviewDeliveriesBox', () => {
    beforeEach(() => {
        localStorage.clear();
        sessionStorage.clear();
        jest.clearAllMocks();
        mockUseOverviewJobs.mockReturnValue({
            data: {items: [delivery], total: 1, page: 1, pages: 1},
            isLoading: false,
        } as any);
    });

    it('renders the deliveries it is given', () => {
        renderBox();

        expect(screen.getByText('JOB-4242')).toBeInTheDocument();
    });

    it('threads the dispatch date range straight into the query', () => {
        renderBox();

        expect(lastParams().startDate).toBe(startDate);
        expect(lastParams().endDate).toBe(endDate);
    });

    /*
     * The toolbar's "all time" resolves to epoch-start, which the Overview
     * endpoints were never built to answer. The panel narrows it and says so.
     */
    it('clamps an all-time range and tells the operator', () => {
        renderBox({startDate: dayjs(0), endDate});

        expect(lastParams().startDate.isSame(endDate.subtract(MAX_OVERVIEW_PANEL_DAYS, 'day'))).toBe(true);
        expect(screen.getByText(new RegExp(`last ${MAX_OVERVIEW_PANEL_DAYS} days`, 'i'))).toBeInTheDocument();
    });

    it('says nothing about the range when it was not narrowed', () => {
        renderBox();

        expect(screen.queryByText(/last \d+ days/i)).not.toBeInTheDocument();
    });

    it('starts on the active status group', () => {
        renderBox();

        expect(screen.getByRole('radio', {name: 'Active'})).toBeChecked();
        expect(lastParams().statusGroup).toBe(1);
    });

    it('sends the picked status group and persists it', () => {
        renderBox();

        fireEvent.click(screen.getByRole('radio', {name: 'Completed'}));

        expect(lastParams().statusGroup).toBe(3);
        expect(localStorage.getItem(STATUS_KEY)).toContain('completed');
    });

    it('restores a persisted status group', () => {
        localStorage.setItem(STATUS_KEY, JSON.stringify('inactive'));
        renderBox();

        expect(screen.getByRole('radio', {name: 'Inactive'})).toBeChecked();
        expect(lastParams().statusGroup).toBe(2);
    });

    it('debounces the search box into the query', () => {
        jest.useFakeTimers();
        try {
            renderBox();

            fireEvent.change(screen.getByRole('textbox', {name: 'Search deliveries'}), {
                target: {value: 'acme'},
            });
            expect(lastParams().search).toBeUndefined();

            act(() => {
                jest.advanceTimersByTime(400);
            });
            expect(lastParams().search).toBe('acme');
        } finally {
            jest.useRealTimers();
        }
    });

    /*
     * BoxShell remounts every panel when the layout version bumps — which happens
     * on the async layout sync, a beat after mount — so a search the operator is
     * mid-way through typing has to survive a remount.
     */
    it('restores the search text after a remount', () => {
        sessionStorage.setItem(SEARCH_KEY, JSON.stringify('acme'));
        renderBox();

        expect(screen.getByRole('textbox', {name: 'Search deliveries'})).toHaveValue('acme');
    });

    it('persists the sort and sends it to the query', () => {
        renderBox();

        fireEvent.click(screen.getByRole('button', {name: /Driver/}));

        expect(lastParams().orderBy).toBe('driver');
        expect(localStorage.getItem(SORT_KEY)).toContain('driver');
    });

    it('persists the page size', () => {
        localStorage.setItem(LIMIT_KEY, JSON.stringify(50));
        renderBox();

        expect(lastParams().limit).toBe(50);
    });

    /* The Dispatch board has a Job Detail panel, so a row selects rather than
     * navigating — no confirmation step, and no per-row map action either. */
    it('selects the job straight into the detail panel, with no confirm step', () => {
        const onSelectJob = jest.fn();
        renderBox({onSelectJob});

        fireEvent.click(screen.getByRole('button', {name: 'View job details'}));

        expect(onSelectJob).toHaveBeenCalledWith(4242);
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('offers no per-row map action', () => {
        renderBox();

        expect(screen.queryByRole('button', {name: 'Open map'})).not.toBeInTheDocument();
    });

    it('passes the refresh cadence to the query hook', () => {
        renderBox({refetchIntervalMs: 30000});

        expect(mockUseOverviewJobs.mock.calls.at(-1)?.[1]).toBe(30000);
    });

    it('normalises API statuses for display', () => {
        mockUseOverviewJobs.mockReturnValue({
            data: {items: [{...delivery, status: 'in transit'}], total: 1, page: 1, pages: 1},
            isLoading: false,
        } as any);

        renderBox();

        expect(screen.getByText('IN_TRANSIT')).toBeInTheDocument();
    });
});
