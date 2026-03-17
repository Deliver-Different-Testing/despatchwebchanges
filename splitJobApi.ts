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
    /** Optional courier ID for the delivery leg (Leg B). Null = unallocated. */
    courierIdForLegB?: number | null;
}

/**
 * Split a job into multiple child jobs with a specified meeting point.
 * This is a combined operation that creates both child jobs with the
 * meeting point address already set, re-rates them, and finalizes the split.
 */
export async function splitJob(request: SplitJobRequest): Promise<void> {
    await apiClient.post<void>('job/splitJob', request);
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
    restoreSplitJobs,
    unSplitJob,
};

export default splitJobApi;
