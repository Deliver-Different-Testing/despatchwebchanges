/**
 * Job API Service
 *
 * React-native API service for job-related operations.
 * Uses fetch with proper security headers instead of AngularJS $http.
 */

import {apiClient} from './apiClient';
import {RelatedJobDto, VoidJobRequest, VoidBulkJobRequest} from '../interfaces/job';

/**
 * Get related jobs for multi-select void operation
 */
export async function getRelatedJobsMultiSelectList(
    jobId: number,
    isArchived: boolean
): Promise<RelatedJobDto[]> {
    return apiClient.get<RelatedJobDto[]>('job/GetRelatedJobsMultiSelectList', {
        jobId,
        isArchived,
    });
}

/**
 * Void a single job or multiple related jobs
 */
export async function voidJob(request: VoidJobRequest): Promise<void> {
    await apiClient.post('job/Void', request);
}

/**
 * Void a bulk job or multiple related jobs
 */
export async function voidBulkJob(request: VoidBulkJobRequest): Promise<void> {
    await apiClient.post('job/VoidBulkJob', request);
}

export const jobApi = {
    getRelatedJobsMultiSelectList,
    voidJob,
    voidBulkJob,
};

export default jobApi;
