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

import {useState, useCallback, useMemo, useRef} from 'react';
import {useInfiniteQuery, useQueryClient} from '@tanstack/react-query';
import type {
    FetchConfig,
    DispatchJob,
    JobListSearchParams,
    JobListStatusCounts,
    JobSearchResult,
} from '../interfaces/dispatchJob';

export interface UseJobListDataResult {
    jobs: DispatchJob[];
    totalCount: number;
    statusCounts: JobListStatusCounts | null;
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
    statusCounts: null,
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

    const {data, isLoading, isFetching, isPlaceholderData, hasNextPage, fetchNextPage, isFetchingNextPage} = useInfiniteQuery<JobSearchResult>({
        queryKey,
        queryFn: ({signal, pageParam}) => fetchConfig!.fetchFn({...params, page: pageParam as number}, {signal}),
        initialPageParam: 0,
        getNextPageParam: (lastPage, allPages) => lastPage.hasMore ? allPages.length : undefined,
        staleTime: 15_000,
        refetchInterval: fetchConfig?.refetchInterval ?? false,
        enabled: !!fetchConfig && !isDisabled,
        // Changing a param swaps the query key, so the list would otherwise blank out
        // until the new page landed — which unmounts the table's scroll container and
        // loses the operator's horizontal position. Hold the last results instead; the
        // panel already shows an indeterminate bar while `isFetching`.
        placeholderData: (previous) => previous,
    });

    // Flatten all pages into a single jobs array
    const jobs = useMemo(
        () => data?.pages.flatMap(p => p.jobs) ?? [],
        [data],
    );

    // The first page's count, not the last: the server re-counts on every page fetch, so
    // reading the newest one made the footer total jitter mid-scroll.
    const totalCount = data?.pages[0]?.totalCount ?? 0;

    // Same reasoning, and the server only answers it once — later pages carry nothing to replace it
    // with. The last answer is also held across a params change, because changing the category tab
    // starts a whole new query and the header would otherwise blink to zero while it runs. Only the
    // disabled branch below clears it, by never reaching here.
    const lastStatusCountsRef = useRef<JobListStatusCounts | null>(null);
    const pageStatusCounts = data?.pages[0]?.statusCounts ?? null;
    if (pageStatusCounts) {
        lastStatusCountsRef.current = pageStatusCounts;
    }
    const statusCounts = pageStatusCounts ?? lastStatusCountsRef.current;

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
        // While the held-over results are on screen the new query has not returned its
        // first page, so the table's infinite scroll is reacting to the *previous*
        // list's length — paging here would fetch against the wrong baseline.
        if (isPlaceholderData) return;
        if (hasNextPage && !isFetchingNextPage) {
            fetchNextPage();
        }
    }, [isPlaceholderData, hasNextPage, isFetchingNextPage, fetchNextPage]);

    // When disabled, return empty results immediately — ignores any cached query data
    if (isDisabled) {
        return {...emptyResult, params, updateParams};
    }

    return {
        jobs,
        totalCount,
        statusCounts,
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
