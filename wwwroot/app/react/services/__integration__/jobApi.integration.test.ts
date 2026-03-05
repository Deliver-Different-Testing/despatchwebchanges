/**
 * Job API Integration Tests
 *
 * Tests the jobApi service using MSW to intercept real HTTP requests.
 * Verifies correct endpoint URLs, request parameters, and response handling.
 */

import { server } from '../../__testUtils__/msw/server';
import { http, HttpResponse } from 'msw';
import { jobApi } from '../jobApi';
import { mockRelatedJobs, mockClientSuggestions, mockVehicleSizes } from '../../__testUtils__/msw/handlers';

describe('jobApi integration', () => {
    describe('getRelatedJobsMultiSelectList', () => {
        it('fetches related jobs with correct parameters', async () => {
            let capturedUrl = '';

            server.use(
                http.get('*/job/GetRelatedJobsMultiSelectList', ({ request }) => {
                    capturedUrl = request.url;
                    return HttpResponse.json(mockRelatedJobs);
                })
            );

            const result = await jobApi.getRelatedJobsMultiSelectList(123, false);

            expect(capturedUrl).toContain('jobId=123');
            expect(capturedUrl).toContain('isArchived=false');
            expect(result).toHaveLength(3);
        });

        it('returns related jobs with selection state', async () => {
            const result = await jobApi.getRelatedJobsMultiSelectList(100, false);

            expect(result[0]).toMatchObject({
                id: 101,
                text: 'JOB-001 - Collection from ABC Ltd',
                selected: true,
            });
            expect(result[1].selected).toBe(false);
        });

        it('handles archived jobs parameter', async () => {
            let capturedIsArchived = '';

            server.use(
                http.get('*/job/GetRelatedJobsMultiSelectList', ({ request }) => {
                    const url = new URL(request.url);
                    capturedIsArchived = url.searchParams.get('isArchived') ?? '';
                    return HttpResponse.json(mockRelatedJobs);
                })
            );

            await jobApi.getRelatedJobsMultiSelectList(100, true);

            expect(capturedIsArchived).toBe('true');
        });

        it('handles job not found', async () => {
            server.use(
                http.get('*/job/GetRelatedJobsMultiSelectList', () => {
                    return HttpResponse.json(
                        { message: 'Job not found' },
                        { status: 404 }
                    );
                })
            );

            await expect(
                jobApi.getRelatedJobsMultiSelectList(999, false)
            ).rejects.toMatchObject({
                status: 404,
            });
        });

        it('returns empty array when no related jobs exist', async () => {
            server.use(
                http.get('*/job/GetRelatedJobsMultiSelectList', () => {
                    return HttpResponse.json([]);
                })
            );

            const result = await jobApi.getRelatedJobsMultiSelectList(100, false);

            expect(result).toHaveLength(0);
        });
        it('sends isBulkJob parameter for bulk jobs', async () => {
            let capturedUrl = '';

            server.use(
                http.get('*/job/GetRelatedJobsMultiSelectList', ({ request }) => {
                    capturedUrl = request.url;
                    return HttpResponse.json(mockRelatedJobs);
                })
            );

            await jobApi.getRelatedJobsMultiSelectList(789, false, true);

            expect(capturedUrl).toContain('isBulkJob=true');
        });
    });

    describe('voidJob', () => {
        it('voids a single job with CSRF header', async () => {
            let capturedBody: unknown = null;
            let capturedCsrfHeader: string | null = null;

            server.use(
                http.post('*/job/Void', async ({ request }) => {
                    capturedCsrfHeader = request.headers.get('X-Requested-With');
                    capturedBody = await request.json();
                    return new HttpResponse(null, { status: 200 });
                })
            );

            await jobApi.voidJob({
                jobId: 123,
                voidSingleJobOnly: true,
                voidReason: 'Customer cancelled',
            });

            expect(capturedCsrfHeader).toBe('XMLHttpRequest');
            expect(capturedBody).toMatchObject({
                jobId: 123,
                voidSingleJobOnly: true,
                voidReason: 'Customer cancelled',
            });
        });

        it('voids multiple related jobs', async () => {
            let capturedBody: unknown = null;

            server.use(
                http.post('*/job/Void', async ({ request }) => {
                    capturedBody = await request.json();
                    return new HttpResponse(null, { status: 200 });
                })
            );

            await jobApi.voidJob({
                jobId: 100,
                voidSingleJobOnly: false,
                voidReason: 'Duplicate order',
                selectedJobIds: [100, 101, 102],
            });

            expect(capturedBody).toMatchObject({
                jobId: 100,
                voidSingleJobOnly: false,
                selectedJobIds: [100, 101, 102],
            });
        });

        it('handles void permission error', async () => {
            server.use(
                http.post('*/job/Void', () => {
                    return HttpResponse.json(
                        { message: 'You do not have permission to void this job' },
                        { status: 403 }
                    );
                })
            );

            await expect(
                jobApi.voidJob({ jobId: 123, voidSingleJobOnly: true })
            ).rejects.toMatchObject({
                status: 403,
                message: 'You do not have permission to void this job',
            });
        });

        it('handles job already voided error', async () => {
            server.use(
                http.post('*/job/Void', () => {
                    return HttpResponse.json(
                        { message: 'Job has already been voided' },
                        { status: 400 }
                    );
                })
            );

            await expect(
                jobApi.voidJob({ jobId: 123, voidSingleJobOnly: true })
            ).rejects.toMatchObject({
                status: 400,
                message: 'Job has already been voided',
            });
        });
    });

    describe('voidBulkJob', () => {
        it('voids a bulk job with CSRF header', async () => {
            let capturedBody: unknown = null;
            let capturedCsrfHeader: string | null = null;

            server.use(
                http.post('*/job/VoidBulkJob', async ({ request }) => {
                    capturedCsrfHeader = request.headers.get('X-Requested-With');
                    capturedBody = await request.json();
                    return new HttpResponse(null, { status: 200 });
                })
            );

            await jobApi.voidBulkJob({
                bulkJobId: 500,
                voidSingleJobOnly: true,
                voidReason: 'Bulk order cancelled',
            });

            expect(capturedCsrfHeader).toBe('XMLHttpRequest');
            expect(capturedBody).toMatchObject({
                bulkJobId: 500,
                voidSingleJobOnly: true,
                voidReason: 'Bulk order cancelled',
            });
        });

        it('voids bulk job with selected child jobs', async () => {
            let capturedBody: unknown = null;

            server.use(
                http.post('*/job/VoidBulkJob', async ({ request }) => {
                    capturedBody = await request.json();
                    return new HttpResponse(null, { status: 200 });
                })
            );

            await jobApi.voidBulkJob({
                bulkJobId: 500,
                voidSingleJobOnly: false,
                selectedJobIds: [501, 502, 503],
            });

            expect(capturedBody).toMatchObject({
                bulkJobId: 500,
                voidSingleJobOnly: false,
                selectedJobIds: [501, 502, 503],
            });
        });

        it('handles bulk job not found', async () => {
            server.use(
                http.post('*/job/VoidBulkJob', () => {
                    return HttpResponse.json(
                        { message: 'Bulk job not found' },
                        { status: 404 }
                    );
                })
            );

            await expect(
                jobApi.voidBulkJob({ bulkJobId: 999, voidSingleJobOnly: true })
            ).rejects.toMatchObject({
                status: 404,
            });
        });

        it('handles server error during void', async () => {
            server.use(
                http.post('*/job/VoidBulkJob', () => {
                    return new HttpResponse('Database error during void operation', {
                        status: 500,
                    });
                })
            );

            await expect(
                jobApi.voidBulkJob({ bulkJobId: 500, voidSingleJobOnly: true })
            ).rejects.toMatchObject({
                status: 500,
            });
        });
    });

    describe('quickCreateJob', () => {
        it('creates a job and returns new job ID', async () => {
            const result = await jobApi.quickCreateJob({
                clientId: 10,
                deliverToContact: 'Jane Doe',
                podName: 'Pod1',
                pickUpAddress: {} as any,
                deliveryAddress: {} as any,
                date: '2026-03-05T00:00:00-05:00',
                fromContactName: 'John Smith',
                refA: '',
                refB: '',
                deliveryNotes: '',
                pickupNotes: '',
                jobNotes: '',
                van: false,
                truck: false,
                pedal: false,
                attention: false,
                vanOk: false,
                reprice: false,
                void: false,
                done: false,
                charge: 50.0,
                fromLat: 40.7128,
                fromLong: -74.006,
                toLat: 34.0522,
                toLong: -118.2437,
                speedId: 1,
                vehicleId: 2,
            });

            expect(result).toBe(12345);
        });

        it('sends CSRF header', async () => {
            let capturedCsrfHeader: string | null = null;

            server.use(
                http.post('*/job/QuickCreateJob', async ({ request }) => {
                    capturedCsrfHeader = request.headers.get('X-Requested-With');
                    return HttpResponse.json(1);
                })
            );

            await jobApi.quickCreateJob({ clientId: 1 } as any);

            expect(capturedCsrfHeader).toBe('XMLHttpRequest');
        });

        it('handles validation error', async () => {
            server.use(
                http.post('*/job/QuickCreateJob', () => {
                    return HttpResponse.json(
                        { message: 'Client ID is required' },
                        { status: 400 }
                    );
                })
            );

            await expect(
                jobApi.quickCreateJob({ clientId: 0 } as any)
            ).rejects.toMatchObject({ status: 400 });
        });
    });

    describe('searchActiveClients', () => {
        it('searches clients with correct parameter', async () => {
            let capturedUrl = '';

            server.use(
                http.get('*/home/ActiveClients', ({ request }) => {
                    capturedUrl = request.url;
                    return HttpResponse.json(mockClientSuggestions);
                })
            );

            const result = await jobApi.searchActiveClients('Acme');

            expect(capturedUrl).toContain('searchText=Acme');
            expect(result).toHaveLength(2);
            expect(result[0]).toMatchObject({ id: 10, text: 'Acme Corp' });
        });

        it('returns empty array when no matches', async () => {
            server.use(
                http.get('*/home/ActiveClients', () => {
                    return HttpResponse.json([]);
                })
            );

            const result = await jobApi.searchActiveClients('ZZZ');
            expect(result).toHaveLength(0);
        });
    });

    describe('getVehicleSizes', () => {
        it('returns list of vehicle sizes', async () => {
            const result = await jobApi.getVehicleSizes();

            expect(result).toHaveLength(3);
            expect(result[0]).toMatchObject({ id: 1, text: 'Car' });
            expect(result[2]).toMatchObject({ id: 3, text: 'Truck' });
        });

        it('handles server error', async () => {
            server.use(
                http.get('*/courier/GetVehicleSizes', () => {
                    return new HttpResponse('Server error', { status: 500 });
                })
            );

            await expect(jobApi.getVehicleSizes()).rejects.toMatchObject({ status: 500 });
        });
    });

    describe('allocateJobToCourier', () => {
        it('sends correct allocation data with CSRF header', async () => {
            let capturedBody: unknown = null;
            let capturedCsrfHeader: string | null = null;

            server.use(
                http.post('*/job/Allocate', async ({ request }) => {
                    capturedCsrfHeader = request.headers.get('X-Requested-With');
                    capturedBody = await request.json();
                    return new HttpResponse(null, { status: 200 });
                })
            );

            await jobApi.allocateJobToCourier(42, [999]);

            expect(capturedCsrfHeader).toBe('XMLHttpRequest');
            expect(capturedBody).toMatchObject({
                courierId: 42,
                jobIds: [999],
            });
        });

        it('handles courier offline error', async () => {
            server.use(
                http.post('*/job/Allocate', () => {
                    return HttpResponse.json(
                        { message: 'Courier is offline' },
                        { status: 400 }
                    );
                })
            );

            await expect(
                jobApi.allocateJobToCourier(42, [999])
            ).rejects.toMatchObject({ status: 400 });
        });
    });
});
