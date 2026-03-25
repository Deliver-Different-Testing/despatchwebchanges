/** @jest-environment jest-environment-jsdom */
/**
 * JobListPanel Tests
 *
 * Covers the main container component: rendering child components,
 * category filtering, search filtering, job selection, stats computation,
 * localStorage persistence, AngularJS bridge callbacks, and optimistic dispatch.
 */

import React from 'react';
import {act, fireEvent, screen, waitFor, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {renderWithProviders} from '../../../__testUtils__';
import {JobListPanel} from './JobListPanel';
import type {DispatchJob, FetchConfig, JobListPanelProps, JobListSearchParams, JobSearchResult} from '../../../interfaces/dispatchJob';
import {AppPage} from '../../../interfaces/dispatchJob';
import dayjs from 'dayjs';

// Mock modules that depend on AngularJS (window.angular)
jest.mock('../../../services/splitJobFlow', () => ({
    executeSplitJobFlow: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../dialogs/add-event-dialog', () => ({
    openAddEventDialog: jest.fn().mockResolvedValue(true),
}));
jest.mock('../../dialogs/event-group-dialog', () => ({
    openEventGroupDialog: jest.fn().mockResolvedValue(true),
}));

// Mock child components' heavy dependencies
jest.mock('../../../services/courierApi', () => ({
    searchActiveCouriersExtended: jest.fn().mockResolvedValue([]),
}));
jest.mock('../../../services/aiAssistantApi', () => ({
    suggestCouriers: jest.fn().mockResolvedValue({couriers: [], summary: '', usage: {inputTokens: 0, outputTokens: 0}}),
}));
jest.mock('../../../../functions/aiSettings', () => ({
    isAiEnabled: jest.fn().mockReturnValue(false),
}));
jest.mock('../../../utils/dateUtils', () => ({
    formatMins: jest.fn((d: any) => d?.format?.('HH:mm') || ''),
    formatShortDate: jest.fn((d: any) => d?.format?.('DD/MMM') || ''),
    getIanaTimezone: jest.fn(() => 'Pacific/Auckland'),
    getTenantTimezone: jest.fn(() => 'New Zealand Standard Time'),
    getTimezoneAbbreviation: jest.fn(() => 'NZST'),
}));

jest.mock('../../../services/jobListApi', () => ({
    allocateJobs: jest.fn(),
    getEventGroups: jest.fn().mockResolvedValue([]),
    updateJobReadStatus: jest.fn().mockResolvedValue(undefined),
    bulkUpdateReadStatus: jest.fn().mockResolvedValue(undefined),
    lateCall: jest.fn().mockResolvedValue(undefined),
    reAllocateJobs: jest.fn().mockResolvedValue(undefined),
    restoreJobs: jest.fn().mockResolvedValue(undefined),
    setFirstJob: jest.fn().mockResolvedValue(undefined),
    releaseBulkJob: jest.fn().mockResolvedValue(undefined),
    splitJob: jest.fn().mockResolvedValue(undefined),
    markJobMissing: jest.fn().mockResolvedValue(undefined),
    moveJobToReprice: jest.fn().mockResolvedValue(undefined),
    updateJobDetail: jest.fn().mockResolvedValue(undefined),
    restoreNationwideJob: jest.fn().mockResolvedValue(undefined),
}));

import {allocateJobs, bulkUpdateReadStatus, restoreJobs} from '../../../services/jobListApi';
const mockedAllocateJobs = allocateJobs as jest.Mock;
const mockedBulkUpdateReadStatus = bulkUpdateReadStatus as jest.Mock;
const mockedRestoreJobs = restoreJobs as jest.Mock;

// ── Mock Data Factory ────────────────────────────────────────────────

function createMockDispatchJob(overrides?: Partial<DispatchJob>): DispatchJob {
    return {
        angularId: 'job-1',
        id: 1,
        jobNo: 'J001',
        hasBeenRead: true,
        showCourierSearch: false,
        isParentOrSingle: true,
        parentId: 0,
        isFlightJob: false,
        isAgentJob: false,
        isBulkJob: false,
        isArchived: false,
        statusId: 0, // New
        statusName: 'New',
        status: 'New',
        booked: dayjs('2030-06-15T09:00:00'),
        time: dayjs('2030-06-15T17:00:00'),
        remain: 120,
        courierSearchLoading: false,
        pickupAddress: {
            addressLine1: '', addressLine2: '', addressLine3: '10',
            addressLine4: 'Queen St', addressLine5: 'Auckland CBD',
            addressLine6: 'Auckland', addressLine7: '1010', addressLine8: '',
            fullAddress: '10 Queen St, Auckland',
        } as any,
        deliveryAddress: {
            addressLine1: '', addressLine2: '', addressLine3: '20',
            addressLine4: 'High St', addressLine5: 'Newmarket',
            addressLine6: 'Auckland', addressLine7: '1023', addressLine8: '',
            fullAddress: '20 High St, Auckland',
        } as any,
        speed: 'Standard',
        vehicle: {id: 1, text: 'Car'},
        client: 'Acme Corp',
        pickUpTimeZone: {id: 1, text: 'NZST'},
        deliveryTimeZone: {id: 1, text: 'NZST'},
        ...overrides,
    } as DispatchJob;
}

// ── Default Props ────────────────────────────────────────────────────

function createDefaultProps(overrides?: Partial<JobListPanelProps>): JobListPanelProps {
    return {
        showToast: jest.fn(),
        appPage: AppPage.Dispatch,
        ...overrides,
    };
}

/**
 * Helper: render panel and push jobs via the setJobsCallback bridge
 */
function renderAndPushJobs(
    jobs: DispatchJob[],
    propOverrides?: Partial<JobListPanelProps>,
) {
    let pushJobs: (jobs: DispatchJob[], total: number) => void = () => {};
    const props = createDefaultProps({
        setJobsCallback: (cb) => { pushJobs = cb; },
        ...propOverrides,
    });
    const {unmount, rerender, ...rest} = renderWithProviders(<JobListPanel {...props}/>);
    act(() => pushJobs(jobs, jobs.length));
    return {result: {unmount, rerender, ...rest}, pushJobs, props};
}

// ── Tests ────────────────────────────────────────────────────────────

describe('JobListPanel', () => {
    beforeEach(() => {
        localStorage.clear();
        (window as any).ContactID = 42;
        mockedAllocateJobs.mockResolvedValue(undefined);
    });

    it('renders all sections, pushes jobs via bridge, and supports refresh/select callbacks', () => {
        const onJobSelect = jest.fn();
        const onRefresh = jest.fn();
        const setJobsCallbackSpy = jest.fn();
        let refreshFn: () => void = () => {};
        let selectJob: (id: number) => void = () => {};
        let pushJobs: (j: DispatchJob[], t: number) => void = () => {};

        renderWithProviders(
            <JobListPanel {...createDefaultProps({
                onJobSelect,
                onRefresh,
                setJobsCallback: (cb) => { pushJobs = cb; setJobsCallbackSpy(cb); },
                setRefreshCallback: (cb) => { refreshFn = cb; },
                setSelectJobCallback: (cb) => { selectJob = cb; },
            })}/>
        );

        // Empty state checks
        expect(screen.getByText('Total')).toBeInTheDocument();
        expect(screen.getByText('Unassigned')).toBeInTheDocument();
        expect(screen.getByRole('button', {name: 'All'})).toBeInTheDocument();
        expect(screen.getByPlaceholderText('Search jobs...')).toBeInTheDocument();
        expect(screen.getByText(/Showing/)).toBeInTheDocument();
        expect(screen.getByText('No jobs to display')).toBeInTheDocument();
        expect(setJobsCallbackSpy).toHaveBeenCalledWith(expect.any(Function));

        // Push jobs via bridge
        const jobs = [
            createMockDispatchJob({id: 10, jobNo: 'J010'}),
            createMockDispatchJob({id: 20, jobNo: 'J020'}),
        ];
        act(() => pushJobs(jobs, 2));
        expect(screen.getByText('J010')).toBeInTheDocument();
        expect(screen.getByText('J020')).toBeInTheDocument();

        // Refresh bridge
        act(() => refreshFn());
        expect(onRefresh).toHaveBeenCalledTimes(1);

        // Select job bridge
        act(() => selectJob(10));
        const row = screen.getByText('J010').closest('tr');
        expect(row).toHaveClass('Mui-selected');
    });

    it('filters by category, search (job number, client, courier), computes stats, selects job on click', async () => {
        jest.useFakeTimers();
        const user = userEvent.setup({advanceTimers: jest.advanceTimersByTime, delay: null});
        const onCategoryChange = jest.fn();
        const onSearchChange = jest.fn();
        const onJobSelect = jest.fn();
        const jobs = [
            createMockDispatchJob({id: 1, jobNo: 'UNASSIGNED-1', statusId: 0, client: 'Widget Co'}),
            createMockDispatchJob({id: 2, jobNo: 'DISPATCHED-1', statusId: 1, client: 'Gadget Inc', assignedCourier: {id: 100, text: '100 - Mike Runner'}}),
            createMockDispatchJob({id: 3, jobNo: 'DONE-1', statusId: 6}),
            createMockDispatchJob({id: 4, jobNo: 'TRANSIT-1', statusId: 11, assignedCourier: {id: 2, text: 'C'}}),
        ];
        renderAndPushJobs(jobs, {onCategoryChange, onSearchChange, onJobSelect});

        // Stats header
        const totalLabel = screen.getByText('Total');
        const statsArea = totalLabel.closest('div')!.parentElement!;
        expect(within(statsArea).getByText('4')).toBeInTheDocument();

        // Footer
        expect(screen.getByText(/Showing 4/)).toBeInTheDocument();
        expect(screen.getByText(/Last updated:/)).toBeInTheDocument();

        // Category filter — Unassigned
        await user.click(screen.getByText('Unassigned'));
        expect(onCategoryChange).toHaveBeenCalledWith('needs-dispatch');
        expect(screen.getByText('UNASSIGNED-1')).toBeInTheDocument();
        expect(screen.queryByText('DISPATCHED-1')).not.toBeInTheDocument();

        // Category filter — Done
        await user.click(screen.getByRole('button', {name: 'Done'}));
        expect(screen.getByText('DONE-1')).toBeInTheDocument();
        expect(screen.queryByText('UNASSIGNED-1')).not.toBeInTheDocument();

        // Category filter — All
        await user.click(screen.getByRole('button', {name: 'All'}));
        expect(screen.getByText('UNASSIGNED-1')).toBeInTheDocument();
        expect(screen.getByText('DISPATCHED-1')).toBeInTheDocument();

        // Search by job number — flush 300ms debounce instantly
        const searchInput = screen.getByPlaceholderText('Search jobs...');
        await user.click(searchInput);
        await user.paste('UNASSIGNED');
        await act(async () => { jest.advanceTimersByTime(300); });
        expect(screen.getByText('UNASSIGNED-1')).toBeInTheDocument();
        expect(screen.queryByText('DISPATCHED-1')).not.toBeInTheDocument();
        expect(onSearchChange).toHaveBeenCalledWith('UNASSIGNED');

        // Search by client
        fireEvent.change(searchInput, { target: { value: 'gadget' } });
        await act(async () => { jest.advanceTimersByTime(300); });
        expect(screen.getByText('DISPATCHED-1')).toBeInTheDocument();
        expect(screen.queryByText('UNASSIGNED-1')).not.toBeInTheDocument();

        // Search by courier
        fireEvent.change(searchInput, { target: { value: 'Mike' } });
        await act(async () => { jest.advanceTimersByTime(300); });
        expect(screen.getByText('DISPATCHED-1')).toBeInTheDocument();
        expect(screen.queryByText('UNASSIGNED-1')).not.toBeInTheDocument();

        // Job selection (clear search first)
        fireEvent.change(searchInput, { target: { value: '' } });
        await act(async () => { jest.advanceTimersByTime(300); });
        await user.click(screen.getByText('UNASSIGNED-1'));
        expect(onJobSelect).toHaveBeenCalledWith(expect.objectContaining({id: 1, jobNo: 'UNASSIGNED-1'}));

        jest.useRealTimers();
    });

    describe('localStorage Persistence', () => {
        const storagePrefix = 'testPanel';
        const contactId = 42;
        const key = (suffix: string) => `${storagePrefix}_${suffix}_${contactId}`;

        it('restores and persists density mode, loggedInCouriersOnly, and sort state', async () => {
            // Restore
            localStorage.setItem(key('densityMode'), 'normal');
            localStorage.setItem(key('loggedInCouriersOnly'), 'true');
            const {result: r1} = renderAndPushJobs([createMockDispatchJob()], {storagePrefix});

            const buttons = screen.getAllByRole('button');
            const normalBtn = buttons.find(b => b.getAttribute('aria-pressed') === 'true' && b.getAttribute('value') === 'normal');
            expect(normalBtn).toBeTruthy();
            expect(screen.getByRole('switch')).toBeChecked();
            r1.unmount();

            // Persist
            localStorage.clear();
            const user = userEvent.setup({ delay: null });
            renderAndPushJobs([createMockDispatchJob()], {storagePrefix});

            const normalButton = screen.getAllByRole('button').find(b => b.getAttribute('value') === 'normal');
            await user.click(normalButton!);
            expect(localStorage.getItem(key('densityMode'))).toBe('normal');

            await user.click(screen.getByRole('switch'));
            expect(localStorage.getItem(key('loggedInCouriersOnly'))).toBe('true');

            await user.click(screen.getByText('Job No'));
            expect(JSON.parse(localStorage.getItem(key('sortState'))!)).toEqual({column: 'jobNo', direction: 'asc'});
        });

        it('uses different keys per storagePrefix (multi-instance isolation)', () => {
            localStorage.setItem(`panelA_loggedInCouriersOnly_${contactId}`, 'true');
            localStorage.setItem(`panelB_loggedInCouriersOnly_${contactId}`, 'false');

            const {result: resultA} = renderAndPushJobs([], {storagePrefix: 'panelA'});
            expect(screen.getByRole('switch')).toBeChecked();
            resultA.unmount();

            renderAndPushJobs([], {storagePrefix: 'panelB'});
            expect(screen.getByRole('switch')).not.toBeChecked();
        });
    });

    it('toggles sort direction and calls onBackendFilter', async () => {
        const user = userEvent.setup({ delay: null });
        const storagePrefix = 'sortTest';
        const onBackendFilter = jest.fn();
        renderAndPushJobs([createMockDispatchJob()], {storagePrefix, onBackendFilter});

        const header = screen.getByText('Job No');
        await user.click(header);
        expect(JSON.parse(localStorage.getItem(`${storagePrefix}_sortState_42`)!)).toEqual({column: 'jobNo', direction: 'asc'});
        expect(onBackendFilter).toHaveBeenCalledWith('jobNo', 'asc');

        await user.click(header);
        expect(JSON.parse(localStorage.getItem(`${storagePrefix}_sortState_42`)!)).toEqual({column: 'jobNo', direction: 'desc'});
    });

    it('renders assign button for unassigned jobs on dispatch page', () => {
        const job = createMockDispatchJob({id: 5, jobNo: 'DISP-1', statusId: 0});
        renderAndPushJobs([job], {showToast: jest.fn(), onRefresh: jest.fn(), appPage: AppPage.Dispatch});

        expect(screen.getByText('Assign')).toBeInTheDocument();
        expect(screen.getByText('DISP-1')).toBeInTheDocument();
    });

    it('uses defaultCategory prop and updates when it changes', () => {
        const jobs = [
            createMockDispatchJob({id: 1, jobNo: 'NEW-1', statusId: 0}),
            createMockDispatchJob({id: 2, jobNo: 'DONE-1', statusId: 6}),
        ];

        let pushJobs: (j: DispatchJob[], t: number) => void = () => {};
        const props = createDefaultProps({
            defaultCategory: 'all',
            setJobsCallback: (cb) => { pushJobs = cb; },
        });

        const {rerender} = renderWithProviders(<JobListPanel {...props}/>);
        act(() => pushJobs(jobs, 2));

        expect(screen.getByText('NEW-1')).toBeInTheDocument();
        expect(screen.getByText('DONE-1')).toBeInTheDocument();

        rerender(<JobListPanel {...props} defaultCategory="delivered"/>);

        expect(screen.getByText('DONE-1')).toBeInTheDocument();
        expect(screen.queryByText('NEW-1')).not.toBeInTheDocument();
    });

    it('logged-in couriers toggle defaults unchecked and can be toggled', async () => {
        const user = userEvent.setup({ delay: null });
        renderWithProviders(<JobListPanel {...createDefaultProps()}/>);

        expect(screen.getByText('Logged-in only')).toBeInTheDocument();
        const toggle = screen.getByRole('switch');
        expect(toggle).not.toBeChecked();

        await user.click(toggle);
        expect(toggle).toBeChecked();

        await user.click(toggle);
        expect(toggle).not.toBeChecked();
    });

    describe('fetchConfig mode (React Query data fetching)', () => {
        function createMockFetchConfig(overrides?: Partial<FetchConfig>): FetchConfig {
            return {
                fetchFn: jest.fn().mockResolvedValue({
                    jobs: [createMockDispatchJob({id: 1, jobNo: 'FETCHED-001'})],
                    totalCount: 1,
                    hasMore: false,
                } as JobSearchResult),
                queryKeyFn: (params: JobListSearchParams) => ['test', 'jobs', params] as const,
                initialParams: {
                    order: 'time',
                    orderDirection: 'asc',
                    page: 0,
                    pageSize: 50,
                },
                ...overrides,
            };
        }

        it('fetches via React Query, skips setJobsCallback, registers updateSearchParams, and refreshes', async () => {
            const fetchConfig = createMockFetchConfig();
            const setJobsCallback = jest.fn();
            let updateParamsFn: ((params: Partial<JobListSearchParams>) => void) | null = null;
            let refreshFn: () => void = () => {};

            renderWithProviders(
                <JobListPanel {...createDefaultProps({
                    fetchConfig,
                    setJobsCallback,
                    setUpdateSearchParamsCallback: (cb) => { updateParamsFn = cb; },
                    setRefreshCallback: (cb) => { refreshFn = cb; },
                })} />,
            );

            await screen.findByText('FETCHED-001');

            expect(fetchConfig.fetchFn).toHaveBeenCalledWith(
                fetchConfig.initialParams,
                expect.objectContaining({signal: expect.any(AbortSignal)}),
            );
            expect(setJobsCallback).not.toHaveBeenCalled();
            expect(updateParamsFn).not.toBeNull();

            // updateSearchParams
            const fetchFn = fetchConfig.fetchFn as jest.Mock;
            fetchFn.mockClear();
            fetchFn.mockResolvedValue({jobs: [createMockDispatchJob({id: 2, jobNo: 'UPDATED'})], totalCount: 1, hasMore: false} as JobSearchResult);
            act(() => updateParamsFn!({searchText: 'new search'}));
            await waitFor(() => expect(fetchFn).toHaveBeenCalledWith(expect.objectContaining({searchText: 'new search'}), expect.any(Object)));

            // Refresh via callback
            fetchFn.mockClear();
            fetchFn.mockResolvedValue({jobs: [createMockDispatchJob({id: 3, jobNo: 'REFRESHED'})], totalCount: 1, hasMore: false} as JobSearchResult);
            act(() => refreshFn());
            await waitFor(() => expect(fetchFn).toHaveBeenCalled());
        });

        it('updates sort via hookData when column header is clicked', async () => {
            const user = userEvent.setup({ delay: null });
            const fetchConfig = createMockFetchConfig();

            renderWithProviders(
                <JobListPanel {...createDefaultProps({fetchConfig})} />,
            );

            await screen.findByText('FETCHED-001');
            (fetchConfig.fetchFn as jest.Mock).mockClear();

            await user.click(screen.getByText('Job No'));

            await waitFor(() => expect(fetchConfig.fetchFn).toHaveBeenCalledWith(
                expect.objectContaining({order: 'jobNo', orderDirection: 'asc', sortColumn: 'jobNo', sortDirection: 'asc'}),
                expect.any(Object),
            ));
        });

        it('shows empty state and computes stats from hook data', async () => {
            const emptyFetchConfig = createMockFetchConfig({
                fetchFn: jest.fn().mockResolvedValue({jobs: [], totalCount: 0, hasMore: false}),
            });

            const {unmount} = renderWithProviders(
                <JobListPanel {...createDefaultProps({fetchConfig: emptyFetchConfig})} />,
            );
            await screen.findByText('No jobs to display');
            unmount();

            const jobs = [
                createMockDispatchJob({id: 1, statusId: 0}),
                createMockDispatchJob({id: 2, statusId: 1, assignedCourier: {id: 1, text: 'C'}}),
                createMockDispatchJob({id: 3, statusId: 6}),
            ];
            const statsFetchConfig = createMockFetchConfig({
                fetchFn: jest.fn().mockResolvedValue({jobs, totalCount: 3, hasMore: false}),
            });

            renderWithProviders(
                <JobListPanel {...createDefaultProps({fetchConfig: statsFetchConfig})} />,
            );
            await waitFor(() => {
                const totalLabel = screen.getByText('Total');
                const statsArea = totalLabel.closest('div')!.parentElement!;
                expect(within(statsArea).getByText('3')).toBeInTheDocument();
            });
        });

        it('sends statusFilter to backend when category tab is clicked', async () => {
            const user = userEvent.setup({ delay: null });
            const fetchConfig = createMockFetchConfig();

            renderWithProviders(
                <JobListPanel {...createDefaultProps({fetchConfig})} />,
            );

            await screen.findByText('FETCHED-001');
            const fetchFn = fetchConfig.fetchFn as jest.Mock;
            fetchFn.mockClear();
            fetchFn.mockResolvedValue({jobs: [], totalCount: 0, hasMore: false} as JobSearchResult);

            // Click "Unassigned" category tab
            await user.click(screen.getByText('Unassigned'));

            await waitFor(() => expect(fetchFn).toHaveBeenCalledWith(
                expect.objectContaining({statusFilter: 'needs-dispatch'}),
                expect.any(Object),
            ));
        });

        it('clears statusFilter when All category is selected', async () => {
            const user = userEvent.setup({ delay: null });
            const fetchConfig = createMockFetchConfig();

            renderWithProviders(
                <JobListPanel {...createDefaultProps({fetchConfig})} />,
            );

            await screen.findByText('FETCHED-001');
            const fetchFn = fetchConfig.fetchFn as jest.Mock;

            // Switch to Unassigned first
            fetchFn.mockResolvedValue({jobs: [], totalCount: 0, hasMore: false} as JobSearchResult);
            await user.click(screen.getByText('Unassigned'));
            await waitFor(() => expect(fetchFn).toHaveBeenCalledWith(
                expect.objectContaining({statusFilter: 'needs-dispatch'}),
                expect.any(Object),
            ));

            // Switch back to All
            fetchFn.mockClear();
            fetchFn.mockResolvedValue({
                jobs: [createMockDispatchJob({id: 1, jobNo: 'ALL-001'})],
                totalCount: 1,
                hasMore: false,
            } as JobSearchResult);

            await user.click(screen.getByRole('button', {name: 'All'}));

            await waitFor(() => expect(fetchFn).toHaveBeenCalledWith(
                expect.objectContaining({statusFilter: undefined}),
                expect.any(Object),
            ));
        });

        it('sends statusFilter for Done category', async () => {
            const user = userEvent.setup({ delay: null });
            const fetchConfig = createMockFetchConfig();

            renderWithProviders(
                <JobListPanel {...createDefaultProps({fetchConfig})} />,
            );

            await screen.findByText('FETCHED-001');
            const fetchFn = fetchConfig.fetchFn as jest.Mock;
            fetchFn.mockClear();
            fetchFn.mockResolvedValue({jobs: [], totalCount: 0, hasMore: false} as JobSearchResult);

            await user.click(screen.getByRole('button', {name: 'Done'}));

            await waitFor(() => expect(fetchFn).toHaveBeenCalledWith(
                expect.objectContaining({statusFilter: 'delivered'}),
                expect.any(Object),
            ));
        });
    });

    describe('Multi-Select', () => {
        it('Ctrl+Click multi-selects, plain click sets detail panel', async () => {
            const user = userEvent.setup({ delay: null });
            const onJobSelect = jest.fn();
            const jobs = [
                createMockDispatchJob({id: 1, angularId: 'j1', jobNo: 'MS-001'}),
                createMockDispatchJob({id: 2, angularId: 'j2', jobNo: 'MS-002'}),
                createMockDispatchJob({id: 3, angularId: 'j3', jobNo: 'MS-003'}),
            ];
            renderAndPushJobs(jobs, {onJobSelect});

            // Plain click — sets detail panel, no selection bar
            await user.click(screen.getByText('MS-001'));
            expect(onJobSelect).toHaveBeenCalledWith(expect.objectContaining({id: 1}));
            expect(screen.queryByText(/job.*selected/i)).not.toBeInTheDocument();

            // Ctrl+Click first job — enters multi-select
            await user.keyboard('{Control>}');
            await user.click(screen.getByText('MS-001'));
            await user.keyboard('{/Control}');

            // Ctrl+Click second job
            await user.keyboard('{Control>}');
            await user.click(screen.getByText('MS-002'));
            await user.keyboard('{/Control}');

            // Selection bar should show
            expect(screen.getByText('2 jobs selected')).toBeInTheDocument();
        });

        it('Escape clears selection, close button (X) clears selection', async () => {
            const user = userEvent.setup({ delay: null });
            const jobs = [
                createMockDispatchJob({id: 1, angularId: 'j1', jobNo: 'CB-001'}),
                createMockDispatchJob({id: 2, angularId: 'j2', jobNo: 'CB-002'}),
            ];
            renderAndPushJobs(jobs);

            // Ctrl+Click both jobs to select all
            await user.keyboard('{Control>}');
            await user.click(screen.getByText('CB-001'));
            await user.click(screen.getByText('CB-002'));
            await user.keyboard('{/Control}');
            expect(screen.getByText('2 jobs selected')).toBeInTheDocument();

            // Escape clears
            await user.keyboard('{Escape}');
            expect(screen.queryByText(/job.*selected/i)).not.toBeInTheDocument();

            // Ctrl+Click to re-select, close button (X) clears
            await user.keyboard('{Control>}');
            await user.click(screen.getByText('CB-001'));
            await user.keyboard('{/Control}');
            expect(screen.getByText('1 job selected')).toBeInTheDocument();
            await user.click(screen.getByTestId('CloseIcon').closest('button')!);
            expect(screen.queryByText(/job.*selected/i)).not.toBeInTheDocument();
        });

        it('selection bar shows Dispatch, Restore, Mark Read, Mark Unread on dispatch page', async () => {
            const user = userEvent.setup({ delay: null });
            const jobs = [
                createMockDispatchJob({id: 1, angularId: 'j1', jobNo: 'BTN-001'}),
                createMockDispatchJob({id: 2, angularId: 'j2', jobNo: 'BTN-002'}),
            ];
            renderAndPushJobs(jobs, {appPage: AppPage.Dispatch});

            // Select all via Ctrl+Click
            await user.keyboard('{Control>}');
            await user.click(screen.getByText('BTN-001'));
            await user.click(screen.getByText('BTN-002'));
            await user.keyboard('{/Control}');

            expect(screen.getByText('Dispatch')).toBeInTheDocument();
            expect(screen.getByText('Restore')).toBeInTheDocument();
            expect(screen.getByText('Mark Read')).toBeInTheDocument();
            expect(screen.getByText('Mark Unread')).toBeInTheDocument();
        });

        it('bulk Mark Read calls API and clears selection', async () => {
            const user = userEvent.setup({ delay: null });
            const showToast = jest.fn();
            mockedBulkUpdateReadStatus.mockResolvedValue(undefined);

            const jobs = [
                createMockDispatchJob({id: 1, angularId: 'j1', jobNo: 'MR-001'}),
                createMockDispatchJob({id: 2, angularId: 'j2', jobNo: 'MR-002'}),
            ];
            renderAndPushJobs(jobs, {showToast});

            // Select all via Ctrl+Click
            await user.keyboard('{Control>}');
            await user.click(screen.getByText('MR-001'));
            await user.click(screen.getByText('MR-002'));
            await user.keyboard('{/Control}');
            await user.click(screen.getByText('Mark Read'));

            await waitFor(() => {
                expect(mockedBulkUpdateReadStatus).toHaveBeenCalledWith(
                    expect.arrayContaining([1, 2]),
                    true,
                );
                expect(showToast).toHaveBeenCalledWith('2 job(s) marked as read', 'success');
                expect(screen.queryByText(/job.*selected/i)).not.toBeInTheDocument();
            });
        });

        it('bulk Restore calls API and clears selection', async () => {
            const user = userEvent.setup({ delay: null });
            const showToast = jest.fn();
            mockedRestoreJobs.mockResolvedValue(undefined);

            const jobs = [
                createMockDispatchJob({id: 10, angularId: 'j10', jobNo: 'RS-001'}),
                createMockDispatchJob({id: 20, angularId: 'j20', jobNo: 'RS-002'}),
            ];
            renderAndPushJobs(jobs, {showToast});

            // Select all via Ctrl+Click
            await user.keyboard('{Control>}');
            await user.click(screen.getByText('RS-001'));
            await user.click(screen.getByText('RS-002'));
            await user.keyboard('{/Control}');
            await user.click(screen.getByText('Restore'));

            await waitFor(() => {
                expect(mockedRestoreJobs).toHaveBeenCalledWith(
                    expect.arrayContaining([10, 20]),
                );
                expect(showToast).toHaveBeenCalledWith('2 job(s) restored', 'success');
                expect(screen.queryByText(/job.*selected/i)).not.toBeInTheDocument();
            });
        });
    });

    describe('View Tabs Bar', () => {
        const mockViews = [
            {id: 1, name: 'North', selected: true},
            {id: 2, name: 'South', selected: true},
            {id: 3, name: 'East', selected: false},
        ];

        it('does not render when views prop is not provided', () => {
            renderAndPushJobs([createMockDispatchJob()]);
            expect(screen.queryByText('Clear All')).not.toBeInTheDocument();
        });

        it('renders view buttons, toggles on click, clears all, and shows count', async () => {
            const user = userEvent.setup({ delay: null });
            const onToggleView = jest.fn();
            const onClearViews = jest.fn();

            renderAndPushJobs([createMockDispatchJob()], {
                views: mockViews,
                onToggleView,
                onClearViews,
            });

            // All view buttons rendered
            expect(screen.getByText('North')).toBeInTheDocument();
            expect(screen.getByText('South')).toBeInTheDocument();
            expect(screen.getByText('East')).toBeInTheDocument();

            // Count indicator shows selected/total
            expect(screen.getByText('2/3')).toBeInTheDocument();

            // Clear All button present
            expect(screen.getByText('Clear All')).toBeInTheDocument();

            // Click a view button triggers onToggleView
            await user.click(screen.getByText('East'));
            expect(onToggleView).toHaveBeenCalledWith({id: 3, name: 'East', selected: false});

            // Click Clear All triggers onClearViews
            await user.click(screen.getByText('Clear All'));
            expect(onClearViews).toHaveBeenCalledTimes(1);
        });

        it('does not render when views array is empty', () => {
            renderAndPushJobs([createMockDispatchJob()], {
                views: [],
                onToggleView: jest.fn(),
                onClearViews: jest.fn(),
            });
            expect(screen.queryByText('Clear All')).not.toBeInTheDocument();
        });
    });
});
