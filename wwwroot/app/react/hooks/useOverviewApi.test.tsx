import React from 'react';
import {renderHook, waitFor} from '@testing-library/react';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {
    useOverviewJobs,
    useOverviewRegions,
    useOverviewSpeeds,
    useOverviewStats,
    useOverviewOpenJobs,
    useCourierSearch,
} from './useOverviewApi';
import {overviewApi} from '../services/overviewApi';

jest.mock('../services/overviewApi', () => ({
    overviewApi: {
        getAllJobs: jest.fn(),
        getAllRegions: jest.fn(),
        getAllSpeeds: jest.fn(),
        getStats: jest.fn(),
        getOpenJobs: jest.fn(),
        searchCouriers: jest.fn(),
        getParentJobMap: jest.fn(),
    },
}));

const mockOverviewApi = overviewApi as jest.Mocked<typeof overviewApi>;

const createTestQueryClient = () =>
    new QueryClient({
        defaultOptions: {
            queries: {retry: false, gcTime: 0},
        },
    });

const createWrapper = () => {
    const queryClient = createTestQueryClient();
    return ({children}: {children: React.ReactNode}) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
};

describe('useOverviewApi hooks', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('useOverviewJobs', () => {
        it('fetches jobs with correct params', async () => {
            const mockData = {items: [{jobId: 1, jobName: 'J-001'}], total: 1, page: 1, pages: 1};
            mockOverviewApi.getAllJobs.mockResolvedValueOnce(mockData as any);

            const params = {statusGroup: 1, page: 1, limit: 20};
            const {result} = renderHook(() => useOverviewJobs(params), {wrapper: createWrapper()});

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            expect(result.current.data).toEqual(mockData);
            expect(mockOverviewApi.getAllJobs).toHaveBeenCalledWith(params, expect.objectContaining({signal: expect.any(AbortSignal)}));
        });

        it('returns error on failure', async () => {
            mockOverviewApi.getAllJobs.mockRejectedValueOnce(new Error('Failed'));

            const {result} = renderHook(() => useOverviewJobs({page: 1, limit: 20}), {
                wrapper: createWrapper(),
            });

            await waitFor(() => {
                expect(result.current.isError).toBe(true);
            });

            expect(result.current.error).toBeDefined();
        });
    });

    describe('useOverviewRegions', () => {
        it('fetches regions', async () => {
            const mockRegions = [{id: 1, text: 'London'}, {id: 2, text: 'Manchester'}];
            mockOverviewApi.getAllRegions.mockResolvedValueOnce(mockRegions);

            const {result} = renderHook(() => useOverviewRegions(), {wrapper: createWrapper()});

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            expect(result.current.data).toEqual(mockRegions);
        });

        it('shares cached data between multiple hook instances', async () => {
            const mockRegions = [{id: 1, text: 'London'}];
            mockOverviewApi.getAllRegions.mockResolvedValueOnce(mockRegions);

            const queryClient = createTestQueryClient();
            const wrapper = ({children}: {children: React.ReactNode}) => (
                <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
            );

            const {result: result1} = renderHook(() => useOverviewRegions(), {wrapper});
            await waitFor(() => expect(result1.current.isSuccess).toBe(true));

            const {result: result2} = renderHook(() => useOverviewRegions(), {wrapper});
            await waitFor(() => expect(result2.current.isSuccess).toBe(true));

            // Only one API call should have been made due to caching
            expect(mockOverviewApi.getAllRegions).toHaveBeenCalledTimes(1);
        });
    });

    describe('useOverviewSpeeds', () => {
        it('fetches speeds', async () => {
            const mockSpeeds = [{id: 1, text: 'Same Day'}];
            mockOverviewApi.getAllSpeeds.mockResolvedValueOnce(mockSpeeds);

            const {result} = renderHook(() => useOverviewSpeeds(), {wrapper: createWrapper()});

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            expect(result.current.data).toEqual(mockSpeeds);
        });
    });

    describe('useOverviewStats', () => {
        it('fetches stats', async () => {
            const mockStats = {active: 10, inactive: 3, completed: 42};
            mockOverviewApi.getStats.mockResolvedValueOnce(mockStats);

            const {result} = renderHook(() => useOverviewStats(), {wrapper: createWrapper()});

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            expect(result.current.data).toEqual(mockStats);
        });
    });

    describe('useOverviewOpenJobs', () => {
        it('fetches open jobs', async () => {
            const mockJobs = [{jobId: 1, reference: 'JOB-001', driverName: 'John'}];
            mockOverviewApi.getOpenJobs.mockResolvedValueOnce(mockJobs as any);

            const {result} = renderHook(() => useOverviewOpenJobs({}), {
                wrapper: createWrapper(),
            });

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            expect(result.current.data).toEqual(mockJobs);
        });

        it('passes refetchInterval when provided', async () => {
            mockOverviewApi.getOpenJobs.mockResolvedValueOnce([]);

            const {result} = renderHook(() => useOverviewOpenJobs({}, 60000), {
                wrapper: createWrapper(),
            });

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            // The hook itself accepts refetchInterval — we verify it doesn't error
            expect(mockOverviewApi.getOpenJobs).toHaveBeenCalled();
        });
    });

    describe('useCourierSearch', () => {
        it('fetches couriers when search text is non-empty', async () => {
            const mockResults = [{id: 1, text: 'Courier A'}];
            mockOverviewApi.searchCouriers.mockResolvedValueOnce(mockResults);

            const {result} = renderHook(() => useCourierSearch('Courier'), {
                wrapper: createWrapper(),
            });

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            expect(result.current.data).toEqual(mockResults);
            expect(mockOverviewApi.searchCouriers).toHaveBeenCalledWith('Courier', expect.any(Object));
        });

        it('does not fetch when search text is empty', async () => {
            const {result} = renderHook(() => useCourierSearch(''), {
                wrapper: createWrapper(),
            });

            // Should remain in idle/disabled state
            expect(result.current.fetchStatus).toBe('idle');
            expect(mockOverviewApi.searchCouriers).not.toHaveBeenCalled();
        });

        it('refetches when search text changes', async () => {
            mockOverviewApi.searchCouriers.mockResolvedValue([]);

            const {result, rerender} = renderHook(
                ({text}: {text: string}) => useCourierSearch(text),
                {
                    wrapper: createWrapper(),
                    initialProps: {text: 'A'},
                },
            );

            await waitFor(() => expect(result.current.isSuccess).toBe(true));

            rerender({text: 'AB'});

            await waitFor(() => expect(result.current.isSuccess).toBe(true));

            expect(mockOverviewApi.searchCouriers).toHaveBeenCalledTimes(2);
        });
    });
});
