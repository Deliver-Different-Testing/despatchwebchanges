/** @jest-environment node */
/**
 * Bulk Price API Service Tests
 */

import { BulkPriceApiService, bulkPriceApi } from './bulkPriceApi';
import { apiClient } from './apiClient';
import { createMockApiError } from '../__testUtils__';
import { BulkPricePreviewResponse } from '../components/dialogs/bulk-price-upload-dialog';

// Mock the apiClient
jest.mock('./apiClient', () => ({
    apiClient: {
        postFormData: jest.fn(),
    },
}));

const mockApiClient = apiClient as jest.Mocked<typeof apiClient>;

describe('BulkPriceApiService', () => {
    describe('applyBulkPriceUpdate', () => {
        const mockFile = new File(['test content'], 'prices.csv', { type: 'text/csv' });

        const mockResponse: BulkPricePreviewResponse = {
            rows: [
                {
                    jobId: 1,
                    jobNo: 'JOB-001',
                    field: 'Amount',
                    oldAmount: 100.00,
                    newAmount: 150.00,
                    isPrebook: false,
                },
                {
                    jobId: 2,
                    jobNo: 'JOB-002',
                    field: 'Amount',
                    oldAmount: 200.00,
                    newAmount: 250.00,
                    isPrebook: true,
                },
            ],
            totalJobs: 2,
            skippedJobs: 0,
            totalOldAmount: 300.00,
            totalNewAmount: 400.00,
        };

        it('should call apiClient.postFormData with correct URL and FormData for recalculate mode', async () => {
            mockApiClient.postFormData.mockResolvedValueOnce(mockResponse);

            const result = await bulkPriceApi.applyBulkPriceUpdate(mockFile, 'recalculate');

            expect(mockApiClient.postFormData).toHaveBeenCalledTimes(1);
            const [url, formData, options] = mockApiClient.postFormData.mock.calls[0];

            expect(url).toBe('/job/ApplyBulkPriceUpdate');
            expect(formData).toBeInstanceOf(FormData);
            expect(formData.get('file')).toBe(mockFile);
            expect(options).toEqual({ params: { pricingMode: 'recalculate' } });
            expect(result).toEqual(mockResponse);
        });

        it('should call apiClient.postFormData with correct params for base mode', async () => {
            mockApiClient.postFormData.mockResolvedValueOnce(mockResponse);

            await bulkPriceApi.applyBulkPriceUpdate(mockFile, 'base');

            const [, , options] = mockApiClient.postFormData.mock.calls[0];
            expect(options).toEqual({ params: { pricingMode: 'base' } });
        });

        it('should call apiClient.postFormData with correct params for gross mode', async () => {
            mockApiClient.postFormData.mockResolvedValueOnce(mockResponse);

            await bulkPriceApi.applyBulkPriceUpdate(mockFile, 'gross');

            const [, , options] = mockApiClient.postFormData.mock.calls[0];
            expect(options).toEqual({ params: { pricingMode: 'gross' } });
        });

        it('should return the response data', async () => {
            mockApiClient.postFormData.mockResolvedValueOnce(mockResponse);

            const result = await bulkPriceApi.applyBulkPriceUpdate(mockFile, 'recalculate');

            expect(result).toEqual(mockResponse);
            expect(result.totalJobs).toBe(2);
            expect(result.rows).toHaveLength(2);
        });

        it('should handle Excel file types', async () => {
            const xlsxFile = new File(['excel content'], 'prices.xlsx', {
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            });
            mockApiClient.postFormData.mockResolvedValueOnce(mockResponse);

            await bulkPriceApi.applyBulkPriceUpdate(xlsxFile, 'gross');

            const [, formData] = mockApiClient.postFormData.mock.calls[0];
            expect(formData.get('file')).toBe(xlsxFile);
        });

        it('should propagate errors from apiClient', async () => {
            const error = createMockApiError({ message: 'Invalid file format' });
            mockApiClient.postFormData.mockRejectedValueOnce(error);

            await expect(
                bulkPriceApi.applyBulkPriceUpdate(mockFile, 'recalculate')
            ).rejects.toEqual(error);
        });

        it('should propagate network errors', async () => {
            const networkError = createMockApiError({
                status: 0,
                statusText: 'Network Error',
                message: 'Network Error',
            });
            mockApiClient.postFormData.mockRejectedValueOnce(networkError);

            await expect(
                bulkPriceApi.applyBulkPriceUpdate(mockFile, 'base')
            ).rejects.toEqual(networkError);
        });

        it('should propagate server errors', async () => {
            const serverError = createMockApiError({
                status: 500,
                statusText: 'Internal Server Error',
                message: 'Database connection failed',
            });
            mockApiClient.postFormData.mockRejectedValueOnce(serverError);

            await expect(
                bulkPriceApi.applyBulkPriceUpdate(mockFile, 'gross')
            ).rejects.toEqual(serverError);
        });
    });

    describe('bulkPriceApi singleton', () => {
        it('should be an instance of BulkPriceApiService', () => {
            expect(bulkPriceApi).toBeInstanceOf(BulkPriceApiService);
        });
    });
});
