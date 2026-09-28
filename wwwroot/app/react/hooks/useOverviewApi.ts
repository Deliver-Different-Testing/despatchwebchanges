/**
 * Overview React Query Hooks
 *
 * Custom hooks for fetching overview data using React Query.
 */

import {useQuery, keepPreviousData} from '@tanstack/react-query';
import {queryKeys} from '../query';
import {overviewApi} from '../services/overviewApi';
import type {
    OverviewQueryParams,
} from '../pages/overview/OverviewPage.interfaces';

export function useOverviewJobs(params: OverviewQueryParams) {
    return useQuery({
        queryKey: queryKeys.overview.jobs(params),
        queryFn: ({signal}) => overviewApi.getAllJobs(params, {signal}),
        placeholderData: keepPreviousData,
        // Page/filter combos are uniquely keyed, so the only thing staleTime
        // affects here is back-nav within the same combo — 60s avoids an
        // immediate refetch when the user toggles tabs and returns.
        staleTime: 60 * 1000,
    });
}

export function useOverviewRegions() {
    return useQuery({
        queryKey: queryKeys.overview.regions,
        queryFn: ({signal}) => overviewApi.getAllRegions({signal}),
        staleTime: 5 * 60 * 1000, // regions rarely change
    });
}

export function useOverviewSpeeds() {
    return useQuery({
        queryKey: queryKeys.overview.speeds,
        queryFn: ({signal}) => overviewApi.getAllSpeeds({signal}),
        staleTime: 5 * 60 * 1000,
    });
}

export function useOverviewStats() {
    return useQuery({
        queryKey: queryKeys.overview.stats,
        queryFn: ({signal}) => overviewApi.getStats({signal}),
        // Stats drive the visible tab counts — let them go stale slightly
        // faster than the table itself so the badges feel responsive.
        staleTime: 30 * 1000,
    });
}

export function useOverviewOpenJobs(
    params: Pick<OverviewQueryParams, 'startDate' | 'endDate' | 'regions' | 'speeds' | 'couriers'>,
    refetchInterval?: number,
) {
    return useQuery({
        queryKey: queryKeys.overview.openJobs(params),
        queryFn: ({signal}) => overviewApi.getOpenJobs(params, {signal}),
        refetchInterval,
        // Align with the 60s poll the OverviewPage installs — without this,
        // mounting the widget refetches even when the cache is seconds old.
        staleTime: refetchInterval ?? 60 * 1000,
    });
}

export function useCourierSearch(searchText: string) {
    return useQuery({
        queryKey: queryKeys.couriers.search(searchText),
        queryFn: ({signal}) => overviewApi.searchCouriers(searchText, {signal}),
        enabled: searchText.length > 0,
    });
}
