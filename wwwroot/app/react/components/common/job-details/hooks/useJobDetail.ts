/**
 * Hook for fetching job detail data via React Query
 */

import {useQuery} from '@tanstack/react-query';
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
    });

    const sortedRelatedJobs = useMemo(() => {
        if (!jobQuery.data) return [];
        const allJobs = [jobQuery.data.job, ...jobQuery.data.relatedJobs];
        allJobs.sort((a, b) =>
            a.jobNo.localeCompare(b.jobNo, undefined, {numeric: true, sensitivity: 'base'})
        );
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
