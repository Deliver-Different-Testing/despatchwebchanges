/**
 * Additional Services API Integration Tests
 *
 * Tests the additionalServicesApi service using MSW to intercept real HTTP requests.
 * Verifies correct endpoint URLs, request parameters, and response handling.
 */

import { server } from '../../__testUtils__/msw/server';
import { http, HttpResponse } from 'msw';
import { additionalServicesApi } from '../additionalServicesApi';
import {
    mockPaginatedServices,
    mockPpdExclusiveAmount,
} from '../../__testUtils__/msw/handlers';

describe('additionalServicesApi integration', () => {
    describe('hasClientItemsAvailable', () => {
        it('sends clientId and speedId as query parameters', async () => {
            let capturedUrl = '';

            server.use(
                http.get('*/job/HasClientItemsAvailable', ({ request }) => {
                    capturedUrl = request.url;
                    return HttpResponse.json(true);
                })
            );

            const result = await additionalServicesApi.hasClientItemsAvailable(42, 3);

            expect(capturedUrl).toContain('clientId=42');
            expect(capturedUrl).toContain('speedId=3');
            expect(result).toBe(true);
        });

        it('returns false when no services available', async () => {
            server.use(
                http.get('*/job/HasClientItemsAvailable', () => {
                    return HttpResponse.json(false);
                })
            );

            const result = await additionalServicesApi.hasClientItemsAvailable(42, 3);

            expect(result).toBe(false);
        });

        it('handles server errors', async () => {
            server.use(
                http.get('*/job/HasClientItemsAvailable', () => {
                    return new HttpResponse('Server error', { status: 500 });
                })
            );

            await expect(
                additionalServicesApi.hasClientItemsAvailable(42, 3)
            ).rejects.toMatchObject({ status: 500 });
        });
    });

    describe('getServices', () => {
        it('sends clientId, speedId and jobId as query parameters', async () => {
            let capturedUrl = '';

            server.use(
                http.get('*/job/GetAllClientItems', ({ request }) => {
                    capturedUrl = request.url;
                    return HttpResponse.json(mockPaginatedServices);
                })
            );

            const result = await additionalServicesApi.getServices(42, 3, 100);

            expect(capturedUrl).toContain('clientId=42');
            expect(capturedUrl).toContain('speedId=3');
            expect(capturedUrl).toContain('jobId=100');
            expect(result.items).toHaveLength(3);
            expect(result.total).toBe(3);
        });

        it('returns service details correctly', async () => {
            const result = await additionalServicesApi.getServices(42, 3, 100);

            expect(result.items[0]).toMatchObject({
                itemId: 1,
                name: 'Express Handling',
                rate: 15.00,
                perItem: false,
            });
            expect(result.items[1]).toMatchObject({
                itemId: 2,
                name: 'Tail Lift Required',
                rate: 25.00,
                onlyVan: true,
            });
        });

        it('handles empty results', async () => {
            server.use(
                http.get('*/job/GetAllClientItems', () => {
                    return HttpResponse.json({ items: [], total: 0 });
                })
            );

            const result = await additionalServicesApi.getServices(42, 3, 100);

            expect(result.items).toHaveLength(0);
            expect(result.total).toBe(0);
        });

        it('handles server errors', async () => {
            server.use(
                http.get('*/job/GetAllClientItems', () => {
                    return new HttpResponse('Server error', { status: 500 });
                })
            );

            await expect(
                additionalServicesApi.getServices(42, 3, 100)
            ).rejects.toMatchObject({ status: 500 });
        });
    });

    describe('calculatePpdExclusiveAmount', () => {
        it('sends clientId and amount as query parameters', async () => {
            let capturedUrl = '';

            server.use(
                http.get('*/job/PPDExclusiveAmount', ({ request }) => {
                    capturedUrl = request.url;
                    return HttpResponse.json(mockPpdExclusiveAmount);
                })
            );

            const result = await additionalServicesApi.calculatePpdExclusiveAmount(42, 100.00);

            expect(capturedUrl).toContain('clientId=42');
            expect(capturedUrl).toContain('amount=100');
            expect(result).toBe(mockPpdExclusiveAmount);
        });

        it('handles decimal amounts', async () => {
            let capturedUrl = '';

            server.use(
                http.get('*/job/PPDExclusiveAmount', ({ request }) => {
                    capturedUrl = request.url;
                    return HttpResponse.json(45.41);
                })
            );

            const result = await additionalServicesApi.calculatePpdExclusiveAmount(42, 49.95);

            expect(capturedUrl).toContain('amount=49.95');
            expect(result).toBe(45.41);
        });

        it('handles server errors', async () => {
            server.use(
                http.get('*/job/PPDExclusiveAmount', () => {
                    return new HttpResponse('Server error', { status: 500 });
                })
            );

            await expect(
                additionalServicesApi.calculatePpdExclusiveAmount(42, 100.00)
            ).rejects.toMatchObject({ status: 500 });
        });
    });

    describe('addServicesToJob', () => {
        it('sends jobId as query parameter and serviceIds/totalCost in body', async () => {
            let capturedUrl = '';
            let capturedBody: unknown = null;

            server.use(
                http.post('*/job/AddClientItemsToJob', async ({ request }) => {
                    capturedUrl = request.url;
                    capturedBody = await request.json();
                    return HttpResponse.json({ success: true });
                })
            );

            await additionalServicesApi.addServicesToJob(100, [1, 2, 3], 90.00);

            expect(capturedUrl).toContain('jobId=100');
            expect(capturedBody).toEqual({
                serviceIds: [1, 2, 3],
                totalCost: 90.00,
            });
        });

        it('sends CSRF header', async () => {
            let capturedCsrfHeader: string | null = null;

            server.use(
                http.post('*/job/AddClientItemsToJob', ({ request }) => {
                    capturedCsrfHeader = request.headers.get('X-Requested-With');
                    return HttpResponse.json({ success: true });
                })
            );

            await additionalServicesApi.addServicesToJob(100, [1], 15.00);

            expect(capturedCsrfHeader).toBe('XMLHttpRequest');
        });

        it('handles empty service IDs', async () => {
            let capturedBody: unknown = null;

            server.use(
                http.post('*/job/AddClientItemsToJob', async ({ request }) => {
                    capturedBody = await request.json();
                    return HttpResponse.json({ success: true });
                })
            );

            await additionalServicesApi.addServicesToJob(100, [], 0);

            expect(capturedBody).toEqual({
                serviceIds: [],
                totalCost: 0,
            });
        });

        it('handles not found errors', async () => {
            server.use(
                http.post('*/job/AddClientItemsToJob', () => {
                    return HttpResponse.json({ message: 'Job not found' }, { status: 404 });
                })
            );

            await expect(
                additionalServicesApi.addServicesToJob(999, [1], 15.00)
            ).rejects.toMatchObject({ status: 404 });
        });

        it('handles server errors', async () => {
            server.use(
                http.post('*/job/AddClientItemsToJob', () => {
                    return new HttpResponse('Server error', { status: 500 });
                })
            );

            await expect(
                additionalServicesApi.addServicesToJob(100, [1], 15.00)
            ).rejects.toMatchObject({ status: 500 });
        });
    });
});
