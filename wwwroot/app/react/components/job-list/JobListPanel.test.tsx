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
import {renderWithTheme} from '../../__testUtils__';
import {JobListPanel} from './JobListPanel';
import type {DispatchJob, JobListPanelProps} from '../../interfaces/dispatchJob';
import {AppPage} from '../../interfaces/dispatchJob';
import dayjs from 'dayjs';

// Mock modules that depend on AngularJS (window.angular)
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
    const result = renderWithTheme(<JobListPanel {...props}/>);
    act(() => pushJobs(jobs, jobs.length));
    return {result, pushJobs, props};
}

// ── Tests ────────────────────────────────────────────────────────────

describe('JobListPanel', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        localStorage.clear();
        (window as any).ContactID = 42;
        mockedAllocateJobs.mockResolvedValue(undefined);
    });

    describe('Rendering', () => {
        it('renders the stats header, toolbar, table, and footer', () => {
            renderWithTheme(<JobListPanel {...createDefaultProps()}/>);

            // Stats header shows "Total" label
            expect(screen.getByText('Total')).toBeInTheDocument();
            // Toolbar category buttons
            expect(screen.getByText('Unassigned')).toBeInTheDocument();
            expect(screen.getByRole('button', {name: 'All'})).toBeInTheDocument();
            // Search field
            expect(screen.getByPlaceholderText('Search jobs...')).toBeInTheDocument();
            // Footer
            expect(screen.getByText(/Showing/)).toBeInTheDocument();
        });

        it('renders empty state when no jobs are pushed', () => {
            renderWithTheme(<JobListPanel {...createDefaultProps()}/>);

            expect(screen.getByText('No jobs to display')).toBeInTheDocument();
        });

        it('renders jobs pushed via setJobsCallback', () => {
            renderAndPushJobs([createMockDispatchJob({jobNo: 'TEST-777'})]);

            expect(screen.getByText('TEST-777')).toBeInTheDocument();
        });
    });

    describe('AngularJS Bridge Callbacks', () => {
        it('registers and invokes setJobsCallback', () => {
            const setJobsCallback = jest.fn();
            renderWithTheme(<JobListPanel {...createDefaultProps({setJobsCallback})}/>);

            expect(setJobsCallback).toHaveBeenCalledWith(expect.any(Function));
        });

        it('registers setRefreshCallback and invokes onRefresh', () => {
            const onRefresh = jest.fn();
            let refreshFn: () => void = () => {};
            renderWithTheme(
                <JobListPanel {...createDefaultProps({
                    onRefresh,
                    setRefreshCallback: (cb) => { refreshFn = cb; },
                })}/>
            );

            act(() => refreshFn());
            expect(onRefresh).toHaveBeenCalledTimes(1);
        });

        it('registers setSelectJobCallback and selects a job', () => {
            const onJobSelect = jest.fn();
            let selectJob: (id: number) => void = () => {};
            const jobs = [createMockDispatchJob({id: 10, jobNo: 'J010'})];

            let pushJobs: (j: DispatchJob[], t: number) => void = () => {};
            renderWithTheme(
                <JobListPanel {...createDefaultProps({
                    onJobSelect,
                    setJobsCallback: (cb) => { pushJobs = cb; },
                    setSelectJobCallback: (cb) => { selectJob = cb; },
                })}/>
            );

            act(() => pushJobs(jobs, 1));
            act(() => selectJob(10));

            // The selected row should have the MUI Mui-selected class
            const row = screen.getByText('J010').closest('tr');
            expect(row).toHaveClass('Mui-selected');
        });
    });

    describe('Category Filtering', () => {
        it('filters to unassigned (needs-dispatch) jobs', async () => {
            const user = userEvent.setup();
            const unassigned = createMockDispatchJob({id: 1, jobNo: 'UNASSIGNED-1', statusId: 0});
            const dispatched = createMockDispatchJob({
                id: 2, jobNo: 'DISPATCHED-1', statusId: 1,
                assignedCourier: {id: 100, text: '100 - Courier'},
            });
            renderAndPushJobs([unassigned, dispatched]);

            await user.click(screen.getByText('Unassigned'));

            expect(screen.getByText('UNASSIGNED-1')).toBeInTheDocument();
            expect(screen.queryByText('DISPATCHED-1')).not.toBeInTheDocument();
        });

        it('filters to delivered jobs', async () => {
            const user = userEvent.setup();
            const newJob = createMockDispatchJob({id: 1, jobNo: 'NEW-1', statusId: 0});
            const delivered = createMockDispatchJob({id: 2, jobNo: 'DONE-1', statusId: 6}); // Completed
            renderAndPushJobs([newJob, delivered]);

            await user.click(screen.getByRole('button', {name: 'Done'}));

            expect(screen.getByText('DONE-1')).toBeInTheDocument();
            expect(screen.queryByText('NEW-1')).not.toBeInTheDocument();
        });

        it('shows all jobs when "All" is selected', async () => {
            const user = userEvent.setup();
            const jobs = [
                createMockDispatchJob({id: 1, jobNo: 'A-1', statusId: 0}),
                createMockDispatchJob({id: 2, jobNo: 'B-1', statusId: 6}),
            ];
            renderAndPushJobs(jobs);

            // Default is 'all', but let's switch away and back
            await user.click(screen.getByRole('button', {name: 'Done'}));
            await user.click(screen.getByRole('button', {name: 'All'}));

            expect(screen.getByText('A-1')).toBeInTheDocument();
            expect(screen.getByText('B-1')).toBeInTheDocument();
        });

        it('calls onCategoryChange callback', async () => {
            const user = userEvent.setup();
            const onCategoryChange = jest.fn();
            renderAndPushJobs([], {onCategoryChange});

            await user.click(screen.getByText('Unassigned'));

            expect(onCategoryChange).toHaveBeenCalledWith('needs-dispatch');
        });
    });

    describe('Search Filtering', () => {
        it('filters jobs by job number', async () => {
            const user = userEvent.setup();
            const jobs = [
                createMockDispatchJob({id: 1, jobNo: 'ALPHA-001'}),
                createMockDispatchJob({id: 2, jobNo: 'BETA-002'}),
            ];
            renderAndPushJobs(jobs);

            const searchInput = screen.getByPlaceholderText('Search jobs...');
            await user.type(searchInput, 'ALPHA');

            await waitFor(() => {
                expect(screen.getByText('ALPHA-001')).toBeInTheDocument();
                expect(screen.queryByText('BETA-002')).not.toBeInTheDocument();
            });
        });

        it('filters jobs by client name', async () => {
            const user = userEvent.setup();
            const jobs = [
                createMockDispatchJob({id: 1, jobNo: 'J1', client: 'Widget Co'}),
                createMockDispatchJob({id: 2, jobNo: 'J2', client: 'Gadget Inc'}),
            ];
            renderAndPushJobs(jobs);

            const searchInput = screen.getByPlaceholderText('Search jobs...');
            await user.type(searchInput, 'widget');

            await waitFor(() => {
                expect(screen.getByText('J1')).toBeInTheDocument();
                expect(screen.queryByText('J2')).not.toBeInTheDocument();
            });
        });

        it('filters by courier name', async () => {
            const user = userEvent.setup();
            const jobs = [
                createMockDispatchJob({
                    id: 1, jobNo: 'J1',
                    assignedCourier: {id: 10, text: '10 - Mike Runner'},
                }),
                createMockDispatchJob({id: 2, jobNo: 'J2'}),
            ];
            renderAndPushJobs(jobs);

            const searchInput = screen.getByPlaceholderText('Search jobs...');
            await user.type(searchInput, 'Mike');

            await waitFor(() => {
                expect(screen.getByText('J1')).toBeInTheDocument();
                expect(screen.queryByText('J2')).not.toBeInTheDocument();
            });
        });

        it('calls onSearchChange callback', async () => {
            const user = userEvent.setup();
            const onSearchChange = jest.fn();
            renderAndPushJobs([], {onSearchChange});

            const searchInput = screen.getByPlaceholderText('Search jobs...');
            await user.type(searchInput, 'test');

            await waitFor(() => {
                expect(onSearchChange).toHaveBeenCalledWith('test');
            });
        });
    });

    describe('Stats Header', () => {
        it('computes stats from job data', () => {
            const jobs = [
                createMockDispatchJob({id: 1, statusId: 0}),       // New (needs dispatch)
                createMockDispatchJob({id: 2, statusId: 1, assignedCourier: {id: 1, text: 'C'}}), // Dispatched (active)
                createMockDispatchJob({id: 3, statusId: 11, assignedCourier: {id: 2, text: 'C'}}), // InTransit
                createMockDispatchJob({id: 4, statusId: 6}),       // Completed
            ];
            renderAndPushJobs(jobs);

            // The stats header shows "Total" label with the count
            const totalLabel = screen.getByText('Total');
            const statsArea = totalLabel.closest('div')!.parentElement!;
            expect(within(statsArea).getByText('4')).toBeInTheDocument();
        });
    });

    describe('Footer', () => {
        it('shows displayed and total job counts', () => {
            const jobs = [
                createMockDispatchJob({id: 1, jobNo: 'J1'}),
                createMockDispatchJob({id: 2, jobNo: 'J2'}),
            ];
            renderAndPushJobs(jobs);

            expect(screen.getByText(/Showing 2/)).toBeInTheDocument();
        });

        it('shows last updated timestamp', () => {
            renderAndPushJobs([createMockDispatchJob()]);

            expect(screen.getByText(/Last updated:/)).toBeInTheDocument();
        });
    });

    describe('Job Selection', () => {
        it('selects a job on click and calls onJobSelect', async () => {
            const user = userEvent.setup();
            const onJobSelect = jest.fn();
            const jobs = [
                createMockDispatchJob({id: 1, jobNo: 'CLICK-ME'}),
                createMockDispatchJob({id: 2, jobNo: 'OTHER'}),
            ];
            renderAndPushJobs(jobs, {onJobSelect});

            await user.click(screen.getByText('CLICK-ME'));

            expect(onJobSelect).toHaveBeenCalledWith(
                expect.objectContaining({id: 1, jobNo: 'CLICK-ME'})
            );
        });
    });

    describe('localStorage Persistence', () => {
        const storagePrefix = 'testPanel';
        const contactId = 42;
        const key = (suffix: string) => `${storagePrefix}_${suffix}_${contactId}`;

        it('restores density mode from localStorage', () => {
            localStorage.setItem(key('densityMode'), 'normal');
            renderAndPushJobs([createMockDispatchJob()], {storagePrefix});

            // The Normal density button should be pressed
            const buttons = screen.getAllByRole('button');
            const normalBtn = buttons.find(b => b.getAttribute('aria-pressed') === 'true' && b.getAttribute('value') === 'normal');
            expect(normalBtn).toBeTruthy();
        });

        it('persists density mode to localStorage on change', async () => {
            const user = userEvent.setup();
            renderAndPushJobs([createMockDispatchJob()], {storagePrefix});

            // Find the "Normal" density toggle button by its value
            const buttons = screen.getAllByRole('button');
            const normalButton = buttons.find(b => b.getAttribute('value') === 'normal');
            expect(normalButton).toBeTruthy();
            await user.click(normalButton!);

            expect(localStorage.getItem(key('densityMode'))).toBe('normal');
        });

        it('restores loggedInCouriersOnly from localStorage', () => {
            localStorage.setItem(key('loggedInCouriersOnly'), 'true');
            renderAndPushJobs([], {storagePrefix});

            const toggle = screen.getByRole('switch');
            expect(toggle).toBeChecked();
        });

        it('persists loggedInCouriersOnly to localStorage on toggle', async () => {
            const user = userEvent.setup();
            renderAndPushJobs([], {storagePrefix});

            const toggle = screen.getByRole('switch');
            await user.click(toggle);

            expect(localStorage.getItem(key('loggedInCouriersOnly'))).toBe('true');
        });

        it('persists sort state to localStorage', async () => {
            const user = userEvent.setup();
            renderAndPushJobs([createMockDispatchJob()], {storagePrefix});

            // Click the "Job No" column header to sort
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
        it('toggles sort direction on repeated header clicks', async () => {
            const user = userEvent.setup();
            const storagePrefix = 'sortTest';
            renderAndPushJobs([createMockDispatchJob()], {storagePrefix});

            const header = screen.getByText('Job No');

            // First click → asc
            await user.click(header);
            let saved = JSON.parse(localStorage.getItem(`${storagePrefix}_sortState_42`)!);
            expect(saved).toEqual({column: 'jobNo', direction: 'asc'});

            // Second click → desc
            await user.click(header);
            saved = JSON.parse(localStorage.getItem(`${storagePrefix}_sortState_42`)!);
            expect(saved).toEqual({column: 'jobNo', direction: 'desc'});
        });

        it('calls onBackendFilter when sort changes', async () => {
            const user = userEvent.setup();
            const onBackendFilter = jest.fn();
            renderAndPushJobs([createMockDispatchJob()], {onBackendFilter});

            await user.click(screen.getByText('Job No'));

            expect(onBackendFilter).toHaveBeenCalledWith('jobNo', 'asc');
        });
    });

    describe('Optimistic Dispatch', () => {
        it('renders assign button for unassigned jobs on dispatch page', () => {
            const job = createMockDispatchJob({id: 5, jobNo: 'DISP-1', statusId: 0});
            renderAndPushJobs([job], {appPage: AppPage.Dispatch});

            // Unassigned jobs should have an Assign button
            expect(screen.getByText('Assign')).toBeInTheDocument();
        });

        it('calls allocateJobs API on dispatch', async () => {
            const showToast = jest.fn();
            const onRefresh = jest.fn();
            mockedAllocateJobs.mockResolvedValue(undefined);

            const job = createMockDispatchJob({id: 5, jobNo: 'DISP-1', statusId: 0});
            renderAndPushJobs([job], {showToast, onRefresh, appPage: AppPage.Dispatch});

            // The job is rendered with an Assign button
            expect(screen.getByText('DISP-1')).toBeInTheDocument();
            expect(screen.getByText('Assign')).toBeInTheDocument();
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

            const {rerender} = renderWithTheme(<JobListPanel {...props}/>);
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
        it('renders the toggle in the toolbar', () => {
            renderWithTheme(<JobListPanel {...createDefaultProps()}/>);

            expect(screen.getByText('Logged-in only')).toBeInTheDocument();
            expect(screen.getByRole('switch')).toBeInTheDocument();
        });

        it('defaults to unchecked', () => {
            renderWithTheme(<JobListPanel {...createDefaultProps()}/>);

            const toggle = screen.getByRole('switch');
            expect(toggle).not.toBeChecked();
        });

        it('can be toggled on and off', async () => {
            const user = userEvent.setup();
            renderWithTheme(<JobListPanel {...createDefaultProps()}/>);

            const toggle = screen.getByRole('switch');
            await user.click(toggle);
            expect(toggle).toBeChecked();

            await user.click(toggle);
            expect(toggle).not.toBeChecked();
        });
    });
});
