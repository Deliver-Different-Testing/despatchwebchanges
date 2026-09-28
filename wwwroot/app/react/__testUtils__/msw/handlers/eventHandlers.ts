/**
 * Event API Handlers
 *
 * MSW handlers for event-related API endpoints.
 */

import { http, HttpResponse } from 'msw';

// Mock data
export const mockDispatchJobDetail = {
    id: 100,
    jobNo: 'JOB-001',
    client: 'ABC Ltd',
    clientId: 50,
    status: 'Active',
    courier: 'John Smith',
    courierId: 1,
};

export const eventHandlers = [
    // Add event to a job
    http.post('*/job/addEvent', async ({ request }) => {
        if (request.headers.get('X-Requested-With') !== 'XMLHttpRequest') {
            return new HttpResponse('Missing CSRF header', { status: 400 });
        }

        const body = await request.json();
        if (!body || typeof body !== 'object') {
            return new HttpResponse('Invalid request body', { status: 400 });
        }

        const { jobId, eventTypeId } = body as { jobId?: number; eventTypeId?: number };
        if (typeof jobId !== 'number' || typeof eventTypeId !== 'number') {
            return new HttpResponse('Invalid parameters', { status: 400 });
        }

        return new HttpResponse(null, { status: 200 });
    }),

    // Log Exsalerate activity (query params, null body)
    http.post('*/job/ExsalerateActivity', ({ request }) => {
        if (request.headers.get('X-Requested-With') !== 'XMLHttpRequest') {
            return new HttpResponse('Missing CSRF header', { status: 400 });
        }

        const url = new URL(request.url);
        const eventName = url.searchParams.get('eventName');
        const clientId = url.searchParams.get('clientId');

        if (!eventName || !clientId) {
            return new HttpResponse('Missing required parameters', { status: 400 });
        }

        return new HttpResponse(null, { status: 200 });
    }),

    // Get dispatch job detail
    http.get('*/job/DispatchJobDetail', ({ request }) => {
        const url = new URL(request.url);
        const jobId = url.searchParams.get('jobId');

        if (!jobId) {
            return new HttpResponse('Missing jobId parameter', { status: 400 });
        }

        return HttpResponse.json(mockDispatchJobDetail);
    }),
];
