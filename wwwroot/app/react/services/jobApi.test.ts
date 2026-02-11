/**
 * Job API Service Tests
 */

import {jobApi, getRelatedJobsMultiSelectList, voidJob, voidBulkJob} from './jobApi';
import {apiClient} from './apiClient';
import {createMockApiError} from '../__testUtils__';

// Mock the apiClient
jest.mock('./apiClient', () => ({
    apiClient: {
        get: jest.fn(),
        post: jest.fn(),
    },
}));

const mockApiClient = apiClient as jest.Mocked<typeof apiClient>;

describe('jobApi', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('getRelatedJobsMultiSelectList', () => {
        it('should call apiClient.get with correct URL and params', async () => {
            const mockResponse = [
                {id: 1, text: 'Job 1', selected: true},
                {id: 2, text: 'Job 2', selected: false},
            ];
            mockApiClient.get.mockResolvedValueOnce(mockResponse);

            const result = await getRelatedJobsMultiSelectList(123, false);

            expect(mockApiClient.get).toHaveBeenCalledWith(
                'job/GetRelatedJobsMultiSelectList',
                {jobId: 123, isArchived: false, isBulkJob: false}
            );
            expect(result).toEqual(mockResponse);
        });

        it('should pass isArchived true when job is archived', async () => {
            mockApiClient.get.mockResolvedValueOnce([]);

            await getRelatedJobsMultiSelectList(456, true);

            expect(mockApiClient.get).toHaveBeenCalledWith(
                'job/GetRelatedJobsMultiSelectList',
                {jobId: 456, isArchived: true, isBulkJob: false}
            );
        });

        it('should pass isBulkJob true for bulk jobs', async () => {
            mockApiClient.get.mockResolvedValueOnce([]);

            await getRelatedJobsMultiSelectList(789, false, true);

            expect(mockApiClient.get).toHaveBeenCalledWith(
                'job/GetRelatedJobsMultiSelectList',
                {jobId: 789, isArchived: false, isBulkJob: true}
            );
        });

    });

    describe('voidJob', () => {
        it('should call apiClient.post with correct URL and request body', async () => {
            mockApiClient.post.mockResolvedValueOnce(undefined);

            await voidJob({
                jobId: 123,
                voidSingleJobOnly: true,
                voidReason: 'Customer requested cancellation',
            });

            expect(mockApiClient.post).toHaveBeenCalledWith('job/Void', {
                jobId: 123,
                voidSingleJobOnly: true,
                voidReason: 'Customer requested cancellation',
            });
        });

        it('should include selectedJobIds when voiding multiple jobs', async () => {
            mockApiClient.post.mockResolvedValueOnce(undefined);

            await voidJob({
                jobId: 123,
                voidSingleJobOnly: false,
                voidReason: 'Bulk cancellation',
                selectedJobIds: [123, 124, 125],
            });

            expect(mockApiClient.post).toHaveBeenCalledWith('job/Void', {
                jobId: 123,
                voidSingleJobOnly: false,
                voidReason: 'Bulk cancellation',
                selectedJobIds: [123, 124, 125],
            });
        });
    });

    describe('voidBulkJob', () => {
        it('should call apiClient.post with correct URL and request body', async () => {
            mockApiClient.post.mockResolvedValueOnce(undefined);

            await voidBulkJob({
                bulkJobId: 456,
                voidSingleJobOnly: true,
                voidReason: 'Bulk job cancellation',
            });

            expect(mockApiClient.post).toHaveBeenCalledWith('job/VoidBulkJob', {
                bulkJobId: 456,
                voidSingleJobOnly: true,
                voidReason: 'Bulk job cancellation',
            });
        });

        it('should include selectedJobIds when voiding multiple related jobs', async () => {
            mockApiClient.post.mockResolvedValueOnce(undefined);

            await voidBulkJob({
                bulkJobId: 456,
                voidSingleJobOnly: false,
                voidReason: 'Cancelling bulk and related',
                selectedJobIds: [456, 457, 458],
            });

            expect(mockApiClient.post).toHaveBeenCalledWith('job/VoidBulkJob', {
                bulkJobId: 456,
                voidSingleJobOnly: false,
                voidReason: 'Cancelling bulk and related',
                selectedJobIds: [456, 457, 458],
            });
        });
    });

    describe('Error propagation', () => {
        it.each([
            ['getRelatedJobsMultiSelectList', () => getRelatedJobsMultiSelectList(123, false), mockApiClient.get],
            ['voidJob', () => voidJob({jobId: 123, voidSingleJobOnly: true, voidReason: 'Test'}), mockApiClient.post],
            ['voidBulkJob', () => voidBulkJob({bulkJobId: 456, voidSingleJobOnly: true, voidReason: 'Test'}), mockApiClient.post],
        ])('%s should propagate errors from apiClient', async (_, apiCall, mockFn) => {
            const error = createMockApiError();
            mockFn.mockRejectedValueOnce(error);
            await expect(apiCall()).rejects.toEqual(error);
        });
    });

    describe('jobApi object', () => {
        it('should export all functions', () => {
            expect(jobApi.getRelatedJobsMultiSelectList).toBe(getRelatedJobsMultiSelectList);
            expect(jobApi.voidJob).toBe(voidJob);
            expect(jobApi.voidBulkJob).toBe(voidBulkJob);
        });
    });
});
