/**
 * JobListPanel Tests
 *
 * Covers the main container component: rendering child components,
 * category filtering, search filtering, job selection, stats computation,
 * localStorage persistence, AngularJS bridge callbacks, and optimistic dispatch.
 */

import React from 'react';
import {act, fireEvent, screen, waitFor, within} from '@testing-library/react';
import { renderWithProviders } from '../../__testUtils__';
import { setupUser } from '../../__testUtils__/setupUser';
import {JobListPanel} from './JobListPanel';
import type {DispatchJob, FetchConfig, JobListPanelProps, JobListSearchParams, JobSearchResult} from '../../interfaces/dispatchJob';
import {AppPage} from '../../interfaces/dispatchJob';
import dayjs from 'dayjs';

// Mock @tanstack/react-virtual so rows render in jsdom (zero-height containers)
jest.mock('@tanstack/react-virtual', () => ({
    useVirtualizer: ({count}: {count: number}) => ({
        getVirtualItems: () =>
            Array.from({length: count}, (_, i) => ({
                index: i,
                start: i * 34,
                end: (i + 1) * 34,
                size: 34,
                key: i,
            })),
        getTotalSize: () => count * 34,
        measureElement: () => {},
    }),
}));

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
jest.mock('../../utils/dateUtils', () =>
    require('../../../tests/mocks/dateUtilsMock').nzDateUtilsMock());

jest.mock('../../services/jobListApi', () => ({
    allocateJobs: jest.fn(),
    getEventGroups: jest.fn().mockResolvedValue([]),
    getActivePartnerOptions: jest.fn().mockResolvedValue([]),
    sendToPartner: jest.fn().mockResolvedValue({success: true, trackingNumber: 'TRK-123', message: 'OK'}),
    updateJobReadStatus: jest.fn().mockResolvedValue(undefined),
    bulkUpdateReadStatus: jest.fn().mockResolvedValue(undefined),
    lateCall: jest.fn().mockResolvedValue(undefined),
    reAllocateJobs: jest.fn().mockResolvedValue(undefined),
    restoreJobs: jest.fn().mockResolvedValue(undefined),
    addRestoreEvent: jest.fn().mockResolvedValue(undefined),
    setFirstJob: jest.fn().mockResolvedValue(undefined),
    releaseBulkJob: jest.fn().mockResolvedValue({jobNumbers: []}),
    splitJob: jest.fn().mockResolvedValue(undefined),
    markJobMissing: jest.fn().mockResolvedValue(undefined),
    moveJobToReprice: jest.fn().mockResolvedValue(undefined),
    updateJobDetail: jest.fn().mockResolvedValue(undefined),
    restoreNationwideJob: jest.fn().mockResolvedValue(undefined),
}));

