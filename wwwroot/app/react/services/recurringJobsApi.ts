/**
 * Recurring Jobs API Service
 *
 * API client for recurring jobs operations.
 * Used by the React Recurring Jobs page.
 */

import {apiClient, RequestOptions, downloadBlob} from './apiClient';
import {
    PaginatedRecurringJobsResponse,
    PaginatedRecurringJobsResponseDto,
    RecurringJobQuery,
    RouteOption,
    SpeedOption,
    transformPaginatedResponse,
} from '../interfaces';

export const recurringJobsApi = {
    /**
     * Fetch paginated list of recurring jobs
     * @param query - Query parameters for filtering, sorting, and pagination
     * @param options - Request options (signal, timeout)
     * @returns Paginated response with transformed job models
     */
    getPreBookJobs: async (query: RecurringJobQuery, options?: RequestOptions): Promise<PaginatedRecurringJobsResponse> => {
        const response = await apiClient.post<PaginatedRecurringJobsResponseDto>(
            'job/PreBookJobs',
            query,
            options
        );
        return transformPaginatedResponse(response);
    },

    /**
     * Fetch list of available speeds for filtering
     * @param options - Request options (signal, timeout)
     * @returns Array of speed options
     */
    getSpeedList: async (options?: RequestOptions): Promise<SpeedOption[]> => {
        return await apiClient.get<SpeedOption[]>('job/SpeedList', undefined, options);
    },

    /**
     * Fetch list of active Recurring Routes for the route filter dropdown.
     * @param options - Request options (signal, timeout)
     * @returns Array of route options
     */
    getRouteList: async (options?: RequestOptions): Promise<RouteOption[]> => {
        return await apiClient.get<RouteOption[]>('job/RouteList', undefined, options);
    },

    /**
     * Void (inactivate) a recurring job
     * @param jobId - ID of the job to void
     */
    voidPrebookJob: async (jobId: number): Promise<void> => {
        await apiClient.post('job/VoidPrebookJob', {jobId});
    },

    /**
     * Export recurring jobs to CSV
     * Downloads the file directly via blob
     * @param query - Query parameters to filter exported jobs
     */
    exportToCsv: async (query: RecurringJobQuery): Promise<void> => {
        const response = await apiClient.postForBlob('job/RecurringJobsExportCsv', query);
        downloadBlob(response, `recurring-jobs-${query.active ? 'active' : 'inactive'}.csv`);
    },
};

export default recurringJobsApi;
