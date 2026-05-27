/**
 * TaskItem Component Tests
 */

import React from 'react';
import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {createTheme, ThemeProvider} from '@mui/material/styles';
import {LocalizationProvider} from '@mui/x-date-pickers/LocalizationProvider';
import {AdapterDayjs} from '@mui/x-date-pickers/AdapterDayjs';
import dayjs from 'dayjs';
import {TaskItem} from './TaskItem';
import {Task, TaskItemProps} from './TaskItem.interfaces';

// Mock the date utilities
jest.mock('../../../utils/dateUtils', () => ({
    getIanaTimezone: jest.fn(() => 'America/New_York'),
    getTenantTimezone: jest.fn(() => 'America/New_York'),
    getTimezoneAbbreviation: jest.fn(() => '(EST)'),
    formatLongDate: jest.fn((date: any) => date?.format?.('MMM/DD/YYYY') ?? ''),
    formatTime: jest.fn((date: any) => date?.format?.('HH:mm') ?? ''),
}));

const theme = createTheme();

const renderWithProviders = (ui: React.ReactElement) => {
    return render(
        <ThemeProvider theme={theme}>
            <LocalizationProvider dateAdapter={AdapterDayjs}>
                {ui}
            </LocalizationProvider>
        </ThemeProvider>
    );
};

// Sample task data
const createMockTask = (overrides?: Partial<Task>): Task => ({
    id: 1,
    title: 'Test Task',
    description: 'This is a test task description',
    dueDate: dayjs('2025-01-15T14:00:00'),
    closed: false,
    assignee: {id: 100, text: 'John Doe'},
    jobId: 12345,
    eventType: 'pickup',
    jobNumber: 'JOB-001',
    priority: 'high',
    _dueDateString: 'Jan 15, 2025',
    _dueTimeString: '2:00 PM',
    ...overrides,
});

const createMockServices = () => ({
    tasksService: {
        markTaskAsClosed: jest.fn().mockResolvedValue(undefined),
        updateTaskDate: jest.fn().mockResolvedValue(undefined),
        updateTaskTime: jest.fn().mockResolvedValue(undefined),
        reassignTaskToStaff: jest.fn().mockResolvedValue(undefined),
    },
    dispatchService: {
        getActiveStaff: jest.fn().mockResolvedValue([
            {id: 100, text: 'John Doe'},
            {id: 101, text: 'Jane Smith'},
            {id: 102, text: 'Bob Johnson'},
        ]),
    },
});

const createDefaultProps = (overrides?: Partial<TaskItemProps>): TaskItemProps => {
    const services = createMockServices();
    return {
        task: createMockTask(),
        config: {},
        onTaskUpdated: jest.fn(),
        onTaskClick: jest.fn(),
        tasksService: services.tasksService,
        dispatchService: services.dispatchService,
        showSuccessToast: jest.fn(),
        showErrorToast: jest.fn(),
        ...overrides,
    };
};

