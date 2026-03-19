/** @jest-environment jest-environment-jsdom */
/**
 * useJobListData Hook Tests
 *
 * Tests the custom React Query hook that manages job list data fetching,
 * parameter state, sorting, and refresh/invalidation.
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

            expect(config.fetchFn).toHaveBeenCalledWith(
                config.initialParams,
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
                result.current.updateParams({searchText: 'hello', page: 2});
            });

            await waitFor(() => {
                expect(config.fetchFn).toHaveBeenCalled();
            });

            const calledParams = (config.fetchFn as jest.Mock).mock.calls[0][0];
            expect(calledParams.searchText).toBe('hello');
            expect(calledParams.page).toBe(2);
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
                result.current.updateParams({page: 5});
            });

            expect(queryKeyFn).toHaveBeenCalledWith(
                expect.objectContaining({page: 5}),
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

    describe('hasMore', () => {
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
    });
});
