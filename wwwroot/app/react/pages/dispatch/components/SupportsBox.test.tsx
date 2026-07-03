import React from 'react';
import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {ThemeProvider, createTheme} from '@mui/material/styles';

// Capture the args useTasks is called with so we can assert filter wiring.
const useTasksMock = jest.fn();
const noopMutation = () => ({mutateAsync: jest.fn().mockResolvedValue(undefined)});

jest.mock('../../../hooks/useTasksApi', () => ({
    useTasks: (...args: unknown[]) => useTasksMock(...args),
    useActiveStaff: () => ({data: [{id: 7, text: 'Alice'}]}),
    useEventTypes: () => ({data: [{id: 3, text: 'Callback'}]}),
    useMarkTaskAsClosed: () => noopMutation(),
    useUpdateTaskDate: () => noopMutation(),
    useUpdateTaskTime: () => noopMutation(),
    useReassignTask: () => noopMutation(),
    useUnassignTask: () => noopMutation(),
}));

jest.mock('../../../services/tasksApi', () => ({
    tasksApi: {getActiveStaff: jest.fn(), getDeliveryJourney: jest.fn()},
}));

jest.mock('../../../components/common/task-item/TaskItem', () => ({
    TaskItem: ({task, onTaskClick}: {
        task: {id: number; title: string; jobId?: number};
        onTaskClick?: (t: {id: number; jobId?: number}) => void;
    }) => (
        <div data-testid={`mock-task-${task.id}`}>
            <button onClick={() => onTaskClick?.(task)}>{task.title}</button>
        </div>
    ),
}));

import {SupportsBox} from './SupportsBox';

function renderBox(overrides: Partial<React.ComponentProps<typeof SupportsBox>> = {}) {
    return render(
        <ThemeProvider theme={createTheme()}>
            <SupportsBox showToast={jest.fn()} {...overrides} />
        </ThemeProvider>,
    );
}

const sampleTasks = [
    {id: 1, title: 'Task One', jobId: 42, assignee: {id: 0, text: 'Me'}},
    {id: 2, title: 'Task Two', jobId: 42, assignee: {id: 5, text: 'Other'}},
];

describe('SupportsBox', () => {
    beforeEach(() => {
        useTasksMock.mockReset();
        useTasksMock.mockReturnValue({data: [], isLoading: false, refetch: jest.fn()});
    });

    it('prompts to select a job when none is provided and does not enable the query', () => {
        renderBox();
        expect(screen.getByText(/select a job to see its tasks/i)).toBeInTheDocument();
        expect(useTasksMock).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({enabled: false}),
        );
    });

    it('renders a TaskItem per task and exposes the status filters in the Filters menu', async () => {
        const user = userEvent.setup();
        useTasksMock.mockReturnValue({data: sampleTasks, isLoading: false, refetch: jest.fn()});
        renderBox({jobId: 42});

        expect(screen.getByTestId('mock-task-1')).toBeInTheDocument();
        expect(screen.getByTestId('mock-task-2')).toBeInTheDocument();

        await user.click(screen.getByRole('button', {name: /Filters/}));
        expect(screen.getByRole('radio', {name: /Total/})).toBeInTheDocument();
        expect(screen.getByRole('radio', {name: /Mine/})).toBeInTheDocument();
        expect(screen.getByRole('radio', {name: /Unassigned/})).toBeInTheDocument();
    });

    it('shows an empty message when the job has no tasks', () => {
        useTasksMock.mockReturnValue({data: [], isLoading: false, refetch: jest.fn()});
        renderBox({jobId: 42});
        expect(screen.getByText(/no tasks matching your filter/i)).toBeInTheDocument();
    });

    it('rebuilds the filter request when a status filter is selected', async () => {
        const user = userEvent.setup();
        useTasksMock.mockReturnValue({data: sampleTasks, isLoading: false, refetch: jest.fn()});
        renderBox({jobId: 42});

        await user.click(screen.getByRole('button', {name: /Filters/}));
        await user.click(screen.getByRole('radio', {name: /Oldest/}));

        // The most recent useTasks call should reflect the 'oldest' ordering.
        const lastCall = useTasksMock.mock.calls.at(-1)!;
        expect(lastCall[0]).toMatchObject({jobId: 42, orderBy: 'created', orderDirection: 'asc'});
    });

    it('selects the task\'s job when a task is clicked', async () => {
        const user = userEvent.setup();
        const onSelectJob = jest.fn();
        useTasksMock.mockReturnValue({data: sampleTasks, isLoading: false, refetch: jest.fn()});
        renderBox({jobId: 42, onSelectJob});

        await user.click(screen.getByRole('button', {name: 'Task One'}));
        expect(onSelectJob).toHaveBeenCalledWith(42);
    });

    it('applies the staff filter to the task request', async () => {
        const user = userEvent.setup();
        useTasksMock.mockReturnValue({data: sampleTasks, isLoading: false, refetch: jest.fn()});
        renderBox({jobId: 42});

        await user.click(screen.getByRole('button', {name: /Filters/}));
        await user.click(screen.getByLabelText('Staff'));
        await user.click(await screen.findByRole('option', {name: 'Alice'}));

        const lastCall = useTasksMock.mock.calls.at(-1)!;
        expect(lastCall[0]).toMatchObject({jobId: 42, staffId: 7});
    });
});
