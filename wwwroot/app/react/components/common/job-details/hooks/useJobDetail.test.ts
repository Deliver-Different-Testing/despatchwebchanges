/**
 * useJobDetail Hook Tests
 */

import {renderHook, waitFor, act} from '@testing-library/react';
import {QueryClient} from '@tanstack/react-query';
import {useJobDetail} from './useJobDetail';
import {createTestQueryClient, createWrapper, suppressConsoleError} from '../../../../__testUtils__';

// Mock API services
jest.mock('../../../../services/jobDetailApi', () => ({
    getJobDetail: jest.fn(),
    getRecurringJobDetail: jest.fn(),
    getBulkJobDetail: jest.fn(),
}));

jest.mock('../../../../../functions/dtoMappings', () => ({
    transformJobGroupDTO: jest.fn(),
}));

jest.mock('../../../../utils/dateUtils', () => ({
    isUsCustomer: jest.fn(),
}));

import {getJobDetail, getRecurringJobDetail, getBulkJobDetail} from '../../../../services/jobDetailApi';
import {transformJobGroupDTO} from '../../../../../functions/dtoMappings';
import {isUsCustomer} from '../../../../utils/dateUtils';

const mockGetJobDetail = getJobDetail as jest.MockedFunction<typeof getJobDetail>;
const mockGetRecurringJobDetail = getRecurringJobDetail as jest.MockedFunction<typeof getRecurringJobDetail>;
const mockGetBulkJobDetail = getBulkJobDetail as jest.MockedFunction<typeof getBulkJobDetail>;
const mockTransformJobGroupDTO = transformJobGroupDTO as jest.MockedFunction<typeof transformJobGroupDTO>;
const mockIsUsCustomer = isUsCustomer as jest.MockedFunction<typeof isUsCustomer>;

// ── Test Helpers ──────────────────────────────────────────────────────

function createMockJobGroup(jobNo = 'J100', relatedJobNos: string[] = []) {
    return {
        job: {id: 1, jobNo, isBulkJob: false} as any,
        relatedJobs: relatedJobNos.map((no, i) => ({id: i + 10, jobNo: no, isBulkJob: false} as any)),
    };
}

const mockDto = {some: 'dto'};

// ── Tests ─────────────────────────────────────────────────────────────

