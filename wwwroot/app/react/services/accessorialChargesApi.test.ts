/**
 * Accessorial Charges API Service Tests
 */

import { accessorialChargesApi } from './accessorialChargesApi';
import { apiClient } from './apiClient';
import { createMockApiError } from '../__testUtils__';

jest.mock('./apiClient', () => ({
    apiClient: {
        get: jest.fn(),
        post: jest.fn(),
        put: jest.fn(),
        delete: jest.fn(),
    },
}));

const mockApiClient = apiClient as jest.Mocked<typeof apiClient>;

describe('AccessorialChargesApiService', () => {
    describe('getAvailableCharges', () => {
        it('should call apiClient.get with correct URL and params', async () => {
            mockApiClient.get.mockResolvedValueOnce([]);

            await accessorialChargesApi.getAvailableCharges(10, 500);

            expect(mockApiClient.get).toHaveBeenCalledWith(
                'AccessorialCharge/GetAvailable',
                { accessorialChargeGroupId: 10, jobId: 500 }
            );
        });

        it('should return available charges', async () => {
            const charges = [{ accessorialChargeId: 1, name: 'Tail Lift', chargeType: 'flat' }];
            mockApiClient.get.mockResolvedValueOnce(charges);

            const result = await accessorialChargesApi.getAvailableCharges(10, 500);

            expect(result).toEqual(charges);
        });

        it('should propagate errors from apiClient', async () => {
            const error = createMockApiError();
            mockApiClient.get.mockRejectedValueOnce(error);

            await expect(
                accessorialChargesApi.getAvailableCharges(10, 500)
            ).rejects.toEqual(error);
        });
    });

    describe('getAppliedCharges', () => {
        it('should call apiClient.get with correct URL and params', async () => {
            mockApiClient.get.mockResolvedValueOnce([]);

            await accessorialChargesApi.getAppliedCharges(500);

            expect(mockApiClient.get).toHaveBeenCalledWith(
                'AccessorialCharge/GetApplied',
                { jobId: 500 }
            );
        });

        it('should return applied charges', async () => {
            const charges = [{ jobAccessorialChargeId: 101, name: 'Fuel Surcharge' }];
            mockApiClient.get.mockResolvedValueOnce(charges);

            const result = await accessorialChargesApi.getAppliedCharges(500);

            expect(result).toEqual(charges);
        });

        it('should propagate errors from apiClient', async () => {
            const error = createMockApiError();
            mockApiClient.get.mockRejectedValueOnce(error);

            await expect(
                accessorialChargesApi.getAppliedCharges(500)
            ).rejects.toEqual(error);
        });
    });

    describe('addCharges', () => {
        it('should call apiClient.post with correct URL, body and params', async () => {
            mockApiClient.post.mockResolvedValueOnce(undefined);
            const charges = [{ accessorialChargeId: 1, inputValue: 2, itemCount: 1 }];

            await accessorialChargesApi.addCharges(500, charges);

            expect(mockApiClient.post).toHaveBeenCalledWith(
                'AccessorialCharge/Add',
                charges,
                { params: { jobId: 500 } }
            );
        });

        it('should propagate errors from apiClient', async () => {
            const error = createMockApiError();
            mockApiClient.post.mockRejectedValueOnce(error);

            await expect(
                accessorialChargesApi.addCharges(500, [])
            ).rejects.toEqual(error);
        });
    });

    describe('updateCharge', () => {
        it('should call apiClient.put with correct URL, body and params', async () => {
            const updated = { jobAccessorialChargeId: 101, calculatedAmount: 50 };
            mockApiClient.put.mockResolvedValueOnce(updated);
            const request = { inputValue: 2, itemCount: 1, notes: 'test' };

            await accessorialChargesApi.updateCharge(101, request);

            expect(mockApiClient.put).toHaveBeenCalledWith(
                'AccessorialCharge/Update',
                request,
                { params: { jobAccessorialChargeId: 101 } }
            );
        });

        it('should return the updated charge', async () => {
            const updated = { jobAccessorialChargeId: 101, calculatedAmount: 50 };
            mockApiClient.put.mockResolvedValueOnce(updated);

            const result = await accessorialChargesApi.updateCharge(101, { inputValue: 2, itemCount: 1 });

            expect(result).toEqual(updated);
        });

        it('should propagate errors from apiClient', async () => {
            const error = createMockApiError();
            mockApiClient.put.mockRejectedValueOnce(error);

            await expect(
                accessorialChargesApi.updateCharge(101, { itemCount: 1 })
            ).rejects.toEqual(error);
        });
    });

    describe('deleteCharge', () => {
        it('should call apiClient.delete with correct params', async () => {
            mockApiClient.delete.mockResolvedValueOnce(undefined);

            await accessorialChargesApi.deleteCharge(101);

            expect(mockApiClient.delete).toHaveBeenCalledWith(
                'AccessorialCharge/Delete',
                { params: { jobAccessorialChargeId: 101 } }
            );
        });

        it('should propagate errors from apiClient', async () => {
            const error = createMockApiError();
            mockApiClient.delete.mockRejectedValueOnce(error);

            await expect(
                accessorialChargesApi.deleteCharge(101)
            ).rejects.toEqual(error);
        });
    });

    describe('getJobAmount', () => {
        it('should call apiClient.get with correct URL and params', async () => {
            mockApiClient.get.mockResolvedValueOnce(127.50);

            await accessorialChargesApi.getJobAmount(500);

            expect(mockApiClient.get).toHaveBeenCalledWith(
                'AccessorialCharge/JobAmount',
                { jobId: 500 }
            );
        });

        it('should return the job amount', async () => {
            mockApiClient.get.mockResolvedValueOnce(127.50);

            const result = await accessorialChargesApi.getJobAmount(500);

            expect(result).toBe(127.50);
        });

        it('should propagate errors from apiClient', async () => {
            const error = createMockApiError();
            mockApiClient.get.mockRejectedValueOnce(error);

            await expect(
                accessorialChargesApi.getJobAmount(500)
            ).rejects.toEqual(error);
        });
    });

    describe('accessorialChargesApi singleton', () => {
        it('should be defined and expose expected methods', () => {
            expect(accessorialChargesApi).toBeDefined();
            expect(typeof accessorialChargesApi.getAvailableCharges).toBe('function');
            expect(typeof accessorialChargesApi.getAppliedCharges).toBe('function');
            expect(typeof accessorialChargesApi.addCharges).toBe('function');
            expect(typeof accessorialChargesApi.updateCharge).toBe('function');
            expect(typeof accessorialChargesApi.deleteCharge).toBe('function');
            expect(typeof accessorialChargesApi.getJobAmount).toBe('function');
        });
    });
});
