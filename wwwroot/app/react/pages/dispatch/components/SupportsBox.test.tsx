import React from 'react';
import { setupUser } from '../../../__testUtils__/setupUser';
import {render, screen} from '@testing-library/react';

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
    TaskItem: ({task, onTaskClick, config}: {
        task: {id: number; title: string; jobId?: number};
        onTaskClick?: (t: {id: number; jobId?: number}) => void;
        config?: {showJobId?: boolean};
    }) => (
        <div data-testid={`mock-task-${task.id}`} data-show-job-id={String(!!config?.showJobId)}>
            <button onClick={() => onTaskClick?.(task)}>{task.title}</button>
        </div>
    ),
}));

import {SupportsBox} from './SupportsBox';
import {MantineTestProvider} from '../../../__testUtils__';

function renderBox(overrides: Partial<React.ComponentProps<typeof SupportsBox>> = {}) {
    return render(
        <MantineTestProvider>
            <SupportsBox showToast={jest.fn()} {...overrides} />
        </MantineTestProvider>,
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
        const user = setupUser();
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
        expect(screen.getByRole('heading', {name: /no tasks/i})).toBeInTheDocument();
        expect(screen.getByText(/no tasks matching your filter/i)).toBeInTheDocument();
    });

    it('rebuilds the filter request when a status filter is selected', async () => {
        const user = setupUser();
        useTasksMock.mockReturnValue({data: sampleTasks, isLoading: false, refetch: jest.fn()});
        renderBox({jobId: 42});

        await user.click(screen.getByRole('button', {name: /Filters/}));
        await user.click(screen.getByRole('radio', {name: /Oldest/}));

        // The most recent useTasks call should reflect the 'oldest' ordering.
        const lastCall = useTasksMock.mock.calls.at(-1)!;
        expect(lastCall[0]).toMatchObject({jobId: 42, orderBy: 'created', orderDirection: 'asc'});
    });

    it('selects the task\'s job when a task is clicked', async () => {
        const user = setupUser();
        const onSelectJob = jest.fn();
        useTasksMock.mockReturnValue({data: sampleTasks, isLoading: false, refetch: jest.fn()});
        renderBox({jobId: 42, onSelectJob});

        await user.click(screen.getByRole('button', {name: 'Task One'}));
        expect(onSelectJob).toHaveBeenCalledWith(42);
    });

    it('applies the staff filter to the task request', async () => {
        const user = setupUser();
        useTasksMock.mockReturnValue({data: sampleTasks, isLoading: false, refetch: jest.fn()});
        renderBox({jobId: 42});

        await user.click(screen.getByRole('button', {name: /Filters/}));
        await user.click(screen.getByLabelText('Staff'));
        await user.click(await screen.findByRole('option', {name: 'Alice'}));

        const lastCall = useTasksMock.mock.calls.at(-1)!;
        expect(lastCall[0]).toMatchObject({jobId: 42, staffId: 7});
    });

    it('scopes the request to the current job by default', () => {
        useTasksMock.mockReturnValue({data: sampleTasks, isLoading: false, refetch: jest.fn()});
        renderBox({jobId: 42});

        const lastCall = useTasksMock.mock.calls.at(-1)!;
        expect(lastCall[0]).toMatchObject({jobId: 42});
        // Rows belong to the one selected job, so the job id is hidden.
        expect(screen.getByTestId('mock-task-1')).toHaveAttribute('data-show-job-id', 'false');
    });

    it('drops the jobId and shows job ids when switched to All tasks', async () => {
        const user = setupUser();
        useTasksMock.mockReturnValue({data: sampleTasks, isLoading: false, refetch: jest.fn()});
        renderBox({jobId: 42});

        await user.click(screen.getByRole('radio', {name: 'All tasks'}));

        const lastCall = useTasksMock.mock.calls.at(-1)!;
        expect(lastCall[0].jobId).toBeUndefined();
        expect(screen.getByTestId('mock-task-1')).toHaveAttribute('data-show-job-id', 'true');
    });

    it('loads tasks in All tasks mode even when no job is selected', async () => {
        const user = setupUser();
        useTasksMock.mockReturnValue({data: sampleTasks, isLoading: false, refetch: jest.fn()});
        renderBox();

        // With no job, current mode prompts to select one and keeps the query disabled.
        expect(screen.getByText(/select a job to see its tasks/i)).toBeInTheDocument();

        await user.click(screen.getByRole('radio', {name: 'All tasks'}));

        expect(screen.queryByText(/select a job to see its tasks/i)).not.toBeInTheDocument();
        expect(screen.getByTestId('mock-task-1')).toBeInTheDocument();
        const lastCall = useTasksMock.mock.calls.at(-1)!;
        expect(lastCall[0].jobId).toBeUndefined();
        expect(lastCall[1]).toMatchObject({enabled: true});
    });

    it('keeps the scope when the active toggle button is clicked again', async () => {
        const user = setupUser();
        useTasksMock.mockReturnValue({data: sampleTasks, isLoading: false, refetch: jest.fn()});
        renderBox({jobId: 42});

        await user.click(screen.getByRole('radio', {name: 'This job'}));

        const lastCall = useTasksMock.mock.calls.at(-1)!;
        expect(lastCall[0]).toMatchObject({jobId: 42});
    });
});
