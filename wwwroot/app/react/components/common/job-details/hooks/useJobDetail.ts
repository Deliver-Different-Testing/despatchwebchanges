/**
 * Hook for fetching job detail data via React Query
 */

import {keepPreviousData, useQuery} from '@tanstack/react-query';
import {queryKeys} from '../../../../query/queryClient';
import {
    getJobDetail,
    getRecurringJobDetail,
    getBulkJobDetail,
} from '../../../../services/jobDetailApi';
import {transformJobGroupDTO} from '../../../../../functions/dtoMappings';
import {isUsCustomer} from '../../../../utils/dateUtils';
import type {IJob, IJobGroup} from '../JobDetails.types';
import {useMemo} from 'react';

interface UseJobDetailOptions {
    jobId?: number;
    isRecurringJob: boolean;
    isBulkJob: boolean;
    enabled?: boolean;
}

interface UseJobDetailResult {
    jobGroup: IJobGroup | undefined;
    job: IJob | undefined;
    sortedRelatedJobs: IJob[];
    isLoading: boolean;
    isFetching: boolean;
    isError: boolean;
    error: unknown;
    refetch: () => Promise<unknown>;
}

function getJobType(isRecurring: boolean, isBulk: boolean): 'standard' | 'recurring' | 'bulk' {
    if (isBulk) return 'bulk';
    if (isRecurring) return 'recurring';
    return 'standard';
}

export function useJobDetail({
    jobId,
    isRecurringJob,
    isBulkJob,
    enabled = true,
}: UseJobDetailOptions): UseJobDetailResult {
    const jobType = getJobType(isRecurringJob, isBulkJob);
    const isUs = isUsCustomer();

    const jobQuery = useQuery({
        queryKey: queryKeys.jobs.detail(jobId ?? 0, jobType),
        queryFn: async ({signal}) => {
            const options = {signal};
            let dto;
            if (isBulkJob) {
                dto = await getBulkJobDetail(jobId!, options);
            } else if (isRecurringJob) {
                dto = await getRecurringJobDetail(jobId!, options);
            } else {
                dto = await getJobDetail(jobId!, options);
            }
            return transformJobGroupDTO(dto, isUs);
        },
        enabled: enabled && !!jobId && jobId > 0,
        staleTime: 10 * 1000,
        placeholderData: keepPreviousData,
    });

    const sortedRelatedJobs = useMemo(() => {
        if (!jobQuery.data) return [];
        const parentId = jobQuery.data.job.id;
        const allJobs = [jobQuery.data.job, ...jobQuery.data.relatedJobs];

        // Chain-order sort mirroring RunViewer's siblingSortKey
        // (homeControl.js ~lines 229-243). Tabs read left-to-right as
        // the shipment timeline: parent -> LHP -> LH1..LHn -> DEL ->
        // anything else. Suffix matching is case-insensitive against
        // the live job number.
        //
        // Parent is identified by id-equality with jobGroup.job.id —
        // IJob has no parentJobId so we can't use the RunViewer's
        // `parentJobID == null` heuristic directly.
        const siblingSortKey = (job: IJob): [number, number, string] => {
            if (job.id === parentId) return [0, 0, ''];
            const num = (job.jobNo ?? '').toUpperCase();
            if (/LHP$/.test(num)) return [1, 0, ''];
            const lh = num.match(/LH(\d+)$/);
            if (lh) return [2, parseInt(lh[1], 10), ''];
            if (/DEL$/.test(num)) return [3, 0, ''];
            return [4, 0, num];
        };

        allJobs.sort((a, b) => {
            const ka = siblingSortKey(a);
            const kb = siblingSortKey(b);
            if (ka[0] !== kb[0]) return ka[0] - kb[0];
            if (ka[1] !== kb[1]) return ka[1] - kb[1];
            return ka[2].localeCompare(kb[2]);
        });
        return allJobs;
    }, [jobQuery.data]);

    return {
        jobGroup: jobQuery.data,
        job: jobQuery.data?.job,
        sortedRelatedJobs,
        isLoading: jobQuery.isLoading,
        isFetching: jobQuery.isFetching,
        isError: jobQuery.isError,
        error: jobQuery.error,
        refetch: () => jobQuery.refetch(),
    };
}
