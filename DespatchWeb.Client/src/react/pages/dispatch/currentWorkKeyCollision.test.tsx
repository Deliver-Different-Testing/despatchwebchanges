/**
 * Regression: current-work query-key collision (Dispatch page crash)
 *
 * The DispatchPage map-courier plain `useQuery` and the CurrentWorkBox
 * `useInfiniteQuery` share the singleton QueryClient. If both use the same
 * cache key, the plain query writes a non-infinite `JobSearchResult`
 * ({jobs,totalCount,hasMore} — no `.pages`) into the shared entry; when the
 * infinite observer then reads it, `getNextPageParam` destructures
 * `data.pages` and evaluates `pages.length` on `undefined`, throwing
 * "Cannot read properties of undefined (reading 'length')".
 *
 * The fix gives the map query its own `dispatch.currentWorkMap` key so the two
 * can never collide. Here `setQueryData` stands in for the plain map query's
 * cache write.
 */

import React from 'react';
import {renderHook, waitFor} from '@testing-library/react';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {useJobListData} from '../../hooks/useJobListData';
import {queryKeys} from '../../query/queryClient';
import type {FetchConfig, JobListSearchParams, JobSearchResult} from '../../interfaces/dispatchJob';

const mapParams = {
    courierId: 7,
    page: 0,
    pageSize: 50,
} as unknown as JobListSearchParams;

// The shape a plain (non-infinite) fetch writes to the cache.
const plainMapResult: JobSearchResult = {
    jobs: [{id: 1, jobNo: 'J001'}] as any[],
    totalCount: 1,
    hasMore: false,
};

const createSharedClient = () =>
    new QueryClient({
        defaultOptions: {queries: {retry: false, gcTime: 0, staleTime: 0}},
    });

const makeWrapper = (client: QueryClient) =>
    ({children}: {children: React.ReactNode}) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );

// CurrentWorkBox's infinite config, keyed by dispatch.currentWork.
const infiniteConfig = (): FetchConfig => ({
    fetchFn: jest.fn().mockResolvedValue(plainMapResult),
    queryKeyFn: (params) => queryKeys.dispatch.currentWork(params),
    initialParams: mapParams,
});

describe('current-work key collision', () => {
    it('throws pages.length when a plain result occupies the infinite query key', () => {
        const client = createSharedClient();
        // Simulate the map plain query writing its non-infinite shape under the
        // SAME key the infinite CurrentWorkBox query uses.
        client.setQueryData(queryKeys.dispatch.currentWork(mapParams), plainMapResult);

        expect(() =>
            renderHook(() => useJobListData(infiniteConfig()), {wrapper: makeWrapper(client)}),
        ).toThrow(/length/);
    });

    it('does not collide when the map query uses its own currentWorkMap key', async () => {
        const client = createSharedClient();
        // The fix: the map plain query writes under a DISTINCT key.
        client.setQueryData(queryKeys.dispatch.currentWorkMap(mapParams), plainMapResult);

        const {result} = renderHook(
            () => useJobListData(infiniteConfig()),
            {wrapper: makeWrapper(client)},
        );

        // The infinite query renders and loads its own data — no crash.
        await waitFor(() => expect(result.current.isLoading).toBe(false));
        expect(result.current.jobs).toEqual(plainMapResult.jobs);
        expect(result.current.hasMore).toBe(false);
    });
});
