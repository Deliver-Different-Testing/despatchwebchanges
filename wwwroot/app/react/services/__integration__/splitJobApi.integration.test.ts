/** @jest-environment jest-fixed-jsdom */
/**
 * Split Job API Integration Tests
 *
 * Tests the splitJobApi service using MSW to intercept real HTTP requests.
 * Verifies correct endpoint URLs, request parameters, and response handling.
 */

import { server } from '../../__testUtils__/msw/setupIntegration';
import { http, HttpResponse } from 'msw';
import { splitJobApi } from '../splitJobApi';

const mockMeetingPointAddress = {
    addressLine1: 'Meeting Point',
    addressLine2: '',
    addressLine3: '50',
    addressLine4: 'Central Avenue',
    addressLine5: 'Auckland',
    addressLine6: '',
    addressLine7: '1010',
    addressLine8: '',
    fullAddress: '50 Central Avenue, Auckland',
};

describe('splitJobApi integration', () => {
    describe('splitJob', () => {
        it('splits a job with meeting point address', async () => {
            let capturedBody: unknown = null;

            server.use(
                http.post('*/job/splitJob', async ({ request }) => {
                    capturedBody = await request.json();
                    return new HttpResponse(null, { status: 200 });
                })
            );

            await splitJobApi.splitJob({
                jobId: 100,
                meetingPointAddress: mockMeetingPointAddress,
            });

            expect(capturedBody).toMatchObject({
                jobId: 100,
                meetingPointAddress: {
                    addressLine4: 'Central Avenue',
                    fullAddress: '50 Central Avenue, Auckland',
                },
            });
        });

        it('sends CSRF header', async () => {
            let capturedCsrfHeader: string | null = null;

            server.use(
                http.post('*/job/splitJob', async ({ request }) => {
                    capturedCsrfHeader = request.headers.get('X-Requested-With');
                    await request.json();
                    return new HttpResponse(null, { status: 200 });
                })
            );

            await splitJobApi.splitJob({
                jobId: 100,
                meetingPointAddress: mockMeetingPointAddress,
            });

            expect(capturedCsrfHeader).toBe('XMLHttpRequest');
        });

        it('handles validation errors', async () => {
            server.use(
                http.post('*/job/splitJob', () => {
                    return HttpResponse.json(
                        { message: 'Job cannot be split' },
                        { status: 400 }
                    );
                })
            );

            await expect(
                splitJobApi.splitJob({
                    jobId: 100,
                    meetingPointAddress: mockMeetingPointAddress,
                })
            ).rejects.toMatchObject({
                status: 400,
            });
        });
    });

    describe('restoreSplitJobs', () => {
        it('sends jobIds as repeated query parameters', async () => {
            let capturedUrl = '';

            server.use(
                http.post('*/job/RestoreSplitJobs', ({ request }) => {
                    capturedUrl = request.url;
                    return new HttpResponse(null, { status: 200 });
                })
            );

            await splitJobApi.restoreSplitJobs([101, 102, 103]);

            // Verify repeated query params: jobIds=101&jobIds=102&jobIds=103
            expect(capturedUrl).toContain('jobIds=101');
            expect(capturedUrl).toContain('jobIds=102');
            expect(capturedUrl).toContain('jobIds=103');
        });

        it('sends null body', async () => {
            let capturedBody: string | null = null;

            server.use(
                http.post('*/job/RestoreSplitJobs', async ({ request }) => {
                    capturedBody = await request.text();
                    return new HttpResponse(null, { status: 200 });
                })
            );

            await splitJobApi.restoreSplitJobs([101]);

            // Body should be null/empty (sent as "null" string by JSON serialization)
            expect(capturedBody === 'null' || capturedBody === '').toBe(true);
        });

        it('handles server errors', async () => {
            server.use(
                http.post('*/job/RestoreSplitJobs', () => {
                    return HttpResponse.json(
                        { message: 'Failed to restore jobs' },
                        { status: 500 }
                    );
                })
            );

            await expect(
                splitJobApi.restoreSplitJobs([101, 102])
            ).rejects.toMatchObject({
                status: 500,
            });
        });
    });

    describe('unSplitJob', () => {
        it('sends jobId as query parameter and returns message', async () => {
            let capturedUrl = '';

            server.use(
                http.post('*/job/UnSplitJob', ({ request }) => {
                    capturedUrl = request.url;
                    return HttpResponse.json('Split successfully reversed');
                })
            );

            const result = await splitJobApi.unSplitJob(100);

            expect(capturedUrl).toContain('jobId=100');
            expect(result).toBe('Split successfully reversed');
        });

        it('handles not found error', async () => {
            server.use(
                http.post('*/job/UnSplitJob', () => {
                    return HttpResponse.json(
                        { message: 'Job not found or not split' },
                        { status: 404 }
                    );
                })
            );

            await expect(splitJobApi.unSplitJob(999)).rejects.toMatchObject({
                status: 404,
            });
        });

        it('handles permission error', async () => {
            server.use(
                http.post('*/job/UnSplitJob', () => {
                    return HttpResponse.json(
                        { message: 'Permission denied' },
                        { status: 403 }
                    );
                })
            );

            await expect(splitJobApi.unSplitJob(100)).rejects.toMatchObject({
                status: 403,
            });
        });
    });
});
