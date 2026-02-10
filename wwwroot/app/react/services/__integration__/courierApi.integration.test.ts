/**
 * Courier API Integration Tests
 *
 * Tests the courierApi service using MSW to intercept real HTTP requests.
 * Verifies correct endpoint URLs, request parameters, and response handling.
 */

import { server } from '../../__testUtils__/msw/setupIntegration';
import { http, HttpResponse } from 'msw';
import { courierApi } from '../courierApi';
import {
    mockCourierSuggestions,
    mockCourierLocations,
    mockClearListEnvelope,
    mockTimeZoneOptions,
} from '../../__testUtils__/msw/handlers';

describe('courierApi integration', () => {
    describe('searchActiveCouriers', () => {
        it('searches couriers with text parameter', async () => {
            let capturedUrl = '';

            server.use(
                http.get('*/courier/AllActiveSearch', ({ request }) => {
                    capturedUrl = request.url;
                    return HttpResponse.json(mockCourierSuggestions);
                })
            );

            const result = await courierApi.searchActiveCouriers('John');

            expect(capturedUrl).toContain('searchText=John');
            expect(result).toHaveLength(3);
        });

        it('returns courier suggestions with id and text', async () => {
            const result = await courierApi.searchActiveCouriers('Smith');

            expect(result[0]).toMatchObject({
                id: 1,
                text: 'John Smith (JS001)',
            });
        });

        it('handles server errors', async () => {
            server.use(
                http.get('*/courier/AllActiveSearch', () => {
                    return new HttpResponse('Server error', { status: 500 });
                })
            );

            await expect(courierApi.searchActiveCouriers('test')).rejects.toMatchObject({
                status: 500,
            });
        });
    });

    describe('getTimeZoneOptions', () => {
        it('fetches timezone options', async () => {
            const result = await courierApi.getTimeZoneOptions();

            expect(result).toHaveLength(3);
            expect(result[0]).toMatchObject({
                id: 1,
                text: 'New Zealand Standard Time',
                timeZoneIana: 'Pacific/Auckland',
            });
        });

        it('handles server errors', async () => {
            server.use(
                http.get('*/job/GetTimeZoneOptions', () => {
                    return new HttpResponse('Server error', { status: 500 });
                })
            );

            await expect(courierApi.getTimeZoneOptions()).rejects.toMatchObject({
                status: 500,
            });
        });
    });

    describe('getAvailableCourierLocations', () => {
        it('fetches locations within bounding box', async () => {
            let capturedUrl = '';

            server.use(
                http.get('*/courier/AvailableCourierLocation', ({ request }) => {
                    capturedUrl = request.url;
                    return HttpResponse.json(mockCourierLocations);
                })
            );

            const result = await courierApi.getAvailableCourierLocations(-0.3, 51.4, 0.1, 51.6);

            expect(capturedUrl).toContain('minLng=-0.3');
            expect(capturedUrl).toContain('minLat=51.4');
            expect(capturedUrl).toContain('maxLng=0.1');
            expect(capturedUrl).toContain('maxLat=51.6');
            expect(result).toHaveLength(2);
        });

        it('returns location details', async () => {
            const result = await courierApi.getAvailableCourierLocations(-0.3, 51.4, 0.1, 51.6);

            expect(result[0]).toMatchObject({
                courierId: 1,
                courierName: 'John Smith',
                latitude: 51.5074,
                longitude: -0.1278,
            });
        });

        it('handles server errors', async () => {
            server.use(
                http.get('*/courier/AvailableCourierLocation', () => {
                    return new HttpResponse('Server error', { status: 500 });
                })
            );

            await expect(
                courierApi.getAvailableCourierLocations(-0.3, 51.4, 0.1, 51.6)
            ).rejects.toMatchObject({
                status: 500,
            });
        });
    });

    describe('getClearListEnvelope', () => {
        it('fetches envelope with correct parameter', async () => {
            let capturedUrl = '';

            server.use(
                http.get('*/courier/ClearListEnvelope', ({ request }) => {
                    capturedUrl = request.url;
                    return HttpResponse.json(mockClearListEnvelope);
                })
            );

            const result = await courierApi.getClearListEnvelope(42);

            expect(capturedUrl).toContain('clearListId=42');
            expect(result).toMatchObject({
                minLat: 51.4,
                maxLat: 51.6,
                minLng: -0.3,
                maxLng: 0.1,
            });
        });

        it('handles not found error', async () => {
            server.use(
                http.get('*/courier/ClearListEnvelope', () => {
                    return HttpResponse.json(
                        { message: 'Clear list not found' },
                        { status: 404 }
                    );
                })
            );

            await expect(courierApi.getClearListEnvelope(999)).rejects.toMatchObject({
                status: 404,
            });
        });
    });
});
