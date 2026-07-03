/**
 * React Query Hooks for Tasks API
 *
 * Query and mutation hooks for task-related operations.
 */

import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {queryKeys} from '../query';
import {tasksApi} from '../services/tasksApi';
import {EventTypeSuggestion, StaffSuggestion, Task, TaskFiltersRequest} from '../interfaces';
import type {DeliveryJourney} from '../components/common/task-history/TaskHistory.interfaces';
import {Dayjs} from 'dayjs';

/**
 * Hook to fetch tasks with filters
 *
 * @param filters - Optional filters for the task query
 * @param options - Additional query options
 * @returns Query result with tasks, loading state, and error
 *
 * @example
 * ```tsx
 * const { data: tasks, isLoading, refetch } = useTasks({
 *   startDate: '2024-01-01',
 *   endDate: '2024-01-31',
 *   showCompleted: false
 * });
 * ```
 */
export function useTasks(
    filters?: TaskFiltersRequest,
    options?: {
        enabled?: boolean;
        refetchInterval?: number | false;
    }
) {
    return useQuery<Task[], Error>({
        queryKey: queryKeys.tasks.list(filters || {}),
        queryFn: ({signal}) => tasksApi.getAllTasks(filters, {signal}),
        enabled: options?.enabled ?? true,
        refetchInterval: options?.refetchInterval ?? false,
    });
}

/**
 * Hook to fetch active staff list
 *
 * @returns Query result with staff list
 */
export function useActiveStaff(options?: {enabled?: boolean}) {
    return useQuery<StaffSuggestion[], Error>({
        queryKey: queryKeys.tasks.staff,
        queryFn: ({signal}) => tasksApi.getActiveStaff({signal}),
        enabled: options?.enabled ?? true,
        staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    });
}

/**
 * Hook to fetch event types list
 *
 * @returns Query result with event types list
 */
export function useEventTypes(options?: {enabled?: boolean}) {
    return useQuery<EventTypeSuggestion[], Error>({
        queryKey: queryKeys.tasks.eventTypes,
        queryFn: ({signal}) => tasksApi.getEventTypes({signal}),
        enabled: options?.enabled ?? true,
        staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    });
}

/**
 * Hook to fetch delivery journey for a job
 *
 * @param jobId - The job ID to get delivery journey for
 * @param options
 * @returns Query result with delivery journey events
 */
export function useDeliveryJourney(jobId?: number, options?: {enabled?: boolean; refetchInterval?: number | false}) {
    return useQuery<DeliveryJourney[], Error>({
        queryKey: queryKeys.tasks.deliveryJourney(jobId || 0),
        queryFn: ({signal}) => tasksApi.getDeliveryJourney(jobId!, {signal}),
        enabled: (options?.enabled ?? true) && !!jobId && jobId > 0,
        refetchInterval: options?.refetchInterval,
    });
}

/**
 * Hook to mark a task as closed or reopened
 *
 * @returns Mutation for closing/reopening tasks
 */
export function useMarkTaskAsClosed() {
    const queryClient = useQueryClient();

    return useMutation<void, Error, {eventId: number; closed: boolean}>({
        mutationFn: ({eventId, closed}) => tasksApi.markTaskAsClosed(eventId, closed),
        onSuccess: async () => {
            // Invalidate all task queries to refetch
            await queryClient.invalidateQueries({queryKey: queryKeys.tasks.all});
        },
    });
}

/**
 * Hook to update a task's due date
 *
 * @returns Mutation for updating task date
 */
export function useUpdateTaskDate() {
    const queryClient = useQueryClient();

    return useMutation<void, Error, {eventId: number; date: Dayjs; timezone?: string}>({
        mutationFn: ({eventId, date, timezone}) => tasksApi.updateTaskDate(eventId, date, timezone),
        onSuccess: async () => {
            await queryClient.invalidateQueries({queryKey: queryKeys.tasks.all});
        },
    });
}

/**
 * Hook to update a task's due time
 *
 * @returns Mutation for updating task time
 */
export function useUpdateTaskTime() {
    const queryClient = useQueryClient();

    return useMutation<void, Error, {eventId: number; time: Dayjs; timezone?: string}>({
        mutationFn: ({eventId, time, timezone}) => tasksApi.updateTaskTime(eventId, time, timezone),
        onSuccess: async () => {
            await queryClient.invalidateQueries({queryKey: queryKeys.tasks.all});
        },
    });
}

/**
 * Hook to reassign a task to a different staff member
 *
 * @returns Mutation for reassigning tasks
 */
export function useReassignTask() {
    const queryClient = useQueryClient();

    return useMutation<void, Error, {eventId: number; staffId: number}>({
        mutationFn: ({eventId, staffId}) => tasksApi.reassignTaskToStaff(eventId, staffId),
        onSuccess: async () => {
            await queryClient.invalidateQueries({queryKey: queryKeys.tasks.all});
        },
    });
}

/**
 * Hook to unassign a task, clearing its assigned staff member
 *
 * @returns Mutation for unassigning tasks
 */
export function useUnassignTask() {
    const queryClient = useQueryClient();

    return useMutation<void, Error, {eventId: number}>({
        mutationFn: ({eventId}) => tasksApi.unassignTask(eventId),
        onSuccess: async () => {
            await queryClient.invalidateQueries({queryKey: queryKeys.tasks.all});
        },
    });
}
