/** @jest-environment jest-fixed-jsdom */
/**
 * Overview API Integration Tests
 *
 * Tests the overviewApi service using MSW to intercept real HTTP requests.
 * Verifies correct endpoint URLs, request parameters, response handling,
 * and DTO transformation for open jobs.
 */

import {server} from '../../__testUtils__/msw/setupIntegration';
import {http, HttpResponse} from 'msw';
import {overviewApi} from '../overviewApi';
import {
    mockOverviewJobsResponse,
    mockOverviewRegions,
    mockOverviewSpeeds,
    mockOverviewStats,
    mockOpenJobDtos,
    mockMapConfig,
} from '../../__testUtils__/msw/handlers';

describe('overviewApi integration', () => {
    describe('getAllJobs', () => {
        it('fetches paginated jobs from /overview', async () => {
            const result = await overviewApi.getAllJobs({page: 1, limit: 20});

            expect(result.items).toHaveLength(2);
            expect(result.total).toBe(2);
            expect(result.page).toBe(1);
            expect(result.pages).toBe(1);
        });

        it('returns parent job details', async () => {
            const result = await overviewApi.getAllJobs({page: 1, limit: 20});

            expect(result.items[0]).toMatchObject({
                jobId: 101,
                jobName: 'J-001',
                status: 'Despatched',
                completion: 50,
                driver: 'John Smith',
            });
        });

        it('includes child jobs in response', async () => {
            const result = await overviewApi.getAllJobs({page: 1, limit: 20});

            expect(result.items[0].childJobs).toHaveLength(1);
            expect(result.items[0].childJobs[0]).toMatchObject({
                jobId: 201,
                jobName: 'J-001-A',
                status: 'Picked Up',
            });
        });

        it('sends query parameters correctly', async () => {
            let capturedUrl = '';

            server.use(
                http.get('*/overview', ({request}) => {
                    capturedUrl = request.url;
                    return HttpResponse.json(mockOverviewJobsResponse);
                }),
            );

            await overviewApi.getAllJobs({
                statusGroup: 1,
                page: 2,
                limit: 50,
                search: 'test-search',
                orderBy: 'status',
                orderDirection: 'desc',
            });

            expect(capturedUrl).toContain('statusGroup=1');
            expect(capturedUrl).toContain('page=2');
            expect(capturedUrl).toContain('limit=50');
            expect(capturedUrl).toContain('search=test-search');
            expect(capturedUrl).toContain('orderBy=status');
            expect(capturedUrl).toContain('orderDirection=desc');
        });

        it('sends filter arrays as repeated params', async () => {
            let capturedUrl = '';

            server.use(
                http.get('*/overview', ({request}) => {
                    capturedUrl = request.url;
                    return HttpResponse.json(mockOverviewJobsResponse);
                }),
            );

            await overviewApi.getAllJobs({
                page: 1,
                limit: 20,
                regions: [1, 2],
                speeds: [3],
                couriers: [10, 20],
            });

            expect(capturedUrl).toContain('regions=1');
            expect(capturedUrl).toContain('regions=2');
            expect(capturedUrl).toContain('speeds=3');
            expect(capturedUrl).toContain('couriers=10');
            expect(capturedUrl).toContain('couriers=20');
        });

        it('handles server errors', async () => {
            server.use(
                http.get('*/overview', () => {
                    return new HttpResponse('Internal Server Error', {status: 500});
                }),
            );

            await expect(overviewApi.getAllJobs({page: 1, limit: 20})).rejects.toMatchObject({
                status: 500,
            });
        });
    });

    describe('getAllRegions', () => {
        it('fetches regions list', async () => {
            const result = await overviewApi.getAllRegions();

            expect(result).toHaveLength(3);
            expect(result).toEqual(mockOverviewRegions);
        });

        it('returns suggestion objects with id and text', async () => {
            const result = await overviewApi.getAllRegions();

            expect(result[0]).toEqual({id: 1, text: 'Auckland'});
        });

        it('handles server errors', async () => {
            server.use(
                http.get('*/overview/GetAllRegions', () => {
                    return new HttpResponse('Server error', {status: 500});
                }),
            );

            await expect(overviewApi.getAllRegions()).rejects.toMatchObject({
                status: 500,
            });
        });
    });

    describe('getAllSpeeds', () => {
        it('fetches speeds list', async () => {
            const result = await overviewApi.getAllSpeeds();

            expect(result).toHaveLength(3);
            expect(result).toEqual(mockOverviewSpeeds);
        });

        it('returns suggestion objects with id and text', async () => {
            const result = await overviewApi.getAllSpeeds();

            expect(result[0]).toEqual({id: 1, text: 'Same Day'});
        });

        it('handles server errors', async () => {
            server.use(
                http.get('*/overview/GetAllSpeeds', () => {
                    return new HttpResponse('Server error', {status: 500});
                }),
            );

            await expect(overviewApi.getAllSpeeds()).rejects.toMatchObject({
                status: 500,
            });
        });
    });

    describe('getStats', () => {
        it('fetches overview stats', async () => {
            const result = await overviewApi.getStats();

            expect(result).toEqual(mockOverviewStats);
        });

        it('returns active, inactive, and completed counts', async () => {
            const result = await overviewApi.getStats();

            expect(result.active).toBe(12);
            expect(result.inactive).toBe(4);
            expect(result.completed).toBe(38);
        });

        it('handles server errors', async () => {
            server.use(
                http.get('*/overview/GetStats', () => {
                    return new HttpResponse('Server error', {status: 500});
                }),
            );

            await expect(overviewApi.getStats()).rejects.toMatchObject({
                status: 500,
            });
        });
    });

    describe('getOpenJobs', () => {
        it('fetches open jobs and transforms DTOs', async () => {
            const result = await overviewApi.getOpenJobs({});

            expect(result).toHaveLength(2);
        });

        it('adds formatted time strings for jobs with pickup/delivery times', async () => {
            const result = await overviewApi.getOpenJobs({});

            // First job has both pickup and delivery times
            expect(result[0]._pickUpTimeStr).toBeDefined();
            expect(result[0]._deliveryTimeStr).toBeDefined();
        });

        it('leaves time strings undefined when times are missing', async () => {
            const result = await overviewApi.getOpenJobs({});

            // Second job has no pickup or delivery times
            expect(result[1]._pickUpTimeStr).toBeUndefined();
            expect(result[1]._deliveryTimeStr).toBeUndefined();
        });

        it('preserves all DTO fields', async () => {
            const result = await overviewApi.getOpenJobs({});

            expect(result[0]).toMatchObject({
                jobId: 301,
                reference: 'OJ-001',
                status: 'In Transit',
                driverName: 'John Smith',
                completedToday: 3,
                quantity: 2,
                packageType: 'Parcel',
                mileage: 15,
            });
        });

        it('sends filter parameters', async () => {
            let capturedUrl = '';

            server.use(
                http.get('*/overview/GetOpenJobs', ({request}) => {
                    capturedUrl = request.url;
                    return HttpResponse.json(mockOpenJobDtos);
                }),
            );

            await overviewApi.getOpenJobs({
                regions: [1, 2],
                speeds: [3],
                couriers: [10],
            });

            expect(capturedUrl).toContain('regions=1');
            expect(capturedUrl).toContain('regions=2');
            expect(capturedUrl).toContain('speeds=3');
            expect(capturedUrl).toContain('couriers=10');
        });

        it('handles server errors', async () => {
            server.use(
                http.get('*/overview/GetOpenJobs', () => {
                    return new HttpResponse('Server error', {status: 500});
                }),
            );

            await expect(overviewApi.getOpenJobs({})).rejects.toMatchObject({
                status: 500,
            });
        });
    });

    describe('getParentJobMap', () => {
        it('fetches map config for a job', async () => {
            const result = await overviewApi.getParentJobMap(101);

            expect(result).toEqual(mockMapConfig);
        });

        it('returns center coordinates and zoom', async () => {
            const result = await overviewApi.getParentJobMap(101);

            expect(result.center).toEqual({lat: -36.8485, lng: 174.7633});
            expect(result.zoom).toBe(12);
        });

        it('includes job locations with child jobs', async () => {
            const result = await overviewApi.getParentJobMap(101);

            expect(result.job).not.toBeNull();
            expect(result.job!.childJobs).toHaveLength(1);
            expect(result.job!.childJobs[0].flight).toBe(false);
        });

        it('includes courier location', async () => {
            const result = await overviewApi.getParentJobMap(101);

            expect(result.courierLocation).toEqual({lat: -36.8500, lng: 174.7650});
        });

        it('sends jobId as query parameter', async () => {
            let capturedUrl = '';

            server.use(
                http.get('*/overview/GetParentJobMap', ({request}) => {
                    capturedUrl = request.url;
                    return HttpResponse.json(mockMapConfig);
                }),
            );

            await overviewApi.getParentJobMap(999);

            expect(capturedUrl).toContain('jobId=999');
        });

        it('handles server errors', async () => {
            server.use(
                http.get('*/overview/GetParentJobMap', () => {
                    return new HttpResponse('Server error', {status: 500});
                }),
            );

            await expect(overviewApi.getParentJobMap(101)).rejects.toMatchObject({
                status: 500,
            });
        });
    });

    describe('searchCouriers', () => {
        it('fetches courier suggestions', async () => {
            const result = await overviewApi.searchCouriers('John');

            expect(result).toBeDefined();
            expect(Array.isArray(result)).toBe(true);
        });

        it('sends search text as query parameter', async () => {
            let capturedUrl = '';

            server.use(
                http.get('*/courier/AllActiveSearch', ({request}) => {
                    capturedUrl = request.url;
                    return HttpResponse.json([{id: 1, text: 'Test Courier'}]);
                }),
            );

            await overviewApi.searchCouriers('Test');

            expect(capturedUrl).toContain('search=Test');
        });

        it('handles server errors', async () => {
            server.use(
                http.get('*/courier/AllActiveSearch', () => {
                    return new HttpResponse('Server error', {status: 500});
                }),
            );

            await expect(overviewApi.searchCouriers('test')).rejects.toMatchObject({
                status: 500,
            });
        });
    });
});
