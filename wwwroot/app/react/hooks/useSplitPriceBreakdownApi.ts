/**
 * React Query Hooks for the Split Pricing Breakdown API
 */

import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {queryKeys} from '../query';
import {splitPriceBreakdownApi} from '../services/splitPriceBreakdownApi';
import type {SplitPriceBreakdown, UpdateSplitPricingBreakdownRequest} from '../interfaces/splitJobs';

export type {SplitPriceBreakdown, UpdateSplitPricingBreakdownRequest};

/** Null means: not a live split parent, or one predating this feature — fall back to the flat dialog. */
export function useSplitPricingBreakdown(jobId: number | undefined, options?: {enabled?: boolean}) {
    return useQuery<SplitPriceBreakdown | null, Error>({
        queryKey: queryKeys.splitPriceBreakdown.job(jobId ?? 0),
        queryFn: ({signal}) => splitPriceBreakdownApi.getSplitPricingBreakdown(jobId!, {signal}),
        enabled: !!jobId && (options?.enabled ?? true),
    });
}

export function useUpdateSplitPricingBreakdown() {
    const queryClient = useQueryClient();

    return useMutation<void, Error, UpdateSplitPricingBreakdownRequest>({
        mutationFn: (request) => splitPriceBreakdownApi.updateSplitPricingBreakdown(request),
        onSuccess: async (_, variables) => {
            await queryClient.invalidateQueries({
                queryKey: queryKeys.splitPriceBreakdown.job(variables.jobId),
            });
        },
    });
}
