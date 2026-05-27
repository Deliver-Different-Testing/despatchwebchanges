/**
 * usePriceBreakdownApi Hooks Tests
 */

import React from 'react';
import {renderHook, waitFor, act} from '@testing-library/react';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {
    usePriceBreakdowns,
    useAddPriceBreakdown,
    useUpdatePriceBreakdown,
    useDeletePriceBreakdown,
    PriceBreakdown,
} from './usePriceBreakdownApi';
import {pricingBreakdownApi} from '../services/pricingBreakdownApi';

// Mock the pricingBreakdownApi
jest.mock('../services/pricingBreakdownApi', () => ({
    pricingBreakdownApi: {
        getPriceBreakdowns: jest.fn(),
        addPriceBreakdown: jest.fn(),
        updatePriceBreakdown: jest.fn(),
        deletePriceBreakdown: jest.fn(),
    },
}));

const mockPricingApi = pricingBreakdownApi as jest.Mocked<typeof pricingBreakdownApi>;

// Create a fresh QueryClient for each test
const createTestQueryClient = () =>
    new QueryClient({
        defaultOptions: {
            queries: {
                retry: false,
                gcTime: 0,
            },
            mutations: {
                retry: false,
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
const mockBreakdowns: PriceBreakdown[] = [
    {chargeId: 1, name: 'Base Charge', amount: 100.00, jobId: 100},
    {chargeId: 2, name: 'Rush Fee', amount: 25.00, jobId: 100},
    {chargeId: 3, name: 'Weekend Surcharge', amount: 15.00, jobId: 100, costAmount: 10.00},
];

describe('usePriceBreakdowns', () => {
    it('should fetch price breakdowns for a regular job', async () => {
        mockPricingApi.getPriceBreakdowns.mockResolvedValueOnce(mockBreakdowns);

        const {result} = renderHook(() => usePriceBreakdowns(100, false, false), {wrapper: createWrapper()});

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        expect(mockPricingApi.getPriceBreakdowns).toHaveBeenCalledWith(100, false, false, expect.anything());
        expect(result.current.data).toEqual(mockBreakdowns);
    });

    it('should fetch price breakdowns for a prebook job', async () => {
        mockPricingApi.getPriceBreakdowns.mockResolvedValueOnce(mockBreakdowns);

        const {result} = renderHook(() => usePriceBreakdowns(200, true, false), {wrapper: createWrapper()});

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        expect(mockPricingApi.getPriceBreakdowns).toHaveBeenCalledWith(200, true, false, expect.anything());
    });

    it('should fetch price breakdowns for an archived job', async () => {
        mockPricingApi.getPriceBreakdowns.mockResolvedValueOnce(mockBreakdowns);

        const {result} = renderHook(() => usePriceBreakdowns(300, false, true), {wrapper: createWrapper()});

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        expect(mockPricingApi.getPriceBreakdowns).toHaveBeenCalledWith(300, false, true, expect.anything());
    });

    it('should not fetch when jobId is undefined', async () => {
        renderHook(() => usePriceBreakdowns(undefined, false, false), {wrapper: createWrapper()});

        await waitFor(() => {
            expect(mockPricingApi.getPriceBreakdowns).not.toHaveBeenCalled();
        });
    });

    it('should not fetch when enabled is false', async () => {
        renderHook(() => usePriceBreakdowns(100, false, false, {enabled: false}), {wrapper: createWrapper()});

        await waitFor(() => {
            expect(mockPricingApi.getPriceBreakdowns).not.toHaveBeenCalled();
        });
    });

    it('should handle empty results', async () => {
        mockPricingApi.getPriceBreakdowns.mockResolvedValueOnce([]);

        const {result} = renderHook(() => usePriceBreakdowns(100, false, false), {wrapper: createWrapper()});

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        expect(result.current.data).toEqual([]);
    });

    it('should handle errors', async () => {
        const error = new Error('Failed to fetch breakdowns');
        mockPricingApi.getPriceBreakdowns.mockRejectedValueOnce(error);

        const {result} = renderHook(() => usePriceBreakdowns(100, false, false), {wrapper: createWrapper()});

        await waitFor(() => {
            expect(result.current.isError).toBe(true);
        });

        expect(result.current.error).toEqual(error);
    });
});

describe('useAddPriceBreakdown', () => {
    it('should add a price breakdown successfully', async () => {
        mockPricingApi.addPriceBreakdown.mockResolvedValueOnce(4);

        const {result} = renderHook(() => useAddPriceBreakdown(), {wrapper: createWrapper()});

        await act(async () => {
            result.current.mutate({
                name: 'New Charge',
                amount: 50.00,
                childJobId: 100,
                jobIdForCache: 100,
            });
        });

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        expect(mockPricingApi.addPriceBreakdown).toHaveBeenCalledWith({
            name: 'New Charge',
            amount: 50.00,
            childJobId: 100,
            jobIdForCache: 100,
        });
        expect(result.current.data).toBe(4);
    });

    it('should add a price breakdown with cost amount', async () => {
        mockPricingApi.addPriceBreakdown.mockResolvedValueOnce(5);

        const {result} = renderHook(() => useAddPriceBreakdown(), {wrapper: createWrapper()});

        await act(async () => {
            result.current.mutate({
                name: 'Charge with Cost',
                amount: 100.00,
                costAmount: 75.00,
                childJobId: 100,
            });
        });

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        expect(mockPricingApi.addPriceBreakdown).toHaveBeenCalled();
    });

    it('should handle errors', async () => {
        const error = new Error('Failed to add breakdown');
        mockPricingApi.addPriceBreakdown.mockRejectedValueOnce(error);

        const {result} = renderHook(() => useAddPriceBreakdown(), {wrapper: createWrapper()});

        await act(async () => {
            result.current.mutate({
                name: 'Test',
                amount: 10.00,
            });
        });

        await waitFor(() => {
            expect(result.current.isError).toBe(true);
        });

        expect(result.current.error).toEqual(error);
    });
});

describe('useUpdatePriceBreakdown', () => {
    it('should update a price breakdown successfully', async () => {
        mockPricingApi.updatePriceBreakdown.mockResolvedValueOnce(undefined);

        const {result} = renderHook(() => useUpdatePriceBreakdown(), {wrapper: createWrapper()});

        await act(async () => {
            result.current.mutate({
                chargeId: 1,
                name: 'Updated Charge',
                amount: 75.00,
                jobId: 100,
                jobIdForCache: 100,
            });
        });

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        expect(mockPricingApi.updatePriceBreakdown).toHaveBeenCalled();
    });

    it('should update a price breakdown with cost amount', async () => {
        mockPricingApi.updatePriceBreakdown.mockResolvedValueOnce(undefined);

        const {result} = renderHook(() => useUpdatePriceBreakdown(), {wrapper: createWrapper()});

        await act(async () => {
            result.current.mutate({
                chargeId: 2,
                name: 'Updated with Cost',
                amount: 120.00,
                costAmount: 90.00,
                jobId: 100,
            });
        });

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        expect(mockPricingApi.updatePriceBreakdown).toHaveBeenCalled();
    });

    it('should handle errors', async () => {
        const error = new Error('Failed to update breakdown');
        mockPricingApi.updatePriceBreakdown.mockRejectedValueOnce(error);

        const {result} = renderHook(() => useUpdatePriceBreakdown(), {wrapper: createWrapper()});

        await act(async () => {
            result.current.mutate({
                chargeId: 999,
                name: 'Test',
                amount: 10.00,
            });
        });

        await waitFor(() => {
            expect(result.current.isError).toBe(true);
        });

        expect(result.current.error).toEqual(error);
    });
});

describe('useDeletePriceBreakdown', () => {
    it('should delete a price breakdown successfully', async () => {
        mockPricingApi.deletePriceBreakdown.mockResolvedValueOnce(undefined);

        const {result} = renderHook(() => useDeletePriceBreakdown(), {wrapper: createWrapper()});

        await act(async () => {
            result.current.mutate({
                chargeId: 1,
                jobId: 100,
            });
        });

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        expect(mockPricingApi.deletePriceBreakdown).toHaveBeenCalledWith({
            chargeId: 1,
            jobId: 100,
        });
    });

    it('should delete an archived breakdown', async () => {
        mockPricingApi.deletePriceBreakdown.mockResolvedValueOnce(undefined);

        const {result} = renderHook(() => useDeletePriceBreakdown(), {wrapper: createWrapper()});

        await act(async () => {
            result.current.mutate({
                chargeId: 2,
                jobId: 100,
                isArchived: true,
            });
        });

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        expect(mockPricingApi.deletePriceBreakdown).toHaveBeenCalledWith({
            chargeId: 2,
            jobId: 100,
            isArchived: true,
        });
    });

    it('should handle errors', async () => {
        const error = new Error('Failed to delete breakdown');
        mockPricingApi.deletePriceBreakdown.mockRejectedValueOnce(error);

        const {result} = renderHook(() => useDeletePriceBreakdown(), {wrapper: createWrapper()});

        await act(async () => {
            result.current.mutate({
                chargeId: 999,
                jobId: 100,
            });
        });

        await waitFor(() => {
            expect(result.current.isError).toBe(true);
        });

        expect(result.current.error).toEqual(error);
    });
});
