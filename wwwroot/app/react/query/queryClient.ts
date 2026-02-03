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
        locations: (bounds: { minLng: number; minLat: number; maxLng: number; maxLat: number }) =>
            ['couriers', 'locations', bounds] as const,
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
    notes: {
        all: ['notes'] as const,
        types: ['notes', 'types'] as const,
        job: (jobId: number, isRecurring: boolean) =>
            ['notes', 'job', jobId, isRecurring] as const,
        bulkJob: (bulkJobId: number) =>
            ['notes', 'bulkJob', bulkJobId] as const,
    },
    priceBreakdowns: {
        all: ['priceBreakdowns'] as const,
        job: (jobId: number, isPrebook: boolean, isArchived: boolean) =>
            ['priceBreakdowns', 'job', jobId, isPrebook, isArchived] as const,
    },
    tasks: {
        all: ['tasks'] as const,
        list: (filters: {
            searchText?: string;
            staffId?: number;
            eventTypeId?: number;
            startDate?: string;
            endDate?: string;
            showCompleted?: boolean;
            jobId?: number;
        }) => ['tasks', 'list', filters] as const,
        staff: ['tasks', 'staff'] as const,
        eventTypes: ['tasks', 'eventTypes'] as const,
        deliveryJourney: (jobId: number) => ['tasks', 'deliveryJourney', jobId] as const,
    },
} as const;

export default queryClient;
