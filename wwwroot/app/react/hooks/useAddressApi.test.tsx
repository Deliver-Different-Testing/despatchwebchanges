/**
 * useAddressApi Hooks Tests
 */

import React from 'react';
import {renderHook, waitFor} from '@testing-library/react';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {useAddressSearch, useLocationDetails, useHereMapsApiKey} from './useAddressApi';
import {addressApi} from '../services/addressApi';
import {HereMapsLocationResult, HereMapsLookupResponse} from '../interfaces';

// Mock the addressApi
jest.mock('../services/addressApi', () => ({
    addressApi: {
        autocompleteSearch: jest.fn(),
        getLocationDetailsById: jest.fn(),
        getHereMapsKey: jest.fn(),
    },
}));

const mockAddressApi = addressApi as jest.Mocked<typeof addressApi>;

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

describe('useAddressSearch', () => {
    const mockAddressResults: HereMapsLocationResult[] = [
        {
            title: '123 Main Street',
            id: 'addr1',
            resultType: 'houseNumber',
            address: {
                label: '123 Main Street, Auckland',
                countryCode: 'NZL',
                countryName: 'New Zealand',
                city: 'Auckland',
                postalCode: '1010',
            },
            position: {lat: -36.8485, lng: 174.7633},
            access: [{lat: -36.8485, lng: 174.7633}],
        },
        {
            title: '456 Main Road',
            id: 'addr2',
            resultType: 'houseNumber',
            address: {
                label: '456 Main Road, Wellington',
                countryCode: 'NZL',
                countryName: 'New Zealand',
                city: 'Wellington',
                postalCode: '6011',
            },
            position: {lat: -41.2865, lng: 174.7762},
            access: [{lat: -41.2865, lng: 174.7762}],
        },
    ];

    it('should not fetch when search text is less than 3 characters', async () => {
        renderHook(() => useAddressSearch('ab'), {wrapper: createWrapper()});

        await waitFor(() => {
            expect(mockAddressApi.autocompleteSearch).not.toHaveBeenCalled();
        });
    });

    it('should fetch addresses when search text is 3 or more characters', async () => {
        mockAddressApi.autocompleteSearch.mockResolvedValueOnce(mockAddressResults);

        const {result} = renderHook(() => useAddressSearch('main'), {wrapper: createWrapper()});

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        expect(mockAddressApi.autocompleteSearch).toHaveBeenCalledWith('main', expect.anything());
        expect(result.current.data).toEqual(mockAddressResults);
    });

    it('should not fetch when enabled is false', async () => {
        renderHook(() => useAddressSearch('main street', {enabled: false}), {wrapper: createWrapper()});

        await waitFor(() => {
            expect(mockAddressApi.autocompleteSearch).not.toHaveBeenCalled();
        });
    });

    it('should handle errors', async () => {
        const error = new Error('API Error');
        mockAddressApi.autocompleteSearch.mockRejectedValueOnce(error);

        const {result} = renderHook(() => useAddressSearch('test'), {wrapper: createWrapper()});

        await waitFor(() => {
            expect(result.current.isError).toBe(true);
        });

        expect(result.current.error).toEqual(error);
    });
});

describe('useLocationDetails', () => {
    const mockLocationDetails: HereMapsLookupResponse = {
        title: '123 Main Street',
        id: 'addr1',
        address: {
            label: '123 Main Street, Auckland 1010',
            countryCode: 'NZL',
            countryName: 'New Zealand',
            city: 'Auckland',
            postalCode: '1010',
            street: 'Main Street',
            houseNumber: '123',
        },
        position: {
            lat: -36.8485,
            lng: 174.7633,
        },
    };

    it('should not fetch when addressId is null', async () => {
        renderHook(() => useLocationDetails(null), {wrapper: createWrapper()});

        await waitFor(() => {
            expect(mockAddressApi.getLocationDetailsById).not.toHaveBeenCalled();
        });
    });

    it('should fetch location details when addressId is provided', async () => {
        mockAddressApi.getLocationDetailsById.mockResolvedValueOnce(mockLocationDetails);

        const {result} = renderHook(() => useLocationDetails('addr1'), {wrapper: createWrapper()});

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        expect(mockAddressApi.getLocationDetailsById).toHaveBeenCalledWith('addr1', expect.anything());
        expect(result.current.data).toEqual(mockLocationDetails);
    });

    it('should not fetch when enabled is false', async () => {
        renderHook(() => useLocationDetails('addr1', {enabled: false}), {wrapper: createWrapper()});

        await waitFor(() => {
            expect(mockAddressApi.getLocationDetailsById).not.toHaveBeenCalled();
        });
    });

    it('should handle errors', async () => {
        const error = new Error('Location not found');
        mockAddressApi.getLocationDetailsById.mockRejectedValueOnce(error);

        const {result} = renderHook(() => useLocationDetails('invalid'), {wrapper: createWrapper()});

        await waitFor(() => {
            expect(result.current.isError).toBe(true);
        });

        expect(result.current.error).toEqual(error);
    });
});

describe('useHereMapsApiKey', () => {
    it('should fetch API key by default', async () => {
        mockAddressApi.getHereMapsKey.mockResolvedValueOnce('test-api-key-123');

        const {result} = renderHook(() => useHereMapsApiKey(), {wrapper: createWrapper()});

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        expect(mockAddressApi.getHereMapsKey).toHaveBeenCalled();
        expect(result.current.data).toBe('test-api-key-123');
    });

    it('should not fetch when enabled is false', async () => {
        renderHook(() => useHereMapsApiKey({enabled: false}), {wrapper: createWrapper()});

        await waitFor(() => {
            expect(mockAddressApi.getHereMapsKey).not.toHaveBeenCalled();
        });
    });

    it('should handle errors', async () => {
        const error = new Error('Failed to get API key');
        mockAddressApi.getHereMapsKey.mockRejectedValueOnce(error);

        const {result} = renderHook(() => useHereMapsApiKey(), {wrapper: createWrapper()});

        await waitFor(() => {
            expect(result.current.isError).toBe(true);
        });

        expect(result.current.error).toEqual(error);
    });
});
