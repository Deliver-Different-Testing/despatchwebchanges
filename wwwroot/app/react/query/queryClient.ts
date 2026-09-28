/**
 * React Query Client Configuration
 *
 * Centralized QueryClient setup with sensible defaults for the application.
 */

import {QueryClient} from '@tanstack/react-query';
import type {PaginatedRequest, TodayActiveDriverFilter, ComplianceFilter, AfterHoursFilter} from '../interfaces/driverManagement';
import type {OverviewQueryParams} from '../pages/overview/OverviewPage.interfaces';
import type {JobListSearchParams} from '../interfaces/dispatchJob';

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
 * Shared QueryClient singleton
 *
 * Uses the instance created by vendor-react (window.ReactQueryClient) so that
 * all React module bundles (job list, job detail, dialogs, etc.) share the
 * same query cache. This enables cross-component cache invalidation — e.g.,
 * updating a job in the detail panel automatically refreshes the job list.
 *
 * Falls back to creating a new instance for unit tests or if vendor-react
 * hasn't loaded yet.
 */
function getSharedQueryClient(): QueryClient {
    const win = typeof window !== 'undefined' ? window : undefined;
    if (win?.ReactQueryClient) {
        // Apply our full default options to the shared instance
        win.ReactQueryClient.setDefaultOptions(defaultQueryOptions);
        return win.ReactQueryClient;
    }
    // Fallback for tests or standalone usage
    return new QueryClient({defaultOptions: defaultQueryOptions});
}

export const queryClient = getSharedQueryClient();

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
        locations: (
            bounds: {minLng: number; minLat: number; maxLng: number; maxLat: number},
            fleetIds: number[],
        ) => ['couriers', 'locations', bounds, fleetIds] as const,
        fleetOptions: ['couriers', 'fleetOptions'] as const,
    },
    timeZones: {
        all: ['timeZones'] as const,
    },
    clients: {
        all: ['clients'] as const,
        search: (searchText: string) => ['clients', 'search', searchText] as const,
    },
    vehicles: {
        all: ['vehicles'] as const,
    },
    jobs: {
        all: ['jobs'] as const,
        related: (jobId: number, isArchived: boolean) =>
            ['jobs', 'related', jobId, isArchived] as const,
        detail: (jobId: number, type: 'standard' | 'recurring' | 'bulk') =>
            ['jobs', 'detail', jobId, type] as const,
        photos: (jobId: number, photoType: 'delivery' | 'pickup') =>
            ['jobs', 'photos', jobId, photoType] as const,
        internalStatuses: ['jobs', 'internalStatuses'] as const,
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
            routeId?: number;
        }) => ['recurringJobs', 'list', query] as const,
        speeds: ['recurringJobs', 'speeds'] as const,
        routes: ['recurringJobs', 'routes'] as const,
        deliveryJourney: (bookingId: number) =>
            ['recurringJobs', 'deliveryJourney', bookingId] as const,
    },
    notes: {
        all: ['notes'] as const,
        types: ['notes', 'types'] as const,
        job: (jobId: number, isRecurring: boolean) =>
            ['notes', 'job', jobId, isRecurring] as const,
        bulkJob: (bulkJobId: number) =>
            ['notes', 'bulkJob', bulkJobId] as const,
        history: (noteId: number, noteSource: string) =>
            ['notes', 'history', noteId, noteSource] as const,
    },
    priceBreakdowns: {
        all: ['priceBreakdowns'] as const,
        job: (jobId: number, isPrebook: boolean, isArchived: boolean) =>
            ['priceBreakdowns', 'job', jobId, isPrebook, isArchived] as const,
    },
    splitPriceBreakdown: {
        all: ['splitPriceBreakdown'] as const,
        job: (jobId: number) => ['splitPriceBreakdown', 'job', jobId] as const,
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
            limit?: number;
        }) => ['tasks', 'list', filters] as const,
        staff: ['tasks', 'staff'] as const,
        eventTypes: ['tasks', 'eventTypes'] as const,
        deliveryJourney: (jobId: number) => ['tasks', 'deliveryJourney', jobId] as const,
    },
    overview: {
        all: ['overview'] as const,
        jobs: (params: OverviewQueryParams) => ['overview', 'jobs', params] as const,
        regions: ['overview', 'regions'] as const,
        speeds: ['overview', 'speeds'] as const,
        stats: ['overview', 'stats'] as const,
        openJobs: (params: Pick<OverviewQueryParams, 'startDate' | 'endDate' | 'regions' | 'speeds' | 'couriers'>) =>
            ['overview', 'openJobs', params] as const,
        parentJobMap: (jobId: number) => ['overview', 'parentJobMap', jobId] as const,
    },
    jobSearch: {
        all: ['jobSearch'] as const,
        pod: (params: JobListSearchParams) => ['jobSearch', 'pod', params] as const,
        bulk: (params: JobListSearchParams) => ['jobSearch', 'bulk', params] as const,
        scanDetail: (jobId: number, isBulkJob: boolean) =>
            ['jobSearch', 'scanDetail', jobId, isBulkJob] as const,
    },
    dispatch: {
        all: ['dispatch'] as const,
        jobs: (params: JobListSearchParams) => ['dispatch', 'jobs', params] as const,
        clearList: (params: JobListSearchParams) => ['dispatch', 'clearList', params] as const,
        clearListEnvelope: (clearListId: number) => ['dispatch', 'clearListEnvelope', clearListId] as const,
        currentWork: (params: JobListSearchParams) => ['dispatch', 'currentWork', params] as const,
        currentWorkMap: (params: JobListSearchParams) => ['dispatch', 'currentWorkMap', params] as const,
        pageViews: (pageId: number) => ['dispatch', 'pageViews', pageId] as const,
        driverOverview: ['dispatch', 'driverOverview'] as const,
        driverLocations: (viewIds: number[], startDate?: string, endDate?: string) =>
            ['dispatch', 'driverLocations', viewIds, startDate, endDate] as const,
        truckCourierStatus: (courierId: number) => ['dispatch', 'truckCourierStatus', courierId] as const,
    },
    nationwide: {
        all: ['nationwide'] as const,
        newJobs: (params: JobListSearchParams) => ['nationwide', 'newJobs', params] as const,
        podJobs: (params: JobListSearchParams) => ['nationwide', 'podJobs', params] as const,
        repriceJobs: (params: JobListSearchParams) => ['nationwide', 'repriceJobs', params] as const,
    },
    driverManagement: {
        all: ['driverManagement'] as const,
        searchCouriers: (searchTerm: string) =>
            ['driverManagement', 'searchCouriers', searchTerm] as const,
        courierDetails: (courierId: number) =>
            ['driverManagement', 'courierDetails', courierId] as const,
        fleetOptions: ['driverManagement', 'fleetOptions'] as const,
        todayActive: (query: PaginatedRequest, filters: TodayActiveDriverFilter) =>
            ['driverManagement', 'todayActive', query, filters] as const,
        compliance: (query: PaginatedRequest, filters: ComplianceFilter) =>
            ['driverManagement', 'compliance', query, filters] as const,
        afterHours: (query: PaginatedRequest, filters: AfterHoursFilter) =>
            ['driverManagement', 'afterHours', query, filters] as const,
        driverEmails: (query: PaginatedRequest) =>
            ['driverManagement', 'driverEmails', query] as const,
        earnings: (query: PaginatedRequest) =>
            ['driverManagement', 'earnings', query] as const,
    },
} as const;

export default queryClient;
