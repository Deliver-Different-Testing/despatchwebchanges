/**
 * Split Job API Service
 *
 * React-native API service for split job operations.
 * Uses fetch with proper security headers instead of AngularJS $http.
 */

import {apiClient} from './apiClient';

export interface SplitJobRequest {
    jobId: number;
}

export interface UpdateSplitJobAddressRequest {
    jobId: number;
    toSuburbId: number;
    address: string;
    deliveryLat: number;
    deliveryLng: number;
}

/**
 * Split a job into multiple child jobs for separate delivery handling.
 */
export async function splitJob(jobId: number): Promise<void> {
    await apiClient.post<void>('job/splitJob', {jobId});
}

/**
 * Update the meeting address for a split job handoff point.
 */
export async function updateSplitJobAddress(
    jobId: number,
    toSuburbId: number,
    address: string,
    deliveryLat: number,
    deliveryLng: number
): Promise<void> {
    await apiClient.post<void>('job/UpdateSplitJobAddress', null, {
        params: {
            jobId,
            toSuburbId,
            address,
            deliveryLat,
            deliveryLng,
        },
    });
}

/**
 * Re-rate a split job after address changes.
 */
export async function reRateSplitJob(jobId: number): Promise<void> {
    await apiClient.post<void>('job/ReRateSplitJob', {jobId});
}

/**
 * Complete the split job process by consolidating information.
 */
export async function finishSplitJobProcess(jobId: number): Promise<void> {
    await apiClient.post<void>('job/finishSplitJobProcess', {jobId});
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
    updateSplitJobAddress,
    reRateSplitJob,
    finishSplitJobProcess,
    restoreSplitJobs,
    unSplitJob,
};

export default splitJobApi;
