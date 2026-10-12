/**
 * Job Search API Handlers
 *
 * MSW handlers for job search/fetch endpoints used by jobSearchApi.ts.
 * Covers POD Search, Bulk Search, Dispatch Jobs, Clear List Jobs,
 * and all three Nationwide job list endpoints.
 */

import {http, HttpResponse} from 'msw';

// ── Mock Data ────────────────────────────────────────────────────────

export const mockDispatchJobDto = {
    id: 1,
    jobNo: 'JOB-001',
    statusId: 0,
    statusName: 'New',
    booked: '2025-06-15T09:00:00+12:00',
    time: '2025-06-15T17:00:00+12:00',
    remain: 120,
    speedId: 100,
    courier: '',
    from: '10 Queen St, Auckland',
    toAddress: '20 High St, Auckland',
    client: 'Test Client',
    parentId: 0,
    isFlightJob: false,
    isAgentJob: false,
    isBulkJob: false,
    isArchived: false,
    hasBeenRead: true,
    pickupAddress: {
        addressLine1: '', addressLine2: '', addressLine3: '10',
        addressLine4: 'Queen St', addressLine5: 'Auckland CBD',
        addressLine6: 'Auckland', addressLine7: '1010', addressLine8: '',
    },
    deliveryAddress: {
        addressLine1: '', addressLine2: '', addressLine3: '20',
        addressLine4: 'High St', addressLine5: 'Newmarket',
        addressLine6: 'Auckland', addressLine7: '1023', addressLine8: '',
    },
};

export const mockJobSearchResultDto = {
    jobs: [mockDispatchJobDto],
    totalCount: 1,
    hasMore: false,
};

export const mockEmptySearchResult = {
    jobs: [],
    totalCount: 0,
    hasMore: false,
};

// ── Handlers ─────────────────────────────────────────────────────────

export const jobSearchHandlers = [
    // POD Search
    http.get('*/Job/PODSearch', ({request}) => {
        const url = new URL(request.url);
        const page = url.searchParams.get('page');
        const pageSize = url.searchParams.get('pageSize');

        if (page === null || pageSize === null) {
            return new HttpResponse('Missing pagination params', {status: 400});
        }

        return HttpResponse.json(mockJobSearchResultDto);
    }),

    // Bulk Search
    http.get('*/Job/BulkSearch', ({request}) => {
        const url = new URL(request.url);
        const page = url.searchParams.get('page');

        if (page === null) {
            return new HttpResponse('Missing page param', {status: 400});
        }

        return HttpResponse.json(mockJobSearchResultDto);
    }),

    // Dispatch Jobs (Home page)
    http.get('*/job', ({request}) => {
        const url = new URL(request.url);
        // Only handle the base /job endpoint, not sub-paths
        const pathname = new URL(request.url).pathname;
        if (pathname.includes('/job/')) return;

        return HttpResponse.json(mockJobSearchResultDto);
    }),

    // Clear List Jobs
    http.get('*/job/GetJobsByClearListEnvelope', ({request}) => {
        const url = new URL(request.url);
        const clearListId = url.searchParams.get('selectedClearListId');

        if (!clearListId) {
            return new HttpResponse('Missing selectedClearListId', {status: 400});
        }

        return HttpResponse.json(mockJobSearchResultDto);
    }),

    // Nationwide - New Jobs
    http.get('*/nationwidejob/nationwideJobListNew', () => {
        return HttpResponse.json(mockJobSearchResultDto);
    }),

    // Nationwide - POD Jobs
    http.get('*/nationwidejob/NationwideJobListPod', () => {
        return HttpResponse.json(mockJobSearchResultDto);
    }),

    // Nationwide - Reprice Jobs
    http.get('*/nationwidejob/nationwideJobListReprice', () => {
        return HttpResponse.json(mockJobSearchResultDto);
    }),
];
