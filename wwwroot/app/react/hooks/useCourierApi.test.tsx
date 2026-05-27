/**
 * useCourierApi Hooks Tests
 */

import React from 'react';
import {renderHook, waitFor} from '@testing-library/react';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {useCourierSearch, useTimeZoneOptions} from './useCourierApi';
import {courierApi} from '../services/courierApi';
import {CourierSuggestion, TimeZoneOption} from '../interfaces';

// Mock the courierApi
jest.mock('../services/courierApi', () => ({
    courierApi: {
        searchActiveCouriers: jest.fn(),
        getTimeZoneOptions: jest.fn(),
    },
}));

const mockCourierApi = courierApi as jest.Mocked<typeof courierApi>;

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

describe('useCourierSearch', () => {
    const mockCouriers: CourierSuggestion[] = [
        {id: 1, text: 'John Smith'},
        {id: 2, text: 'Jane Doe'},
        {id: 3, text: 'John Brown'},
    ];

    it('should not fetch when search text is less than 2 characters', async () => {
        renderHook(() => useCourierSearch('j'), {wrapper: createWrapper()});

        await waitFor(() => {
            expect(mockCourierApi.searchActiveCouriers).not.toHaveBeenCalled();
        });
    });

    it('should fetch couriers when search text is 2 or more characters', async () => {
        mockCourierApi.searchActiveCouriers.mockResolvedValueOnce(mockCouriers);

        const {result} = renderHook(() => useCourierSearch('jo'), {wrapper: createWrapper()});

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        expect(mockCourierApi.searchActiveCouriers).toHaveBeenCalledWith('jo', expect.anything());
        expect(result.current.data).toEqual(mockCouriers);
    });

    it('should fetch with longer search text', async () => {
        mockCourierApi.searchActiveCouriers.mockResolvedValueOnce(mockCouriers.slice(0, 2));

        const {result} = renderHook(() => useCourierSearch('john'), {wrapper: createWrapper()});

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        expect(mockCourierApi.searchActiveCouriers).toHaveBeenCalledWith('john', expect.anything());
        expect(result.current.data).toHaveLength(2);
    });

    it('should not fetch when enabled is false', async () => {
        renderHook(() => useCourierSearch('john', {enabled: false}), {wrapper: createWrapper()});

        await waitFor(() => {
            expect(mockCourierApi.searchActiveCouriers).not.toHaveBeenCalled();
        });
    });

    it('should handle empty results', async () => {
        mockCourierApi.searchActiveCouriers.mockResolvedValueOnce([]);

        const {result} = renderHook(() => useCourierSearch('xyz'), {wrapper: createWrapper()});

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        expect(result.current.data).toEqual([]);
    });

    it('should handle errors', async () => {
        const error = new Error('Search failed');
        mockCourierApi.searchActiveCouriers.mockRejectedValueOnce(error);

        const {result} = renderHook(() => useCourierSearch('test'), {wrapper: createWrapper()});

        await waitFor(() => {
            expect(result.current.isError).toBe(true);
        });

        expect(result.current.error).toEqual(error);
    });
});

describe('useTimeZoneOptions', () => {
    const mockTimeZones: TimeZoneOption[] = [
        {id: 1, text: 'Pacific Time (US)', timeZoneIana: 'America/Los_Angeles'},
        {id: 2, text: 'Eastern Time (US)', timeZoneIana: 'America/New_York'},
        {id: 3, text: 'New Zealand Standard Time', timeZoneIana: 'Pacific/Auckland'},
    ];

    it('should fetch timezone options by default', async () => {
        mockCourierApi.getTimeZoneOptions.mockResolvedValueOnce(mockTimeZones);

        const {result} = renderHook(() => useTimeZoneOptions(), {wrapper: createWrapper()});

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        expect(mockCourierApi.getTimeZoneOptions).toHaveBeenCalled();
        expect(result.current.data).toEqual(mockTimeZones);
    });

    it('should not fetch when enabled is false', async () => {
        renderHook(() => useTimeZoneOptions({enabled: false}), {wrapper: createWrapper()});

        await waitFor(() => {
            expect(mockCourierApi.getTimeZoneOptions).not.toHaveBeenCalled();
        });
    });

    it('should handle empty results', async () => {
        mockCourierApi.getTimeZoneOptions.mockResolvedValueOnce([]);

        const {result} = renderHook(() => useTimeZoneOptions(), {wrapper: createWrapper()});

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        expect(result.current.data).toEqual([]);
    });

    it('should handle errors', async () => {
        const error = new Error('Failed to load timezones');
        mockCourierApi.getTimeZoneOptions.mockRejectedValueOnce(error);

        const {result} = renderHook(() => useTimeZoneOptions(), {wrapper: createWrapper()});

        await waitFor(() => {
            expect(result.current.isError).toBe(true);
        });

        expect(result.current.error).toEqual(error);
    });
});
