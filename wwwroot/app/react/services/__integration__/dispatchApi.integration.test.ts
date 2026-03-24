/** @jest-environment jest-fixed-jsdom */
/**
 * Dispatch API Integration Tests
 *
 * Tests the dispatchApi service using MSW to intercept real HTTP requests.
 * Verifies correct endpoint URLs, request parameters, and response handling.
 */

import { server } from '../../__testUtils__/msw/setupIntegration';
import { http, HttpResponse } from 'msw';
import {
    getDriverLocations,
    getDriverWorkOverview,
    getJobsCurrent,
    getPageViews,
    getPotentialCouriers,
    getExactCourierMatch,
    getUnreadMessageCount,
    getTruckCourierStatus,
    addStopToJob,
} from '../dispatchApi';

const mockDriverLocations = {
    couriers: [
        { courierId: 1, name: 'Driver A', latitude: -36.848, longitude: 174.763 },
        { courierId: 2, name: 'Driver B', latitude: -41.286, longitude: 174.776 },
    ],
};

const mockDriverWorkOverview = [
    { courierId: 1, courierName: 'Driver A', jobCount: 5, completedCount: 3 },
    { courierId: 2, courierName: 'Driver B', jobCount: 3, completedCount: 1 },
];

const mockPageViews = [
    { id: 1, name: 'Auckland', selected: true, centerLatitude: -36.848, centerLongitude: 174.763 },
    { id: 2, name: 'Wellington', selected: false, centerLatitude: -41.286, centerLongitude: 174.776 },
];

const mockPotentialCouriers = [
    { courierId: 10, name: 'Nearby Courier', distance: 1.5 },
    { courierId: 20, name: 'Far Courier', distance: 8.2 },
];

const mockTruckStatus = {
    courierId: 1,
    courierCode: 'DRV01',
    firstName: 'John',
    maxPallets: 10,
    maxPayLoad: 5000,
    currentPallets: 4,
    currentWeight: 2000,
    availablePalletCapacity: 6,
    availablePallets: 6,
    lastUpdated: '2026-03-24T10:00:00Z',
};

