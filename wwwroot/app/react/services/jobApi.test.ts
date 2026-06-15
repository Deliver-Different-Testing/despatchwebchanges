/** @jest-environment node */
/**
 * Job API Service Tests
 */

import {
    jobApi,
    getRelatedJobsMultiSelectList,
    voidJob,
    voidBulkJob,
    quickCreateJob,
    searchActiveClients,
    getVehicleSizes,
    allocateJobToCourier,
    validateSwapPod,
    swapPod,
} from './jobApi';
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
                {jobId: 123, isArchived: false, isBulkJob: false},
                undefined
            );
            expect(result).toEqual(mockResponse);
        });

        it('should pass isArchived true when job is archived', async () => {
            mockApiClient.get.mockResolvedValueOnce([]);

            await getRelatedJobsMultiSelectList(456, true);

            expect(mockApiClient.get).toHaveBeenCalledWith(
                'job/GetRelatedJobsMultiSelectList',
                {jobId: 456, isArchived: true, isBulkJob: false},
                undefined
            );
        });

        it('should pass isBulkJob true for bulk jobs', async () => {
            mockApiClient.get.mockResolvedValueOnce([]);

            await getRelatedJobsMultiSelectList(789, false, true);

            expect(mockApiClient.get).toHaveBeenCalledWith(
                'job/GetRelatedJobsMultiSelectList',
                {jobId: 789, isArchived: false, isBulkJob: true},
                undefined
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

    describe('quickCreateJob', () => {
        it('should call apiClient.post with correct URL and job data', async () => {
            const mockJob = {
                clientId: 10,
                deliverToContact: 'Jane',
                podName: 'Pod1',
                pickUpAddress: {} as any,
                deliveryAddress: {} as any,
                date: '2026-03-05T00:00:00-05:00',
                fromContactName: 'John',
                refA: 'REF-A',
                refB: '',
                deliveryNotes: '',
                pickupNotes: '',
                jobNotes: '',
                van: false,
                truck: false,
                pedal: false,
                attention: false,
                vanOk: false,
                reprice: false,
                void: false,
                done: false,
                charge: 50.0,
                fromLat: 40.7128,
                fromLong: -74.006,
                toLat: 34.0522,
                toLong: -118.2437,
                speedId: 1,
                vehicleId: 2,
                weightKg: null,
                weightLb: null,
            };
            mockApiClient.post.mockResolvedValueOnce(999);

            const result = await quickCreateJob(mockJob);

            expect(mockApiClient.post).toHaveBeenCalledWith('job/QuickCreateJob', mockJob);
            expect(result).toBe(999);
        });
    });

    describe('searchActiveClients', () => {
        it('should call apiClient.get with correct URL and search text', async () => {
            const mockClients = [
                {id: 1, text: 'Acme Corp'},
                {id: 2, text: 'Acme Industries'},
            ];
            mockApiClient.get.mockResolvedValueOnce(mockClients);

            const result = await searchActiveClients('Acme');

            expect(mockApiClient.get).toHaveBeenCalledWith('home/ActiveClients', {searchTerm: 'Acme'}, undefined);
            expect(result).toEqual(mockClients);
        });

        it('should return empty array when no clients match', async () => {
            mockApiClient.get.mockResolvedValueOnce([]);

            const result = await searchActiveClients('NonexistentClient');

            expect(result).toEqual([]);
        });
    });

    describe('getVehicleSizes', () => {
        it('should call apiClient.get with correct URL', async () => {
            const mockVehicles = [
                {id: 1, text: 'Car'},
                {id: 2, text: 'Van'},
                {id: 3, text: 'Truck'},
            ];
            mockApiClient.get.mockResolvedValueOnce(mockVehicles);

            const result = await getVehicleSizes();

            expect(mockApiClient.get).toHaveBeenCalledWith('courier/GetVehicleSizes', undefined, undefined);
            expect(result).toEqual(mockVehicles);
        });
    });

    describe('allocateJobToCourier', () => {
        it('should call apiClient.post with correct URL and allocation data', async () => {
            mockApiClient.post.mockResolvedValueOnce(undefined);

            await allocateJobToCourier(42, [999]);

            expect(mockApiClient.post).toHaveBeenCalledWith('job/Allocate', {
                courierId: 42,
                jobIds: [999],
            });
        });

        it('should support allocating multiple jobs', async () => {
            mockApiClient.post.mockResolvedValueOnce(undefined);

            await allocateJobToCourier(42, [100, 101, 102]);

            expect(mockApiClient.post).toHaveBeenCalledWith('job/Allocate', {
                courierId: 42,
                jobIds: [100, 101, 102],
            });
        });
    });

    describe('validateSwapPod', () => {
        it('should call apiClient.get with correct URL and job param', async () => {
            mockApiClient.get.mockResolvedValueOnce(true);

            const result = await validateSwapPod('JOB-002');

            expect(mockApiClient.get).toHaveBeenCalledWith('Job/ValidateSwapPod', {job: 'JOB-002'}, undefined);
            expect(result).toBe(true);
        });

        it('should return false when the job is not eligible', async () => {
            mockApiClient.get.mockResolvedValueOnce(false);

            const result = await validateSwapPod('INELIGIBLE-JOB');

            expect(result).toBe(false);
        });
    });

    describe('swapPod', () => {
        it('should call apiClient.post with correct URL and body', async () => {
            mockApiClient.post.mockResolvedValueOnce(undefined);

            await swapPod('JOB-001', 'JOB-002');

            expect(mockApiClient.post).toHaveBeenCalledWith('Job/SwapPod', {
                job1: 'JOB-001',
                job2: 'JOB-002',
            });
        });

        it('should pass both job numbers in the correct order', async () => {
            mockApiClient.post.mockResolvedValueOnce(undefined);

            await swapPod('ABC-100', 'XYZ-200');

            const callArgs = mockApiClient.post.mock.calls[0];
            expect(callArgs[1]).toEqual({job1: 'ABC-100', job2: 'XYZ-200'});
        });
    });

    describe('Error propagation', () => {
        it.each([
            ['getRelatedJobsMultiSelectList', () => getRelatedJobsMultiSelectList(123, false), mockApiClient.get],
            ['voidJob', () => voidJob({jobId: 123, voidSingleJobOnly: true, voidReason: 'Test'}), mockApiClient.post],
            ['voidBulkJob', () => voidBulkJob({bulkJobId: 456, voidSingleJobOnly: true, voidReason: 'Test'}), mockApiClient.post],
            ['quickCreateJob', () => quickCreateJob({clientId: 1} as any), mockApiClient.post],
            ['searchActiveClients', () => searchActiveClients('test'), mockApiClient.get],
            ['getVehicleSizes', () => getVehicleSizes(), mockApiClient.get],
            ['allocateJobToCourier', () => allocateJobToCourier(1, [1]), mockApiClient.post],
            ['validateSwapPod', () => validateSwapPod('JOB-001'), mockApiClient.get],
            ['swapPod', () => swapPod('JOB-001', 'JOB-002'), mockApiClient.post],
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
            expect(jobApi.quickCreateJob).toBe(quickCreateJob);
            expect(jobApi.searchActiveClients).toBe(searchActiveClients);
            expect(jobApi.getVehicleSizes).toBe(getVehicleSizes);
            expect(jobApi.allocateJobToCourier).toBe(allocateJobToCourier);
            expect(jobApi.validateSwapPod).toBe(validateSwapPod);
            expect(jobApi.swapPod).toBe(swapPod);
        });
    });
});
