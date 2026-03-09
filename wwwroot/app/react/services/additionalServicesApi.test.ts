/**
 * Additional Services API Service Tests
 */

import { additionalServicesApi } from './additionalServicesApi';
import { apiClient } from './apiClient';
import { createMockApiError } from '../__testUtils__';

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

            await additionalServicesApi.hasClientItemsAvailable(42, 3);

            expect(mockApiClient.get).toHaveBeenCalledWith(
                'job/HasClientItemsAvailable',
                { clientId: 42, speedId: 3 }
            );
        });

        it('should return true when services are available', async () => {
            mockApiClient.get.mockResolvedValueOnce(true);

            const result = await additionalServicesApi.hasClientItemsAvailable(42, 3);

            expect(result).toBe(true);
        });

        it('should return false when no services are available', async () => {
            mockApiClient.get.mockResolvedValueOnce(false);

            const result = await additionalServicesApi.hasClientItemsAvailable(42, 3);

            expect(result).toBe(false);
        });

        it('should propagate errors from apiClient', async () => {
            const error = createMockApiError();
            mockApiClient.get.mockRejectedValueOnce(error);

            await expect(
                additionalServicesApi.hasClientItemsAvailable(42, 3)
            ).rejects.toEqual(error);
        });
    });

    describe('getServices', () => {
        it('should call apiClient.get with correct URL and params', async () => {
            mockApiClient.get.mockResolvedValueOnce({ items: [], total: 0 });

            await additionalServicesApi.getServices(42, 3, 100);

            expect(mockApiClient.get).toHaveBeenCalledWith(
                'job/GetAllClientItems',
                { clientId: 42, speedId: 3, jobId: 100 }
            );
        });

        it('should return paginated services', async () => {
            const response = {
                items: [
                    { itemId: 1, clientId: 42, name: 'Express Handling', description: 'Priority handling', perItem: false, rate: 15.00, onlyVan: false, selected: false },
                    { itemId: 2, clientId: 42, name: 'Tail Lift', description: 'Requires tail lift', perItem: true, rate: 25.00, onlyVan: true, selected: true },
                ],
                total: 2,
            };
            mockApiClient.get.mockResolvedValueOnce(response);

            const result = await additionalServicesApi.getServices(42, 3, 100);

            expect(result).toEqual(response);
            expect(result.items).toHaveLength(2);
            expect(result.total).toBe(2);
        });

        it('should propagate errors from apiClient', async () => {
            const error = createMockApiError();
            mockApiClient.get.mockRejectedValueOnce(error);

            await expect(
                additionalServicesApi.getServices(42, 3, 100)
            ).rejects.toEqual(error);
        });
    });

    describe('calculatePpdExclusiveAmount', () => {
        it('should call apiClient.get with correct URL and params', async () => {
            mockApiClient.get.mockResolvedValueOnce(90.91);

            await additionalServicesApi.calculatePpdExclusiveAmount(42, 100.00);

            expect(mockApiClient.get).toHaveBeenCalledWith(
                'job/PPDExclusiveAmount',
                { clientId: 42, amount: 100.00 }
            );
        });

        it('should return the calculated amount', async () => {
            mockApiClient.get.mockResolvedValueOnce(90.91);

            const result = await additionalServicesApi.calculatePpdExclusiveAmount(42, 100.00);

            expect(result).toBe(90.91);
        });

        it('should propagate errors from apiClient', async () => {
            const error = createMockApiError();
            mockApiClient.get.mockRejectedValueOnce(error);

            await expect(
                additionalServicesApi.calculatePpdExclusiveAmount(42, 100.00)
            ).rejects.toEqual(error);
        });
    });

    describe('addServicesToJob', () => {
        it('should call apiClient.post with correct URL, body and params', async () => {
            mockApiClient.post.mockResolvedValueOnce(undefined);
            const serviceIds = [1, 2, 3];

            await additionalServicesApi.addServicesToJob(100, serviceIds, 65.50);

            expect(mockApiClient.post).toHaveBeenCalledWith(
                'job/AddClientItemsToJob',
                { serviceIds: [1, 2, 3], totalCost: 65.50 },
                { params: { jobId: 100 } }
            );
        });

        it('should handle empty service IDs array', async () => {
            mockApiClient.post.mockResolvedValueOnce(undefined);

            await additionalServicesApi.addServicesToJob(100, [], 0);

            expect(mockApiClient.post).toHaveBeenCalledWith(
                'job/AddClientItemsToJob',
                { serviceIds: [], totalCost: 0 },
                { params: { jobId: 100 } }
            );
        });

        it('should propagate errors from apiClient', async () => {
            const error = createMockApiError();
            mockApiClient.post.mockRejectedValueOnce(error);

            await expect(
                additionalServicesApi.addServicesToJob(100, [1], 15.00)
            ).rejects.toEqual(error);
        });
    });

    describe('additionalServicesApi singleton', () => {
        it('should be defined and expose expected methods', () => {
            expect(additionalServicesApi).toBeDefined();
            expect(typeof additionalServicesApi.hasClientItemsAvailable).toBe('function');
            expect(typeof additionalServicesApi.getServices).toBe('function');
            expect(typeof additionalServicesApi.calculatePpdExclusiveAmount).toBe('function');
            expect(typeof additionalServicesApi.addServicesToJob).toBe('function');
        });
    });
});
