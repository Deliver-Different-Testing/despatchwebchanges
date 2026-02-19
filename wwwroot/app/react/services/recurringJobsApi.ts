/**
 * Recurring Jobs API Service
 *
 * API client for recurring jobs operations.
 * Used by the React Recurring Jobs page.
 */

import {apiClient, downloadBlob} from './apiClient';
import {
    PaginatedRecurringJobsResponse,
    PaginatedRecurringJobsResponseDto,
    RecurringJobQuery,
    SpeedOption,
    transformPaginatedResponse,
} from '../interfaces';

export const recurringJobsApi = {
    /**
     * Fetch paginated list of recurring jobs
     * @param query - Query parameters for filtering, sorting, and pagination
     * @returns Paginated response with transformed job models
     */
    getPreBookJobs: async (query: RecurringJobQuery): Promise<PaginatedRecurringJobsResponse> => {
        const response = await apiClient.post<PaginatedRecurringJobsResponseDto>(
            'job/PreBookJobs',
            query
        );
        return transformPaginatedResponse(response);
    },

    /**
     * Fetch list of available speeds for filtering
     * @returns Array of speed options
     */
    getSpeedList: async (): Promise<SpeedOption[]> => {
        return await apiClient.get<SpeedOption[]>('job/SpeedList');
    },

    /**
     * Void (inactivate) a recurring job
     * @param jobId - ID of the job to void
     */
    voidPrebookJob: async (jobId: number): Promise<void> => {
        await apiClient.get('job/VoidPrebookJob', {jobId});
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
