/** @jest-environment jest-fixed-jsdom */
/**
 * Job List API Integration Tests
 *
 * Tests the jobListApi service using MSW to intercept real HTTP requests.
 * Verifies correct endpoint URLs, request parameters, bodies, headers,
 * response handling, and error propagation.
 */

import { server } from '../../__testUtils__/msw/setupIntegration';
import { http, HttpResponse } from 'msw';
import {
    updateJobReadStatus,
    bulkUpdateReadStatus,
    restoreNationwideJob,
    updateJobDetail,
    lateCall,
    allocateJobs,
    reAllocateJobs,
    restoreJobs,
    setFirstJob,
    releaseBulkJob,
    splitJob,
    getSplitJobStatus,
    getEventGroups,
    markJobMissing,
    moveJobToReprice,
} from '../jobListApi';
import { JobStatus } from '../../../enums/job-status.enum';
import InternalJobStatus from '../../../enums/job-internal-status.enum';

// ── Read Status ─────────────────────────────────────────────────────

describe('jobListApi integration', () => {
    describe('updateJobReadStatus', () => {
        it('sends jobId and hasBeenRead as query params', async () => {
            let capturedUrl = '';

            server.use(
                http.post('*/job/UpdateJobReadStatus', ({ request }) => {
                    capturedUrl = request.url;
                    return new HttpResponse(null, { status: 200 });
                })
            );

            await updateJobReadStatus(42, true);

            expect(capturedUrl).toContain('jobId=42');
            expect(capturedUrl).toContain('hasBeenRead=true');
        });

        it('sends null body with query params', async () => {
            let capturedBody: string | null = null;

            server.use(
                http.post('*/job/UpdateJobReadStatus', async ({ request }) => {
                    capturedBody = await request.text();
                    return new HttpResponse(null, { status: 200 });
                })
            );

            await updateJobReadStatus(1, false);

            expect(capturedBody === 'null' || capturedBody === '').toBe(true);
        });

        it('sends CSRF header', async () => {
            let capturedCsrf: string | null = null;

            server.use(
                http.post('*/job/UpdateJobReadStatus', ({ request }) => {
                    capturedCsrf = request.headers.get('X-Requested-With');
                    return new HttpResponse(null, { status: 200 });
                })
            );

            await updateJobReadStatus(1, true);

            expect(capturedCsrf).toBe('XMLHttpRequest');
        });

        it('rejects on server error', async () => {
            server.use(
                http.post('*/job/UpdateJobReadStatus', () => {
                    return HttpResponse.json(
                        { message: 'Job not found' },
                        { status: 404 }
                    );
                })
            );

            await expect(updateJobReadStatus(999, true)).rejects.toMatchObject({
                status: 404,
            });
        });
    });

    describe('bulkUpdateReadStatus', () => {
        it('sends jobIds and shouldMarkAsRead in request body', async () => {
            let capturedBody: unknown = null;

            server.use(
                http.post('*/job/BulkUpdateReadStatus', async ({ request }) => {
                    capturedBody = await request.json();
                    return new HttpResponse(null, { status: 200 });
                })
            );

            await bulkUpdateReadStatus([10, 20, 30], true);

            expect(capturedBody).toEqual({
                jobIds: [10, 20, 30],
                shouldMarkAsRead: true,
            });
        });

        it('handles empty job list', async () => {
            let capturedBody: unknown = null;

            server.use(
                http.post('*/job/BulkUpdateReadStatus', async ({ request }) => {
                    capturedBody = await request.json();
                    return new HttpResponse(null, { status: 200 });
                })
            );

            await bulkUpdateReadStatus([], false);

            expect(capturedBody).toEqual({
                jobIds: [],
                shouldMarkAsRead: false,
            });
        });
    });

    // ── Nationwide ──────────────────────────────────────────────────

    describe('restoreNationwideJob', () => {
        it('sends jobId in request body', async () => {
            let capturedBody: unknown = null;

            server.use(
                http.post('*/nationwideJob/RestoreJob', async ({ request }) => {
                    capturedBody = await request.json();
                    return new HttpResponse(null, { status: 200 });
                })
            );

            await restoreNationwideJob(55);

            expect(capturedBody).toEqual({ jobId: 55 });
        });

        it('rejects on server error', async () => {
            server.use(
                http.post('*/nationwideJob/RestoreJob', () => {
                    return HttpResponse.json(
                        { message: 'Cannot restore job' },
                        { status: 400 }
                    );
                })
            );

            await expect(restoreNationwideJob(55)).rejects.toMatchObject({
                status: 400,
            });
        });
    });

    // ── Job Updates ─────────────────────────────────────────────────

    describe('updateJobDetail', () => {
        it('sends field update as query params to UpdateJob endpoint', async () => {
            let capturedUrl = '';

            server.use(
                http.post('*/job/UpdateJob', ({ request }) => {
                    capturedUrl = request.url;
                    return new HttpResponse(null, { status: 200 });
                })
            );

            await updateJobDetail(100, 'DriverNotes', 'Handle with care');

            expect(capturedUrl).toContain('jobId=100');
            expect(capturedUrl).toContain('field=DriverNotes');
            expect(capturedUrl).toContain('value=Handle+with+care');
            expect(capturedUrl).toContain('isRecurring=false');
        });

        it('uses UpdateRecurringJob endpoint when isRecurring is true', async () => {
            let capturedUrl = '';

            server.use(
                http.post('*/job/UpdateRecurringJob', ({ request }) => {
                    capturedUrl = request.url;
                    return new HttpResponse(null, { status: 200 });
                })
            );

            await updateJobDetail(200, 'Status', 1, true);

            expect(capturedUrl).toContain('job/UpdateRecurringJob');
            expect(capturedUrl).toContain('jobId=200');
            expect(capturedUrl).toContain('isRecurring=true');
        });

        it('defaults isRecurring to false', async () => {
            let capturedUrl = '';

            server.use(
                http.post('*/job/UpdateJob', ({ request }) => {
                    capturedUrl = request.url;
                    return new HttpResponse(null, { status: 200 });
                })
            );

            await updateJobDetail(100, 'Priority', 'high');

            expect(capturedUrl).toContain('isRecurring=false');
            expect(capturedUrl).not.toContain('UpdateRecurringJob');
        });
    });

    // ── Late Call ────────────────────────────────────────────────────

    describe('lateCall', () => {
        it('sends late call request body', async () => {
            let capturedBody: unknown = null;

            server.use(
                http.post('*/job/LateCall', async ({ request }) => {
                    capturedBody = await request.json();
                    return new HttpResponse(null, { status: 200 });
                })
            );

            await lateCall({
                jobId: 42,
                lateType: 1,
                lateTime: 30,
                calculationRequired: true,
            });

            expect(capturedBody).toEqual({
                jobId: 42,
                lateType: 1,
                lateTime: 30,
                calculationRequired: true,
            });
        });

        it('sends delivery late call', async () => {
            let capturedBody: unknown = null;

            server.use(
                http.post('*/job/LateCall', async ({ request }) => {
                    capturedBody = await request.json();
                    return new HttpResponse(null, { status: 200 });
                })
            );

            await lateCall({
                jobId: 99,
                lateType: 2,
                lateTime: 15,
                calculationRequired: false,
            });

            expect(capturedBody).toMatchObject({
                lateType: 2,
                calculationRequired: false,
            });
        });
    });

    // ── Dispatch / Re-dispatch ──────────────────────────────────────

    describe('allocateJobs', () => {
        it('sends courierId and jobIds in request body', async () => {
            let capturedBody: unknown = null;

            server.use(
                http.post('*/job/Allocate', async ({ request }) => {
                    capturedBody = await request.json();
                    return new HttpResponse(null, { status: 200 });
                })
            );

            await allocateJobs(5, [100, 200, 300]);

            expect(capturedBody).toEqual({
                courierId: 5,
                jobIds: [100, 200, 300],
            });
        });

        it('handles allocation failure', async () => {
            server.use(
                http.post('*/job/Allocate', () => {
                    return HttpResponse.json(
                        { message: 'Courier not available' },
                        { status: 400 }
                    );
                })
            );

            await expect(allocateJobs(5, [100])).rejects.toMatchObject({
                status: 400,
                message: 'Courier not available',
            });
        });
    });

    describe('reAllocateJobs', () => {
        it('sends courierId and jobIds to ReAllocate endpoint', async () => {
            let capturedBody: unknown = null;
            let capturedUrl = '';

            server.use(
                http.post('*/job/ReAllocate', async ({ request }) => {
                    capturedUrl = request.url;
                    capturedBody = await request.json();
                    return new HttpResponse(null, { status: 200 });
                })
            );

            await reAllocateJobs(7, [50, 60]);

            expect(capturedUrl).toContain('job/ReAllocate');
            expect(capturedBody).toEqual({
                courierId: 7,
                jobIds: [50, 60],
            });
        });
    });

    // ── Restore ─────────────────────────────────────────────────────

    describe('restoreJobs', () => {
        it('sends jobIds in request body', async () => {
            let capturedBody: unknown = null;

            server.use(
                http.post('*/job/RestoreJobs', async ({ request }) => {
                    capturedBody = await request.json();
                    return new HttpResponse(null, { status: 200 });
                })
            );

            await restoreJobs([10, 20]);

            expect(capturedBody).toEqual({ jobIds: [10, 20], removeCapturedImages: false });
        });
    });

    // ── First Job ───────────────────────────────────────────────────

    describe('setFirstJob', () => {
        it('sends jobId and courierId as query params', async () => {
            let capturedUrl = '';

            server.use(
                http.post('*/job/SetFirstJob', ({ request }) => {
                    capturedUrl = request.url;
                    return new HttpResponse(null, { status: 200 });
                })
            );

            await setFirstJob(100, 5);

            expect(capturedUrl).toContain('jobId=100');
            expect(capturedUrl).toContain('courierId=5');
        });

        it('sends null body', async () => {
            let capturedBody: string | null = null;

            server.use(
                http.post('*/job/SetFirstJob', async ({ request }) => {
                    capturedBody = await request.text();
                    return new HttpResponse(null, { status: 200 });
                })
            );

            await setFirstJob(100, 5);

            expect(capturedBody === 'null' || capturedBody === '').toBe(true);
        });
    });

    // ── Bulk Job ────────────────────────────────────────────────────

    describe('releaseBulkJob', () => {
        it('sends bulkJobId as query param and returns the released job numbers', async () => {
            let capturedUrl = '';

            server.use(
                http.post('*/job/ReleaseBulkJob', ({ request }) => {
                    capturedUrl = request.url;
                    return HttpResponse.json({ jobNumbers: ['BJR-001', 'BJR-002'] });
                })
            );

            const result = await releaseBulkJob(77);

            expect(capturedUrl).toContain('bulkJobId=77');
            expect(result).toEqual({ jobNumbers: ['BJR-001', 'BJR-002'] });
        });
    });

    // ── Split Job ───────────────────────────────────────────────────

    describe('splitJob', () => {
        it('sends jobId and meetingPointAddress in body and returns taskId', async () => {
            let capturedBody: unknown = null;

            server.use(
                http.post('*/job/splitJob', async ({ request }) => {
                    capturedBody = await request.json();
                    return HttpResponse.json({ taskId: 'task-abc-123' });
                })
            );

            const result = await splitJob(100, { street: '123 Main St' });

            expect(capturedBody).toEqual({
                jobId: 100,
                meetingPointAddress: { street: '123 Main St' },
            });
            expect(result).toEqual({ taskId: 'task-abc-123' });
        });

        it('rejects on validation error', async () => {
            server.use(
                http.post('*/job/splitJob', () => {
                    return HttpResponse.json(
                        { message: 'Job cannot be split' },
                        { status: 400 }
                    );
                })
            );

            await expect(splitJob(100, {})).rejects.toMatchObject({
                status: 400,
            });
        });
    });

    describe('getSplitJobStatus', () => {
        it('sends taskId as query param and returns status', async () => {
            let capturedUrl = '';

            server.use(
                http.get('*/job/splitJobStatus', ({ request }) => {
                    capturedUrl = request.url;
                    return HttpResponse.json({
                        status: 'Completed',
                        errorMessage: null,
                    });
                })
            );

            const result = await getSplitJobStatus('task-abc-123');

            expect(capturedUrl).toContain('taskId=task-abc-123');
            expect(result).toEqual({
                status: 'Completed',
                errorMessage: null,
            });
        });

        it('returns error message on failure status', async () => {
            server.use(
                http.get('*/job/splitJobStatus', () => {
                    return HttpResponse.json({
                        status: 'Failed',
                        errorMessage: 'Meeting point address invalid',
                    });
                })
            );

            const result = await getSplitJobStatus('task-xyz');

            expect(result.status).toBe('Failed');
            expect(result.errorMessage).toBe('Meeting point address invalid');
        });
    });

    // ── Event Groups ────────────────────────────────────────────────

    describe('getEventGroups', () => {
        it('fetches event groups from task endpoint', async () => {
            let capturedUrl = '';

            server.use(
                http.get('*/task/GetEventGroups', ({ request }) => {
                    capturedUrl = request.url;
                    return HttpResponse.json([
                        { id: 1, text: 'Pickup Events' },
                        { id: 2, text: 'Delivery Events' },
                    ]);
                })
            );

            const result = await getEventGroups();

            expect(capturedUrl).toContain('task/GetEventGroups');
            expect(result).toEqual([
                { id: 1, text: 'Pickup Events' },
                { id: 2, text: 'Delivery Events' },
            ]);
        });

        it('returns empty array when no groups exist', async () => {
            server.use(
                http.get('*/task/GetEventGroups', () => {
                    return HttpResponse.json([]);
                })
            );

            const result = await getEventGroups();

            expect(result).toEqual([]);
        });
    });

    // ── Mark Missing ────────────────────────────────────────────────

    describe('markJobMissing', () => {
        it('calls updateJobDetail with Status = Missing (1001)', async () => {
            let capturedUrl = '';

            server.use(
                http.post('*/job/UpdateJob', ({ request }) => {
                    capturedUrl = request.url;
                    return new HttpResponse(null, { status: 200 });
                })
            );

            await markJobMissing(42);

            expect(capturedUrl).toContain('jobId=42');
            expect(capturedUrl).toContain('field=Status');
            expect(capturedUrl).toContain(`value=${JobStatus.Missing}`);
        });
    });

    // ── Reprice ─────────────────────────────────────────────────────

    describe('moveJobToReprice', () => {
        it('calls updateJobDetail with InternalStatusID = Reprice (4)', async () => {
            let capturedUrl = '';

            server.use(
                http.post('*/job/UpdateJob', ({ request }) => {
                    capturedUrl = request.url;
                    return new HttpResponse(null, { status: 200 });
                })
            );

            await moveJobToReprice(99);

            expect(capturedUrl).toContain('jobId=99');
            expect(capturedUrl).toContain('field=InternalStatusID');
            expect(capturedUrl).toContain(`value=${InternalJobStatus.Reprice}`);
        });
    });
});
