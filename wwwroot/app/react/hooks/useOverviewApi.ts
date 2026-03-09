/**
 * Overview React Query Hooks
 *
 * Custom hooks for fetching overview data using React Query.
 */

import {useQuery} from '@tanstack/react-query';
import {queryKeys} from '../query';
import {overviewApi} from '../services/overviewApi';
import type {
    OverviewQueryParams,
} from '../pages/overview/OverviewPage.interfaces';

export function useOverviewJobs(params: OverviewQueryParams) {
    return useQuery({
        queryKey: queryKeys.overview.jobs(params),
        queryFn: ({signal}) => overviewApi.getAllJobs(params, {signal}),
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
    });
}

export function useCourierSearch(searchText: string) {
    return useQuery({
        queryKey: queryKeys.couriers.search(searchText),
        queryFn: ({signal}) => overviewApi.searchCouriers(searchText, {signal}),
        enabled: searchText.length > 0,
    });
}
