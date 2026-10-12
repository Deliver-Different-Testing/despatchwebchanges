/** @jest-environment node */
/**
 * Pricing Breakdown API Service Tests
 */

import {pricingBreakdownApi,} from './pricingBreakdownApi';
import {apiClient} from './apiClient';
import {createMockApiError} from '../__testUtils__';
import {CreatePriceBreakdownRequest, DeletePriceBreakdownRequest, PriceBreakdown} from "../interfaces/priceBreakdown";

// Mock the apiClient
jest.mock('./apiClient', () => ({
    apiClient: {
        get: jest.fn(),
        post: jest.fn(),
    },
}));

const mockApiClient = apiClient as jest.Mocked<typeof apiClient>;

describe('pricingBreakdownApi', () => {
    describe('getPriceBreakdowns', () => {
        const mockBreakdowns: PriceBreakdown[] = [
            {chargeId: 1, name: 'Base Charge', amount: 100.00, jobId: 100},
            {chargeId: 2, name: 'Rush Fee', amount: 25.00, jobId: 100},
            {chargeId: 3, name: 'Weekend Surcharge', amount: 15.00, jobId: 100, costAmount: 10.00},
        ];

        it('should call apiClient.get with correct parameters for regular job', async () => {
            mockApiClient.get.mockResolvedValueOnce(mockBreakdowns);

            const result = await pricingBreakdownApi.getPriceBreakdowns(100, false, false);

            expect(mockApiClient.get).toHaveBeenCalledWith('job/GetPricingBreakdown', {
                jobId: 100,
                isPrebook: false,
                isArchived: false,
            }, undefined);
            expect(result).toEqual(mockBreakdowns);
        });

        it('should call apiClient.get with correct parameters for prebook job', async () => {
            mockApiClient.get.mockResolvedValueOnce(mockBreakdowns);

            await pricingBreakdownApi.getPriceBreakdowns(200, true, false);

            expect(mockApiClient.get).toHaveBeenCalledWith('job/GetPricingBreakdown', {
                jobId: 200,
                isPrebook: true,
                isArchived: false,
            }, undefined);
        });

        it('should call apiClient.get with correct parameters for archived job', async () => {
            mockApiClient.get.mockResolvedValueOnce(mockBreakdowns);

            await pricingBreakdownApi.getPriceBreakdowns(300, false, true);

            expect(mockApiClient.get).toHaveBeenCalledWith('job/GetPricingBreakdown', {
                jobId: 300,
                isPrebook: false,
                isArchived: true,
            }, undefined);
        });

        it('should return empty array when no breakdowns found', async () => {
            mockApiClient.get.mockResolvedValueOnce([]);

            const result = await pricingBreakdownApi.getPriceBreakdowns(100, false, false);

            expect(result).toEqual([]);
        });

        it('should return empty array when API returns null', async () => {
            mockApiClient.get.mockResolvedValueOnce(null);

            const result = await pricingBreakdownApi.getPriceBreakdowns(100, false, false);

            expect(result).toEqual([]);
        });

        it('should handle breakdowns with optional fields', async () => {
            const breakdownsWithOptionalFields: PriceBreakdown[] = [
                {
                    chargeId: 1,
                    name: 'Full Breakdown',
                    amount: 50.00,
                    jobId: 100,
                    costAmount: 30.00,
                    childJobId: 101,
                    isArchived: false
                },
                {chargeId: 2, name: 'Prebook Breakdown', amount: 75.00, prebookJobId: 200},
            ];
            mockApiClient.get.mockResolvedValueOnce(breakdownsWithOptionalFields);

            const result = await pricingBreakdownApi.getPriceBreakdowns(100, false, false);

            expect(result[0].costAmount).toBe(30.00);
            expect(result[0].childJobId).toBe(101);
            expect(result[1].prebookJobId).toBe(200);
        });

        it.each([
            ['404 Not Found', createMockApiError({status: 404, statusText: 'Not Found', message: 'Job not found'})],
            ['500 Server Error', createMockApiError({
                status: 500,
                statusText: 'Internal Server Error',
                message: 'Database error'
            })],
        ])('should propagate %s errors from apiClient', async (_, error) => {
            mockApiClient.get.mockRejectedValueOnce(error);
            await expect(pricingBreakdownApi.getPriceBreakdowns(100, false, false)).rejects.toEqual(error);
        });
    });

    describe('addPriceBreakdown', () => {
        it('should call apiClient.post with correct endpoint and data', async () => {
            const newBreakdown: CreatePriceBreakdownRequest = {
                name: 'New Charge',
                amount: 50.00,
                jobId: 100,
            };
            mockApiClient.post.mockResolvedValueOnce(5);

            const result = await pricingBreakdownApi.addPriceBreakdown(newBreakdown);

            expect(mockApiClient.post).toHaveBeenCalledWith('job/AddPriceComponent', newBreakdown);
            expect(result).toBe(5);
        });

        it('should handle breakdown with all optional fields', async () => {
            const fullBreakdown: CreatePriceBreakdownRequest = {
                name: 'Complete Charge',
                amount: 100.00,
                costAmount: 75.00,
                jobId: 100,
                prebookJobId: 200,
                childJobId: 101,
                isArchived: false,
            };
            mockApiClient.post.mockResolvedValueOnce(6);

            await pricingBreakdownApi.addPriceBreakdown(fullBreakdown);

            expect(mockApiClient.post).toHaveBeenCalledWith('job/AddPriceComponent', fullBreakdown);
        });

        it.each([
            ['400 Bad Request', createMockApiError({
                status: 400,
                statusText: 'Bad Request',
                message: 'Invalid breakdown data'
            })],
            ['500 Server Error', createMockApiError({
                status: 500,
                statusText: 'Internal Server Error',
                message: 'Database error'
            })],
        ])('should propagate %s errors from apiClient', async (_, error) => {
            mockApiClient.post.mockRejectedValueOnce(error);
            const newBreakdown: CreatePriceBreakdownRequest = {name: 'Test', amount: 10.00};
            await expect(pricingBreakdownApi.addPriceBreakdown(newBreakdown)).rejects.toEqual(error);
        });
    });

    describe('updatePriceBreakdown', () => {
        it('should call apiClient.post with correct endpoint and data', async () => {
            const breakdown: PriceBreakdown = {
                chargeId: 1,
                name: 'Updated Charge',
                amount: 75.00,
                jobId: 100,
            };
            mockApiClient.post.mockResolvedValueOnce(undefined);

            await pricingBreakdownApi.updatePriceBreakdown(breakdown);

            expect(mockApiClient.post).toHaveBeenCalledWith('job/UpdatePriceComponent', breakdown);
        });

        it('should handle breakdown with cost amount', async () => {
            const breakdown: PriceBreakdown = {
                chargeId: 2,
                name: 'Charge with Cost',
                amount: 100.00,
                costAmount: 60.00,
                jobId: 100,
            };
            mockApiClient.post.mockResolvedValueOnce(undefined);

            await pricingBreakdownApi.updatePriceBreakdown(breakdown);

            expect(mockApiClient.post).toHaveBeenCalledWith('job/UpdatePriceComponent', breakdown);
        });

        it.each([
            ['404 Not Found', createMockApiError({
                status: 404,
                statusText: 'Not Found',
                message: 'Breakdown not found'
            })],
            ['500 Server Error', createMockApiError({
                status: 500,
                statusText: 'Internal Server Error',
                message: 'Database error'
            })],
        ])('should propagate %s errors from apiClient', async (_, error) => {
            mockApiClient.post.mockRejectedValueOnce(error);
            const breakdown: PriceBreakdown = {chargeId: 1, name: 'Test', amount: 10.00};
            await expect(pricingBreakdownApi.updatePriceBreakdown(breakdown)).rejects.toEqual(error);
        });
    });

    describe('deletePriceBreakdown', () => {
        it('should call apiClient.post with correct endpoint and data', async () => {
            const deleteRequest: DeletePriceBreakdownRequest = {
                chargeId: 1,
                jobId: 100,
            };
            mockApiClient.post.mockResolvedValueOnce(undefined);

            await pricingBreakdownApi.deletePriceBreakdown(deleteRequest);

            expect(mockApiClient.post).toHaveBeenCalledWith('job/DeletePriceComponent', deleteRequest);
        });

        it('should handle delete for archived breakdown', async () => {
            const deleteRequest: DeletePriceBreakdownRequest = {
                chargeId: 2,
                jobId: 100,
                isArchived: true,
            };
            mockApiClient.post.mockResolvedValueOnce(undefined);

            await pricingBreakdownApi.deletePriceBreakdown(deleteRequest);

            expect(mockApiClient.post).toHaveBeenCalledWith('job/DeletePriceComponent', deleteRequest);
        });

        it.each([
            ['404 Not Found', createMockApiError({
                status: 404,
                statusText: 'Not Found',
                message: 'Breakdown not found'
            })],
            ['500 Server Error', createMockApiError({
                status: 500,
                statusText: 'Internal Server Error',
                message: 'Database error'
            })],
        ])('should propagate %s errors from apiClient', async (_, error) => {
            mockApiClient.post.mockRejectedValueOnce(error);
            const deleteRequest: DeletePriceBreakdownRequest = {chargeId: 1, jobId: 100};
            await expect(pricingBreakdownApi.deletePriceBreakdown(deleteRequest)).rejects.toEqual(error);
        });
    });
});
