/**
 * TaskDashboardPage Component Tests
 */

import React from 'react';
import {render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {ThemeProvider, createTheme} from '@mui/material';
import {LocalizationProvider} from '@mui/x-date-pickers/LocalizationProvider';
import {AdapterDayjs} from '@mui/x-date-pickers/AdapterDayjs';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import dayjs from 'dayjs';
import {TaskDashboardPage} from './TaskDashboardPage';
import {TaskDashboardPageProps} from './TaskDashboardPage.interfaces';
import {Task} from '../../interfaces';
import {tasksApi} from '../../services/tasksApi';

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
const localStorageMock = (() => {
    let store: Record<string, string> = {};
    return {
        getItem: jest.fn((key: string) => store[key] || null),
        setItem: jest.fn((key: string, value: string) => {
            store[key] = value;
        }),
        removeItem: jest.fn((key: string) => {
            delete store[key];
        }),
        clear: jest.fn(() => {
            store = {};
        }),
        setStore: (newStore: Record<string, string>) => {
            store = {...newStore};
        },
    };
})();
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
        dueDate: dayjs().add(1, 'day'), // Future task (todo)
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
    onTaskSelect: jest.fn(),
    setRefreshCallback: jest.fn(),
    ...overrides,
});

describe('TaskDashboardPage', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        localStorageMock.setStore({}); // Clear store properly

        // Setup default API responses
        mockTasksApi.getAllTasks.mockResolvedValue(createMockTasks());
        mockTasksApi.getActiveStaff.mockResolvedValue(mockStaff);
        mockTasksApi.getEventTypes.mockResolvedValue(mockEventTypes);
        mockTasksApi.getDeliveryJourney.mockResolvedValue([]);
    });

    describe('Rendering', () => {
        it('renders the page with header and main content', async () => {
            const props = createDefaultProps();
            renderWithProviders(<TaskDashboardPage {...props} />);

            // Should show the view toggle
            expect(screen.getByText('List')).toBeInTheDocument();
            expect(screen.getByText('Calendar')).toBeInTheDocument();

            // Should show status filter buttons
            await waitFor(() => {
                expect(screen.getByRole('button', {name: /Active:/})).toBeInTheDocument();
            });
            expect(screen.getByRole('button', {name: /Overdue:/})).toBeInTheDocument();
            expect(screen.getByRole('button', {name: /Todo:/})).toBeInTheDocument();
            expect(screen.getByRole('button', {name: /Done:/})).toBeInTheDocument();
        });

        it('renders loading state while fetching tasks', async () => {
            // Delay the API response
            mockTasksApi.getAllTasks.mockImplementation(
                () => new Promise((resolve) => setTimeout(() => resolve([]), 100))
            );

            const props = createDefaultProps();
            renderWithProviders(<TaskDashboardPage {...props} />);

            expect(screen.getByRole('progressbar')).toBeInTheDocument();
        });

        it('renders tasks after loading', async () => {
            const props = createDefaultProps();
            renderWithProviders(<TaskDashboardPage {...props} />);

            await waitFor(() => {
                expect(screen.getByText('Overdue follow up call')).toBeInTheDocument();
            });
            expect(screen.getByText('Future email reminder')).toBeInTheDocument();
        });

        it('renders empty state when no tasks match filters', async () => {
            mockTasksApi.getAllTasks.mockResolvedValue([]);

            const props = createDefaultProps();
            renderWithProviders(<TaskDashboardPage {...props} />);

            await waitFor(() => {
                expect(screen.getByText('No tasks match your filters')).toBeInTheDocument();
            });
        });

        it('renders the filters card in list view', async () => {
            const props = createDefaultProps();
            renderWithProviders(<TaskDashboardPage {...props} />);

            await waitFor(() => {
                expect(screen.getByText('Filters')).toBeInTheDocument();
            });

            // Check for search input
            expect(screen.getByRole('textbox', {name: /Search/i})).toBeInTheDocument();
            // Check for Staff and Task Type filter labels (there may be multiple - use getAllByText)
            expect(screen.getAllByText('Staff').length).toBeGreaterThan(0);
            expect(screen.getAllByText('Task Type').length).toBeGreaterThan(0);
        });

        it('renders the delivery journey card', async () => {
            const props = createDefaultProps();
            renderWithProviders(<TaskDashboardPage {...props} />);

            await waitFor(() => {
                expect(screen.getByText(/Delivery Journey/)).toBeInTheDocument();
            });
        });
    });

    describe('Status Filter', () => {
        it('calculates status counts correctly', async () => {
            const props = createDefaultProps();
            renderWithProviders(<TaskDashboardPage {...props} />);

            await waitFor(() => {
                // 2 active tasks (1 overdue + 1 todo), 1 done
                expect(screen.getByRole('button', {name: /Active: 2/})).toBeInTheDocument();
            });
            expect(screen.getByRole('button', {name: /Overdue: 1/})).toBeInTheDocument();
            expect(screen.getByRole('button', {name: /Todo: 1/})).toBeInTheDocument();
            expect(screen.getByRole('button', {name: /Done: 1/})).toBeInTheDocument();
        });

        it('filters tasks by status when clicking status buttons', async () => {
            const user = userEvent.setup();
            const props = createDefaultProps();
            renderWithProviders(<TaskDashboardPage {...props} />);

            await waitFor(() => {
                expect(screen.getByText('Overdue follow up call')).toBeInTheDocument();
            });

            // Click on "Todo" filter
            await user.click(screen.getByRole('button', {name: /Todo:/}));

            await waitFor(() => {
                expect(screen.getByText('Future email reminder')).toBeInTheDocument();
            });
            // Overdue task should not be visible
            expect(screen.queryByText('Overdue follow up call')).not.toBeInTheDocument();
        });

        it('shows only overdue tasks when overdue filter is active', async () => {
            const user = userEvent.setup();
            const props = createDefaultProps();
            renderWithProviders(<TaskDashboardPage {...props} />);

            await waitFor(() => {
                expect(screen.getByText('Overdue follow up call')).toBeInTheDocument();
            });

            // Click on "Overdue" filter
            await user.click(screen.getByRole('button', {name: /Overdue:/}));

            await waitFor(() => {
                expect(screen.getByText('Overdue follow up call')).toBeInTheDocument();
            });
            // Future task should not be visible
            expect(screen.queryByText('Future email reminder')).not.toBeInTheDocument();
        });

        it('shows completed tasks when done filter is active', async () => {
            const user = userEvent.setup();
            const props = createDefaultProps();
            renderWithProviders(<TaskDashboardPage {...props} />);

            await waitFor(() => {
                expect(screen.getByText('Overdue follow up call')).toBeInTheDocument();
            });

            // Click on "Done" filter
            await user.click(screen.getByRole('button', {name: /Done:/}));

            await waitFor(() => {
                expect(screen.getByText('Completed task')).toBeInTheDocument();
            });
            // Active tasks should not be visible
            expect(screen.queryByText('Overdue follow up call')).not.toBeInTheDocument();
            expect(screen.queryByText('Future email reminder')).not.toBeInTheDocument();
        });
    });

    describe('View Mode Toggle', () => {
        it('starts in list view by default', async () => {
            const props = createDefaultProps();
            renderWithProviders(<TaskDashboardPage {...props} />);

            await waitFor(() => {
                expect(screen.getByText('Filters')).toBeInTheDocument();
            });

            // Should show the task list header
            expect(screen.getByText(/Tasks \(/)).toBeInTheDocument();
        });

        it('switches to calendar view when toggle is clicked', async () => {
            const user = userEvent.setup();
            const props = createDefaultProps();
            renderWithProviders(<TaskDashboardPage {...props} />);

            await waitFor(() => {
                expect(screen.getByText('Filters')).toBeInTheDocument();
            });

            // Find and click the switch
            const switchElement = screen.getByRole('checkbox');
            await user.click(switchElement);

            // Filters card should no longer be visible
            await waitFor(() => {
                expect(screen.queryByText('Filters')).not.toBeInTheDocument();
            });
        });

        it('saves view preference to localStorage', async () => {
            const user = userEvent.setup();
            const props = createDefaultProps();
            renderWithProviders(<TaskDashboardPage {...props} />);

            await waitFor(() => {
                expect(screen.getByText('Filters')).toBeInTheDocument();
            });

            const switchElement = screen.getByRole('checkbox');
            await user.click(switchElement);

            expect(localStorageMock.setItem).toHaveBeenCalledWith(
                'taskDashboardViewPreference-1',
                'calendar'
            );
        });

        it('loads view preference from localStorage', async () => {
            // Set up localStorage with calendar view preference
            localStorageMock.setStore({
                'taskDashboardViewPreference-1': 'calendar',
            });

            const props = createDefaultProps();
            renderWithProviders(<TaskDashboardPage {...props} />);

            // Wait for effect to run and set showFullCalendar to true
            await waitFor(() => {
                // Filters should not be visible in calendar view
                expect(screen.queryByText('Filters')).not.toBeInTheDocument();
            });
        });
    });

    describe('Search and Filters', () => {
        it('updates search query on input', async () => {
            const user = userEvent.setup();
            const props = createDefaultProps();
            renderWithProviders(<TaskDashboardPage {...props} />);

            await waitFor(() => {
                expect(screen.getByRole('textbox', {name: /Search/i})).toBeInTheDocument();
            });

            const searchInput = screen.getByRole('textbox', {name: /Search/i});
            await user.type(searchInput, 'follow up');

            expect(searchInput).toHaveValue('follow up');
        });

        it('fetches staff data for dropdown', async () => {
            const props = createDefaultProps();
            renderWithProviders(<TaskDashboardPage {...props} />);

            await waitFor(() => {
                expect(mockTasksApi.getActiveStaff).toHaveBeenCalled();
            });

            // Verify the staff filter is rendered with the label
            expect(screen.getAllByText('Staff').length).toBeGreaterThan(0);
        });

        it('fetches event types data for dropdown', async () => {
            const props = createDefaultProps();
            renderWithProviders(<TaskDashboardPage {...props} />);

            await waitFor(() => {
                expect(mockTasksApi.getEventTypes).toHaveBeenCalled();
            });

            // Verify the task type filter is rendered with the label
            expect(screen.getAllByText('Task Type').length).toBeGreaterThan(0);
        });
    });

    describe('Task Selection', () => {
        it('calls onTaskSelect when a task is clicked', async () => {
            const user = userEvent.setup();
            const props = createDefaultProps();
            renderWithProviders(<TaskDashboardPage {...props} />);

            await waitFor(() => {
                expect(screen.getByText('Overdue follow up call')).toBeInTheDocument();
            });

            // Click on the first task
            await user.click(screen.getByText('Overdue follow up call'));

            expect(props.onTaskSelect).toHaveBeenCalled();
        });

        it('updates delivery journey header when task is selected', async () => {
            const user = userEvent.setup();
            const props = createDefaultProps();
            renderWithProviders(<TaskDashboardPage {...props} />);

            await waitFor(() => {
                expect(screen.getByText('Overdue follow up call')).toBeInTheDocument();
            });

            // Initially no job selected
            expect(screen.getByText(/Delivery Journey$/)).toBeInTheDocument();

            // Click on a task
            await user.click(screen.getByText('Overdue follow up call'));

            await waitFor(() => {
                expect(screen.getByText(/Delivery Journey for Job JOB-100/)).toBeInTheDocument();
            });
        });
    });

    describe('Refresh Callback', () => {
        it('registers refresh callback on mount', async () => {
            const setRefreshCallback = jest.fn();
            const props = createDefaultProps({setRefreshCallback});
            renderWithProviders(<TaskDashboardPage {...props} />);

            await waitFor(() => {
                expect(setRefreshCallback).toHaveBeenCalled();
            });

            // The callback should be a function
            const registeredCallback = setRefreshCallback.mock.calls[0][0];
            expect(typeof registeredCallback).toBe('function');
        });
    });

    describe('API Integration', () => {
        it('calls getAllTasks with correct filters', async () => {
            const props = createDefaultProps();
            renderWithProviders(<TaskDashboardPage {...props} />);

            await waitFor(() => {
                expect(mockTasksApi.getAllTasks).toHaveBeenCalled();
            });

            // Check that showCompleted is true (we always fetch all, then filter client-side)
            const lastCall = mockTasksApi.getAllTasks.mock.calls[0]?.[0];
            expect(lastCall?.showCompleted).toBe(true);
        });

        it('fetches staff list on mount', async () => {
            const props = createDefaultProps();
            renderWithProviders(<TaskDashboardPage {...props} />);

            await waitFor(() => {
                expect(mockTasksApi.getActiveStaff).toHaveBeenCalled();
            });
        });

        it('fetches event types on mount', async () => {
            const props = createDefaultProps();
            renderWithProviders(<TaskDashboardPage {...props} />);

            await waitFor(() => {
                expect(mockTasksApi.getEventTypes).toHaveBeenCalled();
            });
        });
    });

    describe('Error Handling', () => {
        it('handles API errors gracefully', async () => {
            mockTasksApi.getAllTasks.mockRejectedValue(new Error('API Error'));

            const props = createDefaultProps();
            renderWithProviders(<TaskDashboardPage {...props} />);

            // Should not crash, component should still render
            await waitFor(() => {
                expect(screen.getByText('List')).toBeInTheDocument();
            });
        });
    });

    describe('Task Count Display', () => {
        it('displays correct task count in list header', async () => {
            const props = createDefaultProps();
            renderWithProviders(<TaskDashboardPage {...props} />);

            await waitFor(() => {
                // Default filter is "All" which shows active (non-closed) tasks
                // We have 2 active tasks
                expect(screen.getByText('Tasks (2)')).toBeInTheDocument();
            });
        });

        it('updates task count when filter changes', async () => {
            const user = userEvent.setup();
            const props = createDefaultProps();
            renderWithProviders(<TaskDashboardPage {...props} />);

            await waitFor(() => {
                expect(screen.getByText('Tasks (2)')).toBeInTheDocument();
            });

            // Switch to Done filter
            await user.click(screen.getByRole('button', {name: /Done:/}));

            await waitFor(() => {
                expect(screen.getByText('Tasks (1)')).toBeInTheDocument();
            });
        });
    });
});