import {allocateJobs, updateJobReadStatus, restoreJobs, addRestoreEvent} from '../../services/jobListApi';
import {queryClient} from '../../query/queryClient';
const mockedAllocateJobs = allocateJobs as jest.Mock;
const mockedUpdateJobReadStatus = updateJobReadStatus as jest.Mock;
const mockedRestoreJobs = restoreJobs as jest.Mock;
const mockedAddRestoreEvent = addRestoreEvent as jest.Mock;

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

    describe('Prefetch on Mount', () => {
        it('prefetches note types when the panel mounts', () => {
            const prefetchSpy = jest.spyOn(queryClient, 'prefetchQuery').mockResolvedValue(undefined);

            renderWithProviders(<JobListPanel {...createDefaultProps()}/>);

            expect(prefetchSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    queryKey: ['notes', 'types'],
                    staleTime: Infinity,
                }),
            );

            prefetchSpy.mockRestore();
        });
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
            // Footer is hidden when there are no jobs to display
            expect(screen.queryByText(/Showing/)).not.toBeInTheDocument();
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

        it('renders topSlot content above the stats header', () => {
            renderWithProviders(
                <JobListPanel {...createDefaultProps({
                    topSlot: <div data-testid="top-slot">Views</div>,
                })}/>
            );

            const slot = screen.getByTestId('top-slot');
            expect(slot).toBeInTheDocument();
            expect(slot.compareDocumentPosition(screen.getByText('Total')))
                .toBe(Node.DOCUMENT_POSITION_FOLLOWING);
        });
    });

    describe('Category Filtering', () => {
        it('filters by category and calls onCategoryChange', () => {
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
            fireEvent.click(screen.getByText('Unassigned'));
            expect(onCategoryChange).toHaveBeenCalledWith('needs-dispatch');
            expect(screen.getByText('UNASSIGNED-1')).toBeInTheDocument();
            expect(screen.queryByText('DISPATCHED-1')).not.toBeInTheDocument();
            expect(screen.queryByText('DONE-1')).not.toBeInTheDocument();

            // Done filter
            fireEvent.click(screen.getByRole('button', {name: 'Done'}));
            expect(screen.getByText('DONE-1')).toBeInTheDocument();
            expect(screen.queryByText('UNASSIGNED-1')).not.toBeInTheDocument();

            // All filter (switch away and back)
            fireEvent.click(screen.getByRole('button', {name: 'All'}));
            expect(screen.getByText('UNASSIGNED-1')).toBeInTheDocument();
            expect(screen.getByText('DISPATCHED-1')).toBeInTheDocument();
            expect(screen.getByText('DONE-1')).toBeInTheDocument();
        });
    });

    describe('Search Filtering', () => {
        // Fake timers fast-forward the 200ms debounce in JobListPanel without real
        // wall-clock waits. fireEvent (instead of user-event) keeps the input update
        // synchronous so flushDebounce just has to advance the debounce timer.
        beforeEach(() => {
            jest.useFakeTimers();
        });
        afterEach(() => {
            jest.useRealTimers();
        });

        const typeAndFlush = async (input: HTMLElement, value: string) => {
            // Two stacked debounces: JobListToolbar (300ms) → onSearchChange →
            // JobListPanel useEffect (200ms) → debouncedSearchQuery → filter.
            // Advance past the first to let the second be scheduled, then past the second.
            await act(async () => { fireEvent.change(input, {target: {value}}); });
            await act(async () => { await jest.advanceTimersByTimeAsync(300); });
            await act(async () => { await jest.advanceTimersByTimeAsync(200); });
        };

        it('filters jobs by job number, client, and courier, and calls onSearchChange', async () => {
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
            await typeAndFlush(searchInput, 'ALPHA');
            expect(screen.getByText('ALPHA-001')).toBeInTheDocument();
            expect(screen.queryByText('BETA-002')).not.toBeInTheDocument();
            expect(onSearchChange).toHaveBeenCalledWith('ALPHA');

            // Clear and filter by client
            await typeAndFlush(searchInput, 'gadget');
            expect(screen.getByText('BETA-002')).toBeInTheDocument();
            expect(screen.queryByText('ALPHA-001')).not.toBeInTheDocument();

            // Clear and filter by courier
            await typeAndFlush(searchInput, 'Mike');
            expect(screen.getByText('ALPHA-001')).toBeInTheDocument();
            expect(screen.queryByText('BETA-002')).not.toBeInTheDocument();
        });

        it('filters by address fields', async () => {
            const jobs = [
                createMockDispatchJob({
                    id: 1, jobNo: 'ADDR-001',
                    pickupAddress: {addressLine5: 'Wellington Central'} as any,
                }),
                createMockDispatchJob({
                    id: 2, jobNo: 'ADDR-002',
                    deliveryAddress: {addressLine5: 'Christchurch'} as any,
                }),
            ];
            renderAndPushJobs(jobs);

            const searchInput = screen.getByPlaceholderText('Search jobs...');
            await typeAndFlush(searchInput, 'wellington');
            expect(screen.getByText('ADDR-001')).toBeInTheDocument();
            expect(screen.queryByText('ADDR-002')).not.toBeInTheDocument();
        });

        it('handles null/undefined fields without errors', async () => {
            const jobs = [
                createMockDispatchJob({
                    id: 1, jobNo: 'NULL-001',
                    client: undefined as any,
                    assignedCourier: undefined,
                    pickupAddress: undefined as any,
                    deliveryAddress: undefined as any,
                    speed: undefined as any,
                }),
            ];
            renderAndPushJobs(jobs);

            const searchInput = screen.getByPlaceholderText('Search jobs...');
            await typeAndFlush(searchInput, 'anything');
            expect(screen.queryByText('NULL-001')).not.toBeInTheDocument();

            // Clear search — job should reappear
            await typeAndFlush(searchInput, '');
            expect(screen.getByText('NULL-001')).toBeInTheDocument();
        });
    });

    describe('Stats, Footer, and Job Selection', () => {
        it('computes stats, shows footer counts, and selects job on click', () => {
            const onJobSelect = jest.fn();
            const jobs = [
                createMockDispatchJob({id: 1, jobNo: 'J1', statusId: 0}),
                createMockDispatchJob({id: 2, jobNo: 'J2', statusId: 1, assignedCourier: {id: 1, text: 'C'}}),
                createMockDispatchJob({id: 3, jobNo: 'J3', statusId: 11, assignedCourier: {id: 2, text: 'C'}}),
                createMockDispatchJob({id: 4, jobNo: 'J4', statusId: 6}),
            ];
            renderAndPushJobs(jobs, {onJobSelect});

            // Stats header — Active = needs-dispatch, Transit = dispatched/accepted/picked-up/in-transit, Done = delivered
            const totalLabel = screen.getByText('Total');
            const statsArea = totalLabel.closest('div')!.parentElement!;
            expect(within(statsArea).getByText('4')).toBeInTheDocument();
            const statValue = (label: string) => within(within(statsArea).getByText(label).closest('div')!).getByText(/^\d+$/).textContent;
            expect(statValue('Active')).toBe('1'); // J1 (New, no courier)
            expect(statValue('Transit')).toBe('2'); // J2 (Dispatched) + J3 (InTransit)
            expect(statValue('Done')).toBe('1'); // J4 (Completed)

            // Footer
            expect(screen.getByText(/Showing 4/)).toBeInTheDocument();
            expect(screen.getByText(/Last updated:/)).toBeInTheDocument();

            // Job selection
            fireEvent.click(screen.getByText('J1'));
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

        it('persists density mode, loggedInCouriersOnly, and sort state to localStorage', () => {
            renderAndPushJobs([createMockDispatchJob()], {storagePrefix});

            // Persist density mode
            const buttons = screen.getAllByRole('button');
            const normalButton = buttons.find(b => b.getAttribute('value') === 'normal');
            expect(normalButton).toBeTruthy();
            fireEvent.click(normalButton!);
            expect(localStorage.getItem(key('densityMode'))).toBe('normal');

            // Persist loggedInCouriersOnly
            const toggle = screen.getByRole('switch');
            fireEvent.click(toggle);
            expect(localStorage.getItem(key('loggedInCouriersOnly'))).toBe('true');

            // Persist sort state
            fireEvent.click(screen.getByText('Job No'));
            const saved = JSON.parse(localStorage.getItem(key('sortState'))!);
            expect(saved).toEqual({column: 'jobNo', direction: 'asc'});
        });

        it('restores the category filter from localStorage, preferring it over defaultCategory', () => {
            localStorage.setItem(key('selectedCategory'), 'delivered');
            renderAndPushJobs(
                [
                    createMockDispatchJob({id: 1, jobNo: 'NEW-1', statusId: 0}),
                    createMockDispatchJob({id: 2, jobNo: 'DONE-1', statusId: 6}),
                ],
                {storagePrefix, defaultCategory: 'in-progress'},
            );

            expect(screen.getByText('DONE-1')).toBeInTheDocument();
            expect(screen.queryByText('NEW-1')).not.toBeInTheDocument();
        });

        it('persists the category filter and ignores an unrecognised stored value', () => {
            localStorage.setItem(key('selectedCategory'), 'not-a-category');
            renderAndPushJobs(
                [
                    createMockDispatchJob({id: 1, jobNo: 'NEW-1', statusId: 0}),
                    createMockDispatchJob({id: 2, jobNo: 'DONE-1', statusId: 6}),
                ],
                {storagePrefix, defaultCategory: 'in-progress'},
            );

            // Garbage in storage falls back to the defaultCategory prop.
            expect(screen.getByText('NEW-1')).toBeInTheDocument();
            expect(screen.queryByText('DONE-1')).not.toBeInTheDocument();

            fireEvent.click(screen.getByRole('button', {name: 'Unassigned'}));
            expect(localStorage.getItem(key('selectedCategory'))).toBe('needs-dispatch');
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
        it('toggles sort direction and calls onBackendFilter', () => {
            const storagePrefix = 'sortTest';
            const onBackendFilter = jest.fn();
            renderAndPushJobs([createMockDispatchJob()], {storagePrefix, onBackendFilter});

            const header = screen.getByText('Job No');

            // First click → asc
            fireEvent.click(header);
            let saved = JSON.parse(localStorage.getItem(`${storagePrefix}_sortState_42`)!);
            expect(saved).toEqual({column: 'jobNo', direction: 'asc'});
            expect(onBackendFilter).toHaveBeenCalledWith('jobNo', 'asc');

            // Second click → desc
            fireEvent.click(header);
            saved = JSON.parse(localStorage.getItem(`${storagePrefix}_sortState_42`)!);
            expect(saved).toEqual({column: 'jobNo', direction: 'desc'});
        });

        it('sorts jobs correctly by job number column', () => {
            const jobs = [
                createMockDispatchJob({id: 1, jobNo: 'C-003'}),
                createMockDispatchJob({id: 2, jobNo: 'A-001'}),
                createMockDispatchJob({id: 3, jobNo: 'B-002'}),
            ];
            renderAndPushJobs(jobs);

            // Click Job No header to sort asc
            fireEvent.click(screen.getByText('Job No'));

            const rows = screen.getAllByText(/^[A-C]-00\d$/);
            expect(rows.map(el => el.textContent)).toEqual(['A-001', 'B-002', 'C-003']);
        });

        it('sorts jobs correctly by delivery address column', () => {
            const jobs = [
                createMockDispatchJob({id: 1, jobNo: 'J1', deliveryAddress: {addressLine5: 'Zebra Town'} as any}),
                createMockDispatchJob({id: 2, jobNo: 'J2', deliveryAddress: {addressLine5: 'Alpha City'} as any}),
                createMockDispatchJob({id: 3, jobNo: 'J3', deliveryAddress: {addressLine5: 'Middle Park'} as any}),
            ];
            renderAndPushJobs(jobs);

            // Click Delivery header to sort asc
            fireEvent.click(screen.getByText('Delivery'));

            const rows = screen.getAllByText(/^(Alpha City|Middle Park|Zebra Town)$/);
            expect(rows.map(el => el.textContent)).toEqual(['Alpha City', 'Middle Park', 'Zebra Town']);
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

    describe('ASAP Job Late Detection', () => {
        it('does not treat ASAP jobs (null time) as having issues when overdue', () => {
            // ASAP jobs have no delivery time — they should never appear as "late"
            const asapJob = createMockDispatchJob({
                id: 1,
                jobNo: 'ASAP-001',
                statusId: 1, // Dispatched (pre-pickup)
                time: null as any,
                booked: dayjs().subtract(2, 'hour'), // booked 2 hours ago
                assignedCourier: {id: 10, text: '10 - Runner'},
                alertLatePickup: 0,
            });

            const timedJob = createMockDispatchJob({
                id: 2,
                jobNo: 'TIMED-001',
                statusId: 0, // New
            });

            renderAndPushJobs([asapJob, timedJob]);

            // ASAP job should be visible — it's not "late" and shouldn't be filtered out
            expect(screen.getByText('ASAP-001')).toBeInTheDocument();
            expect(screen.getByText('TIMED-001')).toBeInTheDocument();
        });

        it('does not flag ASAP job in transit as late delivery', () => {
            const asapJob = createMockDispatchJob({
                id: 1,
                jobNo: 'ASAP-002',
                statusId: 5, // PickedUp (in-transit status)
                time: null as any, // ASAP — no delivery time
                booked: dayjs().subtract(3, 'hour'),
                assignedCourier: {id: 10, text: '10 - Runner'},
                alertLateDelivery: 0,
            });

            const timedLateJob = createMockDispatchJob({
                id: 2,
                jobNo: 'TIMED-002',
                statusId: 5, // PickedUp
                time: dayjs().subtract(1, 'hour'), // overdue
                booked: dayjs().subtract(2, 'hour'),
                assignedCourier: {id: 20, text: '20 - Other'},
                alertLateDelivery: 0,
            });

            renderAndPushJobs([asapJob, timedLateJob]);

            // Both jobs should render
            expect(screen.getByText('ASAP-002')).toBeInTheDocument();
            expect(screen.getByText('TIMED-002')).toBeInTheDocument();
        });
    });

    describe('Logged-in Couriers Toggle', () => {
        it('defaults to unchecked and can be toggled on and off', () => {
            renderWithProviders(<JobListPanel {...createDefaultProps()}/>);

            expect(screen.getByText('Logged-in only')).toBeInTheDocument();
            const toggle = screen.getByRole('switch');
            expect(toggle).toBeInTheDocument();
            expect(toggle).not.toBeChecked();

            fireEvent.click(toggle);
            expect(toggle).toBeChecked();

            fireEvent.click(toggle);
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

            expect(await screen.findByText('FETCHED-001')).toBeInTheDocument();

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

            expect(await screen.findByText('INITIAL')).toBeInTheDocument();

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

            expect(await screen.findByText('FETCHED-001')).toBeInTheDocument();

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
            const fetchConfig = createMockFetchConfig();
            const onBackendFilter = jest.fn();

            renderWithProviders(
                <JobListPanel {...createDefaultProps({
                    fetchConfig,
                    onBackendFilter,
                })} />,
            );

            expect(await screen.findByText('FETCHED-001')).toBeInTheDocument();

            (fetchConfig.fetchFn as jest.Mock).mockClear();

            fireEvent.click(screen.getByText('Job No'));

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

        it('switches fetch function when selectedClearListId is set then cleared via updateSearchParams', async () => {
            const clearListJobs = [createMockDispatchJob({id: 10, jobNo: 'CLEAR-001'})];
            const allJobs = [createMockDispatchJob({id: 20, jobNo: 'ALL-001'})];

            const fetchFn = jest.fn()
                .mockResolvedValueOnce({jobs: [createMockDispatchJob({id: 1, jobNo: 'INITIAL'})], totalCount: 1, hasMore: false} as JobSearchResult)  // initial fetch
                .mockResolvedValueOnce({jobs: clearListJobs, totalCount: 1, hasMore: false} as JobSearchResult) // clear list fetch
                .mockResolvedValueOnce({jobs: allJobs, totalCount: 1, hasMore: false} as JobSearchResult);       // after clearing

            const queryKeyFn = jest.fn((params: JobListSearchParams) =>
                params.selectedClearListId
                    ? ['test', 'clearList', params] as const
                    : ['test', 'jobs', params] as const
            );

            const fetchConfig = createMockFetchConfig({fetchFn, queryKeyFn});
            let updateParamsFn: ((params: Partial<JobListSearchParams>) => void) = () => {};

            renderWithProviders(
                <JobListPanel {...createDefaultProps({
                    fetchConfig,
                    setUpdateSearchParamsCallback: (cb) => { updateParamsFn = cb; },
                })} />,
            );

            expect(await screen.findByText('INITIAL')).toBeInTheDocument();

            // Simulate AngularJS selecting a clear list area
            act(() => {
                updateParamsFn({selectedClearListId: 42});
            });

            await waitFor(() => {
                expect(fetchFn).toHaveBeenCalledWith(
                    expect.objectContaining({selectedClearListId: 42}),
                    expect.any(Object),
                );
            });

            // Query key should have used the clearList branch
            expect(queryKeyFn).toHaveBeenCalledWith(
                expect.objectContaining({selectedClearListId: 42}),
            );

            // Simulate AngularJS clearing the filter (the bug fix: passing undefined)
            act(() => {
                updateParamsFn({selectedClearListId: undefined});
            });

            await waitFor(() => {
                expect(fetchFn).toHaveBeenLastCalledWith(
                    expect.objectContaining({selectedClearListId: undefined}),
                    expect.any(Object),
                );
            });

            // Query key should have switched back to the jobs branch
            const lastKeyCall = queryKeyFn.mock.calls[queryKeyFn.mock.calls.length - 1][0];
            expect(lastKeyCall.selectedClearListId).toBeUndefined();
        });

        it('shows loading indicator while fetching', async () => {
            let resolveFetch!: (value: JobSearchResult) => void;
            const fetchFn = jest.fn().mockReturnValue(new Promise<JobSearchResult>(r => { resolveFetch = r; }));
            const fetchConfig = createMockFetchConfig({fetchFn});

            renderWithProviders(
                <JobListPanel {...createDefaultProps({fetchConfig})} />,
            );

            // LinearProgress should be visible while fetching
            expect(document.querySelector('.MuiLinearProgress-root')).toBeInTheDocument();

            // Resolve the fetch
            await act(async () => {
                resolveFetch({jobs: [createMockDispatchJob({id: 1, jobNo: 'LOADED'})], totalCount: 1, hasMore: false});
            });

            expect(await screen.findByText('LOADED')).toBeInTheDocument();

            // LinearProgress should be gone after fetch completes
            expect(document.querySelector('.MuiLinearProgress-root')).not.toBeInTheDocument();
        });

        it('calls onJobsLoaded when jobs arrive in fetchConfig mode', async () => {
            const onJobsLoaded = jest.fn();
            const jobs = [
                createMockDispatchJob({id: 1, jobNo: 'MAP-001', statusId: 0}),
                createMockDispatchJob({id: 2, jobNo: 'MAP-002', statusId: 1}),
            ];
            const fetchConfig = createMockFetchConfig({
                fetchFn: jest.fn().mockResolvedValue({
                    jobs,
                    totalCount: 2,
                    hasMore: false,
                } as JobSearchResult),
            });

            renderWithProviders(
                <JobListPanel {...createDefaultProps({fetchConfig, onJobsLoaded})} />,
            );

            await waitFor(() => {
                expect(onJobsLoaded).toHaveBeenCalledWith(jobs);
            });
        });

        it('does not call onJobsLoaded when jobs array is empty', async () => {
            const onJobsLoaded = jest.fn();
            const fetchConfig = createMockFetchConfig({
                fetchFn: jest.fn().mockResolvedValue({
                    jobs: [],
                    totalCount: 0,
                    hasMore: false,
                } as JobSearchResult),
            });

            renderWithProviders(
                <JobListPanel {...createDefaultProps({fetchConfig, onJobsLoaded})} />,
            );

            await screen.findByText('No jobs to display');
            expect(onJobsLoaded).not.toHaveBeenCalled();
        });

        it('does not call onJobsLoaded in pushed-data mode', () => {
            const onJobsLoaded = jest.fn();
            renderAndPushJobs(
                [createMockDispatchJob({id: 1, jobNo: 'PUSHED-001'})],
                {onJobsLoaded},
            );

            expect(onJobsLoaded).not.toHaveBeenCalled();
        });

        it('does not show loading indicator in pushed-data mode', () => {
            renderAndPushJobs([createMockDispatchJob()]);

            expect(document.querySelector('.MuiLinearProgress-root')).not.toBeInTheDocument();
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

            expect(await screen.findByText('No jobs to display')).toBeInTheDocument();

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

    describe('Mark as Read on Click', () => {
        beforeEach(() => {
            mockedUpdateJobReadStatus.mockClear();
        });

        it('calls updateJobReadStatus when clicking an unread job', () => {
            const jobs = [
                createMockDispatchJob({id: 10, jobNo: 'UNREAD1', hasBeenRead: false}),
            ];
            renderAndPushJobs(jobs);

            fireEvent.click(screen.getByText('UNREAD1'));

            expect(mockedUpdateJobReadStatus).toHaveBeenCalledWith(10, true);
        });

        it('does not call updateJobReadStatus when clicking an already-read job', () => {
            const jobs = [
                createMockDispatchJob({id: 20, jobNo: 'READ1', hasBeenRead: true}),
            ];
            renderAndPushJobs(jobs);

            fireEvent.click(screen.getByText('READ1'));

            expect(mockedUpdateJobReadStatus).not.toHaveBeenCalled();
        });

        it('does not call updateJobReadStatus on modifier-click (multi-select)', async () => {
            const user = setupUser();
            const jobs = [
                createMockDispatchJob({id: 30, jobNo: 'UNREAD2', hasBeenRead: false}),
            ];
            renderAndPushJobs(jobs);

            await user.keyboard('{Control>}');
            await user.click(screen.getByText('UNREAD2'));
            await user.keyboard('{/Control}');

            expect(mockedUpdateJobReadStatus).not.toHaveBeenCalled();
        });
    });

    describe('Multi-Select', () => {
        it('includes previously plain-clicked job when Ctrl multi-select begins', async () => {
            const user = setupUser();
            const jobs = [
                createMockDispatchJob({id: 1, jobNo: 'JOB-A'}),
                createMockDispatchJob({id: 2, jobNo: 'JOB-B'}),
                createMockDispatchJob({id: 3, jobNo: 'JOB-C'}),
            ];
            renderAndPushJobs(jobs);

            // Plain click first job (no modifier)
            await user.click(screen.getByText('JOB-A'));

            // Ctrl+click second job to start multi-select
            await user.keyboard('{Control>}');
            await user.click(screen.getByText('JOB-B'));
            await user.keyboard('{/Control}');

            // Both jobs should be in multi-select — toolbar shows "2 jobs selected"
            expect(screen.getByText('2 jobs selected')).toBeInTheDocument();
        });

        it('plain-clicked job plus two Ctrl-clicks yields three selected', async () => {
            const user = setupUser();
            const jobs = [
                createMockDispatchJob({id: 1, jobNo: 'JOB-A'}),
                createMockDispatchJob({id: 2, jobNo: 'JOB-B'}),
                createMockDispatchJob({id: 3, jobNo: 'JOB-C'}),
            ];
            renderAndPushJobs(jobs);

            // Plain click JOB-A
            await user.click(screen.getByText('JOB-A'));

            // Ctrl+click JOB-B and JOB-C
            await user.keyboard('{Control>}');
            await user.click(screen.getByText('JOB-B'));
            await user.click(screen.getByText('JOB-C'));
            await user.keyboard('{/Control}');

            // JOB-A auto-added + JOB-B + JOB-C → 3 selected
            expect(screen.getByText('3 jobs selected')).toBeInTheDocument();
        });

        it('does not auto-add when multi-select already has items', async () => {
            const user = setupUser();
            const jobs = [
                createMockDispatchJob({id: 1, jobNo: 'JOB-A'}),
                createMockDispatchJob({id: 2, jobNo: 'JOB-B'}),
                createMockDispatchJob({id: 3, jobNo: 'JOB-C'}),
            ];
            renderAndPushJobs(jobs);

            // Ctrl+click two jobs directly (no prior plain click)
            await user.keyboard('{Control>}');
            await user.click(screen.getByText('JOB-A'));
            await user.click(screen.getByText('JOB-B'));
            await user.keyboard('{/Control}');

            expect(screen.getByText('2 jobs selected')).toBeInTheDocument();
        });
    });

    describe('Bulk Restore', () => {
        beforeEach(() => {
            mockedRestoreJobs.mockClear().mockResolvedValue(undefined);
            mockedAddRestoreEvent.mockClear().mockResolvedValue(undefined);
        });

        it('excludes archived jobs from the restore call', async () => {
            const user = setupUser();
            const jobs = [
                createMockDispatchJob({id: 1, jobNo: 'JOB-LIVE', isArchived: false}),
                createMockDispatchJob({id: 2, jobNo: 'JOB-ARCH', isArchived: true, done: true}),
            ];
            renderAndPushJobs(jobs);

            await user.keyboard('{Control>}');
            await user.click(screen.getByText('JOB-LIVE'));
            await user.click(screen.getByText('JOB-ARCH'));
            await user.keyboard('{/Control}');

            await user.click(screen.getByText('Restore'));

            await waitFor(() => {
                expect(mockedRestoreJobs).toHaveBeenCalledWith([1], false);
            });
            // Audit event only for the live job; the archived one is never touched.
            expect(mockedAddRestoreEvent).toHaveBeenCalledWith(1);
            expect(mockedAddRestoreEvent).not.toHaveBeenCalledWith(2);
        });

        it('warns and restores nothing when only archived jobs are selected', async () => {
            const user = setupUser();
            const jobs = [
                createMockDispatchJob({id: 1, jobNo: 'JOB-ARCH-1', isArchived: true, done: true}),
                createMockDispatchJob({id: 2, jobNo: 'JOB-ARCH-2', isArchived: true, done: true}),
            ];
            const {props} = renderAndPushJobs(jobs);

            await user.keyboard('{Control>}');
            await user.click(screen.getByText('JOB-ARCH-1'));
            await user.click(screen.getByText('JOB-ARCH-2'));
            await user.keyboard('{/Control}');

            await user.click(screen.getByText('Restore'));

            expect(props.showToast).toHaveBeenCalledWith('Archived jobs can’t be restored', 'warning');
            expect(mockedRestoreJobs).not.toHaveBeenCalled();
            expect(mockedAddRestoreEvent).not.toHaveBeenCalled();
        });
    });
});
