/**
 * TaskItem Component Tests
 *
 * The row is two flat lines: headline plus the due button (top right), then the
 * task's facts as filled key/value chips with the assignee control trailing. Each
 * chip names its own datum, so the assertions are on the visible key word and value;
 * a chip's identity comes from its `data-task-meta` stamp.
 *
 * State lives on the due button as `data-due-state`, not on a coloured keyline — the
 * tones themselves are stylesheet-owned and CSS modules are mocked to `{}` in Jest,
 * so the stamp is the contract.
 */

import React from 'react';
import {fireEvent, screen, waitFor} from '@testing-library/react';
import { renderWithMantine } from '../../../__testUtils__';
import { setupUser } from '../../../__testUtils__/setupUser';
import dayjs from 'dayjs';
import {TaskItem} from './TaskItem';
import {Task, TaskItemProps} from './TaskItem.interfaces';

// Shared fast userEvent instance (see setupUser).
const userEvent = setupUser();

// Only the tenant/timezone lookups are stubbed — `formatRelativeTime` is the real one,
// since the rail's "2d ago" line is exactly what it computes.
jest.mock('../../../utils/dateUtils', () => ({
    ...jest.requireActual('../../../utils/dateUtils'),
    getIanaTimezone: jest.fn(() => 'America/New_York'),
    getTenantTimezone: jest.fn(() => 'America/New_York'),
    getTimezoneAbbreviation: jest.fn(() => '(EST)'),
}));

const renderWithProviders = (ui: React.ReactElement) => renderWithMantine(ui);

/** 23:59 today: due today, and still ahead of now for any run outside the final minute. */
const laterToday = () => dayjs().endOf('day').subtract(1, 'minute');

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
    courierCode: 'ABC123',
    courierName: 'John Smith',
    clientCode: 'ACME',
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
        unassignTask: jest.fn().mockResolvedValue(undefined),
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

const meta = (name: string) => document.querySelector(`[data-task-meta="${name}"]`);
const row = () => document.querySelector('[data-task-state]') as HTMLElement;
const dueControl = () => screen.getByRole('button', {name: /edit date and time/});
const assigneeControl = () => screen.getByRole('button', {name: /change assignee|Assign task/});

/** Opens the due popover and moves to the named option. */
const openDueOption = async (option: 'Date' | 'Time') => {
    await userEvent.click(dueControl());
    await userEvent.click(await screen.findByRole('radio', {name: option}));
};

