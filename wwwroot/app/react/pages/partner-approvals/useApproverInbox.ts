/**
 * React Query hook for the approver inbox.
 *
 * Polls every 60 seconds — short enough that the badge stays roughly in
 * sync without a SignalR pipe, long enough that we don't hammer the
 * endpoint when dozens of tenants leave the app open. The 30s staleTime
 * means navigating between Job Details and the inbox reuses the cached
 * result rather than re-fetching on every mount.
 */

import {useQuery, type UseQueryResult} from '@tanstack/react-query';
import {jobChangeRequestApi} from '../../services/jobChangeRequestApi';
import type {JobChangeRequestInboxItem} from '../../interfaces/jobChangeRequest';

export interface UseApproverInboxOptions {
    /**
     * When false, the query is suspended — used by the app-bar badge to skip
     * polling for tenants with no active partnerships. Defaults to true.
     */
    enabled?: boolean;
}

export function useApproverInbox(
    options: UseApproverInboxOptions = {},
): UseQueryResult<JobChangeRequestInboxItem[]> {
    return useQuery({
        queryKey: ['jobChangeRequests', 'inbox'],
        queryFn: () => jobChangeRequestApi.pendingForApproval(200),
        refetchInterval: 60_000,
        staleTime: 30_000,
        enabled: options.enabled ?? true,
    });
}
