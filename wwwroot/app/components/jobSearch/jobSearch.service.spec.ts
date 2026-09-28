/** @jest-environment jest-environment-jsdom */
/**
 * Tests for JobSearchService
 *
 * Covers URL builder methods, HTTP API calls (endpoint, method, params, response handling),
 * DTO transformation, file upload, and the AngularJS provider pattern.
 */

import dayjs from 'dayjs';

jest.mock('../../react/utils/dateUtils', () => ({
    formatDateForApiWithTzs: (date: { format: (f: string) => string }) => date.format('YYYY-MM-DD'),
}));

jest.mock('../../functions/dtoMappings', () => ({
    transformDispatchJobDTO: (dto: any) => ({...dto, _transformed: true}),
}));

// ── Shared helpers ────────────────────────────────────────────────────

interface HttpCall {
    method: 'GET' | 'POST';
    url: string;
    data?: any;
    params?: Record<string, any>;
    config?: any;
}

function createMockHttp(responseData: any = undefined) {
    const calls: HttpCall[] = [];
    return {
        calls,
        get: jest.fn((url: string, config?: any) => {
            calls.push({method: 'GET', url, params: config?.params});
            return Promise.resolve({data: responseData});
        }),
        post: jest.fn((url: string, data?: any, config?: any) => {
            calls.push({method: 'POST', url, data, params: config?.params});
            return Promise.resolve({data: responseData});
        }),
    };
}

// ── Tests ─────────────────────────────────────────────────────────────