describe('TaskItem', () => {
    describe('Row anatomy', () => {
        it('renders the headline, description, assignee and every fact', () => {
            renderWithProviders(<TaskItem {...createDefaultProps()} />);

            expect(screen.getByText('Test Task')).toBeInTheDocument();
            expect(screen.getByText('This is a test task description')).toBeInTheDocument();
            expect(screen.getByText('John Doe')).toBeInTheDocument();
            expect(screen.getByText('JOB-001')).toBeInTheDocument();
            expect(screen.getByText('Pickup')).toBeInTheDocument();
            expect(screen.getByText('ABC123 — John Smith')).toBeInTheDocument();
            expect(screen.getByText('ACME')).toBeInTheDocument();
        });

        it('names the type of every fact it shows', () => {
            renderWithProviders(<TaskItem {...createDefaultProps()} />);

            expect(meta('jobNumber')).toHaveTextContent(/^JobJOB-001$/);
            expect(meta('courier')).toHaveTextContent(/^CourierABC123 — John Smith$/);
            expect(meta('client')).toHaveTextContent(/^ClientACME$/);
            expect(meta('priority')).toHaveTextContent(/^PriorityHigh$/);
            // The event type names itself, so a key word would only repeat it.
            expect(meta('jobType')).toHaveTextContent(/^Pickup$/);
            expect(assigneeControl()).toHaveTextContent(/^AssigneeJohn Doe$/);
        });

        it('carries no status word — the due button is the state', () => {
            renderWithProviders(<TaskItem {...createDefaultProps()} />);

            expect(screen.queryByText('To do')).not.toBeInTheDocument();
            expect(screen.queryByText('Done')).not.toBeInTheDocument();
            expect(screen.queryByText('Overdue')).not.toBeInTheDocument();
        });

        it('names the timezone once, on the due control', () => {
            renderWithProviders(<TaskItem {...createDefaultProps()} />);

            expect(screen.queryAllByText(/\(EST\)/)).toHaveLength(0);
            expect(dueControl()).toHaveAccessibleName(/\(EST\)/);
        });

        it('renders the courier code alone when the name is missing', () => {
            const props = createDefaultProps({task: createMockTask({courierName: undefined})});
            renderWithProviders(<TaskItem {...props} />);

            expect(screen.getByText('ABC123')).toBeInTheDocument();
        });

        it('omits metadata the task does not carry', () => {
            const task = createMockTask({courierCode: undefined, courierName: undefined, clientCode: undefined});
            renderWithProviders(<TaskItem {...createDefaultProps({task})} />);

            expect(meta('courier')).toBeNull();
            expect(meta('client')).toBeNull();
        });

        it('renders the completion checkbox when allowCompletion is true', () => {
            renderWithProviders(<TaskItem {...createDefaultProps({config: {allowCompletion: true}})} />);

            expect(screen.getByRole('checkbox')).toBeInTheDocument();
        });

        it('renders no checkbox when allowCompletion is false', () => {
            renderWithProviders(<TaskItem {...createDefaultProps({config: {allowCompletion: false}})} />);

            expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
        });
    });

    /**
     * A bare time means "today"; a day line appears only when the time alone would
     * mislead. That is also what keeps the rail from echoing the task dashboard's
     * sticky Today / Tomorrow / Overdue group headers.
     */
    describe('Due button', () => {
        it('shows the time and no day line for a task due today', () => {
            const due = laterToday();
            const task = createMockTask({dueDate: due, _dueTimeString: '11:59 PM'});
            renderWithProviders(<TaskItem {...createDefaultProps({task})} />);

            expect(screen.getByText('11:59 PM')).toBeInTheDocument();
            expect(screen.queryByText(due.format('ddd D'))).not.toBeInTheDocument();
        });

        it('shows the weekday and day for a task due later on', () => {
            const due = dayjs().add(3, 'day');
            const task = createMockTask({dueDate: due, _dueTimeString: '9:15 AM'});
            renderWithProviders(<TaskItem {...createDefaultProps({task})} />);

            expect(screen.getByText('9:15 AM')).toBeInTheDocument();
            expect(screen.getByText(due.format('ddd D'))).toBeInTheDocument();
        });

        it('shows how late an overdue task is', () => {
            const task = createMockTask({dueDate: dayjs().subtract(2, 'day')});
            renderWithProviders(<TaskItem {...createDefaultProps({task})} />);

            expect(screen.getByText('2d ago')).toBeInTheDocument();
        });

        it.each([
            ['no due strings', {_dueDateString: undefined, _dueTimeString: undefined}],
            ['"Invalid Date" strings', {_dueDateString: 'Invalid Date', _dueTimeString: 'Invalid Date'}],
        ])('invites the operator to set a due instant given %s', (_label, overrides) => {
            const props = createDefaultProps({task: createMockTask(overrides)});
            renderWithProviders(<TaskItem {...props} />);

            expect(screen.getByText('Set due')).toBeInTheDocument();
            expect(screen.queryByText(/undefined|Invalid Date/)).not.toBeInTheDocument();
        });

        it('keeps the absolute due date reachable on the control', () => {
            renderWithProviders(<TaskItem {...createDefaultProps()} />);

            expect(dueControl()).toHaveAccessibleName(/Jan 15, 2025/);
            expect(dueControl()).toHaveAccessibleName(/2:00 PM/);
        });

        it('hides the button when showDateTime is false', () => {
            renderWithProviders(<TaskItem {...createDefaultProps({config: {showDateTime: false}})} />);

            expect(screen.queryByRole('button', {name: /edit date and time/})).not.toBeInTheDocument();
            expect(screen.queryByText('2:00 PM')).not.toBeInTheDocument();
        });
    });

    /**
     * One due instant, one control, one popover holding both editors. The time is
     * committed by an explicit button: `TimePicker` is segmented and fires per
     * segment, and each fire here would be an API write.
     */
    describe('Due editor', () => {
        it('names both options and the instant they apply to, opening on Date', async () => {
            renderWithProviders(<TaskItem {...createDefaultProps()} />);

            await userEvent.click(dueControl());

            expect(await screen.findByRole('radio', {name: 'Date'})).toBeChecked();
            expect(screen.getByRole('radio', {name: 'Time'})).not.toBeChecked();
            expect(screen.getByText('Due Jan 15, 2025 2:00 PM (EST)')).toBeInTheDocument();
            expect(screen.getByLabelText('Task due date')).toBeInTheDocument();
        });

        it('seeds the time editor with the task time', async () => {
            renderWithProviders(<TaskItem {...createDefaultProps()} />);

            await openDueOption('Time');

            expect(await screen.findByLabelText('Hours')).toHaveValue('14');
            expect(screen.getByLabelText('Minutes')).toHaveValue('00');
            expect(screen.getByRole('button', {name: 'Set time'})).toBeInTheDocument();
        });

        it('writes the date on selection and advances to the time option', async () => {
            const props = createDefaultProps();
            renderWithProviders(<TaskItem {...props} />);

            await userEvent.click(dueControl());
            await userEvent.click(await screen.findByRole('button', {name: '20 January 2025'}));

            await waitFor(() => {
                expect(props.tasksService.updateTaskDate).toHaveBeenCalled();
            });
            expect(props.showSuccessToast).toHaveBeenCalledWith('Task date updated successfully');
            expect(await screen.findByLabelText('Hours')).toBeInTheDocument();
        });

        it('does not write the time until Set time is pressed', async () => {
            const props = createDefaultProps();
            renderWithProviders(<TaskItem {...props} />);

            await openDueOption('Time');
            fireEvent.change(await screen.findByLabelText('Hours'), {target: {value: '09'}});
            expect(props.tasksService.updateTaskTime).not.toHaveBeenCalled();

            await userEvent.click(screen.getByRole('button', {name: 'Set time'}));

            await waitFor(() => {
                expect(props.tasksService.updateTaskTime).toHaveBeenCalled();
            });
            expect(props.showSuccessToast).toHaveBeenCalledWith('Task time updated successfully');
            const committed = (props.tasksService.updateTaskTime as jest.Mock).mock.calls[0][1];
            expect(committed.format('HH:mm')).toBe('09:00');
        });
    });

    describe('State emphasis', () => {
        it.each([
            ['open', {dueDate: laterToday()}],
            ['overdue', {dueDate: dayjs().subtract(1, 'day')}],
            ['done', {closed: true}],
        ])('stamps the row and the due button for a %s task', (state, overrides) => {
            renderWithProviders(<TaskItem {...createDefaultProps({task: createMockTask(overrides)})} />);

            expect(row()).toHaveAttribute('data-task-state', state);
            expect(dueControl()).toHaveAttribute('data-due-state', state);
        });

        it('stamps a task carrying no due instant as unset', () => {
            const task = createMockTask({_dueDateString: undefined, _dueTimeString: undefined});
            renderWithProviders(<TaskItem {...createDefaultProps({task})} />);

            expect(dueControl()).toHaveAttribute('data-due-state', 'unset');
        });

        it('drops the state tone and the late line when showStatusIndicators is false', () => {
            const props = createDefaultProps({
                task: createMockTask({dueDate: dayjs().subtract(2, 'day')}),
                config: {showStatusIndicators: false},
            });
            renderWithProviders(<TaskItem {...props} />);

            expect(dueControl()).toHaveAttribute('data-due-state', 'open');
            expect(screen.queryByText('2d ago')).not.toBeInTheDocument();
        });

        it('strikes through a completed task', () => {
            renderWithProviders(<TaskItem {...createDefaultProps({task: createMockTask({closed: true})})} />);

            expect(screen.getByText('Test Task')).toHaveStyle('text-decoration: line-through');
        });

        it('treats an overdue completed task as done', () => {
            const task = createMockTask({closed: true, dueDate: dayjs().subtract(1, 'day')});
            renderWithProviders(<TaskItem {...createDefaultProps({task})} />);

            expect(row()).toHaveAttribute('data-task-state', 'done');
            expect(screen.queryByText(/ago/)).not.toBeInTheDocument();
        });
    });

    /** Ink is spent on exceptions only: `low` is the default case and gets no mark. */
    describe('Priority', () => {
        it.each([['high', 'High'], ['medium', 'Medium']] as const)('names %s priority', (priority, label) => {
            renderWithProviders(<TaskItem {...createDefaultProps({task: createMockTask({priority})})} />);

            expect(meta('priority')).toHaveTextContent('Priority' + label);
        });

        it.each(['low', undefined] as const)('renders no priority chip for %s priority', (priority) => {
            renderWithProviders(<TaskItem {...createDefaultProps({task: createMockTask({priority})})} />);

            expect(meta('priority')).toBeNull();
        });
    });

    describe('Assignee', () => {
        it('opens the staff picker and lists staff', async () => {
            const props = createDefaultProps();
            renderWithProviders(<TaskItem {...props} />);

            await userEvent.click(assigneeControl());

            await waitFor(() => {
                expect(props.dispatchService.getActiveStaff).toHaveBeenCalled();
            });
            expect(await screen.findByText('Jane Smith')).toBeInTheDocument();
            expect(screen.getByText('Bob Johnson')).toBeInTheDocument();
        });

        it('reassigns the task to the chosen staff member', async () => {
            const props = createDefaultProps();
            renderWithProviders(<TaskItem {...props} />);

            await userEvent.click(assigneeControl());
            await userEvent.click(await screen.findByText('Jane Smith'));

            await waitFor(() => {
                expect(props.tasksService.reassignTaskToStaff).toHaveBeenCalledWith(1, 101);
            });
            expect(props.showSuccessToast).toHaveBeenCalledWith('Task reassigned successfully');
        });

        it('filters the staff list and reports when nothing matches', async () => {
            renderWithProviders(<TaskItem {...createDefaultProps()} />);

            await userEvent.click(assigneeControl());
            expect(await screen.findByText('Jane Smith')).toBeInTheDocument();

            const searchInput = screen.getByPlaceholderText('Search staff...');
            fireEvent.change(searchInput, {target: {value: 'Jane'}});
            expect(await screen.findByText('Jane Smith')).toBeInTheDocument();
            expect(screen.queryByText('Bob Johnson')).not.toBeInTheDocument();

            fireEvent.change(searchInput, {target: {value: 'xyz'}});
            expect(await screen.findByText('No staff found')).toBeInTheDocument();
        });

        it('shows a spinner while the staff list loads', async () => {
            let resolveStaff!: (value: any[]) => void;
            const staffPromise = new Promise<any[]>(resolve => { resolveStaff = resolve; });
            const services = createMockServices();
            services.dispatchService.getActiveStaff.mockReturnValue(staffPromise);
            const props = createDefaultProps({
                tasksService: services.tasksService,
                dispatchService: services.dispatchService,
            });
            renderWithProviders(<TaskItem {...props} />);

            await userEvent.click(assigneeControl());

            expect(screen.getByLabelText('Loading staff')).toBeInTheDocument();

            resolveStaff([]);
            await waitFor(() => {
                expect(screen.queryByLabelText('Loading staff')).not.toBeInTheDocument();
            });
        });

        it('invites an assignment when the task is unassigned', () => {
            const task = createMockTask({assignee: {id: 0, text: ''}});
            renderWithProviders(<TaskItem {...createDefaultProps({task})} />);

            expect(screen.getByText('Assign')).toBeInTheDocument();
            expect(assigneeControl()).not.toHaveTextContent('Assignee');
        });

        it('unassigns from inside the picker without opening the task', async () => {
            const props = createDefaultProps({config: {onTaskClick: true}});
            renderWithProviders(<TaskItem {...props} />);

            await userEvent.click(assigneeControl());
            const unassign = await screen.findByRole('button', {name: 'Unassign task'});
            expect(unassign).toHaveTextContent('Unassign');
            await userEvent.click(unassign);

            await waitFor(() => {
                expect(props.tasksService.unassignTask).toHaveBeenCalledWith(props.task.id);
            });
            expect(props.onTaskUpdated).toHaveBeenCalled();
            expect(props.onTaskClick).not.toHaveBeenCalled();
        });

        it('offers no unassign action for an already unassigned task', async () => {
            const task = createMockTask({assignee: {id: 0, text: ''}});
            renderWithProviders(<TaskItem {...createDefaultProps({task})} />);

            await userEvent.click(assigneeControl());
            expect(await screen.findByPlaceholderText('Search staff...')).toBeInTheDocument();
            expect(screen.queryByRole('button', {name: 'Unassign task'})).not.toBeInTheDocument();
        });

        it('renders no assignee control when showAssignee is false', () => {
            renderWithProviders(<TaskItem {...createDefaultProps({config: {showAssignee: false}})} />);

            expect(screen.queryByText('John Doe')).not.toBeInTheDocument();
            expect(screen.queryByRole('button', {name: /change assignee/})).not.toBeInTheDocument();
        });
    });

    describe('Completion', () => {
        it('closes the task, confirms it and refreshes', async () => {
            const props = createDefaultProps();
            renderWithProviders(<TaskItem {...props} />);

            await userEvent.click(screen.getByRole('checkbox'));

            await waitFor(() => {
                expect(props.tasksService.markTaskAsClosed).toHaveBeenCalledWith(1, true);
            });
            expect(props.showSuccessToast).toHaveBeenCalledWith('Task completed successfully');
            expect(props.onTaskUpdated).toHaveBeenCalled();
        });

        it('checks the box for a closed task', () => {
            renderWithProviders(<TaskItem {...createDefaultProps({task: createMockTask({closed: true})})} />);

            expect(screen.getByRole('checkbox')).toBeChecked();
        });
    });

    describe('Task click', () => {
        it('calls onTaskClick when the headline is activated', async () => {
            const props = createDefaultProps({config: {onTaskClick: true}});
            renderWithProviders(<TaskItem {...props} />);

            await userEvent.click(screen.getByText('Test Task'));

            expect(props.onTaskClick).toHaveBeenCalledWith(props.task);
        });

        it('does not call onTaskClick when the config is off', async () => {
            const props = createDefaultProps({config: {onTaskClick: false}});
            renderWithProviders(<TaskItem {...props} />);

            await userEvent.click(screen.getByText('Test Task'));

            expect(props.onTaskClick).not.toHaveBeenCalled();
        });

        it.each([
            ['the checkbox', () => screen.getByRole('checkbox')],
            ['the assignee control', () => assigneeControl()],
            ['the due control', () => dueControl()],
        ])('does not open the task from %s', async (_label, target) => {
            const props = createDefaultProps({config: {onTaskClick: true}});
            renderWithProviders(<TaskItem {...props} />);

            await userEvent.click(target());

            expect(props.onTaskClick).not.toHaveBeenCalled();
        });
    });

    describe('Auto-assign on click', () => {
        it('claims an unassigned, open task for the current user and still selects the job', async () => {
            const task = createMockTask({assignee: {id: 0, text: ''}});
            const props = createDefaultProps({
                task,
                config: {onTaskClick: true, autoAssignOnClick: true},
                currentUserId: 555,
            });
            renderWithProviders(<TaskItem {...props} />);

            await userEvent.click(screen.getByText('Test Task'));

            await waitFor(() => {
                expect(props.tasksService.reassignTaskToStaff).toHaveBeenCalledWith(task.id, 555);
            });
            expect(props.onTaskClick).toHaveBeenCalledWith(task);
            await waitFor(() => {
                expect(props.showSuccessToast).toHaveBeenCalledWith('Task assigned to you');
            });
        });

        it.each([
            ['the task already has an assignee', {
                task: createMockTask(),
                currentUserId: 555,
                config: {onTaskClick: true, autoAssignOnClick: true},
            }],
            ['the task is closed', {
                task: createMockTask({closed: true, assignee: {id: 0, text: ''}}),
                currentUserId: 555,
                config: {onTaskClick: true, autoAssignOnClick: true},
            }],
            ['there is no current user', {
                task: createMockTask({assignee: {id: 0, text: ''}}),
                currentUserId: 0,
                config: {onTaskClick: true, autoAssignOnClick: true},
            }],
            ['autoAssignOnClick is off', {
                task: createMockTask({assignee: {id: 0, text: ''}}),
                currentUserId: 555,
                config: {onTaskClick: true},
            }],
        ])('does not claim the task when %s, but still selects the job', async (_label, overrides) => {
            const props = createDefaultProps(overrides as Partial<TaskItemProps>);
            renderWithProviders(<TaskItem {...props} />);

            await userEvent.click(screen.getByText('Test Task'));

            expect(props.onTaskClick).toHaveBeenCalledWith(props.task);
            expect(props.tasksService.reassignTaskToStaff).not.toHaveBeenCalled();
        });
    });

    describe('Config options', () => {
        it.each([
            ['job number', {showJobId: false}, 'jobNumber'],
            ['job type', {showJobType: false}, 'jobType'],
            ['courier', {showCourierCode: false}, 'courier'],
            ['client', {showClientCode: false}, 'client'],
        ])('hides the %s metadata when its config is off', (_label, config, stamp) => {
            renderWithProviders(<TaskItem {...createDefaultProps({config})} />);

            expect(meta(stamp)).toBeNull();
        });

        it('hides the description when showDescription is false', () => {
            renderWithProviders(<TaskItem {...createDefaultProps({config: {showDescription: false}})} />);

            expect(screen.queryByText('This is a test task description')).not.toBeInTheDocument();
        });
    });

    describe('Compact view', () => {
        it('collapses to a single line: no description, no day line', () => {
            const due = dayjs().add(3, 'day');
            const props = createDefaultProps({
                task: createMockTask({dueDate: due, _dueTimeString: '9:15 AM'}),
                config: {compactView: true},
            });
            renderWithProviders(<TaskItem {...props} />);

            expect(screen.getByText('Test Task')).toBeInTheDocument();
            expect(screen.getByText('9:15 AM')).toBeInTheDocument();
            expect(screen.queryByText('This is a test task description')).not.toBeInTheDocument();
            expect(screen.queryByText(due.format('ddd D'))).not.toBeInTheDocument();
        });
    });

    describe('Accessibility', () => {
        it('labels the completion checkbox with the task title', () => {
            renderWithProviders(<TaskItem {...createDefaultProps()} />);

            expect(screen.getByRole('checkbox', {name: 'Mark "Test Task" complete'})).toBeInTheDocument();
        });

        it('activates the task from the keyboard via the headline', async () => {
            const props = createDefaultProps({config: {onTaskClick: true}});
            renderWithProviders(<TaskItem {...props} />);

            const title = screen.getByRole('button', {name: 'Open task: Test Task'});
            title.focus();
            await userEvent.keyboard('{Enter}');

            expect(props.onTaskClick).toHaveBeenCalledWith(props.task);
        });
    });
});
