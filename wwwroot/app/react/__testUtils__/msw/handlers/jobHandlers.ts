/**
 * Job API Handlers
 *
 * MSW handlers for job-related API endpoints.
 */

import { http, HttpResponse } from 'msw';
import {rejectWithoutCsrf} from './requestGuards';
import type { RelatedJobDto, Suggestion } from '../../../interfaces';

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
        const rejected = rejectWithoutCsrf(request);
        if (rejected) return rejected;

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
        const rejected = rejectWithoutCsrf(request);
        if (rejected) return rejected;

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
        const rejected = rejectWithoutCsrf(request);
        if (rejected) return rejected;

        const body = await request.json();
        if (!body || typeof body !== 'object') {
            return new HttpResponse('Invalid request body', { status: 400 });
        }

        const { clientId } = body as { clientId?: number };
        if (typeof clientId !== 'number' || clientId <= 0) {
            return new HttpResponse('Invalid clientId', { status: 400 });
        }

        // Return a mock new job id + job number
        return HttpResponse.json({ jobId: 12345, jobNumber: 'JOB-12345' });
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
        const rejected = rejectWithoutCsrf(request);
        if (rejected) return rejected;

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

    // Validate a job is eligible for a POD swap
    http.get('*/Job/ValidateSwapPod', ({ request }) => {
        const url = new URL(request.url);
        const job = url.searchParams.get('job');

        if (!job) {
            return new HttpResponse('Missing job parameter', { status: 400 });
        }

        // Simulate an ineligible job for testing false responses
        if (job === 'INELIGIBLE') {
            return HttpResponse.json(false);
        }

        return HttpResponse.json(true);
    }),

    // Swap the POD between two jobs
    http.post('*/Job/SwapPod', async ({ request }) => {
        const rejected = rejectWithoutCsrf(request);
        if (rejected) return rejected;

        const body = await request.json();
        if (!body || typeof body !== 'object') {
            return new HttpResponse('Invalid request body', { status: 400 });
        }

        const { job1, job2 } = body as { job1?: string; job2?: string };
        if (typeof job1 !== 'string' || typeof job2 !== 'string') {
            return new HttpResponse('Invalid job numbers', { status: 400 });
        }

        return new HttpResponse(null, { status: 200 });
    }),
];
