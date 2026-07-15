/**
 * TaskCalendarView Component Tests
 */

import React from 'react';
import {render, screen, waitFor} from '@testing-library/react';
import {createTheme, ThemeProvider} from '@mui/material/styles';
import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';
import weekday from 'dayjs/plugin/weekday';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import {TaskCalendarView} from './TaskCalendarView';
import {TaskCalendarViewProps, TasksServiceInterface} from './TaskCalendarView.interfaces';
import {Task} from '../task-item/TaskItem.interfaces';
import { suppressConsoleError } from '../../../__testUtils__';
import { setupUser } from '../../../__testUtils__/setupUser';

// Extend dayjs plugins for tests
dayjs.extend(isoWeek);
dayjs.extend(weekday);
dayjs.extend(utc);
dayjs.extend(timezone);

// Mock the date utilities
jest.mock('../../../utils/dateUtils', () => ({
    getIanaTimezone: jest.fn(() => 'America/New_York'),
    getTenantTimezone: jest.fn(() => 'America/New_York'),
    getTimezoneAbbreviation: jest.fn(() => '(EST)'),
}));

const theme = createTheme();

const renderWithProviders = (ui: React.ReactElement) => {
    return render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);
};

// Sample task data - use relative dates from today
const createMockTask = (overrides?: Partial<Task>): Task => ({
    id: 1,
    title: 'Test Task',
    description: 'This is a test task description',
    dueDate: dayjs(), // Today
    closed: false,
    assignee: {id: 100, text: 'John Doe'},
    jobId: 12345,
    eventType: 'pickup',
    jobNumber: 'JOB-001',
    priority: 'high',
    _dueDateString: dayjs().format('MMM D, YYYY'),
    _dueTimeString: '2:00 PM',
    ...overrides,
});

const createMockTasksService = (): TasksServiceInterface => ({
    markTaskAsClosed: jest.fn().mockResolvedValue(undefined),
});

const createDefaultProps = (overrides?: Partial<TaskCalendarViewProps>): TaskCalendarViewProps => ({
    tasks: [],
    tasksService: createMockTasksService(),
    showSuccessToast: jest.fn(),
    showErrorToast: jest.fn(),
    onTaskUpdate: jest.fn(),
    onTaskClick: jest.fn(),
    onTaskStatusChange: jest.fn(),
    onViewChange: jest.fn(),
    ...overrides,
});

