/** @jest-environment jest-fixed-jsdom */
/**
 * Bulk Price API Integration Tests
 *
 * Tests the bulkPriceApi service using MSW to intercept real HTTP requests.
 * Verifies FormData upload, query parameters, and response handling.
 */

import { server } from '../../__testUtils__/msw/setupIntegration';
import { http, HttpResponse } from 'msw';
import { bulkPriceApi } from '../bulkPriceApi';
import { mockBulkPricePreviewResponse } from '../../__testUtils__/msw/handlers';

describe('bulkPriceApi integration', () => {
    describe('applyBulkPriceUpdate', () => {
        it('uploads file with pricingMode parameter', async () => {
            let capturedUrl = '';
            let capturedHasFile = false;

            server.use(
                http.post('*/job/ApplyBulkPriceUpdate', async ({ request }) => {
                    capturedUrl = request.url;
                    const formData = await request.formData();
                    capturedHasFile = formData.has('file');
                    return HttpResponse.json(mockBulkPricePreviewResponse);
                })
            );

            const file = new File(['col1,col2\n1,50'], 'prices.csv', { type: 'text/csv' });
            const result = await bulkPriceApi.applyBulkPriceUpdate(file, 'recalculate');

            expect(capturedUrl).toContain('pricingMode=recalculate');
            expect(capturedHasFile).toBe(true);
            expect(result.totalJobs).toBe(3);
        });

        it('returns preview response with correct structure', async () => {
            const file = new File(['data'], 'test.csv', { type: 'text/csv' });
            const result = await bulkPriceApi.applyBulkPriceUpdate(file, 'base');

            expect(result.rows).toHaveLength(3);
            expect(result.totalOldAmount).toBe(165.0);
            expect(result.totalNewAmount).toBe(180.0);
            expect(result.rows[0]).toMatchObject({
                jobId: 100,
                jobNo: 'JOB-001',
                oldAmount: 50.0,
                newAmount: 55.0,
            });
        });

        it('supports different pricing modes', async () => {
            let capturedUrl = '';

            server.use(
                http.post('*/job/ApplyBulkPriceUpdate', async ({ request }) => {
                    capturedUrl = request.url;
                    await request.formData();
                    return HttpResponse.json(mockBulkPricePreviewResponse);
                })
            );

            const file = new File(['data'], 'test.csv');
            await bulkPriceApi.applyBulkPriceUpdate(file, 'gross');

            expect(capturedUrl).toContain('pricingMode=gross');
        });

        it('handles server errors', async () => {
            server.use(
                http.post('*/job/ApplyBulkPriceUpdate', () => {
                    return HttpResponse.json(
                        { message: 'Invalid CSV format' },
                        { status: 400 }
                    );
                })
            );

            const file = new File(['bad data'], 'invalid.csv');
            await expect(
                bulkPriceApi.applyBulkPriceUpdate(file, 'recalculate')
            ).rejects.toMatchObject({
                status: 400,
            });
        });

        it('sends multipart content type', async () => {
            let capturedContentType = '';

            server.use(
                http.post('*/job/ApplyBulkPriceUpdate', async ({ request }) => {
                    capturedContentType = request.headers.get('Content-Type') ?? '';
                    await request.formData();
                    return HttpResponse.json(mockBulkPricePreviewResponse);
                })
            );

            const file = new File(['data'], 'test.csv');
            await bulkPriceApi.applyBulkPriceUpdate(file, 'base');

            expect(capturedContentType).toContain('multipart/form-data');
        });
    });
});
