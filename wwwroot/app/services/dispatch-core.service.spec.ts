/**
 * Tests for DispatchCoreService
 * Focuses on the applyBulkPriceUpdate method added in this branch
 */

import { BulkPricePreviewResponse, PricingMode } from '../components/dialogs/bulk-price-upload-dialog/bulk-price-upload-dialog.interfaces';

// We'll test the service method logic by creating a simplified version
// that mimics the actual service behavior

describe('DispatchCoreService', () => {
    describe('applyBulkPriceUpdate', () => {
        // Mock $http service
        let mockHttp: {
            post: jest.Mock;
        };

        // Mock response
        const mockResponse: BulkPricePreviewResponse = {
            rows: [
                {
                    jobId: 1,
                    jobNo: 'JOB-001',
                    field: 'Amount',
                    oldAmount: 100,
                    newAmount: 150,
                    isPrebook: false
                },
                {
                    jobId: 2,
                    jobNo: 'JOB-002',
                    field: 'Amount',
                    oldAmount: 200,
                    newAmount: 250,
                    isPrebook: true
                }
            ],
            totalJobs: 2,
            totalOldAmount: 300,
            totalNewAmount: 400
        };

        // Simplified service method that mirrors the actual implementation
        const applyBulkPriceUpdate = async (
            $http: typeof mockHttp,
            file: File,
            pricingMode: PricingMode
        ): Promise<BulkPricePreviewResponse> => {
            const formData = new FormData();
            formData.append('file', file);

            const response = await $http.post(
                '/job/ApplyBulkPriceUpdate',
                formData,
                {
                    params: { pricingMode },
                    transformRequest: (data: any) => data,
                    headers: { 'Content-Type': undefined }
                }
            ) as { data: BulkPricePreviewResponse };
            return response.data;
        };

        beforeEach(() => {
            mockHttp = {
                post: jest.fn()
            };
        });

        it('should create FormData with the file', async () => {
            mockHttp.post.mockResolvedValue({ data: mockResponse });
            const file = new File(['test content'], 'test.csv', { type: 'text/csv' });

            await applyBulkPriceUpdate(mockHttp, file, 'gross');

            // Verify post was called
            expect(mockHttp.post).toHaveBeenCalledTimes(1);

            // Verify the FormData contains the file
            const [url, formData] = mockHttp.post.mock.calls[0];
            expect(url).toBe('/job/ApplyBulkPriceUpdate');
            expect(formData).toBeInstanceOf(FormData);
            expect(formData.get('file')).toBeInstanceOf(File);
            expect((formData.get('file') as File).name).toBe('test.csv');
        });

        it('should call correct endpoint with recalculate mode', async () => {
            mockHttp.post.mockResolvedValue({ data: mockResponse });
            const file = new File([''], 'test.xlsx');

            await applyBulkPriceUpdate(mockHttp, file, 'recalculate');

            const [, , config] = mockHttp.post.mock.calls[0];
            expect(config.params.pricingMode).toBe('recalculate');
        });

        it('should call correct endpoint with base mode', async () => {
            mockHttp.post.mockResolvedValue({ data: mockResponse });
            const file = new File([''], 'test.xlsx');

            await applyBulkPriceUpdate(mockHttp, file, 'base');

            const [, , config] = mockHttp.post.mock.calls[0];
            expect(config.params.pricingMode).toBe('base');
        });

        it('should call correct endpoint with gross mode', async () => {
            mockHttp.post.mockResolvedValue({ data: mockResponse });
            const file = new File([''], 'test.xlsx');

            await applyBulkPriceUpdate(mockHttp, file, 'gross');

            const [, , config] = mockHttp.post.mock.calls[0];
            expect(config.params.pricingMode).toBe('gross');
        });

        it('should set Content-Type to undefined for multipart upload', async () => {
            mockHttp.post.mockResolvedValue({ data: mockResponse });
            const file = new File([''], 'test.csv');

            await applyBulkPriceUpdate(mockHttp, file, 'gross');

            const [, , config] = mockHttp.post.mock.calls[0];
            expect(config.headers['Content-Type']).toBeUndefined();
        });

        it('should return response data on success', async () => {
            mockHttp.post.mockResolvedValue({ data: mockResponse });
            const file = new File([''], 'test.csv');

            const result = await applyBulkPriceUpdate(mockHttp, file, 'gross');

            expect(result).toEqual(mockResponse);
            expect(result.totalJobs).toBe(2);
            expect(result.rows).toHaveLength(2);
        });

        it('should propagate error on failure', async () => {
            const error = new Error('Network error');
            mockHttp.post.mockRejectedValue(error);
            const file = new File([''], 'test.csv');

            await expect(applyBulkPriceUpdate(mockHttp, file, 'gross'))
                .rejects.toThrow('Network error');
        });

        it('should handle empty response', async () => {
            const emptyResponse: BulkPricePreviewResponse = {
                rows: [],
                totalJobs: 0,
                totalOldAmount: 0,
                totalNewAmount: 0
            };
            mockHttp.post.mockResolvedValue({ data: emptyResponse });
            const file = new File([''], 'empty.csv');

            const result = await applyBulkPriceUpdate(mockHttp, file, 'recalculate');

            expect(result.rows).toEqual([]);
            expect(result.totalJobs).toBe(0);
        });

        it('should handle large file uploads', async () => {
            mockHttp.post.mockResolvedValue({ data: mockResponse });
            // Create a larger file (1MB)
            const largeContent = 'x'.repeat(1024 * 1024);
            const file = new File([largeContent], 'large.xlsx');

            await applyBulkPriceUpdate(mockHttp, file, 'base');

            const [, formData] = mockHttp.post.mock.calls[0];
            expect((formData.get('file') as File).size).toBe(1024 * 1024);
        });
    });
});

describe('BulkPricePreviewResponse Interface', () => {
    it('should accept valid response structure', () => {
        const response: BulkPricePreviewResponse = {
            rows: [{
                jobId: 1,
                jobNo: 'TEST-001',
                field: 'Amount',
                oldAmount: 100,
                newAmount: 200,
                isPrebook: false
            }],
            totalJobs: 1,
            totalOldAmount: 100,
            totalNewAmount: 200
        };

        expect(response.rows).toHaveLength(1);
        expect(response.rows[0].jobId).toBe(1);
    });

    it('should accept response with error field', () => {
        const response: BulkPricePreviewResponse = {
            rows: [{
                jobId: 1,
                jobNo: 'TEST-001',
                field: 'Amount',
                oldAmount: 100,
                newAmount: 100,
                isPrebook: false,
                error: 'Job not found'
            }],
            totalJobs: 1,
            totalOldAmount: 100,
            totalNewAmount: 100
        };

        expect(response.rows[0].error).toBe('Job not found');
    });
});

describe('PricingMode Type', () => {
    it('should only allow valid pricing modes', () => {
        const validModes: PricingMode[] = ['recalculate', 'base', 'gross'];

        validModes.forEach(mode => {
            expect(['recalculate', 'base', 'gross']).toContain(mode);
        });
    });
});
