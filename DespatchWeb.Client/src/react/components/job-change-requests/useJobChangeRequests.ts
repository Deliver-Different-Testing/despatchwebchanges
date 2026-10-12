/**
 * Shared React Query hook for the change-request rows on a single job.
 *
 * Cached under the queryKey `['jobChangeRequests', jobId]` — the same key
 * used by useJobUpdate's `invalidateChangeRequests`, so any code path that
 * files / approves / rejects a request automatically refreshes every
 * subscriber (history panel + in-place pending badges + future inbox).
 *
 * Provides a small selector helper `usePendingChangeForField` that
 * components rendering a single field can use to decide whether to show
 * a "Change pending" badge without each one duplicating the filter logic.
 */

import {useMemo} from 'react';
import {useQuery, type UseQueryResult} from '@tanstack/react-query';
import {jobChangeRequestApi} from '../../services/jobChangeRequestApi';
import type {JobChangeRequestDto} from '../../interfaces/jobChangeRequest';

export function useJobChangeRequests(jobId: number | undefined): UseQueryResult<JobChangeRequestDto[]> {
    return useQuery({
        queryKey: ['jobChangeRequests', jobId],
        queryFn: () => jobChangeRequestApi.forJob(jobId as number),
        enabled: typeof jobId === 'number' && jobId > 0,
        staleTime: 30_000,
    });
}

/**
 * Returns the most recent Pending row for the given JobChangeField (e.g.
 * "PartnerAgreedRate", "PickupAddress"), or null. Components rendering a
 * specific field card use this to drive an in-place "Change pending"
 * badge. Multiple field names may be passed for fields that share a UI
 * (e.g. both `Date` and `BookedTime` map to the Booked card).
 */
export function usePendingChangeForField(
    jobId: number | undefined,
    fieldNames: string | string[],
): JobChangeRequestDto | null {
    const {data} = useJobChangeRequests(jobId);
    const set = useMemo(() => new Set(Array.isArray(fieldNames) ? fieldNames : [fieldNames]), [fieldNames]);
    return useMemo(() => {
        if (!data) return null;
        // Rows arrive newest-first (ListForJobAsync orders by descending id).
        for (const row of data) {
            if (row.status === 'Pending' && set.has(row.fieldName)) return row;
        }
        return null;
    }, [data, set]);
}
