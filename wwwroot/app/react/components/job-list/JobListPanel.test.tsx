/** @jest-environment jest-environment-jsdom */
/**
 * JobListPanel Tests
 *
 * Covers the main container component: rendering child components,
 * category filtering, search filtering, job selection, stats computation,
 * localStorage persistence, AngularJS bridge callbacks, and optimistic dispatch.
 */

import React from 'react';
import {act, screen, waitFor, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {renderWithProviders} from '../../__testUtils__';
import {JobListPanel} from './JobListPanel';
import type {DispatchJob, FetchConfig, JobListPanelProps, JobListSearchParams, JobSearchResult} from '../../interfaces/dispatchJob';
import {AppPage} from '../../interfaces/dispatchJob';
import dayjs from 'dayjs';

// Mock modules that depend on AngularJS (window.angular)
jest.mock('../../services/splitJobFlow', () => ({
    executeSplitJobFlow: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../dialogs/add-event-dialog', () => ({
    openAddEventDialog: jest.fn().mockResolvedValue(true),
}));
jest.mock('../dialogs/event-group-dialog', () => ({
    openEventGroupDialog: jest.fn().mockResolvedValue(true),
}));

// Mock child components' heavy dependencies
jest.mock('../../services/courierApi', () => ({
    searchActiveCouriersExtended: jest.fn().mockResolvedValue([]),
}));
jest.mock('../../services/aiAssistantApi', () => ({
    suggestCouriers: jest.fn().mockResolvedValue({couriers: [], summary: '', usage: {inputTokens: 0, outputTokens: 0}}),
}));
jest.mock('../../../functions/aiSettings', () => ({
    isAiEnabled: jest.fn().mockReturnValue(false),
}));
jest.mock('../../utils/dateUtils', () => ({
    formatMins: jest.fn((d: any) => d?.format?.('HH:mm') || ''),
    formatShortDate: jest.fn((d: any) => d?.format?.('DD/MMM') || ''),
    getIanaTimezone: jest.fn(() => 'Pacific/Auckland'),
    getTenantTimezone: jest.fn(() => 'New Zealand Standard Time'),
    getTimezoneAbbreviation: jest.fn(() => 'NZST'),
}));

jest.mock('../../services/jobListApi', () => ({
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

import {allocateJobs} from '../../services/jobListApi';
const mockedAllocateJobs = allocateJobs as jest.Mock;

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

    describe('Rendering and AngularJS Bridge', () => {
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

            // setJobsCallback bridge registered
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
    });

    describe('Category Filtering', () => {
        it('filters by category and calls onCategoryChange', async () => {
            const user = userEvent.setup();
            const onCategoryChange = jest.fn();
            const jobs = [
                createMockDispatchJob({id: 1, jobNo: 'UNASSIGNED-1', statusId: 0}),
                createMockDispatchJob({
                    id: 2, jobNo: 'DISPATCHED-1', statusId: 1,
                    assignedCourier: {id: 100, text: '100 - Courier'},
                }),
                createMockDispatchJob({id: 3, jobNo: 'DONE-1', statusId: 6}),
            ];
            renderAndPushJobs(jobs, {onCategoryChange});

            // Unassigned filter
            await user.click(screen.getByText('Unassigned'));
            expect(onCategoryChange).toHaveBeenCalledWith('needs-dispatch');
            expect(screen.getByText('UNASSIGNED-1')).toBeInTheDocument();
            expect(screen.queryByText('DISPATCHED-1')).not.toBeInTheDocument();
            expect(screen.queryByText('DONE-1')).not.toBeInTheDocument();

            // Done filter
            await user.click(screen.getByRole('button', {name: 'Done'}));
            expect(screen.getByText('DONE-1')).toBeInTheDocument();
            expect(screen.queryByText('UNASSIGNED-1')).not.toBeInTheDocument();

            // All filter (switch away and back)
            await user.click(screen.getByRole('button', {name: 'All'}));
            expect(screen.getByText('UNASSIGNED-1')).toBeInTheDocument();
            expect(screen.getByText('DISPATCHED-1')).toBeInTheDocument();
            expect(screen.getByText('DONE-1')).toBeInTheDocument();
        });
    });

    describe('Search Filtering', () => {
        it('filters jobs by job number, client, and courier, and calls onSearchChange', async () => {
            const user = userEvent.setup();
            const onSearchChange = jest.fn();
            const jobs = [
                createMockDispatchJob({
                    id: 1, jobNo: 'ALPHA-001', client: 'Widget Co',
                    assignedCourier: {id: 10, text: '10 - Mike Runner'},
                }),
                createMockDispatchJob({id: 2, jobNo: 'BETA-002', client: 'Gadget Inc'}),
            ];
            renderAndPushJobs(jobs, {onSearchChange});

            const searchInput = screen.getByPlaceholderText('Search jobs...');

            // Filter by job number
            await user.click(searchInput);
            await user.paste('ALPHA');
            await waitFor(() => {
                expect(screen.getByText('ALPHA-001')).toBeInTheDocument();
                expect(screen.queryByText('BETA-002')).not.toBeInTheDocument();
            });
            expect(onSearchChange).toHaveBeenCalledWith('ALPHA');

            // Clear and filter by client
            await user.clear(searchInput);
            await user.paste('gadget');
            await waitFor(() => {
                expect(screen.getByText('BETA-002')).toBeInTheDocument();
                expect(screen.queryByText('ALPHA-001')).not.toBeInTheDocument();
            });

            // Clear and filter by courier
            await user.clear(searchInput);
            await user.paste('Mike');
            await waitFor(() => {
                expect(screen.getByText('ALPHA-001')).toBeInTheDocument();
                expect(screen.queryByText('BETA-002')).not.toBeInTheDocument();
            });
        });
    });

    describe('Stats, Footer, and Job Selection', () => {
        it('computes stats, shows footer counts, and selects job on click', async () => {
            const user = userEvent.setup();
            const onJobSelect = jest.fn();
            const jobs = [
                createMockDispatchJob({id: 1, jobNo: 'J1', statusId: 0}),
                createMockDispatchJob({id: 2, jobNo: 'J2', statusId: 1, assignedCourier: {id: 1, text: 'C'}}),
                createMockDispatchJob({id: 3, jobNo: 'J3', statusId: 11, assignedCourier: {id: 2, text: 'C'}}),
                createMockDispatchJob({id: 4, jobNo: 'J4', statusId: 6}),
            ];
            renderAndPushJobs(jobs, {onJobSelect});

            // Stats header
            const totalLabel = screen.getByText('Total');
            const statsArea = totalLabel.closest('div')!.parentElement!;
            expect(within(statsArea).getByText('4')).toBeInTheDocument();

            // Footer
            expect(screen.getByText(/Showing 4/)).toBeInTheDocument();
            expect(screen.getByText(/Last updated:/)).toBeInTheDocument();

            // Job selection
            await user.click(screen.getByText('J1'));
            expect(onJobSelect).toHaveBeenCalledWith(
                expect.objectContaining({id: 1, jobNo: 'J1'})
            );
        });
    });

    describe('localStorage Persistence', () => {
        const storagePrefix = 'testPanel';
        const contactId = 42;
        const key = (suffix: string) => `${storagePrefix}_${suffix}_${contactId}`;

        it('restores density mode and loggedInCouriersOnly from localStorage', () => {
            localStorage.setItem(key('densityMode'), 'normal');
            localStorage.setItem(key('loggedInCouriersOnly'), 'true');
            renderAndPushJobs([createMockDispatchJob()], {storagePrefix});

            // Density mode restored
            const buttons = screen.getAllByRole('button');
            const normalBtn = buttons.find(b => b.getAttribute('aria-pressed') === 'true' && b.getAttribute('value') === 'normal');
            expect(normalBtn).toBeTruthy();

            // loggedInCouriersOnly restored
            const toggle = screen.getByRole('switch');
            expect(toggle).toBeChecked();
        });

        it('persists density mode, loggedInCouriersOnly, and sort state to localStorage', async () => {
            const user = userEvent.setup();
            renderAndPushJobs([createMockDispatchJob()], {storagePrefix});

            // Persist density mode
            const buttons = screen.getAllByRole('button');
            const normalButton = buttons.find(b => b.getAttribute('value') === 'normal');
            expect(normalButton).toBeTruthy();
            await user.click(normalButton!);
            expect(localStorage.getItem(key('densityMode'))).toBe('normal');

            // Persist loggedInCouriersOnly
            const toggle = screen.getByRole('switch');
            await user.click(toggle);
            expect(localStorage.getItem(key('loggedInCouriersOnly'))).toBe('true');

            // Persist sort state
            await user.click(screen.getByText('Job No'));
            const saved = JSON.parse(localStorage.getItem(key('sortState'))!);
            expect(saved).toEqual({column: 'jobNo', direction: 'asc'});
        });

        it('uses different keys per storagePrefix (multi-instance isolation)', () => {
            localStorage.setItem(`panelA_loggedInCouriersOnly_${contactId}`, 'true');
            localStorage.setItem(`panelB_loggedInCouriersOnly_${contactId}`, 'false');

            const {result: resultA} = renderAndPushJobs([], {storagePrefix: 'panelA'});
            const toggleA = screen.getByRole('switch');
            expect(toggleA).toBeChecked();

            resultA.unmount();

            renderAndPushJobs([], {storagePrefix: 'panelB'});
            const toggleB = screen.getByRole('switch');
            expect(toggleB).not.toBeChecked();
        });
    });

    describe('Sorting', () => {
        it('toggles sort direction and calls onBackendFilter', async () => {
            const user = userEvent.setup();
            const storagePrefix = 'sortTest';
            const onBackendFilter = jest.fn();
            renderAndPushJobs([createMockDispatchJob()], {storagePrefix, onBackendFilter});

            const header = screen.getByText('Job No');

            // First click → asc
            await user.click(header);
            let saved = JSON.parse(localStorage.getItem(`${storagePrefix}_sortState_42`)!);
            expect(saved).toEqual({column: 'jobNo', direction: 'asc'});
            expect(onBackendFilter).toHaveBeenCalledWith('jobNo', 'asc');

            // Second click → desc
            await user.click(header);
            saved = JSON.parse(localStorage.getItem(`${storagePrefix}_sortState_42`)!);
            expect(saved).toEqual({column: 'jobNo', direction: 'desc'});
        });
    });

    describe('Optimistic Dispatch', () => {
        it('renders assign button for unassigned jobs on dispatch page', () => {
            const showToast = jest.fn();
            const onRefresh = jest.fn();
            mockedAllocateJobs.mockResolvedValue(undefined);

            const job = createMockDispatchJob({id: 5, jobNo: 'DISP-1', statusId: 0});
            renderAndPushJobs([job], {showToast, onRefresh, appPage: AppPage.Dispatch});

            expect(screen.getByText('Assign')).toBeInTheDocument();
            expect(screen.getByText('DISP-1')).toBeInTheDocument();
        });
    });

    describe('Default Category', () => {
        it('uses defaultCategory prop as initial category', () => {
            renderAndPushJobs(
                [createMockDispatchJob({id: 1, statusId: 6, jobNo: 'DONE-1'})],
                {defaultCategory: 'delivered'},
            );

            expect(screen.getByText('DONE-1')).toBeInTheDocument();
        });

        it('updates category when defaultCategory prop changes', () => {
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

            // Both visible initially
            expect(screen.getByText('NEW-1')).toBeInTheDocument();
            expect(screen.getByText('DONE-1')).toBeInTheDocument();

            // Re-render with 'delivered' category
            rerender(
                <JobListPanel {...props} defaultCategory="delivered"/>
            );

            expect(screen.getByText('DONE-1')).toBeInTheDocument();
            expect(screen.queryByText('NEW-1')).not.toBeInTheDocument();
        });
    });

    describe('Logged-in Couriers Toggle', () => {
        it('defaults to unchecked and can be toggled on and off', async () => {
            const user = userEvent.setup();
            renderWithProviders(<JobListPanel {...createDefaultProps()}/>);

            expect(screen.getByText('Logged-in only')).toBeInTheDocument();
            const toggle = screen.getByRole('switch');
            expect(toggle).toBeInTheDocument();
            expect(toggle).not.toBeChecked();

            await user.click(toggle);
            expect(toggle).toBeChecked();

            await user.click(toggle);
            expect(toggle).not.toBeChecked();
        });
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

        it('fetches jobs via React Query, skips setJobsCallback, and registers updateSearchParams', async () => {
            const fetchConfig = createMockFetchConfig();
            const setJobsCallback = jest.fn();
            let updateParamsFn: ((params: Partial<JobListSearchParams>) => void) | null = null;

            renderWithProviders(
                <JobListPanel {...createDefaultProps({
                    fetchConfig,
                    setJobsCallback,
                    setUpdateSearchParamsCallback: (cb) => { updateParamsFn = cb; },
                })} />,
            );

            await waitFor(() => {
                expect(screen.getByText('FETCHED-001')).toBeInTheDocument();
            });

            // Verifies fetch was called correctly
            expect(fetchConfig.fetchFn).toHaveBeenCalledWith(
                fetchConfig.initialParams,
                expect.objectContaining({signal: expect.any(AbortSignal)}),
            );

            // setJobsCallback should not be called in fetchConfig mode
            expect(setJobsCallback).not.toHaveBeenCalled();

            // setUpdateSearchParamsCallback should be registered
            expect(updateParamsFn).not.toBeNull();
        });

        it('calls updateParams via setUpdateSearchParamsCallback', async () => {
            const fetchFn = jest.fn().mockResolvedValue({
                jobs: [createMockDispatchJob({id: 1, jobNo: 'INITIAL'})],
                totalCount: 1,
                hasMore: false,
            } as JobSearchResult);

            const fetchConfig = createMockFetchConfig({fetchFn});
            let updateParamsFn: ((params: Partial<JobListSearchParams>) => void) = () => {};

            renderWithProviders(
                <JobListPanel {...createDefaultProps({
                    fetchConfig,
                    setUpdateSearchParamsCallback: (cb) => { updateParamsFn = cb; },
                })} />,
            );

            await waitFor(() => {
                expect(screen.getByText('INITIAL')).toBeInTheDocument();
            });

            fetchFn.mockClear();
            fetchFn.mockResolvedValue({
                jobs: [createMockDispatchJob({id: 2, jobNo: 'UPDATED'})],
                totalCount: 1,
                hasMore: false,
            } as JobSearchResult);

            act(() => {
                updateParamsFn({searchText: 'new search'});
            });

            await waitFor(() => {
                expect(fetchFn).toHaveBeenCalledWith(
                    expect.objectContaining({searchText: 'new search'}),
                    expect.any(Object),
                );
            });
        });

        it('refreshes via hookData when refresh callback is invoked', async () => {
            const fetchConfig = createMockFetchConfig();
            let refreshFn: () => void = () => {};

            renderWithProviders(
                <JobListPanel {...createDefaultProps({
                    fetchConfig,
                    setRefreshCallback: (cb) => { refreshFn = cb; },
                })} />,
            );

            await waitFor(() => {
                expect(screen.getByText('FETCHED-001')).toBeInTheDocument();
            });

            (fetchConfig.fetchFn as jest.Mock).mockClear();
            (fetchConfig.fetchFn as jest.Mock).mockResolvedValue({
                jobs: [createMockDispatchJob({id: 2, jobNo: 'REFRESHED'})],
                totalCount: 1,
                hasMore: false,
            } as JobSearchResult);

            act(() => {
                refreshFn();
            });

            await waitFor(() => {
                expect(fetchConfig.fetchFn).toHaveBeenCalled();
            });
        });

        it('updates sort via hookData when column header is clicked', async () => {
            const user = userEvent.setup();
            const fetchConfig = createMockFetchConfig();
            const onBackendFilter = jest.fn();

            renderWithProviders(
                <JobListPanel {...createDefaultProps({
                    fetchConfig,
                    onBackendFilter,
                })} />,
            );

            await waitFor(() => {
                expect(screen.getByText('FETCHED-001')).toBeInTheDocument();
            });

            (fetchConfig.fetchFn as jest.Mock).mockClear();

            await user.click(screen.getByText('Job No'));

            await waitFor(() => {
                expect(fetchConfig.fetchFn).toHaveBeenCalledWith(
                    expect.objectContaining({
                        order: 'jobNo',
                        orderDirection: 'asc',
                        sortColumn: 'jobNo',
                        sortDirection: 'asc',
                    }),
                    expect.any(Object),
                );
            });
        });

        it('shows empty state and stats from hook data', async () => {
            // Empty result
            const emptyFetchConfig = createMockFetchConfig({
                fetchFn: jest.fn().mockResolvedValue({
                    jobs: [],
                    totalCount: 0,
                    hasMore: false,
                }),
            });

            const {unmount} = renderWithProviders(
                <JobListPanel {...createDefaultProps({fetchConfig: emptyFetchConfig})} />,
            );

            await waitFor(() => {
                expect(screen.getByText('No jobs to display')).toBeInTheDocument();
            });

            unmount();

            // Stats from hook data
            const jobs = [
                createMockDispatchJob({id: 1, statusId: 0}),
                createMockDispatchJob({id: 2, statusId: 1, assignedCourier: {id: 1, text: 'C'}}),
                createMockDispatchJob({id: 3, statusId: 6}),
            ];
            const statsFetchConfig = createMockFetchConfig({
                fetchFn: jest.fn().mockResolvedValue({
                    jobs,
                    totalCount: 3,
                    hasMore: false,
                }),
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
    });
});