describe('dispatchApi integration', () => {
    // ── Driver Locations ────────────────────────────────────────────

    describe('getDriverLocations', () => {
        it('fetches driver locations with correct parameters', async () => {
            let capturedUrl = '';
            server.use(
                http.get('*/courier', ({ request }) => {
                    capturedUrl = request.url;
                    return HttpResponse.json(mockDriverLocations);
                })
            );

            const result = await getDriverLocations([1, 2]);

            expect(capturedUrl).toContain('despatchViewIds');
            expect(result).toMatchObject({ couriers: expect.any(Array) });
        });

        it('passes date parameters when provided', async () => {
            let capturedUrl = '';
            server.use(
                http.get('*/courier', ({ request }) => {
                    capturedUrl = request.url;
                    return HttpResponse.json(mockDriverLocations);
                })
            );

            await getDriverLocations([1], '2026-03-24', '2026-03-25');

            expect(capturedUrl).toContain('startDate=');
            expect(capturedUrl).toContain('endDate=');
        });

        it('handles server error', async () => {
            server.use(
                http.get('*/courier', () => {
                    return new HttpResponse('Server error', { status: 500 });
                })
            );

            await expect(getDriverLocations([1])).rejects.toMatchObject({ status: 500 });
        });
    });

    // ── Driver Work Overview ────────────────────────────────────────

    describe('getDriverWorkOverview', () => {
        it('fetches driver work overview', async () => {
            server.use(
                http.get('*/courier/GetDriverWorkOverview', () => {
                    return HttpResponse.json(mockDriverWorkOverview);
                })
            );

            const result = await getDriverWorkOverview();

            expect(result).toHaveLength(2);
            expect(result[0]).toMatchObject({ courierId: 1, jobCount: 5 });
        });

        it('returns empty array when no drivers', async () => {
            server.use(
                http.get('*/courier/GetDriverWorkOverview', () => {
                    return HttpResponse.json([]);
                })
            );

            const result = await getDriverWorkOverview();
            expect(result).toHaveLength(0);
        });

        it('handles server error', async () => {
            server.use(
                http.get('*/courier/GetDriverWorkOverview', () => {
                    return new HttpResponse('Server error', { status: 500 });
                })
            );

            await expect(getDriverWorkOverview()).rejects.toMatchObject({ status: 500 });
        });
    });

    // ── Current Jobs for a Courier ──────────────────────────────────

    describe('getJobsCurrent', () => {
        const mockJobSearchResultDto = {
            jobs: [
                {
                    id: 100,
                    jobNumber: 'JOB-100',
                    statusName: 'Active',
                    clientName: 'Test Client',
                    pickupAddress: '123 Main St',
                    deliveryAddress: '456 Queen St',
                },
            ],
            totalCount: 1,
            hasMore: false,
        };

        it('fetches current jobs with correct parameters', async () => {
            let capturedUrl = '';
            server.use(
                http.get('*/job/GetCurrentWorkList', ({ request }) => {
                    capturedUrl = request.url;
                    return HttpResponse.json(mockJobSearchResultDto);
                })
            );

            const result = await getJobsCurrent(42, '2026-03-24', '2026-03-25');

            expect(capturedUrl).toContain('courierId=42');
            expect(capturedUrl).toContain('startDate=');
            expect(capturedUrl).toContain('endDate=');
            expect(result).toMatchObject({
                totalCount: 1,
                hasMore: false,
            });
            expect(result.jobs).toHaveLength(1);
        });

        it('transforms the DTO response', async () => {
            server.use(
                http.get('*/job/GetCurrentWorkList', () => {
                    return HttpResponse.json(mockJobSearchResultDto);
                })
            );

            const result = await getJobsCurrent(42, '2026-03-24', '2026-03-25');

            expect(result.totalCount).toBe(1);
            expect(result.hasMore).toBe(false);
            expect(result.jobs).toBeDefined();
        });

        it('handles empty results', async () => {
            server.use(
                http.get('*/job/GetCurrentWorkList', () => {
                    return HttpResponse.json({ jobs: [], totalCount: 0, hasMore: false });
                })
            );

            const result = await getJobsCurrent(42, '2026-03-24', '2026-03-25');

            expect(result.jobs).toHaveLength(0);
            expect(result.totalCount).toBe(0);
        });

        it('handles server error', async () => {
            server.use(
                http.get('*/job/GetCurrentWorkList', () => {
                    return new HttpResponse('Server error', { status: 500 });
                })
            );

            await expect(getJobsCurrent(42, '2026-03-24', '2026-03-25')).rejects.toMatchObject({ status: 500 });
        });
    });

    // ── Page Views ──────────────────────────────────────────────────

    describe('getPageViews', () => {
        it('fetches page views with correct pageId parameter', async () => {
            let capturedUrl = '';
            server.use(
                http.get('*/home/GetPageViews', ({ request }) => {
                    capturedUrl = request.url;
                    return HttpResponse.json(mockPageViews);
                })
            );

            const result = await getPageViews(5);

            expect(capturedUrl).toContain('pageId=5');
            expect(result).toHaveLength(2);
            expect(result[0]).toMatchObject({ id: 1, name: 'Auckland', selected: true });
        });

        it('uses default pageId of 1 when not provided', async () => {
            let capturedUrl = '';
            server.use(
                http.get('*/home/GetPageViews', ({ request }) => {
                    capturedUrl = request.url;
                    return HttpResponse.json(mockPageViews);
                })
            );

            await getPageViews();

            expect(capturedUrl).toContain('pageId=1');
        });

        it('handles server error', async () => {
            server.use(
                http.get('*/home/GetPageViews', () => {
                    return new HttpResponse('Server error', { status: 500 });
                })
            );

            await expect(getPageViews(1)).rejects.toMatchObject({ status: 500 });
        });
    });

    // ── Potential Couriers ──────────────────────────────────────────

    describe('getPotentialCouriers', () => {
        it('fetches potential couriers with correct jobId parameter', async () => {
            let capturedUrl = '';
            server.use(
                http.get('*/courier/PotentialCouriers', ({ request }) => {
                    capturedUrl = request.url;
                    return HttpResponse.json(mockPotentialCouriers);
                })
            );

            const result = await getPotentialCouriers(100);

            expect(capturedUrl).toContain('jobId=100');
            expect(result).toHaveLength(2);
            expect(result[0]).toMatchObject({ courierId: 10, name: 'Nearby Courier', distance: 1.5 });
        });

        it('returns empty array when no potential couriers', async () => {
            server.use(
                http.get('*/courier/PotentialCouriers', () => {
                    return HttpResponse.json([]);
                })
            );

            const result = await getPotentialCouriers(100);
            expect(result).toHaveLength(0);
        });

        it('handles not found error', async () => {
            server.use(
                http.get('*/courier/PotentialCouriers', () => {
                    return HttpResponse.json({ message: 'Job not found' }, { status: 404 });
                })
            );

            await expect(getPotentialCouriers(999)).rejects.toMatchObject({ status: 404 });
        });
    });

    // ── Exact Courier Match ─────────────────────────────────────────

    describe('getExactCourierMatch', () => {
        it('fetches courier by exact code', async () => {
            let capturedUrl = '';
            const mockCourier = { id: 42, text: 'John Smith (JS001)' };
            server.use(
                http.get('*/courier/GetExactCourierByCode', ({ request }) => {
                    capturedUrl = request.url;
                    return HttpResponse.json(mockCourier);
                })
            );

            const result = await getExactCourierMatch('JS001');

            expect(capturedUrl).toContain('courierCode=JS001');
            expect(result).toMatchObject({ id: 42, text: 'John Smith (JS001)' });
        });

        it('handles not found error', async () => {
            server.use(
                http.get('*/courier/GetExactCourierByCode', () => {
                    return HttpResponse.json({ message: 'Courier not found' }, { status: 404 });
                })
            );

            await expect(getExactCourierMatch('INVALID')).rejects.toMatchObject({ status: 404 });
        });
    });

    // ── Unread Message Count ────────────────────────────────────────

    describe('getUnreadMessageCount', () => {
        it('sums unreadCount from all conversations', async () => {
            server.use(
                http.get('*/messages/GetRecentList', () => {
                    return HttpResponse.json([
                        { conversationId: 1, unreadCount: 3 },
                        { conversationId: 2, unreadCount: 5 },
                        { conversationId: 3, unreadCount: 0 },
                    ]);
                })
            );

            const result = await getUnreadMessageCount();

            expect(result).toBe(8);
        });

        it('returns 0 when no conversations', async () => {
            server.use(
                http.get('*/messages/GetRecentList', () => {
                    return HttpResponse.json([]);
                })
            );

            const result = await getUnreadMessageCount();
            expect(result).toBe(0);
        });

        it('handles conversations without unreadCount', async () => {
            server.use(
                http.get('*/messages/GetRecentList', () => {
                    return HttpResponse.json([
                        { conversationId: 1 },
                        { conversationId: 2, unreadCount: 2 },
                    ]);
                })
            );

            const result = await getUnreadMessageCount();
            expect(result).toBe(2);
        });

        it('handles server error', async () => {
            server.use(
                http.get('*/messages/GetRecentList', () => {
                    return new HttpResponse('Server error', { status: 500 });
                })
            );

            await expect(getUnreadMessageCount()).rejects.toMatchObject({ status: 500 });
        });
    });

    // ── Truck Courier Status ────────────────────────────────────────

    describe('getTruckCourierStatus', () => {
        it('fetches truck status with correct courierId parameter', async () => {
            let capturedUrl = '';
            server.use(
                http.get('*/courier/TruckCourierStatus', ({ request }) => {
                    capturedUrl = request.url;
                    return HttpResponse.json(mockTruckStatus);
                })
            );

            const result = await getTruckCourierStatus(1);

            expect(capturedUrl).toContain('courierId=1');
            expect(result).toMatchObject({
                courierId: 1,
                courierCode: 'DRV01',
                maxPallets: 10,
                currentPallets: 4,
            });
        });

        it('handles not found error', async () => {
            server.use(
                http.get('*/courier/TruckCourierStatus', () => {
                    return HttpResponse.json({ message: 'Courier not found' }, { status: 404 });
                })
            );

            await expect(getTruckCourierStatus(999)).rejects.toMatchObject({ status: 404 });
        });
    });

    // ── Add Stop to Job ─────────────────────────────────────────────

    describe('addStopToJob', () => {
        const mockPickup = { address1: '123 Main St', city: 'Auckland' };
        const mockDelivery = { address1: '456 Queen St', city: 'Wellington' };

        it('posts with correct body and CSRF header', async () => {
            let capturedBody: unknown = null;
            let capturedCsrfHeader: string | null = null;
            server.use(
                http.post('*/job/AddStopToJob', async ({ request }) => {
                    capturedCsrfHeader = request.headers.get('X-Requested-With');
                    capturedBody = await request.json();
                    return HttpResponse.json(12345);
                })
            );

            const result = await addStopToJob(100, mockPickup as any, mockDelivery as any);

            expect(capturedCsrfHeader).toBe('XMLHttpRequest');
            expect(capturedBody).toMatchObject({
                jobId: 100,
                pickUpAddress: mockPickup,
                deliveryAddress: mockDelivery,
            });
            expect(result).toBe(12345);
        });

        it('sends request with only pickup address', async () => {
            let capturedBody: unknown = null;
            server.use(
                http.post('*/job/AddStopToJob', async ({ request }) => {
                    capturedBody = await request.json();
                    return HttpResponse.json(12346);
                })
            );

            await addStopToJob(100, mockPickup as any, undefined);

            expect(capturedBody).toMatchObject({ jobId: 100, pickUpAddress: mockPickup });
        });

        it('sends request with only delivery address', async () => {
            let capturedBody: unknown = null;
            server.use(
                http.post('*/job/AddStopToJob', async ({ request }) => {
                    capturedBody = await request.json();
                    return HttpResponse.json(12347);
                })
            );

            await addStopToJob(100, undefined, mockDelivery as any);

            expect(capturedBody).toMatchObject({ jobId: 100, deliveryAddress: mockDelivery });
        });

        it('handles validation error', async () => {
            server.use(
                http.post('*/job/AddStopToJob', () => {
                    return HttpResponse.json({ message: 'Job not found' }, { status: 404 });
                })
            );

            await expect(addStopToJob(999, mockPickup as any)).rejects.toMatchObject({ status: 404 });
        });

        it('handles server error', async () => {
            server.use(
                http.post('*/job/AddStopToJob', () => {
                    return new HttpResponse('Server error', { status: 500 });
                })
            );

            await expect(addStopToJob(100, mockPickup as any)).rejects.toMatchObject({ status: 500 });
        });
    });
});