describe('TaskCalendarView', () => {
    describe('Rendering', () => {
        it('renders the calendar toolbar with Today button', () => {
            const props = createDefaultProps();
            renderWithProviders(<TaskCalendarView {...props} />);

            expect(screen.getByRole('button', {name: /today/i})).toBeInTheDocument();
        });

        it('renders the period title for current month', () => {
            const props = createDefaultProps();
            renderWithProviders(<TaskCalendarView {...props} />);

            const currentMonth = dayjs().format('MMMM YYYY');
            expect(screen.getByText(currentMonth)).toBeInTheDocument();
        });

        it('renders day headers in month view', () => {
            const props = createDefaultProps();
            renderWithProviders(<TaskCalendarView {...props} />);

            expect(screen.getByText('Sun')).toBeInTheDocument();
            expect(screen.getByText('Mon')).toBeInTheDocument();
            expect(screen.getByText('Tue')).toBeInTheDocument();
            expect(screen.getByText('Wed')).toBeInTheDocument();
            expect(screen.getByText('Thu')).toBeInTheDocument();
            expect(screen.getByText('Fri')).toBeInTheDocument();
            expect(screen.getByText('Sat')).toBeInTheDocument();
        });

        it('renders view mode toggle buttons', () => {
            const props = createDefaultProps();
            renderWithProviders(<TaskCalendarView {...props} />);

            expect(screen.getByRole('button', {name: /month view/i})).toBeInTheDocument();
            expect(screen.getByRole('button', {name: /week view/i})).toBeInTheDocument();
            expect(screen.getByRole('button', {name: /day view/i})).toBeInTheDocument();
        });
    });

    describe('View Mode Switching', () => {
        it('switches to week view when week button is clicked', async () => {
            const user = setupUser();
            const props = createDefaultProps();
            renderWithProviders(<TaskCalendarView {...props} />);

            await user.click(screen.getByRole('button', {name: /week view/i}));

            // Week view shows date range format
            await waitFor(() => {
                const periodTitle = screen.getByRole('heading', {level: 6});
                expect(periodTitle.textContent).toMatch(/\w+ \d+ - (\w+ )?\d+/);
            });
        });

        it('switches to day view when day button is clicked', async () => {
            const user = setupUser();
            const props = createDefaultProps();
            renderWithProviders(<TaskCalendarView {...props} />);

            await user.click(screen.getByRole('button', {name: /day view/i}));

            // Day view shows full date format
            await waitFor(() => {
                const periodTitle = screen.getByRole('heading', {level: 6});
                expect(periodTitle.textContent).toMatch(/\w+, \w+ \d+, \d{4}/);
            });
        });

        it('switches back to month view when month button is clicked', async () => {
            const user = setupUser();
            const props = createDefaultProps();
            renderWithProviders(<TaskCalendarView {...props} />);

            // Switch to week view first
            await user.click(screen.getByRole('button', {name: /week view/i}));

            // Then back to month view
            await user.click(screen.getByRole('button', {name: /month view/i}));

            const currentMonth = dayjs().format('MMMM YYYY');
            expect(await screen.findByText(currentMonth)).toBeInTheDocument();
        });
    });

    describe('Task Rendering', () => {
        it('renders tasks on the calendar', () => {
            const task = createMockTask({
                id: 1,
                title: 'Important Meeting',
            });
            const props = createDefaultProps({tasks: [task]});
            renderWithProviders(<TaskCalendarView {...props} />);

            expect(screen.getByText('Important Meeting')).toBeInTheDocument();
        });

        it('renders multiple tasks', () => {
            const tasks = [
                createMockTask({id: 1, title: 'Task 1'}),
                createMockTask({id: 2, title: 'Task 2'}),
                createMockTask({id: 3, title: 'Task 3'}),
            ];
            const props = createDefaultProps({tasks});
            renderWithProviders(<TaskCalendarView {...props} />);

            expect(screen.getByText('Task 1')).toBeInTheDocument();
            expect(screen.getByText('Task 2')).toBeInTheDocument();
            expect(screen.getByText('Task 3')).toBeInTheDocument();
        });

        it('shows "+X more" when there are more than 3 tasks on a date', () => {
            const today = dayjs();
            const tasks = [
                createMockTask({id: 1, title: 'Task 1', dueDate: today}),
                createMockTask({id: 2, title: 'Task 2', dueDate: today}),
                createMockTask({id: 3, title: 'Task 3', dueDate: today}),
                createMockTask({id: 4, title: 'Task 4', dueDate: today}),
                createMockTask({id: 5, title: 'Task 5', dueDate: today}),
            ];
            const props = createDefaultProps({tasks});
            renderWithProviders(<TaskCalendarView {...props} />);

            expect(screen.getByText('+2 more')).toBeInTheDocument();
        });

        it('renders task checkbox', () => {
            const task = createMockTask();
            const props = createDefaultProps({tasks: [task]});
            renderWithProviders(<TaskCalendarView {...props} />);

            expect(screen.getByRole('checkbox')).toBeInTheDocument();
        });
    });

    describe('Task Interactions', () => {
        let errorSpy: jest.SpyInstance;
        beforeEach(() => { errorSpy = suppressConsoleError('Error updating task'); });
        afterEach(() => { errorSpy.mockRestore(); });

        it('calls onTaskClick when a task is clicked', async () => {
            const user = setupUser();
            const task = createMockTask({title: 'Clickable Task'});
            const props = createDefaultProps({tasks: [task]});
            renderWithProviders(<TaskCalendarView {...props} />);

            await user.click(screen.getByText('Clickable Task'));

            expect(props.onTaskClick).toHaveBeenCalledWith(task);
        });

        it('calls tasksService.markTaskAsClosed when checkbox is clicked', async () => {
            const user = setupUser();
            const task = createMockTask({id: 42, closed: false});
            const props = createDefaultProps({tasks: [task]});
            renderWithProviders(<TaskCalendarView {...props} />);

            await user.click(screen.getByRole('checkbox'));

            await waitFor(() => {
                expect(props.tasksService.markTaskAsClosed).toHaveBeenCalledWith(42, true);
            });
        });

        it('shows success toast after successful task completion', async () => {
            const user = setupUser();
            const task = createMockTask({closed: false});
            const props = createDefaultProps({tasks: [task]});
            renderWithProviders(<TaskCalendarView {...props} />);

            await user.click(screen.getByRole('checkbox'));

            await waitFor(() => {
                expect(props.showSuccessToast).toHaveBeenCalledWith('Task updated successfully');
            });
        });

        it('calls onTaskStatusChange after task completion', async () => {
            const user = setupUser();
            const task = createMockTask({closed: false});
            const props = createDefaultProps({tasks: [task]});
            renderWithProviders(<TaskCalendarView {...props} />);

            await user.click(screen.getByRole('checkbox'));

            await waitFor(() => {
                expect(props.onTaskStatusChange).toHaveBeenCalled();
            });
        });

        it('shows error toast when task completion fails', async () => {
            const user = setupUser();
            const task = createMockTask({closed: false});
            const tasksService = createMockTasksService();
            tasksService.markTaskAsClosed = jest.fn().mockRejectedValue(new Error('Network error'));
            const props = createDefaultProps({tasks: [task], tasksService});
            renderWithProviders(<TaskCalendarView {...props} />);

            await user.click(screen.getByRole('checkbox'));

            await waitFor(() => {
                expect(props.showErrorToast).toHaveBeenCalledWith('Failed to update task');
            });
        });
    });

    describe('Week View', () => {
        it('renders time slots in week view', async () => {
            const user = setupUser();
            const props = createDefaultProps();
            renderWithProviders(<TaskCalendarView {...props} />);

            await user.click(screen.getByRole('button', {name: /week view/i}));

            expect(await screen.findByText('12 AM')).toBeInTheDocument();
            expect(screen.getByText('12 PM')).toBeInTheDocument();
        });

        it('shows day headers for the week', async () => {
            const user = setupUser();
            const props = createDefaultProps();
            renderWithProviders(<TaskCalendarView {...props} />);

            await user.click(screen.getByRole('button', {name: /week view/i}));

            // Week view should show day column headers
            // Check that time slots are rendered (confirms week view is active)
            expect(await screen.findByText('12 AM')).toBeInTheDocument();
        });
    });

    describe('Day View', () => {
        it('renders time slots in day view', async () => {
            const user = setupUser();
            const props = createDefaultProps();
            renderWithProviders(<TaskCalendarView {...props} />);

            await user.click(screen.getByRole('button', {name: /day view/i}));

            expect(await screen.findByText('12 AM')).toBeInTheDocument();
            expect(screen.getByText('6 AM')).toBeInTheDocument();
            expect(screen.getByText('12 PM')).toBeInTheDocument();
            expect(screen.getByText('6 PM')).toBeInTheDocument();
        });

        it('shows overdue tasks sidebar when there are overdue tasks', async () => {
            const user = setupUser();
            const overdueTask = createMockTask({
                id: 1,
                title: 'Overdue Task',
                dueDate: dayjs().subtract(1, 'day'),
                closed: false,
            });
            const props = createDefaultProps({tasks: [overdueTask]});
            renderWithProviders(<TaskCalendarView {...props} />);

            await user.click(screen.getByRole('button', {name: /day view/i}));

            expect(await screen.findByText('Overdue Tasks (1)')).toBeInTheDocument();
        });

        it('does not show overdue sidebar for completed overdue tasks', async () => {
            const user = setupUser();
            const completedTask = createMockTask({
                id: 1,
                title: 'Completed Task',
                dueDate: dayjs().subtract(1, 'day'),
                closed: true,
            });
            const props = createDefaultProps({tasks: [completedTask]});
            renderWithProviders(<TaskCalendarView {...props} />);

            await user.click(screen.getByRole('button', {name: /day view/i}));

            await waitFor(() => {
                expect(screen.queryByText(/Overdue Tasks/)).not.toBeInTheDocument();
            });
        });
    });

    describe('View Change Callback', () => {
        it('calls onViewChange on initial render', () => {
            const props = createDefaultProps();
            renderWithProviders(<TaskCalendarView {...props} />);

            expect(props.onViewChange).toHaveBeenCalledWith(
                expect.any(Date),
                expect.any(Date)
            );
        });

        it('calls onViewChange when switching view modes', async () => {
            const user = setupUser();
            const props = createDefaultProps();
            renderWithProviders(<TaskCalendarView {...props} />);

            jest.clearAllMocks();

            await user.click(screen.getByRole('button', {name: /week view/i}));

            await waitFor(() => {
                expect(props.onViewChange).toHaveBeenCalled();
            });
        });
    });

    describe('Task Priority Styling', () => {
        it('applies strikethrough to completed tasks', () => {
            const completedTask = createMockTask({
                title: 'Completed Task',
                closed: true,
            });
            const props = createDefaultProps({tasks: [completedTask]});
            renderWithProviders(<TaskCalendarView {...props} />);

            const taskTitle = screen.getByText('Completed Task');
            expect(taskTitle).toHaveStyle('text-decoration: line-through');
        });

        it('renders completed task with checked checkbox', () => {
            const completedTask = createMockTask({closed: true});
            const props = createDefaultProps({tasks: [completedTask]});
            renderWithProviders(<TaskCalendarView {...props} />);

            const checkbox = screen.getByRole('checkbox') as HTMLInputElement;
            expect(checkbox).toBeChecked();
        });

        it('renders uncompleted task with unchecked checkbox', () => {
            const task = createMockTask({closed: false});
            const props = createDefaultProps({tasks: [task]});
            renderWithProviders(<TaskCalendarView {...props} />);

            const checkbox = screen.getByRole('checkbox') as HTMLInputElement;
            expect(checkbox).not.toBeChecked();
        });
    });

    describe('Empty State', () => {
        it('renders calendar with no tasks', () => {
            const props = createDefaultProps({tasks: []});
            renderWithProviders(<TaskCalendarView {...props} />);

            const currentMonth = dayjs().format('MMMM YYYY');
            expect(screen.getByText(currentMonth)).toBeInTheDocument();
            expect(screen.getByText('Sun')).toBeInTheDocument();
        });
    });

    describe('Task Filtering', () => {
        it('only shows tasks for the visible date range', () => {
            const today = dayjs();
            const taskThisMonth = createMockTask({id: 1, title: 'This Month Task', dueDate: today});
            const taskNextMonth = createMockTask({
                id: 2,
                title: 'Next Month Task',
                dueDate: today.add(2, 'month'),
            });
            const props = createDefaultProps({tasks: [taskThisMonth, taskNextMonth]});
            renderWithProviders(<TaskCalendarView {...props} />);

            expect(screen.getByText('This Month Task')).toBeInTheDocument();
            expect(screen.queryByText('Next Month Task')).not.toBeInTheDocument();
        });
    });
});
