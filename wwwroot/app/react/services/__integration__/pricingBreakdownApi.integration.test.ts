/**
 * Pricing Breakdown API Integration Tests
 *
 * Tests the pricingBreakdownApi service using MSW to intercept real HTTP requests.
 * Verifies correct endpoint URLs, request parameters, and response handling.
 */

import { server } from '../../__testUtils__/msw/server';
import { http, HttpResponse } from 'msw';
import { pricingBreakdownApi } from '../pricingBreakdownApi';
import { mockPriceBreakdowns } from '../../__testUtils__/msw/handlers';

describe('pricingBreakdownApi integration', () => {
    describe('getPriceBreakdowns', () => {
        it('fetches breakdowns with correct parameters', async () => {
            let capturedUrl = '';

            server.use(
                http.get('*/job/GetPricingBreakdown', ({ request }) => {
                    capturedUrl = request.url;
                    return HttpResponse.json(mockPriceBreakdowns);
                })
            );

            const result = await pricingBreakdownApi.getPriceBreakdowns(100, false, false);

            expect(capturedUrl).toContain('jobId=100');
            expect(capturedUrl).toContain('isPrebook=false');
            expect(capturedUrl).toContain('isArchived=false');
            expect(result).toHaveLength(3);
        });

        it('returns breakdown details correctly', async () => {
            const result = await pricingBreakdownApi.getPriceBreakdowns(100, false, false);

            expect(result[0]).toMatchObject({
                chargeId: 1,
                name: 'Base Rate',
                amount: 50.0,
                costAmount: 35.0,
            });
        });

        it('passes isPrebook parameter', async () => {
            let capturedUrl = '';

            server.use(
                http.get('*/job/GetPricingBreakdown', ({ request }) => {
                    capturedUrl = request.url;
                    return HttpResponse.json([]);
                })
            );

            await pricingBreakdownApi.getPriceBreakdowns(100, true, false);

            expect(capturedUrl).toContain('isPrebook=true');
        });

        it('returns empty array when response is null', async () => {
            server.use(
                http.get('*/job/GetPricingBreakdown', () => {
                    return HttpResponse.json(null);
                })
            );

            const result = await pricingBreakdownApi.getPriceBreakdowns(100, false, false);

            expect(result).toHaveLength(0);
        });

        it('handles server errors', async () => {
            server.use(
                http.get('*/job/GetPricingBreakdown', () => {
                    return new HttpResponse('Server error', { status: 500 });
                })
            );

            await expect(
                pricingBreakdownApi.getPriceBreakdowns(100, false, false)
            ).rejects.toMatchObject({
                status: 500,
            });
        });
    });

    describe('addPriceBreakdown', () => {
        it('adds breakdown and returns new chargeId', async () => {
            let capturedBody: unknown = null;

            server.use(
                http.post('*/job/AddPriceComponent', async ({ request }) => {
                    capturedBody = await request.json();
                    return HttpResponse.json(42);
                })
            );

            const result = await pricingBreakdownApi.addPriceBreakdown({
                name: 'Express Surcharge',
                amount: 20.0,
                costAmount: 15.0,
                jobId: 100,
            });

            expect(result).toBe(42);
            expect(capturedBody).toMatchObject({
                name: 'Express Surcharge',
                amount: 20.0,
                costAmount: 15.0,
                jobId: 100,
            });
        });

        it('handles validation errors', async () => {
            server.use(
                http.post('*/job/AddPriceComponent', () => {
                    return HttpResponse.json(
                        { message: 'Name is required' },
                        { status: 400 }
                    );
                })
            );

            await expect(
                pricingBreakdownApi.addPriceBreakdown({ name: '', amount: 0 })
            ).rejects.toMatchObject({
                status: 400,
            });
        });
    });

    describe('updatePriceBreakdown', () => {
        it('updates breakdown with correct body', async () => {
            let capturedBody: unknown = null;

            server.use(
                http.post('*/job/UpdatePriceComponent', async ({ request }) => {
                    capturedBody = await request.json();
                    return new HttpResponse(null, { status: 200 });
                })
            );

            await pricingBreakdownApi.updatePriceBreakdown({
                chargeId: 1,
                name: 'Updated Rate',
                amount: 55.0,
                jobId: 100,
            });

            expect(capturedBody).toMatchObject({
                chargeId: 1,
                name: 'Updated Rate',
                amount: 55.0,
            });
        });
    });

    describe('deletePriceBreakdown', () => {
        it('deletes breakdown with correct body', async () => {
            let capturedBody: unknown = null;

            server.use(
                http.post('*/job/DeletePriceComponent', async ({ request }) => {
                    capturedBody = await request.json();
                    return new HttpResponse(null, { status: 200 });
                })
            );

            await pricingBreakdownApi.deletePriceBreakdown({
                chargeId: 1,
                jobId: 100,
                isArchived: false,
            });

            expect(capturedBody).toMatchObject({
                chargeId: 1,
                jobId: 100,
                isArchived: false,
            });
        });

        it('handles not found error', async () => {
            server.use(
                http.post('*/job/DeletePriceComponent', () => {
                    return HttpResponse.json(
                        { message: 'Price component not found' },
                        { status: 404 }
                    );
                })
            );

            await expect(
                pricingBreakdownApi.deletePriceBreakdown({ chargeId: 999, jobId: 100 })
            ).rejects.toMatchObject({
                status: 404,
            });
        });
    });
});
