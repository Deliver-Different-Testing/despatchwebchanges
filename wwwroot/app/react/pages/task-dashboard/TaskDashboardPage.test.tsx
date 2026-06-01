/**
 * TaskDashboardPage Component Tests
 *
 * Optimised: tests sharing identical setup consolidated into single renders.
 */

import React from 'react';
import {render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {createTheme, ThemeProvider} from '@mui/material/styles';
import {LocalizationProvider} from '@mui/x-date-pickers/LocalizationProvider';
import {AdapterDayjs} from '@mui/x-date-pickers/AdapterDayjs';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import dayjs from 'dayjs';
import {TaskDashboardPage} from './TaskDashboardPage';
import {TaskDashboardPageProps} from './TaskDashboardPage.interfaces';
import {Task} from '../../interfaces';
import {tasksApi} from '../../services/tasksApi';

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
const theme = createTheme();

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

const renderWithProviders = (ui: React.ReactElement, queryClient?: QueryClient) => {
    const client = queryClient || createTestQueryClient();
    return render(
        <QueryClientProvider client={client}>
            <ThemeProvider theme={theme}>
                <LocalizationProvider dateAdapter={AdapterDayjs}>
                    {ui}
                </LocalizationProvider>
            </ThemeProvider>
        </QueryClientProvider>
    );
};

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
        expect(screen.getByRole('button', {name: /List/i})).toBeInTheDocument();
        expect(screen.getByRole('button', {name: /Calendar/i})).toBeInTheDocument();

        // Stat cards with correct counts
        expect(await screen.findByRole('button', {name: /ACTIVE: 2/})).toBeInTheDocument();
        expect(screen.getByRole('button', {name: /OVERDUE: 1/})).toBeInTheDocument();
        expect(screen.getByRole('button', {name: /TODO: 1/})).toBeInTheDocument();
        expect(screen.getByRole('button', {name: /DONE: 1/})).toBeInTheDocument();

        // Tasks rendered after loading
        expect(screen.getByText('Overdue follow up call')).toBeInTheDocument();
        expect(screen.getByText('Future email reminder')).toBeInTheDocument();

        // Inline filter bar
        expect(screen.getByRole('textbox', {name: /Search/i})).toBeInTheDocument();
        expect(screen.getAllByText('Staff').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Task Type').length).toBeGreaterThan(0);

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

        const skeletons = document.querySelectorAll('.MuiSkeleton-root');
        expect(skeletons.length).toBe(4);
    });

    // ── Empty state ─────────────────────────────────────────────────
    it('renders empty state when no tasks match filters', async () => {
        mockTasksApi.getAllTasks.mockResolvedValue([]);

        const props = createDefaultProps();
        renderWithProviders(<TaskDashboardPage {...props} />);

        expect(await screen.findByText('No tasks match your filters')).toBeInTheDocument();
    });

    // ── View Mode Toggle (single render) ────────────────────────────
    it('switches to calendar view, saves preference, and keeps delivery journey', async () => {
        const user = userEvent.setup();
        const props = createDefaultProps();
        renderWithProviders(<TaskDashboardPage {...props} />);

        // Starts in list view
        expect(await screen.findByText(/Tasks \(/)).toBeInTheDocument();

        // Switch to calendar
        await user.click(screen.getByRole('button', {name: /Calendar/i}));

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
    it('filters tasks by status card clicks and updates task count', async () => {
        const user = userEvent.setup();
        const props = createDefaultProps();
        renderWithProviders(<TaskDashboardPage {...props} />);

        expect(await screen.findByText('Overdue follow up call')).toBeInTheDocument();
        expect(screen.getByText('Tasks (2)')).toBeInTheDocument();

        await user.click(screen.getByRole('button', {name: /TODO:/}));
        expect(await screen.findByText('Future email reminder')).toBeInTheDocument();
        expect(screen.queryByText('Overdue follow up call')).not.toBeInTheDocument();

        // Click Overdue → only overdue tasks
        await user.click(screen.getByRole('button', {name: /OVERDUE:/}));
        expect(await screen.findByText('Overdue follow up call')).toBeInTheDocument();
        expect(screen.queryByText('Future email reminder')).not.toBeInTheDocument();

        // Click Done → only completed tasks with "Completed" heading
        await user.click(screen.getByRole('button', {name: /DONE:/}));
        expect(await screen.findByText('Completed task')).toBeInTheDocument();
        expect(screen.getByText('Completed')).toBeInTheDocument();
        expect(screen.queryByText('Overdue follow up call')).not.toBeInTheDocument();
        expect(screen.queryByText('Future email reminder')).not.toBeInTheDocument();
        expect(screen.getByText('Tasks (1)')).toBeInTheDocument();
    });

    // ── Search input ────────────────────────────────────────────────
    it('updates search query on input', async () => {
        const user = userEvent.setup();
        const props = createDefaultProps();
        renderWithProviders(<TaskDashboardPage {...props} />);

        const searchInput = await screen.findByRole('textbox', {name: /Search/i});
        await user.click(searchInput);
        await user.paste('follow up');

        expect(searchInput).toHaveValue('follow up');
    });

    // ── Task Selection (single render) ──────────────────────────────
    it('updates Job Details header with job ID on task click', async () => {
        const user = userEvent.setup();
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

        expect(await screen.findByRole('button', {name: /List/i})).toBeInTheDocument();
    });

    // ── Job Details card header consistency ──────────────────────────
    it('renders Job Details header with same style as other card headers on the page', async () => {
        const props = createDefaultProps();
        const {container} = renderWithProviders(<TaskDashboardPage {...props} />);

        await screen.findByText('Overdue follow up call');

        // Collect all toolbar elements on the page
        const toolbars = container.querySelectorAll('[class*="MuiToolbar-dense"]');
        expect(toolbars.length).toBeGreaterThanOrEqual(2); // Tasks header + Job Details header

        // Find the Job Details toolbar and the Tasks toolbar
        const jobDetailsToolbar = Array.from(toolbars).find(tb =>
            tb.textContent?.includes('Job Details')
        );
        const tasksToolbar = Array.from(toolbars).find(tb =>
            tb.textContent?.includes('Tasks (')
        );

        expect(jobDetailsToolbar).toBeInTheDocument();
        expect(tasksToolbar).toBeInTheDocument();

        // Both should use the same MUI variant class (dense toolbar)
        const jobDetailsClasses = jobDetailsToolbar!.className;
        const tasksClasses = tasksToolbar!.className;
        expect(jobDetailsClasses).toContain('MuiToolbar-dense');
        expect(tasksClasses).toContain('MuiToolbar-dense');
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
