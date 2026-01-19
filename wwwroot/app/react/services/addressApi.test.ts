/**
 * Address API Service Tests
 */

import {addressApi} from './addressApi';
import {apiClient} from './apiClient';
import {createMockApiError} from '../__testUtils__';

// Mock the apiClient
jest.mock('./apiClient', () => ({
    apiClient: {
        get: jest.fn(),
    },
}));

const mockApiClient = apiClient as jest.Mocked<typeof apiClient>;

describe('addressApi', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('autocompleteSearch', () => {
        it('should call apiClient.get with correct URL and params', async () => {
            const mockResponse = [
                {
                    title: '123 Main Street, New York, NY',
                    id: 'here:af:address:123',
                    resultType: 'houseNumber',
                    address: {
                        label: '123 Main Street, New York, NY 10001',
                        countryCode: 'USA',
                        countryName: 'United States',
                        city: 'New York',
                        street: 'Main Street',
                        postalCode: '10001',
                        houseNumber: '123',
                    },
                    position: {lat: 40.7128, lng: -74.006},
                    access: [{lat: 40.7128, lng: -74.006}],
                },
            ];
            mockApiClient.get.mockResolvedValueOnce(mockResponse);

            const result = await addressApi.autocompleteSearch('123 Main');

            expect(mockApiClient.get).toHaveBeenCalledWith(
                'addressAutocomplete/AutocompleteAddressSearch',
                {text: '123 Main'}
            );
            expect(result).toEqual(mockResponse);
        });

        it('should handle empty search results', async () => {
            mockApiClient.get.mockResolvedValueOnce([]);

            const result = await addressApi.autocompleteSearch('xyz123nonexistent');

            expect(result).toEqual([]);
        });
    });

    describe('getLocationDetailsById', () => {
        it('should call apiClient.get with correct URL and params', async () => {
            const mockResponse = {
                title: '123 Main Street',
                id: 'here:af:address:123',
                address: {
                    label: '123 Main Street, New York, NY 10001',
                    countryCode: 'USA',
                    countryName: 'United States',
                    stateCode: 'NY',
                    state: 'New York',
                    city: 'New York',
                    street: 'Main Street',
                    postalCode: '10001',
                    houseNumber: '123',
                },
                position: {lat: 40.7128, lng: -74.006},
                streetInfo: [
                    {
                        baseName: 'Main',
                        streetType: 'Street',
                        streetTypePrecedes: false,
                    },
                ],
            };
            mockApiClient.get.mockResolvedValueOnce(mockResponse);

            const result = await addressApi.getLocationDetailsById('here:af:address:123');

            expect(mockApiClient.get).toHaveBeenCalledWith(
                'addressAutocomplete/GetLocationDetailsById',
                {addressId: 'here:af:address:123'}
            );
            expect(result).toEqual(mockResponse);
        });
    });

    describe('fetchNearestAddress', () => {
        it('should call apiClient.get with correct URL and params', async () => {
            const mockResponse = [
                {
                    title: '123 Main Street, New York, NY',
                    id: 'here:af:address:123',
                    resultType: 'houseNumber',
                    address: {
                        label: '123 Main Street, New York, NY 10001',
                        countryCode: 'USA',
                        countryName: 'United States',
                        city: 'New York',
                        street: 'Main Street',
                        postalCode: '10001',
                        houseNumber: '123',
                    },
                    position: {lat: 40.7128, lng: -74.006},
                    access: [],
                },
            ];
            mockApiClient.get.mockResolvedValueOnce(mockResponse);

            const result = await addressApi.fetchNearestAddress(40.7128, -74.006);

            expect(mockApiClient.get).toHaveBeenCalledWith(
                'addressAutocomplete/FetchNearestAddress',
                {latitude: 40.7128, longitude: -74.006}
            );
            expect(result).toEqual(mockResponse);
        });

        it('should handle coordinates with high precision', async () => {
            mockApiClient.get.mockResolvedValueOnce([]);

            await addressApi.fetchNearestAddress(40.71284567890123, -74.00598765432109);

            expect(mockApiClient.get).toHaveBeenCalledWith(
                'addressAutocomplete/FetchNearestAddress',
                {latitude: 40.71284567890123, longitude: -74.00598765432109}
            );
        });
    });

    describe('getHereMapsKey', () => {
        it('should call apiClient.get and extract apiKey from response', async () => {
            const mockResponse = {apiKey: 'test-api-key-12345'};
            mockApiClient.get.mockResolvedValueOnce(mockResponse);

            const result = await addressApi.getHereMapsKey();

            expect(mockApiClient.get).toHaveBeenCalledWith('config/GetHereMapsKey');
            expect(result).toBe('test-api-key-12345');
        });

        it('should handle empty apiKey', async () => {
            const mockResponse = {apiKey: ''};
            mockApiClient.get.mockResolvedValueOnce(mockResponse);

            const result = await addressApi.getHereMapsKey();

            expect(result).toBe('');
        });
    });

    describe('Error propagation', () => {
        it.each([
            ['autocompleteSearch', () => addressApi.autocompleteSearch('test')],
            ['getLocationDetailsById', () => addressApi.getLocationDetailsById('invalid-id')],
            ['fetchNearestAddress', () => addressApi.fetchNearestAddress(40.7128, -74.006)],
            ['getHereMapsKey', () => addressApi.getHereMapsKey()],
        ])('%s should propagate errors from apiClient', async (_, apiCall) => {
            const error = createMockApiError();
            mockApiClient.get.mockRejectedValueOnce(error);
            await expect(apiCall()).rejects.toEqual(error);
        });
    });

    describe('addressApi object', () => {
        it('should export all functions', () => {
            expect(typeof addressApi.autocompleteSearch).toBe('function');
            expect(typeof addressApi.getLocationDetailsById).toBe('function');
            expect(typeof addressApi.fetchNearestAddress).toBe('function');
            expect(typeof addressApi.getHereMapsKey).toBe('function');
        });
    });
});
