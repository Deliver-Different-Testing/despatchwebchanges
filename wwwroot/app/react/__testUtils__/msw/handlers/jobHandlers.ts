/**
 * Job API Handlers
 *
 * MSW handlers for job-related API endpoints.
 */

import { http, HttpResponse } from 'msw';
import type { RelatedJobDto } from '../../../interfaces/job';

// Mock data
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
];
