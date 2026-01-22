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

    describe('Grid Layout', () => {
        describe('Layout Controls', () => {
            // Layout lock/reset controls only appear for custom layouts, not the default layout
            it('does not render layout controls for default layout', async () => {
                const props = createDefaultProps();
                renderWithProviders(<TaskDashboardPage {...props} />);

                await waitFor(() => {
                    expect(screen.getByText('Filters')).toBeInTheDocument();
                });

                // Lock and reset buttons should NOT be present for default layout
                expect(screen.queryByRole('button', {name: /Unlock layout to edit/i})).not.toBeInTheDocument();
                expect(screen.queryByRole('button', {name: /Reset layout to default/i})).not.toBeInTheDocument();
            });

            it.skip('renders layout lock button for custom layouts', async () => {
                // Set up localStorage with a custom layout as active
                const savedLayouts = {
                    layouts: [{
                        name: 'My Custom',
                        listLayouts: {
                            lg: [{i: 'filters', x: 0, y: 0, w: 6, h: 3, minW: 3, minH: 2}],
                            md: [{i: 'filters', x: 0, y: 0, w: 6, h: 3, minW: 3, minH: 2}],
                            sm: [{i: 'filters', x: 0, y: 0, w: 12, h: 3, minW: 6, minH: 2}],
                        },
                        calendarLayouts: {
                            lg: [{i: 'calendar', x: 0, y: 0, w: 6, h: 12, minW: 4, minH: 6}],
                            md: [{i: 'calendar', x: 0, y: 0, w: 6, h: 12, minW: 4, minH: 6}],
                            sm: [{i: 'calendar', x: 0, y: 0, w: 12, h: 8, minW: 6, minH: 6}],
                        },
                        isDefault: false,
                    }],
                    activeLayoutName: 'My Custom',
                };
                localStorageMock.setStore({
                    'taskDashboardSavedLayouts-1': JSON.stringify(savedLayouts),
                });

                const props = createDefaultProps();
                renderWithProviders(<TaskDashboardPage {...props} />);

                await waitFor(() => {
                    expect(screen.getByRole('button', {name: /Unlock layout to edit/i})).toBeInTheDocument();
                });
            });

            it.skip('renders reset layout button for custom layouts', async () => {
                const savedLayouts = {
                    layouts: [{
                        name: 'My Custom',
                        listLayouts: {
                            lg: [{i: 'filters', x: 0, y: 0, w: 6, h: 3, minW: 3, minH: 2}],
                            md: [{i: 'filters', x: 0, y: 0, w: 6, h: 3, minW: 3, minH: 2}],
                            sm: [{i: 'filters', x: 0, y: 0, w: 12, h: 3, minW: 6, minH: 2}],
                        },
                        calendarLayouts: {
                            lg: [{i: 'calendar', x: 0, y: 0, w: 6, h: 12, minW: 4, minH: 6}],
                            md: [{i: 'calendar', x: 0, y: 0, w: 6, h: 12, minW: 4, minH: 6}],
                            sm: [{i: 'calendar', x: 0, y: 0, w: 12, h: 8, minW: 6, minH: 6}],
                        },
                        isDefault: false,
                    }],
                    activeLayoutName: 'My Custom',
                };
                localStorageMock.setStore({
                    'taskDashboardSavedLayouts-1': JSON.stringify(savedLayouts),
                });

                const props = createDefaultProps();
                renderWithProviders(<TaskDashboardPage {...props} />);

                await waitFor(() => {
                    expect(screen.getByRole('button', {name: /Reset layout to default/i})).toBeInTheDocument();
                });
            });

            it.skip('starts custom layout with locked state', async () => {
                const savedLayouts = {
                    layouts: [{
                        name: 'My Custom',
                        listLayouts: {
                            lg: [{i: 'filters', x: 0, y: 0, w: 6, h: 3, minW: 3, minH: 2}],
                            md: [{i: 'filters', x: 0, y: 0, w: 6, h: 3, minW: 3, minH: 2}],
                            sm: [{i: 'filters', x: 0, y: 0, w: 12, h: 3, minW: 6, minH: 2}],
                        },
                        calendarLayouts: {
                            lg: [{i: 'calendar', x: 0, y: 0, w: 6, h: 12, minW: 4, minH: 6}],
                            md: [{i: 'calendar', x: 0, y: 0, w: 6, h: 12, minW: 4, minH: 6}],
                            sm: [{i: 'calendar', x: 0, y: 0, w: 12, h: 8, minW: 6, minH: 6}],
                        },
                        isDefault: false,
                    }],
                    activeLayoutName: 'My Custom',
                };
                localStorageMock.setStore({
                    'taskDashboardSavedLayouts-1': JSON.stringify(savedLayouts),
                });

                const props = createDefaultProps();
                renderWithProviders(<TaskDashboardPage {...props} />);

                await waitFor(() => {
                    // Lock icon should be visible (layout is locked)
                    expect(screen.getByRole('button', {name: /Unlock layout to edit/i})).toBeInTheDocument();
                });
            });

            it.skip('toggles layout lock when lock button is clicked', async () => {
                const user = userEvent.setup();
                const savedLayouts = {
                    layouts: [{
                        name: 'My Custom',
                        listLayouts: {
                            lg: [{i: 'filters', x: 0, y: 0, w: 6, h: 3, minW: 3, minH: 2}],
                            md: [{i: 'filters', x: 0, y: 0, w: 6, h: 3, minW: 3, minH: 2}],
                            sm: [{i: 'filters', x: 0, y: 0, w: 12, h: 3, minW: 6, minH: 2}],
                        },
                        calendarLayouts: {
                            lg: [{i: 'calendar', x: 0, y: 0, w: 6, h: 12, minW: 4, minH: 6}],
                            md: [{i: 'calendar', x: 0, y: 0, w: 6, h: 12, minW: 4, minH: 6}],
                            sm: [{i: 'calendar', x: 0, y: 0, w: 12, h: 8, minW: 6, minH: 6}],
                        },
                        isDefault: false,
                    }],
                    activeLayoutName: 'My Custom',
                };
                localStorageMock.setStore({
                    'taskDashboardSavedLayouts-1': JSON.stringify(savedLayouts),
                });

                const props = createDefaultProps();
                renderWithProviders(<TaskDashboardPage {...props} />);

                await waitFor(() => {
                    expect(screen.getByRole('button', {name: /Unlock layout to edit/i})).toBeInTheDocument();
                });

                // Click to unlock
                await user.click(screen.getByRole('button', {name: /Unlock layout to edit/i}));

                // Should now show "lock layout" aria-label (unlocked state)
                await waitFor(() => {
                    expect(screen.getByRole('button', {name: /Lock layout/i})).toBeInTheDocument();
                });

                // Show toast when unlocking
                expect(props.showToast).toHaveBeenCalledWith(
                    'Layout unlocked - drag widgets to rearrange',
                    'info'
                );
            });

            it.skip('shows toast when locking layout', async () => {
                const user = userEvent.setup();
                const savedLayouts = {
                    layouts: [{
                        name: 'My Custom',
                        listLayouts: {
                            lg: [{i: 'filters', x: 0, y: 0, w: 6, h: 3, minW: 3, minH: 2}],
                            md: [{i: 'filters', x: 0, y: 0, w: 6, h: 3, minW: 3, minH: 2}],
                            sm: [{i: 'filters', x: 0, y: 0, w: 12, h: 3, minW: 6, minH: 2}],
                        },
                        calendarLayouts: {
                            lg: [{i: 'calendar', x: 0, y: 0, w: 6, h: 12, minW: 4, minH: 6}],
                            md: [{i: 'calendar', x: 0, y: 0, w: 6, h: 12, minW: 4, minH: 6}],
                            sm: [{i: 'calendar', x: 0, y: 0, w: 12, h: 8, minW: 6, minH: 6}],
                        },
                        isDefault: false,
                    }],
                    activeLayoutName: 'My Custom',
                };
                localStorageMock.setStore({
                    'taskDashboardSavedLayouts-1': JSON.stringify(savedLayouts),
                });

                const props = createDefaultProps();
                renderWithProviders(<TaskDashboardPage {...props} />);

                await waitFor(() => {
                    expect(screen.getByRole('button', {name: /Unlock layout to edit/i})).toBeInTheDocument();
                });

                // Click to unlock first
                await user.click(screen.getByRole('button', {name: /Unlock layout to edit/i}));

                await waitFor(() => {
                    expect(screen.getByRole('button', {name: /Lock layout/i})).toBeInTheDocument();
                });

                // Click to lock again
                await user.click(screen.getByRole('button', {name: /Lock layout/i}));

                expect(props.showToast).toHaveBeenCalledWith('Layout locked', 'info');
            });
        });

        describe('Reset Layout', () => {
            it('resets layout to default when reset button is clicked', async () => {
                const user = userEvent.setup();
                const savedLayouts = {
                    layouts: [{
                        name: 'My Custom',
                        listLayouts: {
                            lg: [{i: 'filters', x: 0, y: 0, w: 4, h: 2, minW: 3, minH: 2}],
                            md: [{i: 'filters', x: 0, y: 0, w: 4, h: 2, minW: 3, minH: 2}],
                            sm: [{i: 'filters', x: 0, y: 0, w: 12, h: 3, minW: 6, minH: 2}],
                        },
                        calendarLayouts: {
                            lg: [{i: 'calendar', x: 0, y: 0, w: 6, h: 12, minW: 4, minH: 6}],
                            md: [{i: 'calendar', x: 0, y: 0, w: 6, h: 12, minW: 4, minH: 6}],
                            sm: [{i: 'calendar', x: 0, y: 0, w: 12, h: 8, minW: 6, minH: 6}],
                        },
                        isDefault: false,
                    }],
                    activeLayoutName: 'My Custom',
                };
                localStorageMock.setStore({
                    'taskDashboardSavedLayouts-1': JSON.stringify(savedLayouts),
                });

                const props = createDefaultProps();
                renderWithProviders(<TaskDashboardPage {...props} />);

                await waitFor(() => {
                    expect(screen.getByRole('button', {name: /Reset layout to default/i})).toBeInTheDocument();
                });

                // Click reset button
                await user.click(screen.getByRole('button', {name: /Reset layout to default/i}));

                // Should show success toast
                expect(props.showToast).toHaveBeenCalledWith('Layout reset to default', 'success');
            });

            it('updates saved layout in localStorage when reset', async () => {
                const user = userEvent.setup();
                const savedLayouts = {
                    layouts: [{
                        name: 'My Custom',
                        listLayouts: {
                            lg: [{i: 'filters', x: 0, y: 0, w: 4, h: 2, minW: 3, minH: 2}],
                            md: [{i: 'filters', x: 0, y: 0, w: 4, h: 2, minW: 3, minH: 2}],
                            sm: [{i: 'filters', x: 0, y: 0, w: 12, h: 3, minW: 6, minH: 2}],
                        },
                        calendarLayouts: {
                            lg: [{i: 'calendar', x: 0, y: 0, w: 6, h: 12, minW: 4, minH: 6}],
                            md: [{i: 'calendar', x: 0, y: 0, w: 6, h: 12, minW: 4, minH: 6}],
                            sm: [{i: 'calendar', x: 0, y: 0, w: 12, h: 8, minW: 6, minH: 6}],
                        },
                        isDefault: false,
                    }],
                    activeLayoutName: 'My Custom',
                };
                localStorageMock.setStore({
                    'taskDashboardSavedLayouts-1': JSON.stringify(savedLayouts),
                });

                const props = createDefaultProps();
                renderWithProviders(<TaskDashboardPage {...props} />);

                await waitFor(() => {
                    expect(screen.getByRole('button', {name: /Reset layout to default/i})).toBeInTheDocument();
                });

                // Clear previous setItem calls
                localStorageMock.setItem.mockClear();

                // Click reset button
                await user.click(screen.getByRole('button', {name: /Reset layout to default/i}));

                // Should update the layout in localStorage
                expect(localStorageMock.setItem).toHaveBeenCalledWith(
                    'taskDashboardSavedLayouts-1',
                    expect.any(String)
                );
            });
        });

        describe('Layout Persistence', () => {
            it('loads saved layouts from localStorage on mount', async () => {
                const savedLayouts = {
                    layouts: [{
                        name: 'My Custom',
                        listLayouts: {
                            lg: [{i: 'filters', x: 0, y: 0, w: 4, h: 2, minW: 3, minH: 2}],
                            md: [{i: 'filters', x: 0, y: 0, w: 4, h: 2, minW: 3, minH: 2}],
                            sm: [{i: 'filters', x: 0, y: 0, w: 12, h: 3, minW: 6, minH: 2}],
                        },
                        calendarLayouts: {
                            lg: [{i: 'calendar', x: 0, y: 0, w: 6, h: 12, minW: 4, minH: 6}],
                            md: [{i: 'calendar', x: 0, y: 0, w: 6, h: 12, minW: 4, minH: 6}],
                            sm: [{i: 'calendar', x: 0, y: 0, w: 12, h: 8, minW: 6, minH: 6}],
                        },
                        isDefault: false,
                    }],
                    activeLayoutName: 'My Custom',
                };

                localStorageMock.setStore({
                    'taskDashboardSavedLayouts-1': JSON.stringify(savedLayouts),
                });

                const props = createDefaultProps();
                renderWithProviders(<TaskDashboardPage {...props} />);

                await waitFor(() => {
                    expect(localStorageMock.getItem).toHaveBeenCalledWith(
                        'taskDashboardSavedLayouts-1'
                    );
                });
            });

            it('uses default layout when no saved layout exists', async () => {
                localStorageMock.setStore({});

                const props = createDefaultProps();
                renderWithProviders(<TaskDashboardPage {...props} />);

                await waitFor(() => {
                    // Should attempt to load from localStorage
                    expect(localStorageMock.getItem).toHaveBeenCalledWith(
                        'taskDashboardSavedLayouts-1'
                    );
                });

                // Component should still render with default layout
                expect(screen.getByText('Filters')).toBeInTheDocument();
            });

            it('handles corrupted localStorage data gracefully', async () => {
                localStorageMock.setStore({
                    'taskDashboardSavedLayouts-1': 'invalid-json-{{{',
                });

                const props = createDefaultProps();

                // Should not throw, component should render with default layout
                renderWithProviders(<TaskDashboardPage {...props} />);

                await waitFor(() => {
                    expect(screen.getByText('Filters')).toBeInTheDocument();
                });
            });
        });

        describe('Widget Rendering', () => {
            it('renders all widgets in list view', async () => {
                const props = createDefaultProps();
                renderWithProviders(<TaskDashboardPage {...props} />);

                await waitFor(() => {
                    // Filters widget
                    expect(screen.getByText('Filters')).toBeInTheDocument();
                    // Tasks widget
                    expect(screen.getByText(/Tasks \(/)).toBeInTheDocument();
                    // Delivery Journey widget
                    expect(screen.getByText(/Delivery Journey/)).toBeInTheDocument();
                });
            });

            it('renders calendar and delivery journey widgets in calendar view', async () => {
                const user = userEvent.setup();
                const props = createDefaultProps();
                renderWithProviders(<TaskDashboardPage {...props} />);

                await waitFor(() => {
                    expect(screen.getByText('Filters')).toBeInTheDocument();
                });

                // Switch to calendar view
                const switchElement = screen.getByRole('checkbox');
                await user.click(switchElement);

                await waitFor(() => {
                    // Filters widget should not be visible in calendar view
                    expect(screen.queryByText('Filters')).not.toBeInTheDocument();
                });

                // Delivery Journey widget should still be visible
                expect(screen.getByText(/Delivery Journey/)).toBeInTheDocument();

                // Tasks list should not be visible (it's replaced by calendar)
                expect(screen.queryByText(/Tasks \(/)).not.toBeInTheDocument();
            });

            it.skip('shows drag handles when layout is unlocked on custom layout', async () => {
                const user = userEvent.setup();
                const savedLayouts = {
                    layouts: [{
                        name: 'My Custom',
                        listLayouts: {
                            lg: [
                                {i: 'filters', x: 0, y: 0, w: 6, h: 3, minW: 3, minH: 2},
                                {i: 'tasks', x: 0, y: 3, w: 6, h: 9, minW: 3, minH: 4},
                                {i: 'deliveryJourney', x: 6, y: 0, w: 6, h: 12, minW: 3, minH: 4},
                            ],
                            md: [
                                {i: 'filters', x: 0, y: 0, w: 6, h: 3, minW: 3, minH: 2},
                                {i: 'tasks', x: 0, y: 3, w: 6, h: 9, minW: 3, minH: 4},
                                {i: 'deliveryJourney', x: 6, y: 0, w: 6, h: 12, minW: 3, minH: 4},
                            ],
                            sm: [
                                {i: 'filters', x: 0, y: 0, w: 12, h: 3, minW: 6, minH: 2},
                                {i: 'tasks', x: 0, y: 3, w: 12, h: 6, minW: 6, minH: 4},
                                {i: 'deliveryJourney', x: 0, y: 9, w: 12, h: 6, minW: 6, minH: 4},
                            ],
                        },
                        calendarLayouts: {
                            lg: [{i: 'calendar', x: 0, y: 0, w: 6, h: 12, minW: 4, minH: 6}],
                            md: [{i: 'calendar', x: 0, y: 0, w: 6, h: 12, minW: 4, minH: 6}],
                            sm: [{i: 'calendar', x: 0, y: 0, w: 12, h: 8, minW: 6, minH: 6}],
                        },
                        isDefault: false,
                    }],
                    activeLayoutName: 'My Custom',
                };
                localStorageMock.setStore({
                    'taskDashboardSavedLayouts-1': JSON.stringify(savedLayouts),
                });

                const props = createDefaultProps();
                renderWithProviders(<TaskDashboardPage {...props} />);

                await waitFor(() => {
                    expect(screen.getByRole('button', {name: /Unlock layout to edit/i})).toBeInTheDocument();
                });

                // Verify no drag handles initially (locked state)
                expect(screen.queryAllByTestId('DragIndicatorIcon').length).toBe(0);

                // Unlock the layout
                await user.click(screen.getByRole('button', {name: /Unlock layout to edit/i}));

                await waitFor(() => {
                    // Should show lock button now (unlocked state)
                    expect(screen.getByRole('button', {name: /Lock layout/i})).toBeInTheDocument();
                });

                // Drag indicator icons should now be visible (one per widget in list view: filters, tasks, deliveryJourney = 3)
                await waitFor(() => {
                    const dragIndicators = screen.getAllByTestId('DragIndicatorIcon');
                    expect(dragIndicators.length).toBe(3);
                });
            });

            it('hides drag handles when layout is locked', async () => {
                const props = createDefaultProps();
                renderWithProviders(<TaskDashboardPage {...props} />);

                await waitFor(() => {
                    expect(screen.getByText('Filters')).toBeInTheDocument();
                });

                // Default layout is always locked, so drag indicator icons should not be visible
                const dragIndicators = screen.queryAllByTestId('DragIndicatorIcon');
                expect(dragIndicators.length).toBe(0);
            });
        });

        describe('Layout Change Handling', () => {
            it('does not save layout changes when layout is locked', async () => {
                const props = createDefaultProps();
                renderWithProviders(<TaskDashboardPage {...props} />);

                await waitFor(() => {
                    expect(screen.getByText('Filters')).toBeInTheDocument();
                });

                // Clear any previous calls
                localStorageMock.setItem.mockClear();

                // Component renders with locked layout - no layout changes should be saved
                // (The grid layout component won't trigger onLayoutChange when isDraggable is false)
                expect(localStorageMock.setItem).not.toHaveBeenCalledWith(
                    'taskDashboardLayout-list-1',
                    expect.any(String)
                );
            });
        });

        describe('View Mode Layout Switching', () => {
            it('switches to calendar layout when view mode changes to calendar', async () => {
                const user = userEvent.setup();
                const props = createDefaultProps();
                renderWithProviders(<TaskDashboardPage {...props} />);

                await waitFor(() => {
                    expect(screen.getByText('Filters')).toBeInTheDocument();
                });

                // Switch to calendar view
                const switchElement = screen.getByRole('checkbox');
                await user.click(switchElement);

                await waitFor(() => {
                    // Filters widget should not be visible in calendar view
                    expect(screen.queryByText('Filters')).not.toBeInTheDocument();
                });

                // Delivery Journey widget should still be visible
                expect(screen.getByText(/Delivery Journey/)).toBeInTheDocument();
            });

            it('switches to list layout when view mode changes to list', async () => {
                const user = userEvent.setup();
                const props = createDefaultProps();
                renderWithProviders(<TaskDashboardPage {...props} />);

                await waitFor(() => {
                    expect(screen.getByText('Filters')).toBeInTheDocument();
                });

                // First switch to calendar view
                const switchElement = screen.getByRole('checkbox');
                await user.click(switchElement);

                await waitFor(() => {
                    // Verify we're in calendar view - Filters should not be visible
                    expect(screen.queryByText('Filters')).not.toBeInTheDocument();
                });

                // Now switch back to list view
                await user.click(switchElement);

                await waitFor(() => {
                    // Filters widget should now be visible again
                    expect(screen.getByText('Filters')).toBeInTheDocument();
                });

                // Tasks list should be visible in list view
                expect(screen.getByText(/Tasks \(/)).toBeInTheDocument();
            });
        });
    });
});
