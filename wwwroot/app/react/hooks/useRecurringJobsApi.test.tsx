/**
 * useRecurringJobsApi Hooks Tests
 */

import React from 'react';
import dayjs from 'dayjs';
import {renderHook, waitFor} from '@testing-library/react';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {useRecurringJobsList, useSpeedList} from './useRecurringJobsApi';
import {recurringJobsApi} from '../services/recurringJobsApi';
import {
    PaginatedRecurringJobsResponse,
    RecurringJobQuery,
    SpeedOption,
} from '../interfaces';

// Mock the recurringJobsApi
jest.mock('../services/recurringJobsApi', () => ({
    recurringJobsApi: {
        getPreBookJobs: jest.fn(),
        getSpeedList: jest.fn(),
    },
}));

const mockRecurringJobsApi = recurringJobsApi as jest.Mocked<typeof recurringJobsApi>;

// Create a fresh QueryClient for each test
const createTestQueryClient = () =>
    new QueryClient({
        defaultOptions: {
            queries: {
                retry: false,
                gcTime: 0,
            },
        },
    });

// Wrapper component for providing QueryClient
const createWrapper = () => {
    const queryClient = createTestQueryClient();
    return ({children}: {children: React.ReactNode}) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
};

// Sample test data
const mockQuery: RecurringJobQuery = {
    order: 'booked',
    orderDirection: 'desc',
    limit: 50,
    page: 1,
    active: true,
};

const mockPaginatedResponse: PaginatedRecurringJobsResponse = {
    items: [
        {
            id: 1,
            booked: dayjs('2024-01-15T10:00:00Z'),
            nextDueTime: dayjs('2024-01-20T14:00:00Z'),
            client: 'Acme Corp',
            jobNo: 'RJ-001',
            clientId: 100,
            courier: 'Express Courier',
            speed: 'Same Day',
            customJobName: 'Weekly delivery',
            pickupAddress: {
                addressLine1: 'Warehouse A',
                addressLine2: '',
                addressLine3: '',
                addressLine4: '123 Main St',
                addressLine5: 'Auckland',
                addressLine6: '',
                addressLine7: '1010',
                addressLine8: '',
                fullAddress: '123 Main St, Auckland 1010',
            },
            deliveryAddress: {
                addressLine1: 'Client Office',
                addressLine2: '',
                addressLine3: '',
                addressLine4: '456 Business Ave',
                addressLine5: 'Wellington',
                addressLine6: '',
                addressLine7: '6011',
                addressLine8: '',
                fullAddress: '456 Business Ave, Wellington 6011',
            },
        },
        {
            id: 2,
            booked: dayjs('2024-01-10T09:00:00Z'),
            client: 'Beta Inc',
            jobNo: 'RJ-002',
            clientId: 101,
            courier: 'Standard Delivery',
            speed: 'Next Day',
            pickupAddress: {
                addressLine1: 'Office B',
                addressLine2: '',
                addressLine3: '',
                addressLine4: '789 Park Rd',
                addressLine5: 'Christchurch',
                addressLine6: '',
                addressLine7: '8011',
                addressLine8: '',
                fullAddress: '789 Park Rd, Christchurch 8011',
            },
            deliveryAddress: {
                addressLine1: 'Distribution Center',
                addressLine2: '',
                addressLine3: '',
                addressLine4: '321 Industrial Way',
                addressLine5: 'Hamilton',
                addressLine6: '',
                addressLine7: '3200',
                addressLine8: '',
                fullAddress: '321 Industrial Way, Hamilton 3200',
            },
        },
    ],
    total: 2,
    page: 1,
    pages: 1,
};

const mockSpeedOptions: SpeedOption[] = [
    {id: 1, text: 'Same Day'},
    {id: 2, text: 'Next Day'},
    {id: 3, text: 'Economy'},
];

