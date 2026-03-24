/** @jest-environment jest-fixed-jsdom */
/**
 * Job Search API Integration Tests
 *
 * Tests the jobSearchApi functions using MSW to intercept real HTTP requests.
 * Verifies correct endpoint URLs, request parameters, DTO transformation,
 * and error handling for all job search/fetch endpoints.
 */

import {server} from '../../__testUtils__/msw/setupIntegration';
import {http, HttpResponse} from 'msw';
import {
    fetchPodJobs,
    fetchBulkJobs,
    fetchDispatchJobs,
    fetchClearListJobs,
    fetchNationwideJobsNew,
    fetchNationwideJobsPod,
    fetchNationwideJobsReprice,
} from '../jobSearchApi';
import {mockJobSearchResultDto} from '../../__testUtils__/msw/handlers';
import type {JobListSearchParams} from '../../interfaces/dispatchJob';
import dayjs from 'dayjs';

// ── Helpers ──────────────────────────────────────────────────────────

function createBaseParams(overrides?: Partial<JobListSearchParams>): JobListSearchParams {
    return {
        page: 0,
        pageSize: 50,
        order: 'time',
        orderDirection: 'asc',
        searchText: '',
        ...overrides,
    };
}

// ── Tests ────────────────────────────────────────────────────────────

