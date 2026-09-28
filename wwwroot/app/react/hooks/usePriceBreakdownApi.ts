/**
 * React Query Hooks for Price Breakdown API
 *
 * Provides type-safe hooks for pricing breakdown operations
 * with automatic caching, loading states, and error handling.
 */

import {useQuery, useMutation, useQueryClient} from '@tanstack/react-query';
import {queryKeys} from '../query';
import {pricingBreakdownApi} from '../services/pricingBreakdownApi';
import {PriceBreakdown} from "../interfaces/priceBreakdown";
import type {CreatePriceBreakdownRequest} from '../interfaces/priceBreakdown';
import type {DeletePriceBreakdownRequest} from '../interfaces/priceBreakdown';

// Re-export types for convenience
export type {PriceBreakdown, CreatePriceBreakdownRequest, DeletePriceBreakdownRequest};

/**
 * Hook to fetch price breakdowns for a job
 *
 * @param jobId - The job ID to fetch breakdowns for
 * @param isPrebook - Whether this is a prebook job
 * @param isArchived - Whether the job is archived
 * @param options - Additional options
 * @returns Query result with price breakdowns array, loading state, and error
 *
 * @example
 * ```tsx
 * const { data: breakdowns, isLoading } = usePriceBreakdowns(123, false, false);
 * ```
 */
export function usePriceBreakdowns(
    jobId: number | undefined,
    isPrebook: boolean = false,
    isArchived: boolean = false,
    options?: {enabled?: boolean}
) {
    return useQuery<PriceBreakdown[], Error>({
        queryKey: queryKeys.priceBreakdowns.job(jobId ?? 0, isPrebook, isArchived),
        queryFn: ({signal}) => pricingBreakdownApi.getPriceBreakdowns(jobId!, isPrebook, isArchived, {signal}),
        enabled: !!jobId && (options?.enabled ?? true),
    });
}

/**
 * Hook to add a new price breakdown
 *
 * @returns Mutation object with mutate function and status
 *
 * @example
 * ```tsx
 * const addBreakdown = useAddPriceBreakdown();
 * addBreakdown.mutate({ name: 'Freight', amount: 100, childJobId: 123 });
 * ```
 */
export function useAddPriceBreakdown() {
    const queryClient = useQueryClient();

    return useMutation<number, Error, CreatePriceBreakdownRequest & {jobIdForCache?: number; isPrebookForCache?: boolean; isArchivedForCache?: boolean}>({
        mutationFn: (breakdown) => pricingBreakdownApi.addPriceBreakdown(breakdown),
        onSuccess: async (_, variables) => {
            const jobId = variables.jobIdForCache ?? variables.childJobId ?? variables.prebookJobId ?? 0;
            const isPrebook = variables.isPrebookForCache ?? !!variables.prebookJobId;
            const isArchived = variables.isArchivedForCache ?? variables.isArchived ?? false;
            await queryClient.invalidateQueries({
                queryKey: queryKeys.priceBreakdowns.job(jobId, isPrebook, isArchived),
            });
        },
    });
}

/**
 * Hook to update an existing price breakdown
 *
 * @returns Mutation object with mutate function and status
 *
 * @example
 * ```tsx
 * const updateBreakdown = useUpdatePriceBreakdown();
 * updateBreakdown.mutate({ chargeId: 1, name: 'Updated', amount: 150 });
 * ```
 */
export function useUpdatePriceBreakdown() {
    const queryClient = useQueryClient();

    return useMutation<void, Error, PriceBreakdown & {jobIdForCache?: number; isPrebookForCache?: boolean; isArchivedForCache?: boolean}>({
        mutationFn: (breakdown) => pricingBreakdownApi.updatePriceBreakdown(breakdown),
        onSuccess: async (_, variables) => {
            const jobId = variables.jobIdForCache ?? variables.childJobId ?? variables.jobId ?? variables.prebookJobId ?? 0;
            const isPrebook = variables.isPrebookForCache ?? !!variables.prebookJobId;
            const isArchived = variables.isArchivedForCache ?? variables.isArchived ?? false;
            await queryClient.invalidateQueries({
                queryKey: queryKeys.priceBreakdowns.job(jobId, isPrebook, isArchived),
            });
        },
    });
}

/**
 * Hook to delete a price breakdown
 *
 * @returns Mutation object with mutate function and status
 *
 * @example
 * ```tsx
 * const deleteBreakdown = useDeletePriceBreakdown();
 * deleteBreakdown.mutate({ chargeId: 1, jobId: 123 });
 * ```
 */
export function useDeletePriceBreakdown() {
    const queryClient = useQueryClient();

    return useMutation<void, Error, DeletePriceBreakdownRequest & {isPrebookForCache?: boolean}>({
        mutationFn: (request) => pricingBreakdownApi.deletePriceBreakdown(request),
        onSuccess: async (_, variables) => {
            const isPrebook = variables.isPrebookForCache ?? false;
            const isArchived = variables.isArchived ?? false;
            await queryClient.invalidateQueries({
                queryKey: queryKeys.priceBreakdowns.job(variables.jobId, isPrebook, isArchived),
            });
        },
    });
}
