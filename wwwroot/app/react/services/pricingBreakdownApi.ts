/**
 * Pricing Breakdown API Service
 *
 * React-native API service for pricing breakdown operations.
 * Uses fetch with proper security headers instead of AngularJS $http.
 */

import {apiClient, RequestOptions} from './apiClient';

export interface PriceBreakdown {
    chargeId: number;
    name: string;
    amount: number;
    jobId?: number;
    prebookJobId?: number;
    costAmount?: number;
    childJobId?: number;
    isArchived?: boolean;
}

export interface CreatePriceBreakdownRequest {
    name: string;
    amount: number;
    costAmount?: number;
    jobId?: number;
    prebookJobId?: number;
    childJobId?: number;
    isArchived?: boolean;
}

export interface DeletePriceBreakdownRequest {
    chargeId: number;
    jobId: number;
    isArchived?: boolean;
}

export interface SuggestedFuelCharge {
    fuelChargeAmount: number;
    fuelCostAmount: number;
}

/**
 * Get price breakdowns for a job
 */
export async function getPriceBreakdowns(
    jobId: number,
    isPrebook: boolean,
    isArchived: boolean,
    options?: RequestOptions
): Promise<PriceBreakdown[]> {
    const breakdowns = await apiClient.get<PriceBreakdown[]>('job/GetPricingBreakdown', {
        jobId,
        isPrebook,
        isArchived,
    }, options);
    return breakdowns ?? [];
}

/**
 * Add a new price breakdown
 */
export async function addPriceBreakdown(breakdown: CreatePriceBreakdownRequest): Promise<number> {
    return apiClient.post<number>('job/AddPriceComponent', breakdown);
}

/**
 * Update an existing price breakdown
 */
export async function updatePriceBreakdown(breakdown: PriceBreakdown): Promise<void> {
    await apiClient.post('job/UpdatePriceComponent', breakdown);
}

/**
 * Delete a price breakdown
 */
export async function deletePriceBreakdown(request: DeletePriceBreakdownRequest): Promise<void> {
    await apiClient.post('job/DeletePriceComponent', request);
}

/**
 * Get a suggested fuel surcharge (revenue + driver cost) for a manually-added charge amount,
 * using the job's actual fuel rate and vehicle size driver fuel percentage.
 */
export async function getSuggestedFuelCharge(
    jobId: number,
    chargeAmount: number,
    isPrebook: boolean,
    isArchived?: boolean
): Promise<SuggestedFuelCharge> {
    return apiClient.get<SuggestedFuelCharge>('job/GetSuggestedFuelCharge', {
        jobId,
        chargeAmount,
        isPrebook,
        isArchived,
    });
}

export const pricingBreakdownApi = {
    getPriceBreakdowns,
    addPriceBreakdown,
    updatePriceBreakdown,
    deletePriceBreakdown,
    getSuggestedFuelCharge,
};

export default pricingBreakdownApi;
