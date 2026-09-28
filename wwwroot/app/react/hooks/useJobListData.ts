/**
 * useJobListData Hook
 *
 * Encapsulates data fetching for any job list instance using React Query.
 * When provided with a fetch function and query key factory, it manages
 * search params, sorting, pagination, and refresh — replacing the
 * AngularJS data-push pattern.
 *
 * Uses useInfiniteQuery for automatic page accumulation (infinite scroll).
 */

import {useState, useCallback, useMemo} from 'react';
import {useInfiniteQuery, useQueryClient} from '@tanstack/react-query';
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
    fetchNextPage: () => void;
    isFetchingNextPage: boolean;
}

const emptyResult: UseJobListDataResult = {
    jobs: [],
    totalCount: 0,
    isLoading: false,
    isFetching: false,
    hasMore: false,
    params: {} as JobListSearchParams,
    refresh: () => {},
    updateSort: () => {},
    updateParams: () => {},
    fetchNextPage: () => {},
    isFetchingNextPage: false,
};

export function useJobListData(fetchConfig: FetchConfig | null | undefined): UseJobListDataResult {
    const queryClient = useQueryClient();

    const [params, setParams] = useState<JobListSearchParams>(
        () => fetchConfig?.initialParams ?? {} as JobListSearchParams,
    );

    const isDisabled = !!params.disabled;

    // Strip page from params for the query key — page is managed by useInfiniteQuery
    const queryKey = useMemo(
        () => fetchConfig?.queryKeyFn(params) ?? ['job-list', 'disabled'],
        [fetchConfig, params],
    );

    const {data, isLoading, isFetching, hasNextPage, fetchNextPage, isFetchingNextPage} = useInfiniteQuery<JobSearchResult>({
        queryKey,
        queryFn: ({signal, pageParam}) => fetchConfig!.fetchFn({...params, page: pageParam as number}, {signal}),
        initialPageParam: 0,
        getNextPageParam: (lastPage, allPages) => lastPage.hasMore ? allPages.length : undefined,
        staleTime: 15_000,
        enabled: !!fetchConfig && !isDisabled,
    });

    // Flatten all pages into a single jobs array
    const jobs = useMemo(
        () => data?.pages.flatMap(p => p.jobs) ?? [],
        [data],
    );

    const totalCount = data?.pages[data.pages.length - 1]?.totalCount ?? 0;

    const refresh = useCallback(() => {
        if (!fetchConfig) return;
        queryClient.invalidateQueries({queryKey: fetchConfig.queryKeyFn(params)});
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

    const fetchNextPageSafe = useCallback(() => {
        if (hasNextPage && !isFetchingNextPage) {
            fetchNextPage();
        }
    }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

    // When disabled, return empty results immediately — ignores any cached query data
    if (isDisabled) {
        return {...emptyResult, params, updateParams};
    }

    return {
        jobs,
        totalCount,
        isLoading,
        isFetching,
        hasMore: hasNextPage ?? false,
        params,
        refresh,
        updateSort,
        updateParams,
        fetchNextPage: fetchNextPageSafe,
        isFetchingNextPage,
    };
}
