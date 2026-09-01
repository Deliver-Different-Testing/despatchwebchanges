/**
 * TaskDashboardPage Component Tests
 *
 * Optimised: tests sharing identical setup consolidated into single renders.
 */

import React from 'react';
import { renderWithMantineOverMui } from '../../__testUtils__';
import { setupUser } from '../../__testUtils__/setupUser';
import {render, screen, waitFor} from '@testing-library/react';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import dayjs from 'dayjs';
import {useMediaQuery} from '@mantine/hooks';
import {TaskDashboardPage} from './TaskDashboardPage';
import {TaskDashboardPageProps} from './TaskDashboardPage.interfaces';
import {Task} from '../../interfaces';
import {tasksApi} from '../../services/tasksApi';

// Control the compact/expanded breakpoint deterministically. Defaults to
// expanded (false) in beforeEach; the compact-layout test flips it to true.
// Only useMediaQuery is replaced — the rest of @mantine/hooks stays real.
jest.mock('@mantine/hooks', () => ({
    ...jest.requireActual('@mantine/hooks'),
    useMediaQuery: jest.fn(),
}));
const mockUseMediaQuery = useMediaQuery as jest.Mock;

// Mock JobDetails to avoid AngularJS dependency chain
jest.mock('../../components/common/job-details/JobDetails', () => ({
    JobDetails: ({config}: { config: { jobId?: number } }) => (
        <div data-testid="job-details" data-job-id={config.jobId ?? ''}>
            JobDetails Mock
        </div>
    ),
}));

// Mock the tasksApi
jest.mock('../../services/tasksApi', () => ({
    tasksApi: {
        getAllTasks: jest.fn(),
        getActiveStaff: jest.fn(),
        getEventTypes: jest.fn(),
        getDeliveryJourney: jest.fn(),
        markTaskAsClosed: jest.fn(),
        updateTaskDate: jest.fn(),
        updateTaskTime: jest.fn(),
        reassignTaskToStaff: jest.fn(),
        unassignTask: jest.fn(),
    },
}));

// Mock the date utilities
jest.mock('../../utils/dateUtils', () => ({
    formatDateForApi: jest.fn((date) => date.toISOString()),
    parseDateFromApi: jest.fn((dateStr) => dayjs(dateStr)),
    formatRelativeDateTime: jest.fn((dateStr) => dateStr),
    getIanaTimezone: jest.fn(() => 'America/New_York'),
    getTenantTimezone: jest.fn(() => 'America/New_York'),
    getTimezoneAbbreviation: jest.fn(() => '(EST)'),
}));

// Mock localStorage
const localStorageStore: Record<string, string> = {};
const localStorageMock = {
    getItem: jest.fn((key: string) => localStorageStore[key] || null),
    setItem: jest.fn((key: string, value: string) => {
        localStorageStore[key] = value;
    }),
    removeItem: jest.fn((key: string) => {
        delete localStorageStore[key];
    }),
    clear: jest.fn(() => {
        Object.keys(localStorageStore).forEach(key => delete localStorageStore[key]);
    }),
    setStore: (newStore: Record<string, string>) => {
        Object.keys(localStorageStore).forEach(key => delete localStorageStore[key]);
        Object.assign(localStorageStore, newStore);
    },
};
Object.defineProperty(window, 'localStorage', {value: localStorageMock});

// Mock window.ContactID
Object.defineProperty(window, 'ContactID', {value: 1, writable: true});

const mockTasksApi = tasksApi as jest.Mocked<typeof tasksApi>;

// Create a fresh QueryClient for each test
const createTestQueryClient = () =>
    new QueryClient({
        defaultOptions: {
            queries: {
                retry: false,
                gcTime: 0,
            },
            mutations: {
                retry: false,
            },
        },
    });

const renderWithProviders = (ui: React.ReactElement, queryClient?: QueryClient) =>
    // Mantine outside, MUI inside: the page is still MUI but its rows (`TaskItem`)
    // are Mantine, so both providers have to be present.
    renderWithMantineOverMui(ui, {queryClient: queryClient ?? createTestQueryClient()});