describe('useRecurringJobsApi Hooks', () => {
    describe('useRecurringJobsList', () => {
        it('should fetch recurring jobs list successfully', async () => {
            mockRecurringJobsApi.getPreBookJobs.mockResolvedValueOnce(mockPaginatedResponse);

            const {result} = renderHook(() => useRecurringJobsList(mockQuery), {
                wrapper: createWrapper(),
            });

            expect(result.current.isLoading).toBe(true);

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            expect(result.current.data).toEqual(mockPaginatedResponse);
            expect(mockRecurringJobsApi.getPreBookJobs).toHaveBeenCalledWith(mockQuery, expect.anything());
        });

        it('should pass query parameters to the API', async () => {
            mockRecurringJobsApi.getPreBookJobs.mockResolvedValueOnce({
                ...mockPaginatedResponse,
                items: [],
            });

            const queryWithFilters: RecurringJobQuery = {
                ...mockQuery,
                searchText: 'Acme',
                speedId: 1,
                courierId: 5,
            };

            const {result} = renderHook(() => useRecurringJobsList(queryWithFilters), {
                wrapper: createWrapper(),
            });

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            expect(mockRecurringJobsApi.getPreBookJobs).toHaveBeenCalledWith(queryWithFilters, expect.anything());
        });

        it('should handle pagination parameters', async () => {
            const paginatedResponse: PaginatedRecurringJobsResponse = {
                ...mockPaginatedResponse,
                page: 2,
                pages: 5,
                total: 100,
            };
            mockRecurringJobsApi.getPreBookJobs.mockResolvedValueOnce(paginatedResponse);

            const queryPage2: RecurringJobQuery = {
                ...mockQuery,
                page: 2,
            };

            const {result} = renderHook(() => useRecurringJobsList(queryPage2), {
                wrapper: createWrapper(),
            });

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            expect(result.current.data?.page).toBe(2);
            expect(result.current.data?.pages).toBe(5);
            expect(result.current.data?.total).toBe(100);
        });

        it('should handle errors', async () => {
            const error = new Error('Failed to fetch recurring jobs');
            mockRecurringJobsApi.getPreBookJobs.mockRejectedValueOnce(error);

            const {result} = renderHook(() => useRecurringJobsList(mockQuery), {
                wrapper: createWrapper(),
            });

            await waitFor(() => {
                expect(result.current.isError).toBe(true);
            });

            expect(result.current.error).toEqual(error);
        });

        it('should not fetch when disabled', async () => {
            mockRecurringJobsApi.getPreBookJobs.mockResolvedValueOnce(mockPaginatedResponse);

            const {result} = renderHook(
                () => useRecurringJobsList(mockQuery, {enabled: false}),
                {wrapper: createWrapper()}
            );

            expect(result.current.isLoading).toBe(false);
            expect(result.current.data).toBeUndefined();
            expect(mockRecurringJobsApi.getPreBookJobs).not.toHaveBeenCalled();
        });

        it('should refetch when query changes', async () => {
            mockRecurringJobsApi.getPreBookJobs.mockResolvedValue(mockPaginatedResponse);

            const {result, rerender} = renderHook(
                ({query}: {query: RecurringJobQuery}) => useRecurringJobsList(query),
                {
                    wrapper: createWrapper(),
                    initialProps: {query: mockQuery},
                }
            );

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            // Change the query
            const newQuery: RecurringJobQuery = {...mockQuery, page: 2};
            rerender({query: newQuery});

            await waitFor(() => {
                expect(mockRecurringJobsApi.getPreBookJobs).toHaveBeenCalledTimes(2);
            });

            expect(mockRecurringJobsApi.getPreBookJobs).toHaveBeenLastCalledWith(newQuery, expect.anything());
        });

        it('should handle active/inactive filter', async () => {
            mockRecurringJobsApi.getPreBookJobs.mockResolvedValueOnce({
                ...mockPaginatedResponse,
                items: [],
            });

            const inactiveQuery: RecurringJobQuery = {
                ...mockQuery,
                active: false,
            };

            const {result} = renderHook(() => useRecurringJobsList(inactiveQuery), {
                wrapper: createWrapper(),
            });

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            expect(mockRecurringJobsApi.getPreBookJobs).toHaveBeenCalledWith(inactiveQuery, expect.anything());
        });
    });

    describe('useSpeedList', () => {
        it('should fetch speed list successfully', async () => {
            mockRecurringJobsApi.getSpeedList.mockResolvedValueOnce(mockSpeedOptions);

            const {result} = renderHook(() => useSpeedList(), {
                wrapper: createWrapper(),
            });

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            expect(result.current.data).toEqual(mockSpeedOptions);
            expect(mockRecurringJobsApi.getSpeedList).toHaveBeenCalled();
        });

        it('should return array of speed options', async () => {
            mockRecurringJobsApi.getSpeedList.mockResolvedValueOnce(mockSpeedOptions);

            const {result} = renderHook(() => useSpeedList(), {
                wrapper: createWrapper(),
            });

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            expect(result.current.data).toHaveLength(3);
            expect(result.current.data?.[0]).toEqual({id: 1, text: 'Same Day'});
        });

        it('should handle errors', async () => {
            const error = new Error('Failed to fetch speed list');
            mockRecurringJobsApi.getSpeedList.mockRejectedValueOnce(error);

            const {result} = renderHook(() => useSpeedList(), {
                wrapper: createWrapper(),
            });

            await waitFor(() => {
                expect(result.current.isError).toBe(true);
            });

            expect(result.current.error).toEqual(error);
        });

        it('should not fetch when disabled', async () => {
            const {result} = renderHook(() => useSpeedList({enabled: false}), {
                wrapper: createWrapper(),
            });

            expect(result.current.data).toBeUndefined();
            expect(mockRecurringJobsApi.getSpeedList).not.toHaveBeenCalled();
        });

        it('should cache speed list data', async () => {
            mockRecurringJobsApi.getSpeedList.mockResolvedValue(mockSpeedOptions);

            const queryClient = createTestQueryClient();
            const wrapper = ({children}: {children: React.ReactNode}) => (
                <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
            );

            // First render
            const {result: result1} = renderHook(() => useSpeedList(), {wrapper});

            await waitFor(() => {
                expect(result1.current.isSuccess).toBe(true);
            });

            // Second render with same wrapper (same cache)
            const {result: result2} = renderHook(() => useSpeedList(), {wrapper});

            // Should use cached data, not make a new API call
            expect(result2.current.data).toEqual(mockSpeedOptions);
            // Only one call should have been made due to caching
            expect(mockRecurringJobsApi.getSpeedList).toHaveBeenCalledTimes(1);
        });
    });
});
