/**
 * Courier API Service Tests
 */

import {courierApi, getAvailableCourierLocations, getClearListEnvelope} from './courierApi';
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

    describe('getAvailableCourierLocations', () => {
        const mockCouriers = [
            {
                courierId: 1,
                courierInitials: 'JS',
                firstName: 'John',
                lastName: 'Smith',
                latitude: 40.7128,
                longitude: -74.006,
                jobCount: 3,
                overdueJobCount: 0,
                isUrgentArmy: false,
            },
            {
                courierId: 2,
                courierInitials: 'JD',
                firstName: 'Jane',
                lastName: 'Doe',
                latitude: 34.0522,
                longitude: -118.2437,
                jobCount: 1,
                overdueJobCount: 1,
                isUrgentArmy: true,
            },
        ];

        it('should call apiClient.get with correct endpoint and bounds', async () => {
            mockApiClient.get.mockResolvedValueOnce(mockCouriers);

            const result = await getAvailableCourierLocations(-125, 24, -65, 50);

            expect(mockApiClient.get).toHaveBeenCalledWith('courier/AvailableCourierLocation', {
                minLng: -125,
                minLat: 24,
                maxLng: -65,
                maxLat: 50,
            });
            expect(result).toEqual(mockCouriers);
        });

        it('should return empty array when no couriers in bounds', async () => {
            mockApiClient.get.mockResolvedValueOnce([]);

            const result = await getAvailableCourierLocations(0, 0, 1, 1);

            expect(result).toEqual([]);
        });

        it('should work with courierApi object', async () => {
            mockApiClient.get.mockResolvedValueOnce(mockCouriers);

            const result = await courierApi.getAvailableCourierLocations(-125, 24, -65, 50);

            expect(result).toEqual(mockCouriers);
        });

        it.each([
            ['404 Not Found', createMockApiError({status: 404, statusText: 'Not Found', message: 'Not found'})],
            ['500 Server Error', createMockApiError({status: 500, statusText: 'Internal Server Error', message: 'Database error'})],
        ])('should propagate %s errors from apiClient', async (_, error) => {
            mockApiClient.get.mockRejectedValueOnce(error);
            await expect(getAvailableCourierLocations(-125, 24, -65, 50)).rejects.toEqual(error);
        });
    });

    describe('getClearListEnvelope', () => {
        const mockEnvelope = {
            minimumLatitude: 33.5,
            maximumLatitude: 34.5,
            minimumLongitude: -118.5,
            maximumLongitude: -117.5,
        };

        it('should call apiClient.get with correct endpoint and clearListId', async () => {
            mockApiClient.get.mockResolvedValueOnce(mockEnvelope);

            const result = await getClearListEnvelope(123);

            expect(mockApiClient.get).toHaveBeenCalledWith('courier/DriverDestinationEnvelope', {
                clearListId: 123,
            });
            expect(result).toEqual(mockEnvelope);
        });

        it('should return envelope data with correct coordinate structure', async () => {
            mockApiClient.get.mockResolvedValueOnce(mockEnvelope);

            const result = await getClearListEnvelope(456);

            expect(result).toHaveProperty('minimumLatitude');
            expect(result).toHaveProperty('maximumLatitude');
            expect(result).toHaveProperty('minimumLongitude');
            expect(result).toHaveProperty('maximumLongitude');
            expect(result.minimumLatitude).toBe(33.5);
            expect(result.maximumLatitude).toBe(34.5);
        });

        it('should work with courierApi object', async () => {
            mockApiClient.get.mockResolvedValueOnce(mockEnvelope);

            const result = await courierApi.getClearListEnvelope(789);

            expect(mockApiClient.get).toHaveBeenCalledWith('courier/DriverDestinationEnvelope', {
                clearListId: 789,
            });
            expect(result).toEqual(mockEnvelope);
        });

        it.each([
            ['404 Not Found', createMockApiError({status: 404, statusText: 'Not Found', message: 'Clearlist not found'})],
            ['500 Server Error', createMockApiError({status: 500, statusText: 'Internal Server Error', message: 'Database error'})],
        ])('should propagate %s errors from apiClient', async (_, error) => {
            mockApiClient.get.mockRejectedValueOnce(error);
            await expect(getClearListEnvelope(123)).rejects.toEqual(error);
        });
    });
});
