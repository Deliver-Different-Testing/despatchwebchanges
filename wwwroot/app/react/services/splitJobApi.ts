/**
 * Split Job API Service
 *
 * React-native API service for split job operations.
 * Uses fetch with proper security headers instead of AngularJS $http.
 */

import {apiClient} from './apiClient';
import {AddressViewModel} from '../interfaces';

/**
 * One leg's confirmed share of the parent total. Shares are sent rather than per-line amounts so
 * the server stays the single source of truth for rounding.
 */
export interface SplitPricingAllocationItem {
    sequence: number;
    sharePercent: number;
}

/**
 * One leg's confirmed share of a single breakdown line, for a charge that shouldn't follow the
 * overall split — a congestion charge only one leg's route incurred, for example.
 */
export interface SplitPricingLineAllocationItem {
    /** The parent breakdown line this override applies to; 0 for the synthesised line. */
    pricingBreakdownId: number;
    sequence: number;
    sharePercent: number;
}

/**
 * Request model for splitting a job with a meeting point address.
 */
export interface SplitJobRequest {
    jobId: number;
    meetingPointAddress: AddressViewModel;
    courierIdForLegB?: number | null;
    /** Omitted for callers that don't confirm pricing — the server then derives the split itself. */
    pricingAllocation?: SplitPricingAllocationItem[] | null;
    /** Only the lines the user adjusted; every other line follows `pricingAllocation`. */
    lineAllocation?: SplitPricingLineAllocationItem[] | null;
}

/** How the proposed per-leg shares were derived. */
export type SplitPricingBasis = 'RoadMiles' | 'StraightLine' | 'UserConfirmed' | 'LegRates' | 'EvenSplit';

export interface SplitPricingLine {
    /** The parent line this was divided out of; 0 for the synthesised line. */
    pricingBreakdownId: number;
    name: string;
    revenue: number;
    cost: number;
}

/** One of the parent's lines, before it is divided — what a per-line share is set against. */
export interface SplitPricingParentLine {
    pricingBreakdownId: number;
    /** The original charge name, without a "Part {suffix}". */
    name: string;
    revenue: number;
    cost: number;
    isAccessorial: boolean;
}

export interface SplitPricingLeg {
    sequence: number;
    letterSuffix: string;
    jobNumber: string;
    miles: number;
    sharePercent: number;
    totalRevenue: number;
    totalCost: number;
    lines: SplitPricingLine[];
}

export interface SplitPricingPreview {
    basis: SplitPricingBasis;
    parentTotalRevenue: number;
    parentTotalCost: number;
    /** True when the job has no itemised lines and a single synthesised line is being divided. */
    isSynthesised: boolean;
    /** The undivided lines behind the split, each of which can be given its own share. */
    parentLines: SplitPricingParentLine[];
    legs: SplitPricingLeg[];
}

export interface SplitPricingPreviewRequest {
    jobId: number;
    meetingPointAddress: AddressViewModel;
}

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
