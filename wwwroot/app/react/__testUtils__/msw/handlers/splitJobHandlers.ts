/**
 * Split Job API Handlers
 *
 * MSW handlers for split job API endpoints.
 */

import { http, HttpResponse } from 'msw';

export const splitJobHandlers = [
    // Split a job
    http.post('*/job/splitJob', async ({ request }) => {
        if (request.headers.get('X-Requested-With') !== 'XMLHttpRequest') {
            return new HttpResponse('Missing CSRF header', { status: 400 });
        }

        const body = await request.json();
        if (!body || typeof body !== 'object') {
            return new HttpResponse('Invalid request body', { status: 400 });
        }

        const { jobId, meetingPointAddress } = body as { jobId?: number; meetingPointAddress?: unknown };
        if (typeof jobId !== 'number' || !meetingPointAddress) {
            return new HttpResponse('Invalid parameters', { status: 400 });
        }

        return new HttpResponse(null, { status: 200 });
    }),

    // Restore split jobs (uses repeated query params, null body)
    http.post('*/job/RestoreSplitJobs', ({ request }) => {
        if (request.headers.get('X-Requested-With') !== 'XMLHttpRequest') {
            return new HttpResponse('Missing CSRF header', { status: 400 });
        }

        const url = new URL(request.url);
        const jobIds = url.searchParams.getAll('jobIds');

        if (!jobIds || jobIds.length === 0) {
            return new HttpResponse('Missing jobIds parameter', { status: 400 });
        }

        return new HttpResponse(null, { status: 200 });
    }),

    // Un-split a job (query param, null body)
    http.post('*/job/UnSplitJob', ({ request }) => {
        if (request.headers.get('X-Requested-With') !== 'XMLHttpRequest') {
            return new HttpResponse('Missing CSRF header', { status: 400 });
        }

        const url = new URL(request.url);
        const jobId = url.searchParams.get('jobId');

        if (!jobId) {
            return new HttpResponse('Missing jobId parameter', { status: 400 });
        }

        return HttpResponse.json('Split successfully reversed');
    }),
];
