/**
 * React Query Hooks for Recurring Jobs API
 *
 * Query hooks for recurring jobs data fetching.
 * For mutations (void, export), use recurringJobsApi directly.
 */

import {useQuery, keepPreviousData} from '@tanstack/react-query';
import {queryKeys} from '../query';
import {recurringJobsApi} from '../services/recurringJobsApi';
import {PaginatedRecurringJobsResponse, RecurringJobQuery, RouteOption, SpeedOption} from '../interfaces';
import type {RecurringJourney} from '../components/common/recurring-delivery-journey/RecurringDeliveryJourney.types';

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

/**
 * Hook to load active Recurring Routes for the route filter dropdown.
 *
 * @param options - Additional options
 * @returns Query result with route options, loading state, and error
 */
export function useRouteList(options?: { enabled?: boolean }) {
    return useQuery<RouteOption[], Error>({
        queryKey: queryKeys.recurringJobs.routes,
        queryFn: ({signal}) => recurringJobsApi.getRouteList({signal}),
        enabled: options?.enabled ?? true,
        staleTime: 5 * 60 * 1000, // Cache for 5 minutes (routes rarely change)
        gcTime: 30 * 60 * 1000, // Keep in cache for 30 minutes
    });
}

/**
 * Hook to load the Recurring Log (one entry per live job spawned from a
 * recurring booking family) plus its breakdown counts.
 *
 * Polls every 2 minutes to mirror the live-job delivery journey cadence.
 */
export function useRecurringJobDeliveryJourney(
    bookingId: number | null | undefined,
    options?: {enabled?: boolean; refetchInterval?: number | false},
) {
    return useQuery<RecurringJourney, Error>({
        queryKey: queryKeys.recurringJobs.deliveryJourney(bookingId ?? 0),
        queryFn: ({signal}) => recurringJobsApi.getDeliveryJourney(bookingId!, {signal}),
        enabled: (options?.enabled ?? true) && !!bookingId && bookingId > 0,
        refetchInterval: options?.refetchInterval ?? 2 * 60 * 1000,
    });
}
