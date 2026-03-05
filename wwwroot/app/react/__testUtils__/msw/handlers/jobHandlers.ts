/**
 * Job API Handlers
 *
 * MSW handlers for job-related API endpoints.
 */

import { http, HttpResponse } from 'msw';
import type { RelatedJobDto, Suggestion } from '../../../interfaces/job';

// Mock data
export const mockClientSuggestions: Suggestion[] = [
    { id: 10, text: 'Acme Corp' },
    { id: 20, text: 'Acme Industries' },
];

export const mockVehicleSizes: Suggestion[] = [
    { id: 1, text: 'Car' },
    { id: 2, text: 'Van' },
    { id: 3, text: 'Truck' },
];

export const mockRelatedJobs: RelatedJobDto[] = [
    {
        id: 101,
        text: 'JOB-001 - Collection from ABC Ltd',
        selected: true,
    },
    {
        id: 102,
        text: 'JOB-002 - Delivery to XYZ Corp',
        selected: false,
    },
    {
        id: 103,
        text: 'JOB-003 - Return pickup',
        selected: false,
    },
];

export const jobHandlers = [
    // Get related jobs for multi-select
    http.get('*/job/GetRelatedJobsMultiSelectList', ({ request }) => {
        const url = new URL(request.url);
        const jobId = url.searchParams.get('jobId');

        if (!jobId) {
            return new HttpResponse('Missing jobId parameter', { status: 400 });
        }

        return HttpResponse.json(mockRelatedJobs);
    }),

    // Void a single job
    http.post('*/job/Void', async ({ request }) => {
        // Verify CSRF header
        if (request.headers.get('X-Requested-With') !== 'XMLHttpRequest') {
            return new HttpResponse('Missing CSRF header', { status: 400 });
        }

        const body = await request.json();
        if (!body || typeof body !== 'object') {
            return new HttpResponse('Invalid request body', { status: 400 });
        }

        const { jobId } = body as { jobId?: number };
        if (typeof jobId !== 'number') {
            return new HttpResponse('Invalid jobId', { status: 400 });
        }

        return new HttpResponse(null, { status: 200 });
    }),

    // Void a bulk job
    http.post('*/job/VoidBulkJob', async ({ request }) => {
        // Verify CSRF header
        if (request.headers.get('X-Requested-With') !== 'XMLHttpRequest') {
            return new HttpResponse('Missing CSRF header', { status: 400 });
        }

        const body = await request.json();
        if (!body || typeof body !== 'object') {
            return new HttpResponse('Invalid request body', { status: 400 });
        }

        const { bulkJobId } = body as { bulkJobId?: number };
        if (typeof bulkJobId !== 'number') {
            return new HttpResponse('Invalid bulkJobId', { status: 400 });
        }

        return new HttpResponse(null, { status: 200 });
    }),

    // Quick create job
    http.post('*/job/QuickCreateJob', async ({ request }) => {
        if (request.headers.get('X-Requested-With') !== 'XMLHttpRequest') {
            return new HttpResponse('Missing CSRF header', { status: 400 });
        }

        const body = await request.json();
        if (!body || typeof body !== 'object') {
            return new HttpResponse('Invalid request body', { status: 400 });
        }

        const { clientId } = body as { clientId?: number };
        if (typeof clientId !== 'number' || clientId <= 0) {
            return new HttpResponse('Invalid clientId', { status: 400 });
        }

        // Return a mock new job ID
        return HttpResponse.json(12345);
    }),

    // Search active clients
    http.get('*/home/ActiveClients', ({ request }) => {
        const url = new URL(request.url);
        const searchText = url.searchParams.get('searchText');

        if (!searchText) {
            return HttpResponse.json([]);
        }

        const filtered = mockClientSuggestions.filter(c =>
            c.text.toLowerCase().includes(searchText.toLowerCase())
        );
        return HttpResponse.json(filtered);
    }),

    // Get vehicle sizes
    http.get('*/courier/GetVehicleSizes', () => {
        return HttpResponse.json(mockVehicleSizes);
    }),

    // Allocate job to courier
    http.post('*/job/Allocate', async ({ request }) => {
        if (request.headers.get('X-Requested-With') !== 'XMLHttpRequest') {
            return new HttpResponse('Missing CSRF header', { status: 400 });
        }

        const body = await request.json();
        if (!body || typeof body !== 'object') {
            return new HttpResponse('Invalid request body', { status: 400 });
        }

        const { courierId, jobIds } = body as { courierId?: number; jobIds?: number[] };
        if (typeof courierId !== 'number' || !Array.isArray(jobIds)) {
            return new HttpResponse('Invalid allocation data', { status: 400 });
        }

        return new HttpResponse(null, { status: 200 });
    }),
];
