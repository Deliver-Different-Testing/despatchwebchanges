/**
 * Courier API Service Tests
 */

import {courierApi} from './courierApi';
import {apiClient} from './apiClient';
import {createMockApiError} from '../__testUtils__';

// Mock the apiClient
jest.mock('./apiClient', () => ({
    apiClient: {
        get: jest.fn(),
    },
}));

const mockApiClient = apiClient as jest.Mocked<typeof apiClient>;

describe('courierApi', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('searchActiveCouriers', () => {
        it('should call apiClient.get with correct endpoint and search text', async () => {
            const mockCouriers = [
                {id: 1, text: 'John Smith'},
                {id: 2, text: 'Jane Doe'},
            ];
            mockApiClient.get.mockResolvedValueOnce(mockCouriers);

            const result = await courierApi.searchActiveCouriers('John');

            expect(mockApiClient.get).toHaveBeenCalledWith('courier/AllActiveSearch', {
                searchText: 'John',
            });
            expect(result).toEqual(mockCouriers);
        });

        it('should return empty array when no couriers found', async () => {
            mockApiClient.get.mockResolvedValueOnce([]);

            const result = await courierApi.searchActiveCouriers('NonExistent');

            expect(result).toEqual([]);
        });

        it('should handle empty search text', async () => {
            const mockCouriers = [{id: 1, text: 'All Couriers'}];
            mockApiClient.get.mockResolvedValueOnce(mockCouriers);

            const result = await courierApi.searchActiveCouriers('');

            expect(mockApiClient.get).toHaveBeenCalledWith('courier/AllActiveSearch', {
                searchText: '',
            });
            expect(result).toEqual(mockCouriers);
        });

        it.each([
            ['404 Not Found', createMockApiError({status: 404, statusText: 'Not Found', message: 'Courier not found'})],
            ['500 Server Error', createMockApiError({status: 500, statusText: 'Internal Server Error', message: 'Database error'})],
        ])('should propagate %s errors from apiClient', async (_, error) => {
            mockApiClient.get.mockRejectedValueOnce(error);
            await expect(courierApi.searchActiveCouriers('test')).rejects.toEqual(error);
        });
    });

    describe('getTimeZoneOptions', () => {
        it('should call apiClient.get with correct endpoint', async () => {
            const mockTimeZones = [
                {id: 1, text: 'Pacific Time', timeZoneIana: 'America/Los_Angeles'},
                {id: 2, text: 'Eastern Time', timeZoneIana: 'America/New_York'},
            ];
            mockApiClient.get.mockResolvedValueOnce(mockTimeZones);

            const result = await courierApi.getTimeZoneOptions();

            expect(mockApiClient.get).toHaveBeenCalledWith('job/GetTimeZoneOptions');
            expect(result).toEqual(mockTimeZones);
        });

        it('should return empty array when no timezones available', async () => {
            mockApiClient.get.mockResolvedValueOnce([]);

            const result = await courierApi.getTimeZoneOptions();

            expect(result).toEqual([]);
        });

        it.each([
            ['500 Server Error', createMockApiError({status: 500, statusText: 'Internal Server Error', message: 'Database error'})],
        ])('should propagate %s errors from apiClient', async (_, error) => {
            mockApiClient.get.mockRejectedValueOnce(error);
            await expect(courierApi.getTimeZoneOptions()).rejects.toEqual(error);
        });
    });
});
