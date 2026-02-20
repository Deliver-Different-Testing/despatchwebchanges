/**
 * Additional Services API Integration Tests
 *
 * Tests the additionalServicesApi service using MSW to intercept real HTTP requests.
 * Verifies correct endpoint URLs, request parameters, and response handling.
 */

import { server } from '../../__testUtils__/msw/server';
import { http, HttpResponse } from 'msw';
import { additionalServicesApi } from '../additionalServicesApi';
import { mockAdditionalServices } from '../../__testUtils__/msw/handlers';

describe('additionalServicesApi integration', () => {
    describe('hasClientItemsAvailable', () => {
        it('checks availability with correct parameters', async () => {
            let capturedUrl = '';

            server.use(
                http.get('*/job/HasClientItemsAvailable', ({ request }) => {
                    capturedUrl = request.url;
                    return HttpResponse.json(true);
                })
            );

            const result = await additionalServicesApi.hasClientItemsAvailable(50, 1);

            expect(capturedUrl).toContain('clientId=50');
            expect(capturedUrl).toContain('speedId=1');
            expect(result).toBe(true);
        });

        it('returns false when no items available', async () => {
            server.use(
                http.get('*/job/HasClientItemsAvailable', () => {
                    return HttpResponse.json(false);
                })
            );

            const result = await additionalServicesApi.hasClientItemsAvailable(99, 1);

            expect(result).toBe(false);
        });

        it('handles server errors', async () => {
            server.use(
                http.get('*/job/HasClientItemsAvailable', () => {
                    return new HttpResponse('Server error', { status: 500 });
                })
            );

            await expect(
                additionalServicesApi.hasClientItemsAvailable(50, 1)
            ).rejects.toMatchObject({
                status: 500,
            });
        });
    });

    describe('getServices', () => {
        it('fetches services with correct parameters', async () => {
            let capturedUrl = '';

            server.use(
                http.get('*/job/GetAllClientItems', ({ request }) => {
                    capturedUrl = request.url;
                    return HttpResponse.json({
                        items: mockAdditionalServices,
                        total: mockAdditionalServices.length,
                    });
                })
            );

            const result = await additionalServicesApi.getServices(50, 1, 100);

            expect(capturedUrl).toContain('clientId=50');
            expect(capturedUrl).toContain('speedId=1');
            expect(capturedUrl).toContain('jobId=100');
            expect(result.items).toHaveLength(3);
            expect(result.total).toBe(3);
        });

        it('returns service details correctly', async () => {
            const result = await additionalServicesApi.getServices(50, 1, 100);

            expect(result.items[0]).toMatchObject({
                itemId: 1,
                name: 'Tail Lift',
                rate: 25.0,
                onlyVan: true,
            });
        });

        it('handles empty results', async () => {
            server.use(
                http.get('*/job/GetAllClientItems', () => {
                    return HttpResponse.json({ items: [], total: 0 });
                })
            );

            const result = await additionalServicesApi.getServices(50, 1, 100);

            expect(result.items).toHaveLength(0);
            expect(result.total).toBe(0);
        });
    });

    describe('calculatePpdExclusiveAmount', () => {
        it('calculates exclusive amount with correct parameters', async () => {
            let capturedUrl = '';

            server.use(
                http.get('*/job/PPDExclusiveAmount', ({ request }) => {
                    capturedUrl = request.url;
                    const url = new URL(request.url);
                    const amount = parseFloat(url.searchParams.get('amount')!);
                    return HttpResponse.json(Math.round((amount / 1.15) * 100) / 100);
                })
            );

            const result = await additionalServicesApi.calculatePpdExclusiveAmount(50, 115.0);

            expect(capturedUrl).toContain('clientId=50');
            expect(capturedUrl).toContain('amount=115');
            expect(result).toBe(100);
        });
    });

    describe('addServicesToJob', () => {
        it('sends body and jobId query parameter', async () => {
            let capturedUrl = '';
            let capturedBody: unknown = null;

            server.use(
                http.post('*/job/AddClientItemsToJob', async ({ request }) => {
                    capturedUrl = request.url;
                    capturedBody = await request.json();
                    return new HttpResponse(null, { status: 200 });
                })
            );

            await additionalServicesApi.addServicesToJob(100, [1, 2], 30.0);

            expect(capturedUrl).toContain('jobId=100');
            expect(capturedBody).toMatchObject({
                serviceIds: [1, 2],
                totalCost: 30.0,
            });
        });

        it('sends CSRF header', async () => {
            let capturedCsrfHeader: string | null = null;

            server.use(
                http.post('*/job/AddClientItemsToJob', ({ request }) => {
                    capturedCsrfHeader = request.headers.get('X-Requested-With');
                    return new HttpResponse(null, { status: 200 });
                })
            );

            await additionalServicesApi.addServicesToJob(100, [1], 25.0);

            expect(capturedCsrfHeader).toBe('XMLHttpRequest');
        });

        it('handles errors', async () => {
            server.use(
                http.post('*/job/AddClientItemsToJob', () => {
                    return HttpResponse.json(
                        { message: 'Job not found' },
                        { status: 404 }
                    );
                })
            );

            await expect(
                additionalServicesApi.addServicesToJob(999, [1], 25.0)
            ).rejects.toMatchObject({
                status: 404,
            });
        });
    });
});
