/**
 * Recurring Jobs API Service
 *
 * API client for recurring jobs operations.
 * Used by the React Recurring Jobs page.
 */

import {apiClient} from './apiClient';
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
        const response = await fetch('job/RecurringJobsExportCsv', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
            },
            body: JSON.stringify(query),
            credentials: 'same-origin',
        });

        if (!response.ok) {
            throw new Error('Failed to export CSV');
        }

        // Extract filename from content-disposition header if available
        const contentDisposition = response.headers.get('content-disposition');
        let filename = `recurring-jobs-${query.active ? 'active' : 'inactive'}.csv`;
        if (contentDisposition) {
            const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
            if (filenameMatch && filenameMatch[1]) {
                filename = filenameMatch[1].replace(/['"]/g, '');
            }
        }

        // Create blob and trigger download
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    },
};

export default recurringJobsApi;
