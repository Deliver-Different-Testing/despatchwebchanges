/**
 * Split Job API Service
 *
 * React-native API service for split job operations.
 * Uses fetch with proper security headers instead of AngularJS $http.
 */

import {apiClient} from './apiClient';
import {AddressViewModel} from '../interfaces';

/**
 * Request model for splitting a job with a meeting point address.
 */
export interface SplitJobRequest {
    jobId: number;
    meetingPointAddress: AddressViewModel;
}

export interface SplitJobResponse {
    taskId: string;
}

export interface SplitJobStatusResponse {
    status: 'Running' | 'Completed' | 'Failed';
    errorMessage: string | null;
}

/**
 * Split a job into multiple child jobs with a specified meeting point.
 * Returns a taskId for polling the background operation status.
 */
export async function splitJob(request: SplitJobRequest): Promise<SplitJobResponse> {
    return apiClient.post<SplitJobResponse>('job/splitJob', request);
}

/**
 * Poll the status of a background split job operation.
 */
export async function getSplitJobStatus(taskId: string): Promise<SplitJobStatusResponse> {
    return apiClient.get<SplitJobStatusResponse>('job/splitJobStatus', { taskId });
}

/**
 * Restore split jobs back to their original state.
 */
export async function restoreSplitJobs(jobIds: number[]): Promise<void> {
    await apiClient.post<void>('job/RestoreSplitJobs', null, {
        params: {jobIds},
    });
}

/**
 * Reverse a job split, merging child jobs back into the parent.
 */
export async function unSplitJob(jobId: number): Promise<string> {
    return apiClient.post<string>('job/UnSplitJob', null, {
        params: {jobId},
    });
}

export const splitJobApi = {
    splitJob,
    getSplitJobStatus,
    restoreSplitJobs,
    unSplitJob,
};

export default splitJobApi;
