/**
 * Split Job API Service
 *
 * React-native API service for split job operations.
 * Uses fetch with proper security headers instead of AngularJS $http.
 */

import {apiClient} from './apiClient';
import {SplitJobRequest, SplitPricingPreview, SplitPricingPreviewRequest} from "../interfaces/splitJobs";


/** How the proposed per-leg shares were derived. */
export type SplitPricingBasis = 'RoadMiles' | 'StraightLine' | 'UserConfirmed' | 'LegRates' | 'EvenSplit';

/**
 * Proposes how the job's pricing would divide across the two legs of a split. Read-only — nothing
 * is written until splitJob is called.
 */
export async function previewSplitPricing(
    request: SplitPricingPreviewRequest,
): Promise<SplitPricingPreview> {
    return apiClient.post<SplitPricingPreview>('job/PreviewSplitPricing', request);
}

/**
 * Split a job into pickup and delivery child jobs with a specified meeting point.
 * The backend performs the split synchronously and returns 200 OK on success.
 */
export async function splitJob(request: SplitJobRequest): Promise<void> {
    await apiClient.post('job/splitJob', request);
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
    previewSplitPricing,
    restoreSplitJobs,
    unSplitJob,
};

export default splitJobApi;
