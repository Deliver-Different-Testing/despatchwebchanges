/**
 * React Query Hooks for Courier API
 *
 * Provides type-safe hooks for courier-related API operations
 * with automatic caching, loading states, and error handling.
 */

import {useQuery} from '@tanstack/react-query';
import {queryKeys} from '../query';
import {courierApi} from '../services/courierApi';
import {CourierSuggestion, TimeZoneOption} from '../interfaces';

/**
 * Hook to search for active couriers
 *
 * @param searchText - Search text (minimum 2 characters to trigger search by default)
 * @param options - Additional options. `minLength` lowers the search floor for
 *   callers that must match short courier codes.
 * @returns Query result with couriers array, loading state, and error
 *
 * @example
 * ```tsx
 * const { data: couriers, isLoading, error } = useCourierSearch(searchText);
 * ```
 */
export function useCourierSearch(
    searchText: string,
    options?: {
        enabled?: boolean;
        minLength?: number;
    }
) {
    const shouldSearch = searchText.length >= (options?.minLength ?? 2);

    return useQuery<CourierSuggestion[], Error>({
        queryKey: queryKeys.couriers.search(searchText),
        queryFn: ({signal}) => courierApi.searchActiveCouriers(searchText, {signal}),
        enabled: shouldSearch && (options?.enabled ?? true),
        staleTime: 60 * 1000, // Cache search results for 1 minute
    });
}

/**
 * Hook to load timezone options
 *
 * @param options - Additional options
 * @returns Query result with timezone options, loading state, and error
 *
 * @example
 * ```tsx
 * const { data: timeZones, isLoading } = useTimeZoneOptions();
 * ```
 */
export function useTimeZoneOptions(options?: {enabled?: boolean}) {
    return useQuery<TimeZoneOption[], Error>({
        queryKey: queryKeys.timeZones.all,
        queryFn: ({signal}) => courierApi.getTimeZoneOptions({signal}),
        enabled: options?.enabled ?? true,
        staleTime: 5 * 60 * 1000, // Cache timezone options for 5 minutes (rarely change)
        gcTime: 30 * 60 * 1000, // Keep in cache for 30 minutes
    });
}