describe('useJobDetail', () => {
    let queryClient: QueryClient;
    let errorSpy: jest.SpyInstance;

    beforeEach(() => {
        queryClient = createTestQueryClient();
        jest.clearAllMocks();
        mockIsUsCustomer.mockReturnValue(false);
        errorSpy = suppressConsoleError();
    });

    afterEach(() => {
        errorSpy.mockRestore();
    });

    it('calls getJobDetail for standard jobs and transforms DTO with isUs flag', async () => {
        const mockGroup = createMockJobGroup();
        mockGetJobDetail.mockResolvedValueOnce(mockDto as any);
        mockTransformJobGroupDTO.mockReturnValueOnce(mockGroup as any);
        mockIsUsCustomer.mockReturnValue(true);

        const wrapper = createWrapper({withTheme: false, withQueryClient: true, queryClient});
        const {result} = renderHook(
            () => useJobDetail({jobId: 1, isRecurringJob: false, isBulkJob: false}),
            {wrapper},
        );

        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(mockGetJobDetail).toHaveBeenCalledWith(1, expect.objectContaining({signal: expect.any(AbortSignal)}));
        expect(mockGetRecurringJobDetail).not.toHaveBeenCalled();
        expect(mockGetBulkJobDetail).not.toHaveBeenCalled();
        expect(mockTransformJobGroupDTO).toHaveBeenCalledWith(mockDto, true);
        expect(result.current.job).toEqual(mockGroup.job);
    });

    it('calls getRecurringJobDetail for recurring jobs', async () => {
        const mockGroup = createMockJobGroup();
        mockGetRecurringJobDetail.mockResolvedValueOnce(mockDto as any);
        mockTransformJobGroupDTO.mockReturnValueOnce(mockGroup as any);

        const wrapper = createWrapper({withTheme: false, withQueryClient: true, queryClient});
        const {result} = renderHook(
            () => useJobDetail({jobId: 5, isRecurringJob: true, isBulkJob: false}),
            {wrapper},
        );

        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(mockGetRecurringJobDetail).toHaveBeenCalledWith(5, expect.objectContaining({signal: expect.any(AbortSignal)}));
        expect(mockGetJobDetail).not.toHaveBeenCalled();
        expect(mockGetBulkJobDetail).not.toHaveBeenCalled();
    });

    it('calls getBulkJobDetail for bulk jobs', async () => {
        const mockGroup = createMockJobGroup();
        mockGetBulkJobDetail.mockResolvedValueOnce(mockDto as any);
        mockTransformJobGroupDTO.mockReturnValueOnce(mockGroup as any);

        const wrapper = createWrapper({withTheme: false, withQueryClient: true, queryClient});
        const {result} = renderHook(
            () => useJobDetail({jobId: 10, isRecurringJob: false, isBulkJob: true}),
            {wrapper},
        );

        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(mockGetBulkJobDetail).toHaveBeenCalledWith(10, expect.objectContaining({signal: expect.any(AbortSignal)}));
        expect(mockGetJobDetail).not.toHaveBeenCalled();
        expect(mockGetRecurringJobDetail).not.toHaveBeenCalled();
    });

    it('does not fetch when jobId <= 0', async () => {
        const wrapper = createWrapper({withTheme: false, withQueryClient: true, queryClient});
        const {result} = renderHook(
            () => useJobDetail({jobId: 0, isRecurringJob: false, isBulkJob: false}),
            {wrapper},
        );

        // Flush microtasks to ensure no fetch fires
        await act(async () => {});

        expect(mockGetJobDetail).not.toHaveBeenCalled();
        expect(result.current.jobGroup).toBeUndefined();
        expect(result.current.sortedRelatedJobs).toEqual([]);
    });

    it('does not fetch when enabled is false', async () => {
        const wrapper = createWrapper({withTheme: false, withQueryClient: true, queryClient});
        const {result} = renderHook(
            () => useJobDetail({jobId: 1, isRecurringJob: false, isBulkJob: false, enabled: false}),
            {wrapper},
        );

        await act(async () => {});

        expect(mockGetJobDetail).not.toHaveBeenCalled();
        expect(result.current.jobGroup).toBeUndefined();
    });

    it('returns related jobs in chain order: parent first, then non-leg children lex-sorted', async () => {
        // Parent J10 (id=1) is jobGroup.job, the rest are children with
        // no LHP/LH[0-9]/DEL suffix so they fall into bucket [4, 0, num]
        // and get lex-sorted by jobNo within that bucket. The parent
        // ALWAYS comes first regardless of jobNo because bucket 0 is
        // reserved for `job.id === parentId`.
        const mockGroup = createMockJobGroup('J10', ['J2', 'J20', 'J1']);
        mockGetJobDetail.mockResolvedValueOnce(mockDto as any);
        mockTransformJobGroupDTO.mockReturnValueOnce(mockGroup as any);

        const wrapper = createWrapper({withTheme: false, withQueryClient: true, queryClient});
        const {result} = renderHook(
            () => useJobDetail({jobId: 1, isRecurringJob: false, isBulkJob: false}),
            {wrapper},
        );

        await waitFor(() => expect(result.current.isLoading).toBe(false));

        const jobNos = result.current.sortedRelatedJobs.map(j => j.jobNo);
        expect(jobNos).toEqual(['J10', 'J1', 'J2', 'J20']);
    });

    it('sorts safely when jobNo is null (e.g. recurring job templates)', async () => {
        const mockGroup = {
            job: {id: 1, jobNo: null, isBulkJob: false} as any,
            relatedJobs: [
                {id: 2, jobNo: 'J2', isBulkJob: false} as any,
                {id: 3, jobNo: null, isBulkJob: false} as any,
                {id: 4, jobNo: 'J1', isBulkJob: false} as any,
            ],
        };
        mockGetRecurringJobDetail.mockResolvedValueOnce(mockDto as any);
        mockTransformJobGroupDTO.mockReturnValueOnce(mockGroup as any);

        const wrapper = createWrapper({withTheme: false, withQueryClient: true, queryClient});
        const {result} = renderHook(
            () => useJobDetail({jobId: 1, isRecurringJob: true, isBulkJob: false}),
            {wrapper},
        );

        await waitFor(() => expect(result.current.isLoading).toBe(false));

        // Should not throw, and nulls should sort before non-null values.
        const jobNos = result.current.sortedRelatedJobs.map(j => j.jobNo);
        expect(jobNos).toEqual([null, null, 'J1', 'J2']);
    });

    it('returns error state when API call fails', async () => {
        mockGetJobDetail.mockRejectedValueOnce(new Error('Network error'));

        const wrapper = createWrapper({withTheme: false, withQueryClient: true, queryClient});
        const {result} = renderHook(
            () => useJobDetail({jobId: 1, isRecurringJob: false, isBulkJob: false}),
            {wrapper},
        );

        await waitFor(() => expect(result.current.isError).toBe(true));

        expect(result.current.error).toBeInstanceOf(Error);
        expect(result.current.jobGroup).toBeUndefined();
    });

    it('returns loading state initially while fetching', () => {
        mockGetJobDetail.mockReturnValue(new Promise(() => {}));

        const wrapper = createWrapper({withTheme: false, withQueryClient: true, queryClient});
        const {result} = renderHook(
            () => useJobDetail({jobId: 1, isRecurringJob: false, isBulkJob: false}),
            {wrapper},
        );

        expect(result.current.isLoading).toBe(true);
        expect(result.current.isFetching).toBe(true);
        expect(result.current.jobGroup).toBeUndefined();
    });

    it('exposes isFetching as false after data loads', async () => {
        const mockGroup = createMockJobGroup();
        mockGetJobDetail.mockResolvedValueOnce(mockDto as any);
        mockTransformJobGroupDTO.mockReturnValueOnce(mockGroup as any);

        const wrapper = createWrapper({withTheme: false, withQueryClient: true, queryClient});
        const {result} = renderHook(
            () => useJobDetail({jobId: 1, isRecurringJob: false, isBulkJob: false}),
            {wrapper},
        );

        // Initially fetching
        expect(result.current.isFetching).toBe(true);

        // After load completes, isFetching should be false
        await waitFor(() => expect(result.current.isFetching).toBe(false));
        expect(result.current.isLoading).toBe(false);
        expect(result.current.job).toBeDefined();
    });
});