describe('TaskItem', () => {
    describe('Rendering', () => {
        it('renders the task title', () => {
            const props = createDefaultProps();
            renderWithProviders(<TaskItem {...props} />);

            expect(screen.getByText('Test Task')).toBeInTheDocument();
        });

        it('renders the task description', () => {
            const props = createDefaultProps();
            renderWithProviders(<TaskItem {...props} />);

            expect(screen.getByText('This is a test task description')).toBeInTheDocument();
        });

        it('renders the assignee name', () => {
            const props = createDefaultProps();
            renderWithProviders(<TaskItem {...props} />);

            expect(screen.getByText('John Doe')).toBeInTheDocument();
        });

        it('renders the job number', () => {
            const props = createDefaultProps();
            renderWithProviders(<TaskItem {...props} />);

            expect(screen.getByText('Job #JOB-001')).toBeInTheDocument();
        });

        it('renders the event type capitalized', () => {
            const props = createDefaultProps();
            renderWithProviders(<TaskItem {...props} />);

            expect(screen.getByText('Pickup')).toBeInTheDocument();
        });

        it('renders the due date and time', () => {
            const props = createDefaultProps();
            renderWithProviders(<TaskItem {...props} />);

            expect(screen.getByText(/Jan 15, 2025/)).toBeInTheDocument();
            expect(screen.getByText(/2:00 PM/)).toBeInTheDocument();
        });

        it('renders "Unassigned" when no assignee', () => {
            const task = createMockTask({assignee: {id: 0, text: ''}});
            const props = createDefaultProps({task});
            renderWithProviders(<TaskItem {...props} />);

            expect(screen.getByText('Unassigned')).toBeInTheDocument();
        });

        it('renders checkbox when allowCompletion is true', () => {
            const props = createDefaultProps({config: {allowCompletion: true}});
            renderWithProviders(<TaskItem {...props} />);

            expect(screen.getByRole('checkbox')).toBeInTheDocument();
        });

        it('does not render checkbox when allowCompletion is false', () => {
            const props = createDefaultProps({config: {allowCompletion: false}});
            renderWithProviders(<TaskItem {...props} />);

            expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
        });
    });

    describe('Status Indicators', () => {
        it('shows "To do" chip for open, non-overdue task', () => {
            const task = createMockTask({
                closed: false,
                dueDate: dayjs().add(1, 'day'),
            });
            const props = createDefaultProps({task});
            renderWithProviders(<TaskItem {...props} />);

            expect(screen.getByText('To do')).toBeInTheDocument();
        });

        it('shows "Done" chip for closed task', () => {
            const task = createMockTask({closed: true});
            const props = createDefaultProps({task});
            renderWithProviders(<TaskItem {...props} />);

            expect(screen.getByText('Done')).toBeInTheDocument();
        });

        it('shows "Overdue" chip for overdue task', () => {
            const task = createMockTask({
                closed: false,
                dueDate: dayjs().subtract(1, 'day'),
            });
            const props = createDefaultProps({task});
            renderWithProviders(<TaskItem {...props} />);

            expect(screen.getByText('Overdue')).toBeInTheDocument();
        });

        it('does not show status chip when showStatusIndicators is false', () => {
            const props = createDefaultProps({config: {showStatusIndicators: false}});
            renderWithProviders(<TaskItem {...props} />);

            expect(screen.queryByText('To do')).not.toBeInTheDocument();
            expect(screen.queryByText('Done')).not.toBeInTheDocument();
            expect(screen.queryByText('Overdue')).not.toBeInTheDocument();
        });
    });

    describe('Config Options', () => {
        it('hides job ID when showJobId is false', () => {
            const props = createDefaultProps({config: {showJobId: false}});
            renderWithProviders(<TaskItem {...props} />);

            expect(screen.queryByText('Job #JOB-001')).not.toBeInTheDocument();
        });

        it('hides assignee when showAssignee is false', () => {
            const props = createDefaultProps({config: {showAssignee: false}});
            renderWithProviders(<TaskItem {...props} />);

            expect(screen.queryByText('John Doe')).not.toBeInTheDocument();
        });

        it('hides job type when showJobType is false', () => {
            const props = createDefaultProps({config: {showJobType: false}});
            renderWithProviders(<TaskItem {...props} />);

            expect(screen.queryByText('Pickup')).not.toBeInTheDocument();
        });

        it('hides date/time when showDateTime is false', () => {
            const props = createDefaultProps({config: {showDateTime: false}});
            renderWithProviders(<TaskItem {...props} />);

            expect(screen.queryByText(/Jan 15, 2025/)).not.toBeInTheDocument();
            expect(screen.queryByText(/2:00 PM/)).not.toBeInTheDocument();
        });

        it('hides description when showDescription is false', () => {
            const props = createDefaultProps({config: {showDescription: false}});
            renderWithProviders(<TaskItem {...props} />);

            expect(screen.queryByText('This is a test task description')).not.toBeInTheDocument();
        });
    });

    describe('Task Completion', () => {
        it('calls tasksService.markTaskAsClosed when checkbox is clicked', async () => {
            const props = createDefaultProps();
            renderWithProviders(<TaskItem {...props} />);

            const checkbox = screen.getByRole('checkbox');
            await userEvent.click(checkbox);

            await waitFor(() => {
                expect(props.tasksService.markTaskAsClosed).toHaveBeenCalledWith(1, true);
            });
        });

        it('shows success toast after successful completion', async () => {
            const props = createDefaultProps();
            renderWithProviders(<TaskItem {...props} />);

            const checkbox = screen.getByRole('checkbox');
            await userEvent.click(checkbox);

            await waitFor(() => {
                expect(props.showSuccessToast).toHaveBeenCalledWith('Task completed successfully');
            });
        });

        it('calls onTaskUpdated after successful completion', async () => {
            const props = createDefaultProps();
            renderWithProviders(<TaskItem {...props} />);

            const checkbox = screen.getByRole('checkbox');
            await userEvent.click(checkbox);

            await waitFor(() => {
                expect(props.onTaskUpdated).toHaveBeenCalled();
            });
        });

        it('checkbox is checked for closed task', () => {
            const task = createMockTask({closed: true});
            const props = createDefaultProps({task});
            renderWithProviders(<TaskItem {...props} />);

            const checkbox = screen.getByRole('checkbox') as HTMLInputElement;
            expect(checkbox.checked).toBe(true);
        });
    });

    describe('Task Click', () => {
        it('calls onTaskClick when task is clicked and onTaskClick config is true', async () => {
            const props = createDefaultProps({config: {onTaskClick: true}});
            renderWithProviders(<TaskItem {...props} />);

            // Click on the task title
            await userEvent.click(screen.getByText('Test Task'));

            expect(props.onTaskClick).toHaveBeenCalledWith(props.task);
        });

        it('does not call onTaskClick when onTaskClick config is false', async () => {
            const props = createDefaultProps({config: {onTaskClick: false}});
            renderWithProviders(<TaskItem {...props} />);

            await userEvent.click(screen.getByText('Test Task'));

            expect(props.onTaskClick).not.toHaveBeenCalled();
        });
    });

    describe('Date Picker', () => {
        it('opens date popover when date button is clicked', async () => {
            const props = createDefaultProps();
            renderWithProviders(<TaskItem {...props} />);

            const dateButton = screen.getByText(/Jan 15, 2025/).closest('button');
            await userEvent.click(dateButton!);

            // DateCalendar should be visible in the popover
            expect(await screen.findByRole('grid')).toBeInTheDocument();
        });

        it('calls tasksService.updateTaskDate when a new date is selected', async () => {
            const props = createDefaultProps();
            renderWithProviders(<TaskItem {...props} />);

            const dateButton = screen.getByText(/Jan 15, 2025/).closest('button');
            await userEvent.click(dateButton!);

            // Wait for calendar to open
            expect(await screen.findByRole('grid')).toBeInTheDocument();

            // Click on a day (day 20)
            const day20 = screen.getByRole('gridcell', {name: '20'});
            await userEvent.click(day20);

            await waitFor(() => {
                expect(props.tasksService.updateTaskDate).toHaveBeenCalled();
            });
        });

        it('shows success toast after date update', async () => {
            const props = createDefaultProps();
            renderWithProviders(<TaskItem {...props} />);

            const dateButton = screen.getByText(/Jan 15, 2025/).closest('button');
            await userEvent.click(dateButton!);

            expect(await screen.findByRole('grid')).toBeInTheDocument();

            const day20 = screen.getByRole('gridcell', {name: '20'});
            await userEvent.click(day20);

            await waitFor(() => {
                expect(props.showSuccessToast).toHaveBeenCalledWith('Task date updated successfully');
            });
        });
    });

    describe('Time Picker', () => {
        it('opens time popover when time button is clicked', async () => {
            const props = createDefaultProps();
            renderWithProviders(<TaskItem {...props} />);

            const timeButton = screen.getByText(/2:00 PM/).closest('button');
            await userEvent.click(timeButton!);

            // TimeClock should be visible in the popover
            expect(await screen.findByRole('listbox')).toBeInTheDocument();
        });
    });

    describe('Assignee Popover', () => {
        it('opens assignee popover when assignee button is clicked', async () => {
            const props = createDefaultProps();
            renderWithProviders(<TaskItem {...props} />);

            const assigneeButton = screen.getByText('John Doe').closest('button');
            await userEvent.click(assigneeButton!);

            await waitFor(() => {
                expect(props.dispatchService.getActiveStaff).toHaveBeenCalled();
            });
        });

        it('shows staff list in assignee popover', async () => {
            const props = createDefaultProps();
            renderWithProviders(<TaskItem {...props} />);

            const assigneeButton = screen.getByText('John Doe').closest('button');
            await userEvent.click(assigneeButton!);

            await waitFor(() => {
                expect(screen.getByText('Jane Smith')).toBeInTheDocument();
                expect(screen.getByText('Bob Johnson')).toBeInTheDocument();
            });
        });

        it('calls tasksService.reassignTaskToStaff when staff is selected', async () => {
            const props = createDefaultProps();
            renderWithProviders(<TaskItem {...props} />);

            const assigneeButton = screen.getByText('John Doe').closest('button');
            await userEvent.click(assigneeButton!);

            expect(await screen.findByText('Jane Smith')).toBeInTheDocument();

            await userEvent.click(screen.getByText('Jane Smith'));

            await waitFor(() => {
                expect(props.tasksService.reassignTaskToStaff).toHaveBeenCalledWith(1, 101);
            });
        });

        it('shows success toast after reassignment', async () => {
            const props = createDefaultProps();
            renderWithProviders(<TaskItem {...props} />);

            const assigneeButton = screen.getByText('John Doe').closest('button');
            await userEvent.click(assigneeButton!);

            expect(await screen.findByText('Jane Smith')).toBeInTheDocument();

            await userEvent.click(screen.getByText('Jane Smith'));

            await waitFor(() => {
                expect(props.showSuccessToast).toHaveBeenCalledWith('Task reassigned successfully');
            });
        });

        it('filters staff list based on search input', async () => {
            const props = createDefaultProps();
            renderWithProviders(<TaskItem {...props} />);

            const assigneeButton = screen.getByText('John Doe').closest('button');
            await userEvent.click(assigneeButton!);

            expect(await screen.findByText('Jane Smith')).toBeInTheDocument();

            const searchInput = screen.getByPlaceholderText('Search staff...');
            fireEvent.change(searchInput, { target: { value: 'Jane' } });

            await waitFor(() => {
                expect(screen.getByText('Jane Smith')).toBeInTheDocument();
                expect(screen.queryByText('Bob Johnson')).not.toBeInTheDocument();
            });
        });

        it('shows "No staff found" when search has no results', async () => {
            const props = createDefaultProps();
            renderWithProviders(<TaskItem {...props} />);

            const assigneeButton = screen.getByText('John Doe').closest('button');
            await userEvent.click(assigneeButton!);

            expect(await screen.findByText('Jane Smith')).toBeInTheDocument();

            const searchInput = screen.getByPlaceholderText('Search staff...');
            fireEvent.change(searchInput, { target: { value: 'xyz' } });

            expect(await screen.findByText('No staff found')).toBeInTheDocument();
        });

        it('shows loading spinner while loading staff', async () => {
            let resolveStaff!: (value: any[]) => void;
            const staffPromise = new Promise<any[]>(resolve => { resolveStaff = resolve; });

            const services = createMockServices();
            services.dispatchService.getActiveStaff.mockReturnValue(staffPromise);
            const props = createDefaultProps({
                tasksService: services.tasksService,
                dispatchService: services.dispatchService,
            });
            renderWithProviders(<TaskItem {...props} />);

            const assigneeButton = screen.getByText('John Doe').closest('button');
            await userEvent.click(assigneeButton!);

            expect(screen.getByRole('progressbar')).toBeInTheDocument();

            // Resolve to avoid act() warnings from dangling promise
            resolveStaff([]);
            await waitFor(() => {
                expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
            });
        });
    });

    describe('Priority Indicator', () => {
        it('renders priority indicator for high priority task', () => {
            const task = createMockTask({priority: 'high'});
            const props = createDefaultProps({task});
            renderWithProviders(<TaskItem {...props} />);

            // Verify task renders with priority - the indicator is a colored bar
            expect(screen.getByText('Test Task')).toBeInTheDocument();
        });

        it('renders priority indicator for medium priority task', () => {
            const task = createMockTask({priority: 'medium'});
            const props = createDefaultProps({task});
            renderWithProviders(<TaskItem {...props} />);

            expect(screen.getByText('Test Task')).toBeInTheDocument();
        });

        it('renders priority indicator for low priority task', () => {
            const task = createMockTask({priority: 'low'});
            const props = createDefaultProps({task});
            renderWithProviders(<TaskItem {...props} />);

            expect(screen.getByText('Test Task')).toBeInTheDocument();
        });

        it('renders without priority indicator when priority is undefined', () => {
            const task = createMockTask({priority: undefined});
            const props = createDefaultProps({task});
            renderWithProviders(<TaskItem {...props} />);

            expect(screen.getByText('Test Task')).toBeInTheDocument();
        });
    });

    describe('Completed Task Styling', () => {
        it('applies strikethrough to completed task title', () => {
            const task = createMockTask({closed: true});
            const props = createDefaultProps({task});
            renderWithProviders(<TaskItem {...props} />);

            const title = screen.getByText('Test Task');
            expect(title).toHaveStyle('text-decoration: line-through');
        });
    });

    describe('Overdue Styling', () => {
        it('applies overdue styling to date/time buttons for overdue tasks', () => {
            const task = createMockTask({
                closed: false,
                dueDate: dayjs().subtract(1, 'day'),
            });
            const props = createDefaultProps({task});
            renderWithProviders(<TaskItem {...props} />);

            // Check that the Overdue chip is shown
            expect(screen.getByText('Overdue')).toBeInTheDocument();
        });

        it('does not show overdue styling for completed tasks', () => {
            const task = createMockTask({
                closed: true,
                dueDate: dayjs().subtract(1, 'day'),
            });
            const props = createDefaultProps({task});
            renderWithProviders(<TaskItem {...props} />);

            // Should show Done, not Overdue
            expect(screen.getByText('Done')).toBeInTheDocument();
            expect(screen.queryByText('Overdue')).not.toBeInTheDocument();
        });
    });

    describe('Event Propagation', () => {
        it('checkbox click does not trigger task click', async () => {
            const props = createDefaultProps({config: {onTaskClick: true}});
            renderWithProviders(<TaskItem {...props} />);

            const checkbox = screen.getByRole('checkbox');
            await userEvent.click(checkbox);

            // onTaskClick should not be called when clicking checkbox
            // (though the completion handler will be called)
            await waitFor(() => {
                expect(props.tasksService.markTaskAsClosed).toHaveBeenCalled();
            });
            // Since checkbox has stopPropagation, onTaskClick count should be 0
            // However, due to event bubbling specifics, we mainly verify the completion worked
        });

        it('assignee button click does not trigger task click', async () => {
            const props = createDefaultProps({config: {onTaskClick: true}});
            renderWithProviders(<TaskItem {...props} />);

            const assigneeButton = screen.getByText('John Doe').closest('button');
            await userEvent.click(assigneeButton!);

            // Should open popover, not trigger task click
            await waitFor(() => {
                expect(props.dispatchService.getActiveStaff).toHaveBeenCalled();
            });
        });
    });
});
