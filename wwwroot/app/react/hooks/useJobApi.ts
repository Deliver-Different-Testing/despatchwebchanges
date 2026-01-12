/**
 * React Query Hooks for Job API
 *
 * Query hooks for job-related data fetching.
 * For mutations (void, update), use jobApi directly - simpler and no caching benefit.
 */

import {useQuery} from '@tanstack/react-query';
import {queryKeys} from '../query';
import {jobApi} from '../services/jobApi';
import {RelatedJobDto} from '../interfaces';

/**
 * Hook to load related jobs for multi-select void operation
 *
 * @param jobId - The job ID to get related jobs for
 * @param isArchived - Whether the job is archived
 * @param options - Additional options
 * @returns Query result with related jobs, loading state, and error
 *
 * @example
 * ```tsx
 * const { data: relatedJobs, isLoading } = useRelatedJobs(jobId, isArchived, {
 *   enabled: showRelatedJobs
 * });
 * ```
 */
export function useRelatedJobs(
    jobId: number,
    isArchived: boolean,
    options?: {
        enabled?: boolean;
    }
) {
    return useQuery<RelatedJobDto[], Error>({
        queryKey: queryKeys.jobs.related(jobId, isArchived),
        queryFn: () => jobApi.getRelatedJobsMultiSelectList(jobId, isArchived),
        enabled: (options?.enabled ?? true) && jobId > 0,
        staleTime: 30 * 1000,
    });
}
