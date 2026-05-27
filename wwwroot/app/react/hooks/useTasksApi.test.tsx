/**
 * useTasksApi Hooks Tests
 */

import React from 'react';
import {renderHook, waitFor} from '@testing-library/react';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import dayjs from 'dayjs';
import {
    useTasks,
    useActiveStaff,
    useEventTypes,
    useDeliveryJourney,
    useMarkTaskAsClosed,
    useUpdateTaskDate,
    useUpdateTaskTime,
    useReassignTask,
} from './useTasksApi';
import {tasksApi} from '../services/tasksApi';
import {Task, StaffSuggestion, EventTypeSuggestion} from '../interfaces';
import {DeliveryJourney} from '../components/common/task-history/TaskHistory.interfaces';

// Mock the tasksApi
jest.mock('../services/tasksApi', () => ({
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

// Wrapper component for providing QueryClient
const createWrapper = () => {
    const queryClient = createTestQueryClient();
    return ({children}: {children: React.ReactNode}) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
};

// Sample test data
const mockTasks: Task[] = [
    {
        id: 1,
        title: 'Follow up call',
        description: 'Call customer about delivery',
        dueDate: dayjs('2024-01-15T10:00:00Z'),
        closed: false,
        assignee: {id: 5, text: 'John Doe'},
        jobId: 100,
        eventType: 'Call',
        jobNumber: 'JOB-100',
    },
    {
        id: 2,
        title: 'Email reminder',
        description: 'Send reminder email',
        dueDate: dayjs('2024-01-16T14:00:00Z'),
        closed: true,
        assignee: {id: 6, text: 'Jane Smith'},
        jobId: 101,
        eventType: 'Email',
        jobNumber: 'JOB-101',
    },
];

const mockStaff: StaffSuggestion[] = [
    {id: 1, text: 'John Doe'},
    {id: 2, text: 'Jane Smith'},
    {id: 3, text: 'Bob Wilson'},
];

const mockEventTypes: EventTypeSuggestion[] = [
    {id: 1, text: 'Call'},
    {id: 2, text: 'Email'},
    {id: 3, text: 'Meeting'},
];

const mockDeliveryJourney: DeliveryJourney[] = [
    {
        id: '1',
        jobId: 123,
        title: 'Picked up',
        icon: 'local_shipping',
        description: 'Package picked up',
        date: dayjs('2024-01-15T10:00:00Z'),
        tags: ['pickup'],
        status: 'completed',
        notes: '',
    },
    {
        id: '2',
        jobId: 123,
        title: 'Delivered',
        icon: 'check_circle',
        description: 'Package delivered',
        date: dayjs('2024-01-15T14:00:00Z'),
        tags: ['delivered'],
        status: 'completed',
        notes: '',
    },
];

describe('useTasksApi Hooks', () => {
    describe('useTasks', () => {
        it('should fetch tasks successfully', async () => {
            mockTasksApi.getAllTasks.mockResolvedValueOnce(mockTasks);

            const {result} = renderHook(() => useTasks(), {
                wrapper: createWrapper(),
            });

            expect(result.current.isLoading).toBe(true);

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            expect(result.current.data).toEqual(mockTasks);
            expect(mockTasksApi.getAllTasks).toHaveBeenCalledWith(undefined, expect.anything());
        });

        it('should pass filters to the API', async () => {
            mockTasksApi.getAllTasks.mockResolvedValueOnce([]);

            const filters = {
                searchText: 'test',
                staffId: 5,
                showCompleted: false,
            };

            const {result} = renderHook(() => useTasks(filters), {
                wrapper: createWrapper(),
            });

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            expect(mockTasksApi.getAllTasks).toHaveBeenCalledWith(filters, expect.anything());
        });

        it('should handle errors', async () => {
            const error = new Error('Failed to fetch tasks');
            mockTasksApi.getAllTasks.mockRejectedValueOnce(error);

            const {result} = renderHook(() => useTasks(), {
                wrapper: createWrapper(),
            });

            await waitFor(() => {
                expect(result.current.isError).toBe(true);
            });

            expect(result.current.error).toEqual(error);
        });

        it('should not fetch when disabled', async () => {
            mockTasksApi.getAllTasks.mockResolvedValueOnce(mockTasks);

            const {result} = renderHook(() => useTasks(undefined, {enabled: false}), {
                wrapper: createWrapper(),
            });

            expect(result.current.isLoading).toBe(false);
            expect(result.current.data).toBeUndefined();
            expect(mockTasksApi.getAllTasks).not.toHaveBeenCalled();
        });
    });

    describe('useActiveStaff', () => {
        it('should fetch active staff successfully', async () => {
            mockTasksApi.getActiveStaff.mockResolvedValueOnce(mockStaff);

            const {result} = renderHook(() => useActiveStaff(), {
                wrapper: createWrapper(),
            });

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            expect(result.current.data).toEqual(mockStaff);
            expect(mockTasksApi.getActiveStaff).toHaveBeenCalled();
        });

        it('should handle errors', async () => {
            const error = new Error('Failed to fetch staff');
            mockTasksApi.getActiveStaff.mockRejectedValueOnce(error);

            const {result} = renderHook(() => useActiveStaff(), {
                wrapper: createWrapper(),
            });

            await waitFor(() => {
                expect(result.current.isError).toBe(true);
            });

            expect(result.current.error).toEqual(error);
        });

        it('should not fetch when disabled', async () => {
            const {result} = renderHook(() => useActiveStaff({enabled: false}), {
                wrapper: createWrapper(),
            });

            expect(result.current.data).toBeUndefined();
            expect(mockTasksApi.getActiveStaff).not.toHaveBeenCalled();
        });
    });

    describe('useEventTypes', () => {
        it('should fetch event types successfully', async () => {
            mockTasksApi.getEventTypes.mockResolvedValueOnce(mockEventTypes);

            const {result} = renderHook(() => useEventTypes(), {
                wrapper: createWrapper(),
            });

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            expect(result.current.data).toEqual(mockEventTypes);
            expect(mockTasksApi.getEventTypes).toHaveBeenCalled();
        });

        it('should handle errors', async () => {
            const error = new Error('Failed to fetch event types');
            mockTasksApi.getEventTypes.mockRejectedValueOnce(error);

            const {result} = renderHook(() => useEventTypes(), {
                wrapper: createWrapper(),
            });

            await waitFor(() => {
                expect(result.current.isError).toBe(true);
            });

            expect(result.current.error).toEqual(error);
        });

        it('should not fetch when disabled', async () => {
            const {result} = renderHook(() => useEventTypes({enabled: false}), {
                wrapper: createWrapper(),
            });

            expect(result.current.data).toBeUndefined();
            expect(mockTasksApi.getEventTypes).not.toHaveBeenCalled();
        });
    });

    describe('useDeliveryJourney', () => {
        it('should fetch delivery journey successfully', async () => {
            mockTasksApi.getDeliveryJourney.mockResolvedValueOnce(mockDeliveryJourney);

            const {result} = renderHook(() => useDeliveryJourney(123), {
                wrapper: createWrapper(),
            });

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            expect(result.current.data).toEqual(mockDeliveryJourney);
            expect(mockTasksApi.getDeliveryJourney).toHaveBeenCalledWith(123, expect.anything());
        });

        it('should not fetch when jobId is undefined', async () => {
            const {result} = renderHook(() => useDeliveryJourney(undefined), {
                wrapper: createWrapper(),
            });

            expect(result.current.data).toBeUndefined();
            expect(mockTasksApi.getDeliveryJourney).not.toHaveBeenCalled();
        });

        it('should not fetch when jobId is 0', async () => {
            const {result} = renderHook(() => useDeliveryJourney(0), {
                wrapper: createWrapper(),
            });

            expect(result.current.data).toBeUndefined();
            expect(mockTasksApi.getDeliveryJourney).not.toHaveBeenCalled();
        });

        it('should handle errors', async () => {
            const error = new Error('Failed to fetch delivery journey');
            mockTasksApi.getDeliveryJourney.mockRejectedValueOnce(error);

            const {result} = renderHook(() => useDeliveryJourney(123), {
                wrapper: createWrapper(),
            });

            await waitFor(() => {
                expect(result.current.isError).toBe(true);
            });

            expect(result.current.error).toEqual(error);
        });
    });

    describe('useMarkTaskAsClosed', () => {
        it('should mark task as closed successfully', async () => {
            mockTasksApi.markTaskAsClosed.mockResolvedValueOnce(undefined);

            const {result} = renderHook(() => useMarkTaskAsClosed(), {
                wrapper: createWrapper(),
            });

            result.current.mutate({eventId: 123, closed: true});

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            expect(mockTasksApi.markTaskAsClosed).toHaveBeenCalledWith(123, true);
        });

        it('should reopen task successfully', async () => {
            mockTasksApi.markTaskAsClosed.mockResolvedValueOnce(undefined);

            const {result} = renderHook(() => useMarkTaskAsClosed(), {
                wrapper: createWrapper(),
            });

            result.current.mutate({eventId: 456, closed: false});

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            expect(mockTasksApi.markTaskAsClosed).toHaveBeenCalledWith(456, false);
        });

        it('should handle errors', async () => {
            const error = new Error('Failed to update task');
            mockTasksApi.markTaskAsClosed.mockRejectedValueOnce(error);

            const {result} = renderHook(() => useMarkTaskAsClosed(), {
                wrapper: createWrapper(),
            });

            result.current.mutate({eventId: 123, closed: true});

            await waitFor(() => {
                expect(result.current.isError).toBe(true);
            });

            expect(result.current.error).toEqual(error);
        });
    });

    describe('useUpdateTaskDate', () => {
        it('should update task date successfully', async () => {
            mockTasksApi.updateTaskDate.mockResolvedValueOnce(undefined);
            const newDate = dayjs('2024-02-01');

            const {result} = renderHook(() => useUpdateTaskDate(), {
                wrapper: createWrapper(),
            });

            result.current.mutate({eventId: 123, date: newDate});

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            expect(mockTasksApi.updateTaskDate).toHaveBeenCalledWith(123, newDate, undefined);
        });

        it('should handle errors', async () => {
            const error = new Error('Failed to update date');
            mockTasksApi.updateTaskDate.mockRejectedValueOnce(error);

            const {result} = renderHook(() => useUpdateTaskDate(), {
                wrapper: createWrapper(),
            });

            result.current.mutate({eventId: 123, date: dayjs()});

            await waitFor(() => {
                expect(result.current.isError).toBe(true);
            });

            expect(result.current.error).toEqual(error);
        });
    });

    describe('useUpdateTaskTime', () => {
        it('should update task time successfully', async () => {
            mockTasksApi.updateTaskTime.mockResolvedValueOnce(undefined);
            const newTime = dayjs('2024-01-15T14:30:00');

            const {result} = renderHook(() => useUpdateTaskTime(), {
                wrapper: createWrapper(),
            });

            result.current.mutate({eventId: 123, time: newTime});

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            expect(mockTasksApi.updateTaskTime).toHaveBeenCalledWith(123, newTime, undefined);
        });

        it('should handle errors', async () => {
            const error = new Error('Failed to update time');
            mockTasksApi.updateTaskTime.mockRejectedValueOnce(error);

            const {result} = renderHook(() => useUpdateTaskTime(), {
                wrapper: createWrapper(),
            });

            result.current.mutate({eventId: 123, time: dayjs()});

            await waitFor(() => {
                expect(result.current.isError).toBe(true);
            });

            expect(result.current.error).toEqual(error);
        });
    });

    describe('useReassignTask', () => {
        it('should reassign task successfully', async () => {
            mockTasksApi.reassignTaskToStaff.mockResolvedValueOnce(undefined);

            const {result} = renderHook(() => useReassignTask(), {
                wrapper: createWrapper(),
            });

            result.current.mutate({eventId: 123, staffId: 456});

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            expect(mockTasksApi.reassignTaskToStaff).toHaveBeenCalledWith(123, 456);
        });

        it('should handle errors', async () => {
            const error = new Error('Failed to reassign task');
            mockTasksApi.reassignTaskToStaff.mockRejectedValueOnce(error);

            const {result} = renderHook(() => useReassignTask(), {
                wrapper: createWrapper(),
            });

            result.current.mutate({eventId: 123, staffId: 456});

            await waitFor(() => {
                expect(result.current.isError).toBe(true);
            });

            expect(result.current.error).toEqual(error);
        });
    });
});
