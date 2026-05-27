/**
 * useJobListData Hook Tests
 *
 * Tests the custom React Query hook that manages job list data fetching,
 * parameter state, sorting, refresh/invalidation, and infinite scroll pagination.
 */

import React from 'react';
import {renderHook, waitFor, act} from '@testing-library/react';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {useJobListData} from './useJobListData';
import type {FetchConfig, JobListSearchParams, JobSearchResult} from '../interfaces/dispatchJob';

// ── Helpers ──────────────────────────────────────────────────────────

const createTestQueryClient = () =>
    new QueryClient({
        defaultOptions: {
            queries: {
                retry: false,
                gcTime: 0,
                staleTime: 0,
            },
        },
    });

const createWrapper = (queryClient?: QueryClient) => {
    const client = queryClient ?? createTestQueryClient();
    return ({children}: { children: React.ReactNode }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
};

const mockJobs = [
    {id: 1, jobNo: 'J001'},
    {id: 2, jobNo: 'J002'},
] as any[];

const mockResult: JobSearchResult = {
    jobs: mockJobs,
    totalCount: 2,
    hasMore: false,
};

function createMockFetchConfig(overrides?: Partial<FetchConfig>): FetchConfig {
    return {
        fetchFn: jest.fn().mockResolvedValue(mockResult),
        queryKeyFn: (params: JobListSearchParams) => ['test', 'jobs', params] as const,
        initialParams: {
            order: 'time',
            orderDirection: 'asc',
            page: 0,
            pageSize: 50,
        },
        ...overrides,
    };
}

// ── Tests ────────────────────────────────────────────────────────────

describe('useJobListData', () => {
    describe('initial fetch', () => {
        it('should fetch data on mount with initial params', async () => {
            const config = createMockFetchConfig();

            const {result} = renderHook(
                () => useJobListData(config),
                {wrapper: createWrapper()},
            );

            // Initially loading
            expect(result.current.isLoading).toBe(true);
            expect(result.current.jobs).toEqual([]);

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            // useInfiniteQuery passes pageParam as page (overriding params.page)
            expect(config.fetchFn).toHaveBeenCalledWith(
                expect.objectContaining({...config.initialParams, page: 0}),
                expect.objectContaining({signal: expect.any(AbortSignal)}),
            );
            expect(result.current.jobs).toEqual(mockJobs);
            expect(result.current.totalCount).toBe(2);
            expect(result.current.hasMore).toBe(false);
        });

        it('should return empty defaults while loading', () => {
            const fetchFn = jest.fn().mockReturnValue(new Promise(() => {})); // never resolves
            const config = createMockFetchConfig({fetchFn});

            const {result} = renderHook(
                () => useJobListData(config),
                {wrapper: createWrapper()},
            );

            expect(result.current.jobs).toEqual([]);
            expect(result.current.totalCount).toBe(0);
            expect(result.current.hasMore).toBe(false);
            expect(result.current.isLoading).toBe(true);
        });
    });

    describe('updateSort', () => {
        it('should update sort params and trigger refetch', async () => {
            const config = createMockFetchConfig();

            const {result} = renderHook(
                () => useJobListData(config),
                {wrapper: createWrapper()},
            );

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            // Clear initial call
            (config.fetchFn as jest.Mock).mockClear();

            act(() => {
                result.current.updateSort('jobNo', 'desc');
            });

            await waitFor(() => {
                expect(config.fetchFn).toHaveBeenCalled();
            });

            // Verify the fetch was called with updated sort params
            const calledParams = (config.fetchFn as jest.Mock).mock.calls[0][0];
            expect(calledParams.order).toBe('jobNo');
            expect(calledParams.orderDirection).toBe('desc');
            expect(calledParams.sortColumn).toBe('jobNo');
            expect(calledParams.sortDirection).toBe('desc');
        });

        it('should expose updated params after sort change', async () => {
            const config = createMockFetchConfig();

            const {result} = renderHook(
                () => useJobListData(config),
                {wrapper: createWrapper()},
            );

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            act(() => {
                result.current.updateSort('client', 'asc');
            });

            expect(result.current.params.order).toBe('client');
            expect(result.current.params.orderDirection).toBe('asc');
        });
    });

    describe('updateParams', () => {
        it('should merge new params and trigger refetch', async () => {
            const config = createMockFetchConfig();

            const {result} = renderHook(
                () => useJobListData(config),
                {wrapper: createWrapper()},
            );

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            (config.fetchFn as jest.Mock).mockClear();

            act(() => {
                result.current.updateParams({searchText: 'hello'});
            });

            await waitFor(() => {
                expect(config.fetchFn).toHaveBeenCalled();
            });

            const calledParams = (config.fetchFn as jest.Mock).mock.calls[0][0];
            expect(calledParams.searchText).toBe('hello');
            // pageParam overrides page to 0 (start of new infinite query)
            expect(calledParams.page).toBe(0);
            // Original params should still be present
            expect(calledParams.order).toBe('time');
            expect(calledParams.pageSize).toBe(50);
        });

        it('should expose merged params', async () => {
            const config = createMockFetchConfig();

            const {result} = renderHook(
                () => useJobListData(config),
                {wrapper: createWrapper()},
            );

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            act(() => {
                result.current.updateParams({searchText: 'filtered'});
            });

            expect(result.current.params).toEqual({
                ...config.initialParams,
                searchText: 'filtered',
            });
        });

        it('should clear selectedClearListId when updated with undefined', async () => {
            const config = createMockFetchConfig();

            const {result} = renderHook(
                () => useJobListData(config),
                {wrapper: createWrapper()},
            );

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            // Simulate selecting a clear list area
            act(() => {
                result.current.updateParams({selectedClearListId: 42});
            });
            expect(result.current.params.selectedClearListId).toBe(42);

            // Simulate clearing the filter — must explicitly pass undefined
            act(() => {
                result.current.updateParams({selectedClearListId: undefined});
            });
            expect(result.current.params.selectedClearListId).toBeUndefined();
        });

        it('should retain stale selectedClearListId when key is omitted from update', async () => {
            const config = createMockFetchConfig();

            const {result} = renderHook(
                () => useJobListData(config),
                {wrapper: createWrapper()},
            );

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            // Set a clear list id
            act(() => {
                result.current.updateParams({selectedClearListId: 42});
            });
            expect(result.current.params.selectedClearListId).toBe(42);

            // Update other params without mentioning selectedClearListId
            act(() => {
                result.current.updateParams({searchText: 'hello'});
            });

            // selectedClearListId should still be present (shallow merge)
            expect(result.current.params.selectedClearListId).toBe(42);
            expect(result.current.params.searchText).toBe('hello');
        });
    });

    describe('refresh', () => {
        it('should invalidate the query and refetch', async () => {
            const queryClient = createTestQueryClient();
            const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');
            const config = createMockFetchConfig();

            const {result} = renderHook(
                () => useJobListData(config),
                {wrapper: createWrapper(queryClient)},
            );

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            act(() => {
                result.current.refresh();
            });

            expect(invalidateSpy).toHaveBeenCalledWith({
                queryKey: config.queryKeyFn(config.initialParams),
            });

            invalidateSpy.mockRestore();
        });
    });

    describe('query key generation', () => {
        it('should call queryKeyFn with current params', async () => {
            const queryKeyFn = jest.fn((params: JobListSearchParams) => ['test', params] as const);
            const config = createMockFetchConfig({queryKeyFn});

            const {result} = renderHook(
                () => useJobListData(config),
                {wrapper: createWrapper()},
            );

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            expect(queryKeyFn).toHaveBeenCalledWith(config.initialParams);
        });

        it('should regenerate query key when params change', async () => {
            const queryKeyFn = jest.fn((params: JobListSearchParams) => ['test', params] as const);
            const config = createMockFetchConfig({queryKeyFn});

            const {result} = renderHook(
                () => useJobListData(config),
                {wrapper: createWrapper()},
            );

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            queryKeyFn.mockClear();

            act(() => {
                result.current.updateParams({searchText: 'test'});
            });

            expect(queryKeyFn).toHaveBeenCalledWith(
                expect.objectContaining({searchText: 'test'}),
            );
        });
    });

    describe('error handling', () => {
        it('should handle fetch errors gracefully', async () => {
            const error = new Error('Network error');
            const config = createMockFetchConfig({
                fetchFn: jest.fn().mockRejectedValue(error),
            });

            const {result} = renderHook(
                () => useJobListData(config),
                {wrapper: createWrapper()},
            );

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            // Should return defaults when error occurs
            expect(result.current.jobs).toEqual([]);
            expect(result.current.totalCount).toBe(0);
        });
    });

    describe('hasMore and infinite scroll', () => {
        it('should reflect hasMore from fetch result', async () => {
            const config = createMockFetchConfig({
                fetchFn: jest.fn().mockResolvedValue({
                    jobs: mockJobs,
                    totalCount: 100,
                    hasMore: true,
                }),
            });

            const {result} = renderHook(
                () => useJobListData(config),
                {wrapper: createWrapper()},
            );

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            expect(result.current.hasMore).toBe(true);
            expect(result.current.totalCount).toBe(100);
        });

        it('should accumulate jobs across pages when fetchNextPage is called', async () => {
            const page0Jobs = [{id: 1, jobNo: 'J001'}, {id: 2, jobNo: 'J002'}] as any[];
            const page1Jobs = [{id: 3, jobNo: 'J003'}, {id: 4, jobNo: 'J004'}] as any[];

            const fetchFn = jest.fn()
                .mockResolvedValueOnce({jobs: page0Jobs, totalCount: 4, hasMore: true})
                .mockResolvedValueOnce({jobs: page1Jobs, totalCount: 4, hasMore: false});

            const config = createMockFetchConfig({fetchFn});

            const {result} = renderHook(
                () => useJobListData(config),
                {wrapper: createWrapper()},
            );

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            expect(result.current.jobs).toEqual(page0Jobs);
            expect(result.current.hasMore).toBe(true);

            // Fetch next page
            act(() => {
                result.current.fetchNextPage();
            });

            await waitFor(() => {
                expect(result.current.jobs).toHaveLength(4);
            });

            expect(result.current.jobs).toEqual([...page0Jobs, ...page1Jobs]);
            expect(result.current.hasMore).toBe(false);
            expect(result.current.totalCount).toBe(4);

            // Second call should have page=1
            expect(fetchFn).toHaveBeenCalledTimes(2);
            expect(fetchFn.mock.calls[1][0].page).toBe(1);
        });

        it('should expose isFetchingNextPage while loading more', async () => {
            let resolvePage1: (value: JobSearchResult) => void;
            const page1Promise = new Promise<JobSearchResult>((res) => {
                resolvePage1 = res;
            });

            const fetchFn = jest.fn()
                .mockResolvedValueOnce({jobs: mockJobs, totalCount: 4, hasMore: true})
                .mockReturnValueOnce(page1Promise);

            const config = createMockFetchConfig({fetchFn});

            const {result} = renderHook(
                () => useJobListData(config),
                {wrapper: createWrapper()},
            );

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            expect(result.current.isFetchingNextPage).toBe(false);

            act(() => {
                result.current.fetchNextPage();
            });

            await waitFor(() => {
                expect(result.current.isFetchingNextPage).toBe(true);
            });

            // Existing jobs should still be visible
            expect(result.current.jobs).toEqual(mockJobs);

            // Resolve page 1
            const page1Jobs = [{id: 3, jobNo: 'J003'}] as any[];
            act(() => {
                resolvePage1!({jobs: page1Jobs, totalCount: 3, hasMore: false});
            });

            await waitFor(() => {
                expect(result.current.isFetchingNextPage).toBe(false);
            });

            expect(result.current.jobs).toEqual([...mockJobs, ...page1Jobs]);
        });

        it('should not fetch next page when hasMore is false', async () => {
            const config = createMockFetchConfig({
                fetchFn: jest.fn().mockResolvedValue({
                    jobs: mockJobs,
                    totalCount: 2,
                    hasMore: false,
                }),
            });

            const {result} = renderHook(
                () => useJobListData(config),
                {wrapper: createWrapper()},
            );

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            // fetchNextPage should be a no-op when hasMore is false
            act(() => {
                result.current.fetchNextPage();
            });

            expect(config.fetchFn).toHaveBeenCalledTimes(1); // only initial fetch
        });
    });
});
