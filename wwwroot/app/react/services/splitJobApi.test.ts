/**
 * Split Job API Service Tests
 */

import {
    splitJobApi,
    splitJob,
    updateSplitJobAddress,
    reRateSplitJob,
    finishSplitJobProcess,
    restoreSplitJobs,
    unSplitJob,
} from './splitJobApi';
import {apiClient} from './apiClient';
import {createMockApiError} from '../__testUtils__';

jest.mock('./apiClient', () => ({
    apiClient: {
        get: jest.fn(),
        post: jest.fn(),
    },
}));

const mockApiClient = apiClient as jest.Mocked<typeof apiClient>;

describe('splitJobApi', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('splitJob', () => {
        it('should call apiClient.post with correct URL and job ID', async () => {
            mockApiClient.post.mockResolvedValueOnce(undefined);
            await splitJob(123);
            expect(mockApiClient.post).toHaveBeenCalledWith('job/splitJob', {jobId: 123});
        });
    });

    describe('updateSplitJobAddress', () => {
        it('should call apiClient.post with correct URL and parameters', async () => {
            mockApiClient.post.mockResolvedValueOnce(undefined);
            await updateSplitJobAddress(123, 456, '123 Main St', -36.8485, 174.7633);
            expect(mockApiClient.post).toHaveBeenCalledWith(
                'job/UpdateSplitJobAddress',
                null,
                {
                    params: {
                        jobId: 123,
                        toSuburbId: 456,
                        address: '123 Main St',
                        deliveryLat: -36.8485,
                        deliveryLng: 174.7633,
                    },
                }
            );
        });
    });

    describe('reRateSplitJob', () => {
        it('should call apiClient.post with correct URL and job ID', async () => {
            mockApiClient.post.mockResolvedValueOnce(undefined);
            await reRateSplitJob(123);
            expect(mockApiClient.post).toHaveBeenCalledWith('job/ReRateSplitJob', {jobId: 123});
        });
    });

    describe('finishSplitJobProcess', () => {
        it('should call apiClient.post with correct URL and job ID', async () => {
            mockApiClient.post.mockResolvedValueOnce(undefined);
            await finishSplitJobProcess(123);
            expect(mockApiClient.post).toHaveBeenCalledWith('job/finishSplitJobProcess', {jobId: 123});
        });
    });

    describe('restoreSplitJobs', () => {
        it('should call apiClient.post with correct URL and job IDs', async () => {
            mockApiClient.post.mockResolvedValueOnce(undefined);
            await restoreSplitJobs([123, 124, 125]);
            expect(mockApiClient.post).toHaveBeenCalledWith(
                'job/RestoreSplitJobs',
                null,
                {params: {jobIds: [123, 124, 125]}}
            );
        });
    });

    describe('unSplitJob', () => {
        it('should call apiClient.post and return message', async () => {
            const expectedMessage = 'Job unsplit successfully';
            mockApiClient.post.mockResolvedValueOnce(expectedMessage);
            const result = await unSplitJob(123);
            expect(mockApiClient.post).toHaveBeenCalledWith('job/UnSplitJob', null, {params: {jobId: 123}});
            expect(result).toBe(expectedMessage);
        });
    });

    describe('error handling', () => {
        it.each([
            ['splitJob', () => splitJob(123)],
            ['updateSplitJobAddress', () => updateSplitJobAddress(123, 456, 'Test', 0, 0)],
            ['reRateSplitJob', () => reRateSplitJob(123)],
            ['finishSplitJobProcess', () => finishSplitJobProcess(123)],
            ['restoreSplitJobs', () => restoreSplitJobs([123])],
            ['unSplitJob', () => unSplitJob(123)],
        ])('%s should propagate errors', async (_, apiCall) => {
            const error = createMockApiError();
            mockApiClient.post.mockRejectedValueOnce(error);
            await expect(apiCall()).rejects.toEqual(error);
        });
    });

    describe('splitJobApi object', () => {
        it('should export all functions', () => {
            expect(splitJobApi.splitJob).toBe(splitJob);
            expect(splitJobApi.updateSplitJobAddress).toBe(updateSplitJobAddress);
            expect(splitJobApi.reRateSplitJob).toBe(reRateSplitJob);
            expect(splitJobApi.finishSplitJobProcess).toBe(finishSplitJobProcess);
            expect(splitJobApi.restoreSplitJobs).toBe(restoreSplitJobs);
            expect(splitJobApi.unSplitJob).toBe(unSplitJob);
        });
    });
});
