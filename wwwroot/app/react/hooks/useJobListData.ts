/**
 * useJobListData Hook
 *
 * Encapsulates data fetching for any job list instance using React Query.
 * When provided with a fetch function and query key factory, it manages
 * search params, sorting, pagination, and refresh — replacing the
 * AngularJS data-push pattern.
 */

import {useState, useCallback, useMemo} from 'react';
import {useQuery, useQueryClient} from '@tanstack/react-query';
import type {FetchConfig, DispatchJob, JobListSearchParams, JobSearchResult} from '../interfaces/dispatchJob';

export interface UseJobListDataResult {
    jobs: DispatchJob[];
    totalCount: number;
    isLoading: boolean;
    isFetching: boolean;
    hasMore: boolean;
    params: JobListSearchParams;
    refresh: () => void;
    updateSort: (column: string, direction: string) => void;
    updateParams: (params: Partial<JobListSearchParams>) => void;
}

export function useJobListData(fetchConfig: FetchConfig | null | undefined): UseJobListDataResult {
    const queryClient = useQueryClient();

    const [params, setParams] = useState<JobListSearchParams>(
        () => fetchConfig?.initialParams ?? {} as JobListSearchParams,
    );

    const queryKey = useMemo(
        () => fetchConfig?.queryKeyFn(params) ?? ['job-list', 'disabled'],
        [fetchConfig, params],
    );

    const {data, isLoading, isFetching} = useQuery<JobSearchResult>({
        queryKey,
        queryFn: ({signal}) => fetchConfig!.fetchFn(params, {signal}),
        staleTime: 15_000,
        enabled: !!fetchConfig,
    });

    const refresh = useCallback(async () => {
        if (!fetchConfig) return;
        await queryClient.invalidateQueries({queryKey: fetchConfig.queryKeyFn(params)});
    }, [queryClient, fetchConfig, params]);

    const updateSort = useCallback((column: string, direction: string) => {
        setParams(prev => ({
            ...prev,
            order: column,
            orderDirection: direction,
            sortColumn: column,
            sortDirection: direction,
        }));
    }, []);

    const updateParams = useCallback((newParams: Partial<JobListSearchParams>) => {
        setParams(prev => ({...prev, ...newParams}));
    }, []);

    return {
        jobs: data?.jobs ?? [],
        totalCount: data?.totalCount ?? 0,
        isLoading,
        isFetching,
        hasMore: data?.hasMore ?? false,
        params,
        refresh,
        updateSort,
        updateParams,
    };
}