// Sample test data
const createMockTasks = (): Task[] => [
    {
        id: 1,
        title: 'Overdue follow up call',
        description: 'Call customer about delivery',
        dueDate: dayjs().subtract(1, 'day'), // Overdue
        closed: false,
        assignee: {id: 5, text: 'John Doe'},
        jobId: 100,
        eventType: 'Call',
        jobNumber: 'JOB-100',
    },
    {
        id: 2,
        title: 'Future email reminder',
        description: 'Send reminder email',
        dueDate: dayjs().add(1, 'day'),
        closed: false,
        assignee: {id: 6, text: 'Jane Smith'},
        jobId: 101,
        eventType: 'Email',
        jobNumber: 'JOB-101',
    },
    {
        id: 3,
        title: 'Completed task',
        description: 'Already done task',
        dueDate: dayjs().subtract(2, 'days'),
        closed: true,
        assignee: {id: 7, text: 'Bob Wilson'},
        jobId: 102,
        eventType: 'Call',
        jobNumber: 'JOB-102',
    },
];

const mockStaff = [
    {id: 5, text: 'John Doe'},
    {id: 6, text: 'Jane Smith'},
    {id: 7, text: 'Bob Wilson'},
];

const mockEventTypes = [
    {id: 1, text: 'Call'},
    {id: 2, text: 'Email'},
    {id: 3, text: 'Meeting'},
];

const createDefaultProps = (overrides?: Partial<TaskDashboardPageProps>): TaskDashboardPageProps => ({
    showToast: jest.fn(),
    isUsCustomer: true,
    setRefreshCallback: jest.fn(),
    ...overrides,
});