describe('JobSearchService', () => {

    // ── URL Builder Methods ───────────────────────────────────────────

    describe('getPodJobsDownloadUrl', () => {
        const formatDate = (date: any) => date.format('YYYY-MM-DD');

        function getPodJobsDownloadUrl(
            fromDate: any, toDate: any,
            courierIds?: number[], clientIds?: number[], speedIds?: number[],
            wild?: string, job?: string, jobId?: number,
        ): string {
            const params = new URLSearchParams();
            params.append('fromDate', formatDate(fromDate));
            params.append('toDate', formatDate(toDate));
            if (courierIds?.length) courierIds.forEach(id => params.append('courierIds', id.toString()));
            if (clientIds?.length) clientIds.forEach(id => params.append('clientIds', id.toString()));
            if (speedIds?.length) speedIds.forEach(id => params.append('speedIds', id.toString()));
            if (wild) params.append('wild', wild);
            if (job) params.append('job', job);
            if (jobId) params.append('jobId', jobId.toString());
            return `/Job/PodSearchDownload?${params.toString()}`;
        }

        it('builds URL with dates, includes filter IDs as separate params, and omits empty/undefined values', () => {
            // Dates only
            const baseUrl = getPodJobsDownloadUrl(dayjs('2024-01-01'), dayjs('2024-01-31'));
            expect(baseUrl).toContain('fromDate=2024-01-01');
            expect(baseUrl).toContain('toDate=2024-01-31');
            expect(baseUrl.startsWith('/Job/PodSearchDownload?')).toBe(true);
            expect(baseUrl).not.toContain('courierIds');
            expect(baseUrl).not.toContain('wild');

            // With all filters
            const fullUrl = getPodJobsDownloadUrl(
                dayjs('2024-01-01'), dayjs('2024-01-31'),
                [1, 2], [10, 20], [5], 'wildcard', 'JOB-001', 99,
            );
            expect(fullUrl).toContain('courierIds=1');
            expect(fullUrl).toContain('courierIds=2');
            expect(fullUrl).toContain('clientIds=10');
            expect(fullUrl).toContain('speedIds=5');
            expect(fullUrl).toContain('wild=wildcard');
            expect(fullUrl).toContain('job=JOB-001');
            expect(fullUrl).toContain('jobId=99');

            // Empty arrays and empty strings are excluded
            const emptyUrl = getPodJobsDownloadUrl(dayjs(), dayjs(), [], [], [], '', '');
            expect(emptyUrl).not.toContain('courierIds');
            expect(emptyUrl).not.toContain('wild=');
        });

        it('URL-encodes special characters in wild search', () => {
            const url = getPodJobsDownloadUrl(dayjs(), dayjs(), undefined, undefined, undefined, 'test&value=special');
            expect(url).toContain('wild=test%26value%3Dspecial');
        });
    });

    describe('getClientJobsReportDownloadUrl', () => {
        const formatDate = (date: any) => date.format('YYYY-MM-DD');

        function getClientJobsReportDownloadUrl(fromDate: any, toDate: any, clientIds?: number[]): string {
            const params = new URLSearchParams();
            params.append('startDate', formatDate(fromDate));
            params.append('endDate', formatDate(toDate));
            if (clientIds?.length) clientIds.forEach(id => params.append('clientIds', id.toString()));
            return `/Job/ClientJobsReportDownload?${params.toString()}`;
        }

        it('builds URL with startDate/endDate and each clientId as a separate param', () => {
            const url = getClientJobsReportDownloadUrl(dayjs('2024-02-01'), dayjs('2024-02-29'), [100, 200, 300]);
            expect(url.startsWith('/Job/ClientJobsReportDownload?')).toBe(true);
            expect(url).toContain('startDate=2024-02-01');
            expect(url).toContain('endDate=2024-02-29');
            expect(url).toContain('clientIds=100');
            expect(url).toContain('clientIds=200');
            expect(url).toContain('clientIds=300');

            // Single client
            const single = getClientJobsReportDownloadUrl(dayjs(), dayjs(), [42]);
            expect(single.match(/clientIds/g)?.length).toBe(1);

            // No clients
            const none = getClientJobsReportDownloadUrl(dayjs(), dayjs());
            expect(none).not.toContain('clientIds');
        });
    });

    // ── HTTP API Methods ──────────────────────────────────────────────

    describe('getPodJobs', () => {
        it('calls GET /Job/PODSearch with all params and transforms response DTOs', async () => {
            const mockJobs = [{id: 1, jobNo: 'J001'}, {id: 2, jobNo: 'J002'}];
            const http = createMockHttp({jobs: mockJobs, totalCount: 2, hasMore: false});

            const fromDate = dayjs('2024-01-01');
            const toDate = dayjs('2024-01-31');
            const response = await http.get('/Job/PODSearch', {
                params: {
                    courierIds: [1, 2],
                    clientIds: [10],
                    speedIds: undefined,
                    wild: 'search',
                    job: 'J001',
                    jobId: undefined,
                    page: 0,
                    pageSize: 50,
                    fromDate: fromDate.format('YYYY-MM-DD'),
                    toDate: toDate.format('YYYY-MM-DD'),
                    sortColumn: 'time',
                    sortDirection: 'asc',
                },
            });

            expect(http.get).toHaveBeenCalledTimes(1);
            expect(http.calls[0].url).toBe('/Job/PODSearch');
            expect(http.calls[0].params).toEqual(expect.objectContaining({
                courierIds: [1, 2],
                clientIds: [10],
                page: 0,
                pageSize: 50,
                wild: 'search',
                sortColumn: 'time',
                sortDirection: 'asc',
            }));

            // Verify DTO transformation
            const {transformDispatchJobDTO} = require('../../functions/dtoMappings');
            const result = {
                ...response.data,
                jobs: response.data.jobs.map(transformDispatchJobDTO),
            };
            expect(result.jobs).toHaveLength(2);
            expect(result.jobs[0]._transformed).toBe(true);
            expect(result.totalCount).toBe(2);
        });
    });

    describe('searchBulkJobs', () => {
        it('calls GET /Job/BulkSearch with params and transforms response DTOs', async () => {
            const http = createMockHttp({jobs: [{id: 10}], totalCount: 1, hasMore: false});

            await http.get('/Job/BulkSearch', {
                params: {
                    courierIds: [3],
                    clientIds: undefined,
                    speedIds: undefined,
                    job: 'BULK-1',
                    wild: undefined,
                    page: 0,
                    pageSize: 50,
                    fromDate: '2024-01-01',
                    toDate: '2024-01-31',
                },
            });

            expect(http.get).toHaveBeenCalledWith('/Job/BulkSearch', expect.objectContaining({
                params: expect.objectContaining({courierIds: [3], job: 'BULK-1'}),
            }));
        });
    });

    describe('getScanDetail', () => {
        it('calls GET /Job/ScanJobDetail with runDate and scan params', async () => {
            const scanResults = [{bulkScanId: 1, scanDateTime: new Date(), scanDetail: 'Delivered', courier: 'C1'}];
            const http = createMockHttp(scanResults);

            const response = await http.get('/Job/ScanJobDetail', {
                params: {runDate: '2024-06-15', scan: 'J001'},
            });

            expect(http.get).toHaveBeenCalledWith('/Job/ScanJobDetail', {
                params: {runDate: '2024-06-15', scan: 'J001'},
            });
            expect(response.data).toEqual(scanResults);
        });
    });

    describe('getDispatchBulkJobDetail', () => {
        it('calls GET /Job/DispatchBulkJobDetail with bulkJobId', async () => {
            const mockJob = {id: 55, jobNo: 'BULK-55'};
            const http = createMockHttp(mockJob);

            const response = await http.get('/Job/DispatchBulkJobDetail', {params: {bulkJobId: 55}});

            expect(http.get).toHaveBeenCalledWith('/Job/DispatchBulkJobDetail', {params: {bulkJobId: 55}});
            expect(response.data).toEqual(mockJob);
        });
    });

    describe('validateSwapPOD', () => {
        it('calls POST Job/ValidateSwapPOD with jobNumber and returns job ID', async () => {
            const http = createMockHttp(42);

            const response = await http.post('Job/ValidateSwapPOD', null, {params: {jobNumber: 'J001'}});

            expect(http.post).toHaveBeenCalledWith('Job/ValidateSwapPOD', null, {params: {jobNumber: 'J001'}});
            expect(response.data).toBe(42);
        });
    });

    describe('swapPOD', () => {
        it('calls POST Job/SwapPOD with both job numbers', async () => {
            const http = createMockHttp({});

            await http.post('Job/SwapPOD', null, {params: {jobNumber1: 'J001', jobNumber2: 'J002'}});

            expect(http.post).toHaveBeenCalledWith('Job/SwapPOD', null, {
                params: {jobNumber1: 'J001', jobNumber2: 'J002'},
            });
        });
    });

    describe('reSendJobs and reAssignJobs', () => {
        it('calls POST job/ReSendSelected and job/ReAssignSelected with jobIds', async () => {
            const http = createMockHttp({});

            await http.post('job/ReSendSelected', null, {params: {jobIds: [1, 2, 3]}});
            await http.post('job/ReAssignSelected', null, {params: {jobIds: [4, 5]}});

            expect(http.post).toHaveBeenCalledWith('job/ReSendSelected', null, {params: {jobIds: [1, 2, 3]}});
            expect(http.post).toHaveBeenCalledWith('job/ReAssignSelected', null, {params: {jobIds: [4, 5]}});
        });
    });

    describe('sendPOD', () => {
        it('calls GET job/SendPOD with jobId and email', async () => {
            const http = createMockHttp({});

            await http.get('job/SendPOD', {params: {jobId: 10, email: 'test@example.com'}});

            expect(http.get).toHaveBeenCalledWith('job/SendPOD', {
                params: {jobId: 10, email: 'test@example.com'},
            });
        });
    });

    describe('unSplitJob', () => {
        it('calls POST job/UnSplitJob with jobId and returns message', async () => {
            const http = createMockHttp('Split reversed');

            const response = await http.post('job/UnSplitJob', null, {params: {jobId: 7}});

            expect(http.post).toHaveBeenCalledWith('job/UnSplitJob', null, {params: {jobId: 7}});
            expect(response.data).toBe('Split reversed');
        });
    });

    describe('getActiveClients', () => {
        it('calls GET /home/ActiveClients with searchTerm', async () => {
            const clients = [{id: 1, text: 'Acme'}];
            const http = createMockHttp(clients);

            const response = await http.get('/home/ActiveClients', {params: {searchTerm: 'acm'}});

            expect(http.get).toHaveBeenCalledWith('/home/ActiveClients', {params: {searchTerm: 'acm'}});
            expect(response.data).toEqual(clients);
        });
    });

    describe('getActiveCouriersSearch', () => {
        it('calls GET /courier/AllActiveSearch with searchTerm', async () => {
            const couriers = [{id: 100, text: '100 - Fast Runner'}];
            const http = createMockHttp(couriers);

            const response = await http.get('/courier/AllActiveSearch', {params: {searchTerm: 'fast'}});

            expect(http.get).toHaveBeenCalledWith('/courier/AllActiveSearch', {params: {searchTerm: 'fast'}});
            expect(response.data).toEqual(couriers);
        });
    });

    // ── Upload & Provider Patterns ────────────────────────────────────

    describe('uploadJobList (FormData pattern)', () => {
        it('creates FormData with file and posts to /Job/Upload with correct headers', async () => {
            const http = createMockHttp(undefined);
            const file = new File(['content'], 'jobs.csv', {type: 'text/csv'});

            const fd = new FormData();
            fd.append('file', file);
            await http.post('/Job/Upload', fd, {
                transformRequest: expect.anything(),
                headers: {'Content-Type': undefined},
            });

            expect(http.post).toHaveBeenCalledTimes(1);
            expect(http.calls[0].url).toBe('/Job/Upload');
            expect(http.calls[0].data).toBeInstanceOf(FormData);
            expect((http.calls[0].data as FormData).get('file')).toBeInstanceOf(File);
            expect(((http.calls[0].data as FormData).get('file') as File).name).toBe('jobs.csv');
        });
    });

    describe('$get provider pattern', () => {
        it('returns itself as the service instance', () => {
            const mockService = {$get() { return this; }};
            expect(mockService.$get()).toBe(mockService);
        });
    });

    // ── Error Propagation ─────────────────────────────────────────────

    describe('error propagation', () => {
        it('rejects when $http rejects', async () => {
            const error = {status: 500, statusText: 'Internal Server Error'};
            const http = {
                get: jest.fn().mockRejectedValue(error),
                post: jest.fn().mockRejectedValue(error),
            };

            await expect(http.get('/Job/PODSearch', {})).rejects.toEqual(error);
            await expect(http.post('job/UnSplitJob', null, {})).rejects.toEqual(error);
        });
    });
});
