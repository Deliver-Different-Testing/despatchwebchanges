/**
 * TaskListContextMenu Component Tests
 */

import React from 'react';
import {render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {createTheme, ThemeProvider} from '@mui/material/styles';
import dayjs from 'dayjs';
import {TaskListContextMenu} from './TaskListContextMenu';
import {Task, TasksServiceInterface} from './TaskItem.interfaces';

const theme = createTheme();

const renderWithProviders = (ui: React.ReactElement) =>
    render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);

const createMockTask = (overrides?: Partial<Task>): Task => ({
    id: 1,
    title: 'Test Task',
    description: '',
    dueDate: dayjs('2025-01-15T14:00:00'),
    closed: false,
    assignee: {id: 100, text: 'John Doe'},
    jobId: 12345,
    eventType: 'pickup',
    jobNumber: 'JOB-001',
    ...overrides,
});

const createTasksService = (): jest.Mocked<TasksServiceInterface> => ({
    markTaskAsClosed: jest.fn().mockResolvedValue(undefined),
    updateTaskDate: jest.fn().mockResolvedValue(undefined),
    updateTaskTime: jest.fn().mockResolvedValue(undefined),
    reassignTaskToStaff: jest.fn().mockResolvedValue(undefined),
    unassignTask: jest.fn().mockResolvedValue(undefined),
});

const defaultProps = () => ({
    task: createMockTask(),
    position: {mouseX: 100, mouseY: 200},
    onClose: jest.fn(),
    tasksService: createTasksService(),
    onTaskUpdated: jest.fn(),
    showSuccessToast: jest.fn(),
    showErrorToast: jest.fn(),
});

describe('TaskListContextMenu', () => {
    it('renders the Unassign item when open with a task and position', () => {
        renderWithProviders(<TaskListContextMenu {...defaultProps()} />);

        expect(screen.getByText('Unassign')).toBeInTheDocument();
    });

    it('does not open when position is null', () => {
        renderWithProviders(<TaskListContextMenu {...defaultProps()} position={null} />);

        expect(screen.queryByText('Unassign')).not.toBeInTheDocument();
    });

    it('disables Unassign when the task has no assignee', () => {
        const props = defaultProps();
        renderWithProviders(
            <TaskListContextMenu {...props} task={createMockTask({assignee: {id: 0, text: ''}})} />,
        );

        expect(screen.getByRole('menuitem')).toHaveAttribute('aria-disabled', 'true');
    });

    it('unassigns the task, toasts, refreshes and closes on click', async () => {
        const props = defaultProps();
        renderWithProviders(<TaskListContextMenu {...props} />);

        await userEvent.click(screen.getByText('Unassign'));

        await waitFor(() => {
            expect(props.tasksService.unassignTask).toHaveBeenCalledWith(1);
        });
        expect(props.showSuccessToast).toHaveBeenCalledWith('Task unassigned');
        expect(props.onTaskUpdated).toHaveBeenCalled();
        expect(props.onClose).toHaveBeenCalled();
    });

    it('shows an error toast when unassigning fails', async () => {
        const props = defaultProps();
        props.tasksService.unassignTask.mockRejectedValueOnce(new Error('boom'));
        renderWithProviders(<TaskListContextMenu {...props} />);

        await userEvent.click(screen.getByText('Unassign'));

        await waitFor(() => {
            expect(props.showErrorToast).toHaveBeenCalledWith('Error unassigning task');
        });
        expect(props.onClose).not.toHaveBeenCalled();
    });
});
