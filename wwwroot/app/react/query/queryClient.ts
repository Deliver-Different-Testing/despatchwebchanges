/**
 * React Query Client Configuration
 *
 * Centralized QueryClient setup with sensible defaults for the application.
 */

import {QueryClient} from '@tanstack/react-query';

/**
 * Default options for all queries
 */
const defaultQueryOptions = {
    queries: {
        // Don't refetch on window focus (can be enabled per-query if needed)
        refetchOnWindowFocus: false,

        // Retry failed requests once
        retry: 1,

        // Consider data stale after 30 seconds
        staleTime: 30 * 1000,

        // Keep unused data in cache for 5 minutes
        gcTime: 5 * 60 * 1000,
    },
    mutations: {
        // Don't retry mutations by default
        retry: 0,
    },
};

/**
 * Singleton QueryClient instance
 *
 * Use this instance throughout the application to ensure
 * consistent caching and state management.
 */
export const queryClient = new QueryClient({
    defaultOptions: defaultQueryOptions,
});

/**
 * Query key factory for type-safe and consistent query keys
 *
 * Usage:
 *   queryKeys.couriers.search('john')  // ['couriers', 'search', 'john']
 *   queryKeys.couriers.all             // ['couriers']
 *   queryKeys.jobs.related(123, false) // ['jobs', 'related', 123, false]
 */
export const queryKeys = {
    couriers: {
        all: ['couriers'] as const,
        search: (searchText: string) => ['couriers', 'search', searchText] as const,
    },
    timeZones: {
        all: ['timeZones'] as const,
    },
    jobs: {
        all: ['jobs'] as const,
        related: (jobId: number, isArchived: boolean) =>
            ['jobs', 'related', jobId, isArchived] as const,
    },
    addresses: {
        all: ['addresses'] as const,
        search: (searchText: string) => ['addresses', 'search', searchText] as const,
        details: (addressId: string) => ['addresses', 'details', addressId] as const,
        nearest: (lat: number, lng: number) => ['addresses', 'nearest', lat, lng] as const,
    },
    hereMaps: {
        apiKey: ['hereMaps', 'apiKey'] as const,
    },
    recurringJobs: {
        all: ['recurringJobs'] as const,
        list: (query: {
            order: string;
            orderDirection: string;
            limit: number;
            page: number;
            active: boolean;
            searchText?: string;
            speedId?: number;
            time?: string;
            courierId?: number;
            daysOfWeek?: number;
        }) => ['recurringJobs', 'list', query] as const,
        speeds: ['recurringJobs', 'speeds'] as const,
    },
} as const;

export default queryClient;
