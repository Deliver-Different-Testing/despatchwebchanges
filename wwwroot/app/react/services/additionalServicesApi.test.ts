/**
 * Additional Services API Service Tests
 */

import { AdditionalServicesApiService, additionalServicesApi } from './additionalServicesApi';
import { apiClient } from './apiClient';
import { createMockApiError } from '../__testUtils__';

// Mock the apiClient
jest.mock('./apiClient', () => ({
    apiClient: {
        get: jest.fn(),
        post: jest.fn(),
    },
}));

const mockApiClient = apiClient as jest.Mocked<typeof apiClient>;

describe('AdditionalServicesApiService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('hasClientItemsAvailable', () => {
        it('should call apiClient.get with correct URL and params', async () => {
            mockApiClient.get.mockResolvedValueOnce(true);

            const result = await additionalServicesApi.hasClientItemsAvailable(123, 456);

            expect(mockApiClient.get).toHaveBeenCalledWith(
                'job/HasClientItemsAvailable',
                { clientId: 123, speedId: 456 }
            );
            expect(result).toBe(true);
        });

        it('should return false when no services are available', async () => {
            mockApiClient.get.mockResolvedValueOnce(false);

            const result = await additionalServicesApi.hasClientItemsAvailable(789, 101);

            expect(result).toBe(false);
        });

        it('should propagate errors from apiClient', async () => {
            const error = createMockApiError();
            mockApiClient.get.mockRejectedValueOnce(error);

            await expect(
                additionalServicesApi.hasClientItemsAvailable(123, 456)
            ).rejects.toEqual(error);
        });
    });

    describe('getServices', () => {
        it('should call apiClient.get with correct URL and params', async () => {
            const mockResponse = {
                items: [
                    { itemId: 1, clientId: 123, name: 'Service 1', description: '', perItem: false, rate: 10, onlyVan: false, selected: false },
                ],
                total: 1,
            };
            mockApiClient.get.mockResolvedValueOnce(mockResponse);

            const result = await additionalServicesApi.getServices(123, 456, 789);

            expect(mockApiClient.get).toHaveBeenCalledWith(
                'job/GetAllClientItems',
                { clientId: 123, speedId: 456, jobId: 789 }
            );
            expect(result).toEqual(mockResponse);
        });

        it('should propagate errors from apiClient', async () => {
            const error = createMockApiError();
            mockApiClient.get.mockRejectedValueOnce(error);

            await expect(
                additionalServicesApi.getServices(123, 456, 789)
            ).rejects.toEqual(error);
        });
    });

    describe('calculatePpdExclusiveAmount', () => {
        it('should call apiClient.get with correct URL and params', async () => {
            mockApiClient.get.mockResolvedValueOnce(90.91);

            const result = await additionalServicesApi.calculatePpdExclusiveAmount(123, 100);

            expect(mockApiClient.get).toHaveBeenCalledWith(
                'job/PPDExclusiveAmount',
                { clientId: 123, amount: 100 }
            );
            expect(result).toBe(90.91);
        });

        it('should propagate errors from apiClient', async () => {
            const error = createMockApiError();
            mockApiClient.get.mockRejectedValueOnce(error);

            await expect(
                additionalServicesApi.calculatePpdExclusiveAmount(123, 100)
            ).rejects.toEqual(error);
        });
    });

    describe('addServicesToJob', () => {
        it('should call apiClient.post with correct URL and body', async () => {
            mockApiClient.post.mockResolvedValueOnce(undefined);

            await additionalServicesApi.addServicesToJob(789, [1, 2, 3], 150.50);

            expect(mockApiClient.post).toHaveBeenCalledWith(
                'job/AddClientItemsToJob',
                { serviceIds: [1, 2, 3], totalCost: 150.50 },
                { params: { jobId: 789 } }
            );
        });

        it('should propagate errors from apiClient', async () => {
            const error = createMockApiError();
            mockApiClient.post.mockRejectedValueOnce(error);

            await expect(
                additionalServicesApi.addServicesToJob(789, [1, 2], 100)
            ).rejects.toEqual(error);
        });
    });

    describe('additionalServicesApi singleton', () => {
        it('should be an instance of AdditionalServicesApiService', () => {
            expect(additionalServicesApi).toBeInstanceOf(AdditionalServicesApiService);
        });
    });
});