describe('jobSearchApi integration', () => {

    // ── fetchPodJobs ─────────────────────────────────────────────────

    describe('fetchPodJobs', () => {
        it('sends correct parameters to /Job/PODSearch', async () => {
            let capturedUrl = '';

            server.use(
                http.get('*/Job/PODSearch', ({request}) => {
                    capturedUrl = request.url;
                    return HttpResponse.json(mockJobSearchResultDto);
                }),
            );

            await fetchPodJobs(createBaseParams({
                courierIds: [1, 2],
                clientIds: [10],
                speedIds: [100],
                wild: 'wildcard',
                page: 0,
                pageSize: 25,
            }));

            expect(capturedUrl).toContain('/Job/PODSearch');
            expect(capturedUrl).toContain('page=0');
            expect(capturedUrl).toContain('pageSize=25');
        });

        it('transforms DTO results into domain objects', async () => {
            const result = await fetchPodJobs(createBaseParams());

            expect(result.jobs).toHaveLength(1);
            expect(result.totalCount).toBe(1);
            expect(result.hasMore).toBe(false);
            // transformDispatchJobDTO converts string dates to dayjs objects
            expect(result.jobs[0]).toHaveProperty('id', 1);
            expect(result.jobs[0]).toHaveProperty('jobNo', 'JOB-001');
        });

        it('handles server errors', async () => {
            server.use(
                http.get('*/Job/PODSearch', () => {
                    return HttpResponse.json(
                        {message: 'Internal Server Error'},
                        {status: 500},
                    );
                }),
            );

            await expect(fetchPodJobs(createBaseParams())).rejects.toMatchObject({
                status: 500,
            });
        });

        it('handles empty results', async () => {
            server.use(
                http.get('*/Job/PODSearch', () => {
                    return HttpResponse.json({jobs: [], totalCount: 0, hasMore: false});
                }),
            );

            const result = await fetchPodJobs(createBaseParams());

            expect(result.jobs).toEqual([]);
            expect(result.totalCount).toBe(0);
        });
    });

    // ── fetchBulkJobs ────────────────────────────────────────────────

    describe('fetchBulkJobs', () => {
        it('sends correct parameters to /Job/BulkSearch', async () => {
            let capturedUrl = '';

            server.use(
                http.get('*/Job/BulkSearch', ({request}) => {
                    capturedUrl = request.url;
                    return HttpResponse.json(mockJobSearchResultDto);
                }),
            );

            await fetchBulkJobs(createBaseParams({
                job: 'BULK-001',
                wild: 'search',
            }));

            expect(capturedUrl).toContain('/Job/BulkSearch');
            expect(capturedUrl).toContain('page=0');
        });

        it('transforms results', async () => {
            const result = await fetchBulkJobs(createBaseParams());

            expect(result.jobs).toHaveLength(1);
            expect(result.jobs[0]).toHaveProperty('jobNo', 'JOB-001');
        });
    });

    // ── fetchDispatchJobs ────────────────────────────────────────────

    describe('fetchDispatchJobs', () => {
        it('sends correct parameters to /job', async () => {
            let capturedUrl = '';

            server.use(
                http.get('*/job', ({request}) => {
                    const url = new URL(request.url);
                    // Only intercept the base /job endpoint
                    if (url.pathname.endsWith('/job') || url.pathname.endsWith('/job/')) {
                        capturedUrl = request.url;
                        return HttpResponse.json(mockJobSearchResultDto);
                    }
                }),
            );

            await fetchDispatchJobs(createBaseParams({
                isInternal: true,
                statusFilter: 'active',
                despatchViewIds: [1, 2],
            }));

            expect(capturedUrl).toContain('order=time');
            expect(capturedUrl).toContain('orderDirection=asc');
            expect(capturedUrl).toContain('isInternal=true');
        });

        it('handles server errors', async () => {
            server.use(
                http.get('*/job', () => {
                    return HttpResponse.json(
                        {message: 'Forbidden'},
                        {status: 403},
                    );
                }),
            );

            await expect(fetchDispatchJobs(createBaseParams())).rejects.toMatchObject({
                status: 403,
            });
        });
    });

    // ── fetchClearListJobs ───────────────────────────────────────────

    describe('fetchClearListJobs', () => {
        it('sends selectedClearListId to /job/GetJobsByClearListEnvelope', async () => {
            let capturedUrl = '';

            server.use(
                http.get('*/job/GetJobsByClearListEnvelope', ({request}) => {
                    capturedUrl = request.url;
                    return HttpResponse.json(mockJobSearchResultDto);
                }),
            );

            await fetchClearListJobs(createBaseParams({selectedClearListId: 42}));

            expect(capturedUrl).toContain('selectedClearListId=42');
        });

        it('transforms results', async () => {
            server.use(
                http.get('*/job/GetJobsByClearListEnvelope', () => {
                    return HttpResponse.json(mockJobSearchResultDto);
                }),
            );

            const result = await fetchClearListJobs(createBaseParams({selectedClearListId: 1}));

            expect(result.jobs).toHaveLength(1);
            expect(result.totalCount).toBe(1);
        });
    });

    // ── Nationwide Jobs ──────────────────────────────────────────────

    describe('fetchNationwideJobsNew', () => {
        it('calls /nationwidejob/nationwideJobListNew', async () => {
            let capturedUrl = '';

            server.use(
                http.get('*/nationwidejob/nationwideJobListNew', ({request}) => {
                    capturedUrl = request.url;
                    return HttpResponse.json(mockJobSearchResultDto);
                }),
            );

            await fetchNationwideJobsNew(createBaseParams({
                isInternal: true,
                despatchViewIds: [1, 2],
            }));

            expect(capturedUrl).toContain('/nationwidejob/nationwideJobListNew');
            expect(capturedUrl).toContain('isInternal=true');
        });

        it('transforms results', async () => {
            const result = await fetchNationwideJobsNew(createBaseParams());

            expect(result.jobs).toHaveLength(1);
            expect(result.jobs[0]).toHaveProperty('jobNo', 'JOB-001');
        });

        it('handles server errors', async () => {
            server.use(
                http.get('*/nationwidejob/nationwideJobListNew', () => {
                    return HttpResponse.json(
                        {message: 'Server Error'},
                        {status: 500},
                    );
                }),
            );

            await expect(fetchNationwideJobsNew(createBaseParams())).rejects.toMatchObject({
                status: 500,
            });
        });
    });

    describe('fetchNationwideJobsPod', () => {
        it('calls /nationwidejob/NationwideJobListPod', async () => {
            let capturedUrl = '';

            server.use(
                http.get('*/nationwidejob/NationwideJobListPod', ({request}) => {
                    capturedUrl = request.url;
                    return HttpResponse.json(mockJobSearchResultDto);
                }),
            );

            await fetchNationwideJobsPod(createBaseParams());

            expect(capturedUrl).toContain('/nationwidejob/NationwideJobListPod');
        });

        it('transforms results', async () => {
            const result = await fetchNationwideJobsPod(createBaseParams());

            expect(result.jobs).toHaveLength(1);
        });
    });

    describe('fetchNationwideJobsReprice', () => {
        it('calls /nationwidejob/nationwideJobListReprice', async () => {
            let capturedUrl = '';

            server.use(
                http.get('*/nationwidejob/nationwideJobListReprice', ({request}) => {
                    capturedUrl = request.url;
                    return HttpResponse.json(mockJobSearchResultDto);
                }),
            );

            await fetchNationwideJobsReprice(createBaseParams());

            expect(capturedUrl).toContain('/nationwidejob/nationwideJobListReprice');
        });

        it('transforms results', async () => {
            const result = await fetchNationwideJobsReprice(createBaseParams());

            expect(result.jobs).toHaveLength(1);
        });

        it('handles empty results', async () => {
            server.use(
                http.get('*/nationwidejob/nationwideJobListReprice', () => {
                    return HttpResponse.json({jobs: [], totalCount: 0, hasMore: false});
                }),
            );

            const result = await fetchNationwideJobsReprice(createBaseParams());

            expect(result.jobs).toEqual([]);
            expect(result.totalCount).toBe(0);
        });
    });

    // ── Shared behavior ──────────────────────────────────────────────

    describe('date formatting', () => {
        it('formats dates in POD search requests', async () => {
            let capturedUrl = '';

            server.use(
                http.get('*/Job/PODSearch', ({request}) => {
                    capturedUrl = request.url;
                    return HttpResponse.json(mockJobSearchResultDto);
                }),
            );

            await fetchPodJobs(createBaseParams({
                startDate: dayjs('2025-03-01') as any,
                endDate: dayjs('2025-03-31') as any,
            }));

            // Dates should be formatted (exact format depends on formatDateForApiWithTzs)
            expect(capturedUrl).toContain('fromDate=');
            expect(capturedUrl).toContain('toDate=');
        });

        it('formats endDate as dateCutoff in nationwide requests', async () => {
            let capturedUrl = '';

            server.use(
                http.get('*/nationwidejob/nationwideJobListNew', ({request}) => {
                    capturedUrl = request.url;
                    return HttpResponse.json(mockJobSearchResultDto);
                }),
            );

            await fetchNationwideJobsNew(createBaseParams({
                endDate: dayjs('2025-06-30') as any,
            }));

            expect(capturedUrl).toContain('dateCutoff=');
        });
    });
});
