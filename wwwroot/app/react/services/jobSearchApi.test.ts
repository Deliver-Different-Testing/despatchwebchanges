/** @jest-environment node */
/**
 * Job Search API Service Tests
 *
 * Unit tests for all fetch functions in jobSearchApi.ts.
 * Mocks apiClient and transformDispatchJobDTO to verify correct
 * URL, parameter formatting, and DTO transformation.
 */

import {
    fetchPodJobs,
    fetchBulkJobs,
    fetchDispatchBulkJobDetail,
    fetchDispatchJobs,
    fetchClearListJobs,
    fetchCurrentWorkJobs,
    fetchNationwideJobsNew,
    fetchNationwideJobsPod,
    fetchNationwideJobsReprice,
} from './jobSearchApi';
import {apiClient} from './apiClient';
import {createMockApiError} from '../__testUtils__';
import type {IJobSearchResultDto} from '../../interfaces/job.interface';
import type {JobListSearchParams} from '../interfaces/dispatchJob';
import dayjs from 'dayjs';

jest.mock('./apiClient', () => ({
    apiClient: {
        get: jest.fn(),
    },
}));

jest.mock('../../functions/dtoMappings', () => ({
    transformDispatchJobDTO: jest.fn((dto: any) => ({...dto, _transformed: true})),
}));

jest.mock('../utils/dateUtils', () => ({
    formatDateForApiWithTzs: jest.fn((d: any) => `formatted-${d}`),
    getIanaTimezone: jest.fn(() => 'Pacific/Auckland'),
}));

const mockApiClient = apiClient as jest.Mocked<typeof apiClient>;

// ── Helpers ──────────────────────────────────────────────────────────

function createMockDto(jobCount: number = 2): IJobSearchResultDto {
    return {
        jobs: Array.from({length: jobCount}, (_, i) => ({
            id: i + 1,
            jobNo: `JOB-${i + 1}`,
        })) as any,
        totalCount: jobCount,
        hasMore: false,
    };
}

function createBaseParams(overrides?: Partial<JobListSearchParams>): JobListSearchParams {
    return {
        page: 0,
        pageSize: 50,
        order: 'time',
        orderDirection: 'asc',
        searchText: 'test',
        ...overrides,
    };
}

// ── Tests ────────────────────────────────────────────────────────────