describe('TaskDashboardPage', () => {
    beforeEach(() => {
        localStorageMock.setStore({}); // Clear store properly
        mockUseMediaQuery.mockReturnValue(false); // expanded (two-pane) by default

        // Setup default API responses
        mockTasksApi.getAllTasks.mockResolvedValue(createMockTasks());
        mockTasksApi.getActiveStaff.mockResolvedValue(mockStaff);
        mockTasksApi.getEventTypes.mockResolvedValue(mockEventTypes);
        mockTasksApi.getDeliveryJourney.mockResolvedValue([]);
    });

    // ── Default render assertions (single render) ───────────────────
    it('renders page with all expected elements, stat counts, date groups, API calls, and refresh callback', async () => {
        const setRefreshCallback = jest.fn();
        const props = createDefaultProps({setRefreshCallback});
        renderWithProviders(<TaskDashboardPage {...props} />);

        // View toggle buttons
        expect(screen.getByRole('radio', {name: /List/i})).toBeInTheDocument();
        expect(screen.getByRole('radio', {name: /Calendar/i})).toBeInTheDocument();

        // The status filter mirrors the time-to-action buckets with their counts
        // (mock data: 1 overdue, 0 due today, 1 upcoming/tomorrow, 1 done).
        expect(await screen.findByRole('radio', {name: /Overdue 1/})).toBeInTheDocument();
        expect(screen.getByRole('radio', {name: /Today \(0\)/})).toBeInTheDocument();
        expect(screen.getByRole('radio', {name: /Upcoming \(1\)/})).toBeInTheDocument();
        expect(screen.getByRole('radio', {name: /Done \(1\)/})).toBeInTheDocument();

        // Tasks rendered after loading
        expect(screen.getByText('Overdue follow up call')).toBeInTheDocument();
        expect(screen.getByText('Future email reminder')).toBeInTheDocument();

        // Panel bar: inline search + a Filters button (staff/type/refresh live in its popover)
        expect(screen.getByRole('textbox', {name: /Search tasks/i})).toBeInTheDocument();
        expect(screen.getByRole('button', {name: /^Filters/})).toBeInTheDocument();

        // Job Details panel (rendered directly in React, no AngularJS bridge)
        expect(screen.getByText('Job Details')).toBeInTheDocument();

        // Two-column layout: tasks panel + job details
        expect(screen.getByText(/Tasks \(/)).toBeInTheDocument();

        // Task count in list header
        expect(screen.getByText('Tasks (2)')).toBeInTheDocument();

        // Date grouping
        const overdueHeaders = screen.getAllByText('Overdue');
        expect(overdueHeaders.length).toBeGreaterThanOrEqual(1);
        expect(screen.getByText('Tomorrow')).toBeInTheDocument();

        // API integration
        expect(mockTasksApi.getAllTasks).toHaveBeenCalled();
        const lastCall = mockTasksApi.getAllTasks.mock.calls[0]?.[0];
        expect(lastCall?.showCompleted).toBe(true);
        expect(mockTasksApi.getActiveStaff).toHaveBeenCalled();
        expect(mockTasksApi.getEventTypes).toHaveBeenCalled();

        // Refresh callback registered
        expect(setRefreshCallback).toHaveBeenCalled();
        expect(typeof setRefreshCallback.mock.calls[0][0]).toBe('function');
    });

    // ── Skeleton loading state ──────────────────────────────────────
    it('renders skeleton loading state while fetching tasks', async () => {
        mockTasksApi.getAllTasks.mockImplementation(
            () => new Promise(() => {})
        );

        const props = createDefaultProps();
        renderWithProviders(<TaskDashboardPage {...props} />);

        // Mantine's Skeleton has no role and no generated class hook, so the
        // component stamps its own.
        expect(screen.getAllByTestId('task-skeleton')).toHaveLength(4);
    });

    // ── Empty state (shared NoData component) ───────────────────────
    it('renders the shared NoData empty state when no tasks match filters', async () => {
        mockTasksApi.getAllTasks.mockResolvedValue([]);

        const props = createDefaultProps();
        renderWithProviders(<TaskDashboardPage {...props} />);

        expect(await screen.findByText('No tasks')).toBeInTheDocument();
        expect(screen.getByText('No tasks match your filters')).toBeInTheDocument();
    });

    // ── The status filter is a radio group ──────────────────────────
    it('selects a bucket and clears it through the explicit All option', async () => {
        const user = setupUser();
        const props = createDefaultProps();
        renderWithProviders(<TaskDashboardPage {...props} />);

        const overdue = await screen.findByRole('radio', {name: /Overdue 1/});
        const upcoming = screen.getByRole('radio', {name: /Upcoming \(1\)/});
        const all = screen.getByRole('radio', {name: 'All'});

        // Default is "All", which is now an option rather than an absence.
        expect(all).toBeChecked();
        expect(overdue).not.toBeChecked();

        await user.click(overdue);
        expect(overdue).toBeChecked();
        expect(upcoming).not.toBeChecked();
        expect(all).not.toBeChecked();

        // A radio group cannot deselect, so clearing goes through All.
        await user.click(all);
        expect(all).toBeChecked();
        expect(overdue).not.toBeChecked();
    });

    // ── Adaptive layout: Job Details opens in a drawer below md ─────
    it('opens Job Details in a drawer on compact widths and closes it', async () => {
        mockUseMediaQuery.mockReturnValue(true); // compact (single pane + drawer)
        const user = setupUser();
        const props = createDefaultProps();
        renderWithProviders(<TaskDashboardPage {...props} />);

        await screen.findByText('Overdue follow up call');

        // No side panel — the details header only appears once the drawer opens.
        expect(screen.queryByText('Job Details')).not.toBeInTheDocument();

        await user.click(screen.getByText('Overdue follow up call'));

        expect(await screen.findByText(/Job Details - Job #100/)).toBeInTheDocument();

        await user.click(screen.getByRole('button', {name: /Close job details/i}));

        await waitFor(() => {
            expect(screen.queryByText(/Job Details - Job #100/)).not.toBeInTheDocument();
        });
    });

    // ── View Mode Toggle (single render) ────────────────────────────
    it('switches to calendar view, saves preference, and keeps delivery journey', async () => {
        const user = setupUser();
        const props = createDefaultProps();
        renderWithProviders(<TaskDashboardPage {...props} />);

        // Starts in list view
        expect(await screen.findByText(/Tasks \(/)).toBeInTheDocument();

        // Switch to calendar
        await user.click(screen.getByRole('radio', {name: /Calendar/i}));

        // Tasks panel replaced by calendar
        await waitFor(() => {
            expect(screen.queryByText(/Tasks \(/)).not.toBeInTheDocument();
        });

        // Saves preference to localStorage
        expect(localStorageMock.setItem).toHaveBeenCalledWith(
            'taskDashboardViewPreference-1',
            'calendar'
        );

        // Job Details still visible in two-column layout
        expect(screen.getByText('Job Details')).toBeInTheDocument();
    });

    // ── Load view preference from localStorage ──────────────────────
    it('loads view preference from localStorage', async () => {
        localStorageMock.setStore({
            'taskDashboardViewPreference-1': 'calendar',
        });

        const props = createDefaultProps();
        renderWithProviders(<TaskDashboardPage {...props} />);

        await waitFor(() => {
            expect(screen.queryByText(/Tasks \(/)).not.toBeInTheDocument();
        });
    });

    // ── Status Filters (single render, sequential clicks) ───────────
    it('filters tasks by bucket and updates the task count', async () => {
        const user = setupUser();
        const props = createDefaultProps();
        renderWithProviders(<TaskDashboardPage {...props} />);

        expect(await screen.findByText('Overdue follow up call')).toBeInTheDocument();
        expect(screen.getByText('Tasks (2)')).toBeInTheDocument();

        await user.click(screen.getByRole('radio', {name: /Upcoming/}));
        expect(await screen.findByText('Future email reminder')).toBeInTheDocument();
        expect(screen.queryByText('Overdue follow up call')).not.toBeInTheDocument();

        // Click Overdue → only overdue tasks
        await user.click(screen.getByRole('radio', {name: /Overdue/}));
        expect(await screen.findByText('Overdue follow up call')).toBeInTheDocument();
        expect(screen.queryByText('Future email reminder')).not.toBeInTheDocument();

        // Click Done → only completed tasks with "Completed" heading
        await user.click(screen.getByRole('radio', {name: /Done/}));
        expect(await screen.findByText('Completed task')).toBeInTheDocument();
        expect(screen.getByText('Completed')).toBeInTheDocument();
        expect(screen.queryByText('Overdue follow up call')).not.toBeInTheDocument();
        expect(screen.queryByText('Future email reminder')).not.toBeInTheDocument();
        expect(screen.getByText('Tasks (1)')).toBeInTheDocument();
    });

    // ── Search input ────────────────────────────────────────────────
    it('updates search query on input', async () => {
        const user = setupUser();
        const props = createDefaultProps();
        renderWithProviders(<TaskDashboardPage {...props} />);

        const searchInput = await screen.findByRole('textbox', {name: /Search/i});
        await user.click(searchInput);
        await user.paste('follow up');

        expect(searchInput).toHaveValue('follow up');
    });

    // ── Filters popover holds staff + task type ─────────────────────
    it('reveals the staff and task-type filters inside the Filters popover', async () => {
        const user = setupUser();
        const props = createDefaultProps();
        renderWithProviders(<TaskDashboardPage {...props} />);

        await screen.findByText('Overdue follow up call');

        // The staff + task-type selects are hidden until the popover opens.
        expect(screen.queryAllByRole('combobox')).toHaveLength(0);

        await user.click(screen.getByRole('button', {name: /^Filters/}));

        await waitFor(() => {
            expect(screen.getAllByRole('combobox').length).toBeGreaterThanOrEqual(2);
        });
        // Both selects show their "all" default value. Copy matches dispatch's
        // Tasks panel: sentence case, terse.
        expect(screen.getByRole('combobox', {name: 'Staff'})).toHaveValue('All staff');
        expect(screen.getByRole('combobox', {name: 'Type'})).toHaveValue('All types');
    });

    // ── Freshness indicator ─────────────────────────────────────────
    it('shows a data-freshness label once tasks have loaded', async () => {
        const props = createDefaultProps();
        renderWithProviders(<TaskDashboardPage {...props} />);

        await screen.findByText('Overdue follow up call');
        expect(await screen.findByText(/Updated/i)).toBeInTheDocument();
    });

    // ── Task Selection (single render) ──────────────────────────────
    it('updates Job Details header with job ID on task click', async () => {
        const user = setupUser();
        const props = createDefaultProps();
        renderWithProviders(<TaskDashboardPage {...props} />);

        expect(await screen.findByText('Overdue follow up call')).toBeInTheDocument();
        expect(screen.getByText('Job Details')).toBeInTheDocument();

        await user.click(screen.getByText('Overdue follow up call'));

        expect(await screen.findByText(/Job Details - Job #100/)).toBeInTheDocument();
    });

    // ── Error Handling ──────────────────────────────────────────────
    it('handles API errors gracefully', async () => {
        mockTasksApi.getAllTasks.mockRejectedValue(new Error('API Error'));

        const props = createDefaultProps();
        renderWithProviders(<TaskDashboardPage {...props} />);

        expect(await screen.findByRole('radio', {name: /List/i})).toBeInTheDocument();
    });

    // ── Panel header consistency ─────────────────────────────────────
    // The Tasks and Job Details panels now route their headers through the
    // shared gradient PanelHeader instead of a dense Toolbar. Assert by
    // visible header text (per the query-by-text rule) rather than class.
    it('renders the Tasks (n) and Job Details headers via the shared PanelHeader', async () => {
        const props = createDefaultProps();
        renderWithProviders(<TaskDashboardPage {...props} />);

        await screen.findByText('Overdue follow up call');

        expect(screen.getByText(/Tasks \(\d+\)/)).toBeInTheDocument();
        expect(screen.getByText('Job Details')).toBeInTheDocument();
    });

    // ── Auto-refresh: default off ───────────────────────────────────
    it('renders the auto-refresh control defaulting to the 60s cadence', async () => {
        // No stored preference must not mean "never refresh" — nothing pushes task updates.
        const user = setupUser();
        const props = createDefaultProps();
        renderWithProviders(<TaskDashboardPage {...props} />);

        await screen.findByText('Overdue follow up call');
        await user.click(screen.getByRole('button', {name: /^Filters/}));

        expect(await screen.findByRole('combobox', {name: 'Auto-refresh'})).toHaveValue('1 min');
    });

    // ── Auto-refresh: seed from localStorage ────────────────────────
    it('seeds the auto-refresh interval from localStorage', async () => {
        localStorageMock.setStore({'taskDashboardRefreshInterval-1': '30'});

        const user = setupUser();
        const props = createDefaultProps();
        renderWithProviders(<TaskDashboardPage {...props} />);

        await screen.findByText('Overdue follow up call');
        await user.click(screen.getByRole('button', {name: /^Filters/}));

        expect(await screen.findByRole('combobox', {name: 'Auto-refresh'})).toHaveValue('30 seconds');
    });

    // ── Auto-refresh: select an interval, then turn off ─────────────
    it('configures the auto-refresh interval and persists the choice', async () => {
        const user = setupUser();
        const props = createDefaultProps();
        renderWithProviders(<TaskDashboardPage {...props} />);

        await screen.findByText('Overdue follow up call');
        await user.click(screen.getByRole('button', {name: /^Filters/}));

        // Open the Auto-refresh select (showing the 60s default) and pick "2 mins"
        await user.click(await screen.findByRole('combobox', {name: 'Auto-refresh'}));
        await user.click(await screen.findByRole('option', {name: '2 mins'}));

        // Persisted as seconds and reflected on the control
        expect(localStorageMock.setItem).toHaveBeenCalledWith('taskDashboardRefreshInterval-1', '120');
        expect(screen.getByRole('combobox', {name: 'Auto-refresh'})).toHaveValue('2 mins');

        // Turn it off — an explicit choice that must survive the new default
        await user.click(screen.getByRole('combobox', {name: 'Auto-refresh'}));
        await user.click(await screen.findByRole('option', {name: 'Off'}));

        expect(localStorageMock.setItem).toHaveBeenCalledWith('taskDashboardRefreshInterval-1', '0');
        expect(screen.getByRole('combobox', {name: 'Auto-refresh'})).toHaveValue('Off');
    });

    // ── No onTaskSelect prop (bridge removed) ───────────────────────
    it('does not pass selection state through AngularJS bridge', async () => {
        // TaskDashboardPageProps no longer includes onTaskSelect.
        // Selection is managed locally in React and passed directly to JobDetails.
        const props = createDefaultProps();
        expect(props).not.toHaveProperty('onTaskSelect');

        renderWithProviders(<TaskDashboardPage {...props} />);
        await screen.findByText('Overdue follow up call');

        // Job Details panel is present (rendered directly, not via AngularJS)
        expect(screen.getByText('Job Details')).toBeInTheDocument();

        // No "Delivery Journey" panel (replaced by Job Details)
        expect(screen.queryByText('Delivery Journey')).not.toBeInTheDocument();
    });
});
