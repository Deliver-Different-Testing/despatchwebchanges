/**
 * React Query hook gating the app-bar Partner Approvals badge.
 *
 * Partnerships change rarely (admin-driven, not user-driven), so we keep the
 * result fresh for 10 minutes and avoid the noisy refetches the inbox query
 * does. The badge component renders nothing while this is loading or false —
 * tenants with no active pairings never see the button at all.
 */

import {useQuery, type UseQueryResult} from '@tanstack/react-query';
import {jobChangeRequestApi} from '../../services/jobChangeRequestApi';

export function useHasActivePartners(): UseQueryResult<boolean> {
    return useQuery({
        queryKey: ['jobChangeRequests', 'hasActivePartners'],
        queryFn: () => jobChangeRequestApi.hasActivePartners(),
        staleTime: 10 * 60_000,
    });
}
