/**
 * React Query Hooks for Recurring Jobs API
 *
 * Query hooks for recurring jobs data fetching.
 * For mutations (void, export), use recurringJobsApi directly.
 */

import {useQuery, keepPreviousData} from '@tanstack/react-query';
import {queryKeys} from '../query';
import {recurringJobsApi} from '../services/recurringJobsApi';
import {PaginatedRecurringJobsResponse, RecurringJobQuery, SpeedOption} from '../interfaces';

/**
 * Hook to load paginated recurring jobs list
 *
 * @param query - Query parameters for filtering, sorting, and pagination
 * @param options - Additional options
 * @returns Query result with paginated jobs, loading state, and error
 *
 * @example
 * ```tsx
 * const { data, isLoading, refetch } = useRecurringJobsList({
 *   order: 'booked',
 *   orderDirection: 'desc',
 *   limit: 50,
 *   page: 1,
 *   active: true,
 *   searchText: 'client name'
 * });
 * ```
 */
export function useRecurringJobsList(
    query: RecurringJobQuery,
    options?: {
        enabled?: boolean;
    }
) {
    return useQuery<PaginatedRecurringJobsResponse, Error>({
        queryKey: queryKeys.recurringJobs.list(query),
        queryFn: ({signal}) => recurringJobsApi.getPreBookJobs(query, {signal}),
        enabled: options?.enabled ?? true,
        placeholderData: keepPreviousData,
    });
}

/**
 * Hook to load available speeds for filtering
 *
 * @param options - Additional options
 * @returns Query result with speed options, loading state, and error
 *
 * @example
 * ```tsx
 * const { data: speeds, isLoading } = useSpeedList();
 * ```
 */
export function useSpeedList(options?: { enabled?: boolean }) {
    return useQuery<SpeedOption[], Error>({
        queryKey: queryKeys.recurringJobs.speeds,
        queryFn: ({signal}) => recurringJobsApi.getSpeedList({signal}),
        enabled: options?.enabled ?? true,
        staleTime: 5 * 60 * 1000, // Cache for 5 minutes (speeds rarely change)
        gcTime: 30 * 60 * 1000, // Keep in cache for 30 minutes
    });
}
