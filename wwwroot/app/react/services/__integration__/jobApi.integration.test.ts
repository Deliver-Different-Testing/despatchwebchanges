/**
 * Job API Integration Tests
 *
 * Tests the jobApi service using MSW to intercept real HTTP requests.
 * Verifies correct endpoint URLs, request parameters, and response handling.
 */

import { server } from '../../__testUtils__/msw/setupIntegration';
import { http, HttpResponse } from 'msw';
import { jobApi } from '../jobApi';
import { mockRelatedJobs } from '../../__testUtils__/msw/handlers';

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
});