describe('jobSearchApi', () => {
    // ── fetchPodJobs ─────────────────────────────────────────────────

    describe('fetchPodJobs', () => {
        it('should call GET /Job/PODSearch with correct params', async () => {
            const dto = createMockDto();
            mockApiClient.get.mockResolvedValueOnce(dto);

            const params = createBaseParams({
                courierIds: [1, 2],
                clientIds: [10],
                speedIds: [100],
                wild: 'wildcard',
                job: 'JOB-001',
                jobId: 42,
                startDate: dayjs('2025-01-01') as any,
                endDate: dayjs('2025-01-31') as any,
                sortColumn: 'jobNo',
                sortDirection: 'desc',
            });

            await fetchPodJobs(params);

            expect(mockApiClient.get).toHaveBeenCalledWith(
                '/Job/PODSearch',
                expect.objectContaining({
                    courierIds: [1, 2],
                    clientIds: [10],
                    speedIds: [100],
                    wild: 'wildcard',
                    job: 'JOB-001',
                    jobId: 42,
                    page: 0,
                    pageSize: 50,
                    sortColumn: 'jobNo',
                    sortDirection: 'desc',
                }),
                undefined,
            );
        });

        it('should format dates using formatDateForApiWithTzs', async () => {
            mockApiClient.get.mockResolvedValueOnce(createMockDto());
            const startDate = dayjs('2025-03-01');

            await fetchPodJobs(createBaseParams({startDate: startDate as any}));

            const calledParams = mockApiClient.get.mock.calls[0]![1]!;
            expect(calledParams.fromDate).toBe(`formatted-${startDate}`);
        });

        it('should transform DTO jobs via transformDispatchJobDTO', async () => {
            mockApiClient.get.mockResolvedValueOnce(createMockDto(2));

            const result = await fetchPodJobs(createBaseParams());

            expect(result.jobs).toHaveLength(2);
            expect(result.jobs[0]).toHaveProperty('_transformed', true);
            expect(result.totalCount).toBe(2);
            expect(result.hasMore).toBe(false);
        });

        it('should fall back to order/orderDirection when sortColumn/sortDirection not set', async () => {
            mockApiClient.get.mockResolvedValueOnce(createMockDto());

            await fetchPodJobs(createBaseParams({order: 'time', orderDirection: 'asc'}));

            const calledParams = mockApiClient.get.mock.calls[0]![1]!;
            expect(calledParams.sortColumn).toBe('time');
            expect(calledParams.sortDirection).toBe('asc');
        });

        it('should pass RequestOptions through', async () => {
            mockApiClient.get.mockResolvedValueOnce(createMockDto());
            const signal = new AbortController().signal;

            await fetchPodJobs(createBaseParams(), {signal});

            expect(mockApiClient.get).toHaveBeenCalledWith(
                '/Job/PODSearch',
                expect.any(Object),
                {signal},
            );
        });
    });

    // ── fetchBulkJobs ────────────────────────────────────────────────

    describe('fetchBulkJobs', () => {
        it('should call GET /Job/BulkSearch with correct params including bulkJobId', async () => {
            mockApiClient.get.mockResolvedValueOnce(createMockDto());

            await fetchBulkJobs(createBaseParams({
                courierIds: [5],
                clientIds: [20],
                speedIds: [200],
                job: 'BULK-001',
                wild: 'search',
                bulkJobId: 99,
            }));

            expect(mockApiClient.get).toHaveBeenCalledWith(
                '/Job/BulkSearch',
                expect.objectContaining({
                    courierIds: [5],
                    clientIds: [20],
                    speedIds: [200],
                    job: 'BULK-001',
                    wild: 'search',
                    bulkJobId: 99,
                    page: 0,
                    pageSize: 50,
                }),
                undefined,
            );
        });

        it('should omit bulkJobId when not provided', async () => {
            mockApiClient.get.mockResolvedValueOnce(createMockDto());

            await fetchBulkJobs(createBaseParams({
                courierIds: [5],
            }));

            const calledParams = mockApiClient.get.mock.calls[0]![1]!;
            expect(calledParams.bulkJobId).toBeUndefined();
        });

        it('should transform results', async () => {
            mockApiClient.get.mockResolvedValueOnce(createMockDto(3));

            const result = await fetchBulkJobs(createBaseParams());

            expect(result.jobs).toHaveLength(3);
            expect(result.totalCount).toBe(3);
        });
    });

    // ── fetchDispatchBulkJobDetail ───────────────────────────────────

    describe('fetchDispatchBulkJobDetail', () => {
        it('should GET /Job/DispatchBulkJobDetail with the bulkJobId and transform the result', async () => {
            mockApiClient.get.mockResolvedValueOnce({id: 7, jobNo: 'BULK-7'});

            const result = await fetchDispatchBulkJobDetail(7);

            expect(mockApiClient.get).toHaveBeenCalledWith(
                '/Job/DispatchBulkJobDetail',
                {bulkJobId: 7},
                undefined,
            );
            expect(result).toHaveProperty('_transformed', true);
            expect(result).toHaveProperty('jobNo', 'BULK-7');
        });
    });

    // ── fetchDispatchJobs ────────────────────────────────────────────

    describe('fetchDispatchJobs', () => {
        it('should call GET /job with correct params', async () => {
            mockApiClient.get.mockResolvedValueOnce(createMockDto());

            await fetchDispatchJobs(createBaseParams({
                useTime: true,
                isInternal: true,
                statusFilter: 'active',
                despatchViewIds: [1, 2, 3],
                startDate: dayjs('2025-02-01') as any,
                endDate: dayjs('2025-02-28') as any,
            }));

            expect(mockApiClient.get).toHaveBeenCalledWith(
                '/job',
                expect.objectContaining({
                    order: 'time',
                    orderDirection: 'asc',
                    useTime: true,
                    isInternal: true,
                    statusFilter: 'active',
                    despatchViewIds: [1, 2, 3],
                    page: 0,
                    pageSize: 50,
                    searchText: 'test',
                }),
                undefined,
            );
        });

        it('should use default order values', async () => {
            mockApiClient.get.mockResolvedValueOnce(createMockDto());

            await fetchDispatchJobs({page: 0, pageSize: 50});

            const calledParams = mockApiClient.get.mock.calls[0]![1]!;
            expect(calledParams.order).toBe('time');
            expect(calledParams.orderDirection).toBe('asc');
            expect(calledParams.searchText).toBe('');
        });
    });

    // ── fetchCurrentWorkJobs ─────────────────────────────────────────

    describe('fetchCurrentWorkJobs', () => {
        it('should call GET /job/GetCurrentWorkList with courierId and formatted dates', async () => {
            mockApiClient.get.mockResolvedValueOnce(createMockDto());

            await fetchCurrentWorkJobs(createBaseParams({
                courierId: 42,
                startDate: dayjs('2025-02-01') as any,
                endDate: dayjs('2025-02-28') as any,
            }));

            expect(mockApiClient.get).toHaveBeenCalledWith(
                '/job/GetCurrentWorkList',
                expect.objectContaining({
                    courierId: 42,
                    startDate: expect.stringContaining('formatted-'),
                    endDate: expect.stringContaining('formatted-'),
                }),
                undefined,
            );
        });

        it('transforms each returned job', async () => {
            mockApiClient.get.mockResolvedValueOnce(createMockDto(2));

            const result = await fetchCurrentWorkJobs(createBaseParams({courierId: 1}));

            expect(result.jobs).toHaveLength(2);
            expect((result.jobs[0] as any)._transformed).toBe(true);
        });
    });

    // ── fetchClearListJobs ───────────────────────────────────────────

    describe('fetchClearListJobs', () => {
        it('should call GET /job/GetJobsByClearListEnvelope with selectedClearListId', async () => {
            mockApiClient.get.mockResolvedValueOnce(createMockDto());

            await fetchClearListJobs(createBaseParams({
                selectedClearListId: 42,
                isInternal: true,
            }));

            expect(mockApiClient.get).toHaveBeenCalledWith(
                '/job/GetJobsByClearListEnvelope',
                expect.objectContaining({
                    selectedClearListId: 42,
                    isInternal: true,
                }),
                undefined,
            );
        });
    });

    // ── Nationwide Jobs ──────────────────────────────────────────────

    describe('fetchNationwideJobsNew', () => {
        it('should call GET /nationwidejob/nationwideJobListNew', async () => {
            mockApiClient.get.mockResolvedValueOnce(createMockDto());

            await fetchNationwideJobsNew(createBaseParams({
                isInternal: true,
                despatchViewIds: [1, 2],
                useTime: false,
                startDate: dayjs('2025-01-01') as any,
                endDate: dayjs('2025-01-31') as any,
            }));

            expect(mockApiClient.get).toHaveBeenCalledWith(
                '/nationwidejob/nationwideJobListNew',
                expect.objectContaining({
                    order: 'time',
                    orderDirection: 'asc',
                    isInternal: true,
                    despatchViewIds: [1, 2],
                    useTime: false,
                    page: 0,
                    pageSize: 50,
                    searchText: 'test',
                }),
                undefined,
            );
        });

        it('should format endDate as dateCutoff parameter', async () => {
            mockApiClient.get.mockResolvedValueOnce(createMockDto());
            const endDate = dayjs('2025-06-30');

            await fetchNationwideJobsNew(createBaseParams({endDate: endDate as any}));

            const calledParams = mockApiClient.get.mock.calls[0]![1]!;
            expect(calledParams.dateCutoff).toBe(`formatted-${endDate}`);
        });
    });

    describe('fetchNationwideJobsPod', () => {
        it('should call GET /nationwidejob/NationwideJobListPod', async () => {
            mockApiClient.get.mockResolvedValueOnce(createMockDto());

            await fetchNationwideJobsPod(createBaseParams());

            expect(mockApiClient.get).toHaveBeenCalledWith(
                '/nationwidejob/NationwideJobListPod',
                expect.any(Object),
                undefined,
            );
        });
    });

    describe('fetchNationwideJobsReprice', () => {
        it('should call GET /nationwidejob/nationwideJobListReprice', async () => {
            mockApiClient.get.mockResolvedValueOnce(createMockDto());

            await fetchNationwideJobsReprice(createBaseParams());

            expect(mockApiClient.get).toHaveBeenCalledWith(
                '/nationwidejob/nationwideJobListReprice',
                expect.any(Object),
                undefined,
            );
        });
    });

    // ── Shared behavior ──────────────────────────────────────────────

    describe('default parameter values', () => {
        it.each([
            ['fetchPodJobs', fetchPodJobs],
            ['fetchBulkJobs', fetchBulkJobs],
            ['fetchDispatchJobs', fetchDispatchJobs],
            ['fetchClearListJobs', fetchClearListJobs],
            ['fetchNationwideJobsNew', fetchNationwideJobsNew],
            ['fetchNationwideJobsPod', fetchNationwideJobsPod],
            ['fetchNationwideJobsReprice', fetchNationwideJobsReprice],
        ] as const)('%s should use default page=0 and pageSize=50', async (_name, fetchFn) => {
            mockApiClient.get.mockResolvedValueOnce(createMockDto());

            await fetchFn({});

            const calledParams = mockApiClient.get.mock.calls[0]![1]!;
            expect(calledParams.page).toBe(0);
            expect(calledParams.pageSize).toBe(50);
        });
    });

    describe('error handling', () => {
        it.each([
            ['fetchPodJobs', () => fetchPodJobs(createBaseParams())],
            ['fetchBulkJobs', () => fetchBulkJobs(createBaseParams())],
            ['fetchDispatchJobs', () => fetchDispatchJobs(createBaseParams())],
            ['fetchClearListJobs', () => fetchClearListJobs(createBaseParams())],
            ['fetchNationwideJobsNew', () => fetchNationwideJobsNew(createBaseParams())],
            ['fetchNationwideJobsPod', () => fetchNationwideJobsPod(createBaseParams())],
            ['fetchNationwideJobsReprice', () => fetchNationwideJobsReprice(createBaseParams())],
        ])('%s should propagate errors', async (_, apiCall) => {
            const error = createMockApiError();
            mockApiClient.get.mockRejectedValueOnce(error);
            await expect(apiCall()).rejects.toEqual(error);
        });
    });

    describe('empty results', () => {
        it('should handle empty job arrays', async () => {
            mockApiClient.get.mockResolvedValueOnce({jobs: [], totalCount: 0, hasMore: false});

            const result = await fetchDispatchJobs(createBaseParams());

            expect(result.jobs).toEqual([]);
            expect(result.totalCount).toBe(0);
            expect(result.hasMore).toBe(false);
        });
    });

    describe('date formatting', () => {
        it('should omit date params when not provided', async () => {
            mockApiClient.get.mockResolvedValueOnce(createMockDto());

            await fetchDispatchJobs(createBaseParams({startDate: undefined, endDate: undefined}));

            const calledParams = mockApiClient.get.mock.calls[0]![1]!;
            expect(calledParams.startDate).toBeUndefined();
            expect(calledParams.endDate).toBeUndefined();
        });
    });
});
