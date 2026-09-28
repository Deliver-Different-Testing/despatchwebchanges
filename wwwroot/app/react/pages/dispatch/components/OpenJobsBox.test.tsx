import React from 'react';
import {fireEvent, render, screen} from '@testing-library/react';
import dayjs from 'dayjs';
import {MantineTestProvider} from '../../../__testUtils__';
import {OpenJobsBox} from './OpenJobsBox';
import {MAX_OVERVIEW_PANEL_DAYS} from '../lib/overviewPanelRange';

jest.mock('../../../hooks/useOverviewApi', () => ({
    useOverviewOpenJobs: jest.fn(),
}));

jest.mock('../../../utils/dateUtils', () => ({
    formatMins: jest.fn((s: string) => s),
}));

import {useOverviewOpenJobs} from '../../../hooks/useOverviewApi';

const mockUseOpenJobs = useOverviewOpenJobs as jest.MockedFunction<typeof useOverviewOpenJobs>;

// ContactID is 0 in setup.ts
const VIEW_MODE_KEY = 'dispatchOpenJobsViewMode-0';
const SORT_KEY = 'dispatchOpenJobsSort-0';
const LIMIT_KEY = 'dispatchOpenJobsLimit-0';

const startDate = dayjs('2026-09-01T00:00:00');
const endDate = dayjs('2026-09-04T00:00:00');

const openJob = {
    jobId: 77,
    reference: 'JOB-077',
    status: 'New',
    pickupTime: '2026-09-01T10:00:00',
    pickupName: 'Warehouse A',
    pickupAddress: '123 Main St',
    deliveryTime: '2026-09-01T14:00:00',
    deliveryName: 'Office B',
    deliveryAddress: '456 High St',
    driverName: 'John Smith',
    completedToday: 5,
    lastCompleted: '13:00',
    quantity: 2,
    packageType: 'Parcel',
    mileage: 15,
    _pickUpTimeStr: '01 Sep 2026 10:00',
    _deliveryTimeStr: '01 Sep 2026 14:00',
};

const renderBox = (props: Partial<React.ComponentProps<typeof OpenJobsBox>> = {}) =>
    render(
        <MantineTestProvider>
            <OpenJobsBox despatchViewIds={[]} startDate={startDate} endDate={endDate} {...props} />
        </MantineTestProvider>,
    );

const lastParams = () => mockUseOpenJobs.mock.calls.at(-1)?.[0] as any;

describe('OpenJobsBox', () => {
    beforeEach(() => {
        localStorage.clear();
        jest.clearAllMocks();
        mockUseOpenJobs.mockReturnValue({data: [openJob], isLoading: false} as any);
    });

    /*
     * The card view's JobCard is 300px minimum at 50% width, so it needs 600px+ to
     * lay out as intended — a dashboard column does not have it. Table first here,
     * unlike the full-width Overview page, which opens on cards.
     */
    it('opens in table view', () => {
        renderBox();

        expect(screen.getByRole('radio', {name: 'Table'})).toBeChecked();
        expect(screen.getByRole('columnheader', {name: /Job Number/})).toBeInTheDocument();
    });

    it('persists the view mode and restores it', () => {
        const {unmount} = renderBox();

        fireEvent.click(screen.getByRole('radio', {name: 'Cards'}));
        expect(localStorage.getItem(VIEW_MODE_KEY)).toContain('cards');
        unmount();

        renderBox();
        expect(screen.getByRole('radio', {name: 'Cards'})).toBeChecked();
        expect(screen.getByText('John Smith')).toBeInTheDocument();
    });

    it('threads the dispatch date range into the query', () => {
        renderBox();

        expect(lastParams().startDate).toBe(startDate);
        expect(lastParams().endDate).toBe(endDate);
    });

    it('threads the selected despatch views into the query, matching the main Jobs List', () => {
        renderBox({despatchViewIds: [3, 7]});

        expect(lastParams().despatchViewIds).toEqual([3, 7]);
    });

    it('clamps an all-time range and tells the operator', () => {
        renderBox({startDate: dayjs(0), endDate});

        expect(lastParams().startDate.isSame(endDate.subtract(MAX_OVERVIEW_PANEL_DAYS, 'day'))).toBe(true);
        expect(screen.getByText(new RegExp(`last ${MAX_OVERVIEW_PANEL_DAYS} days`, 'i'))).toBeInTheDocument();
    });

    it('passes the refresh cadence to the query hook', () => {
        renderBox({refetchIntervalMs: 45000});

        expect(mockUseOpenJobs.mock.calls.at(-1)?.[1]).toBe(45000);
    });

    it('persists the sort', () => {
        renderBox();

        fireEvent.click(screen.getByRole('button', {name: /Driver/}));

        expect(localStorage.getItem(SORT_KEY)).toContain('driverName');
    });

    it('restores a persisted page size', () => {
        localStorage.setItem(LIMIT_KEY, JSON.stringify(20));
        renderBox({});

        expect(screen.getByRole('combobox', {name: 'Rows per page'})).toHaveValue('20');
    });

    it('selects a job into the detail panel when a handler is supplied', () => {
        const onSelectJob = jest.fn();
        renderBox({onSelectJob});

        fireEvent.click(screen.getByRole('button', {name: 'Open job JOB-077'}));

        expect(onSelectJob).toHaveBeenCalledWith(77);
    });

    it('leaves rows inert without a select handler', () => {
        renderBox();

        expect(screen.queryByRole('button', {name: 'Open job JOB-077'})).not.toBeInTheDocument();
    });
});
