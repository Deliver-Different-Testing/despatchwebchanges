/**
 * Split Pricing Breakdown API Service
 *
 * React-native API service for the split-parent pricing grid
 * (docs/pricing/job-splitting-price-breakdown.md §3/§8).
 */

import {apiClient} from './apiClient';
import {RequestOptions} from './requestOptions';
import type {SplitPriceBreakdown, UpdateSplitPricingBreakdownRequest} from '../interfaces/splitJobs';

/**
 * Fetches the split-parent grid's data. Null means the job isn't a split parent, or is one with
 * no allocation rows yet (split before this feature shipped) — not an error.
 */
export async function getSplitPricingBreakdown(
    jobId: number,
    isArchived = false,
    options?: RequestOptions,
): Promise<SplitPriceBreakdown | null> {
    const breakdown = await apiClient.get<SplitPriceBreakdown | null>(
        'job/GetSplitPricingBreakdown', {jobId, isArchived}, options,
    );
    return breakdown ?? null;
}

/** One batched Save & Close — every revenue/share/cost-override edit made in the grid session. */
export async function updateSplitPricingBreakdown(request: UpdateSplitPricingBreakdownRequest): Promise<void> {
    await apiClient.post('job/UpdateSplitPricingBreakdown', request);
}

export const splitPriceBreakdownApi = {
    getSplitPricingBreakdown,
    updateSplitPricingBreakdown,
};

export default splitPriceBreakdownApi;
