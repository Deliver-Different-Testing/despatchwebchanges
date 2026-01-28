/**
 * Split Job API Service Tests
 */

import {
    splitJobApi,
    splitJob,
    restoreSplitJobs,
    unSplitJob,
    SplitJobRequest,
} from './splitJobApi';
import {apiClient} from './apiClient';
import {createMockApiError} from '../__testUtils__';
import {AddressViewModel} from '../interfaces';

jest.mock('./apiClient', () => ({
    apiClient: {
        get: jest.fn(),
        post: jest.fn(),
    },
}));

const mockApiClient = apiClient as jest.Mocked<typeof apiClient>;

const createMockAddress = (): AddressViewModel => ({
    addressLine1: '123 Main St',
    addressLine2: '',
    addressLine3: '',
    addressLine4: '',
    addressLine5: 'Auckland',
    addressLine6: '',
    addressLine7: '1010',
    addressLine8: '',
    latitude: -36.8485,
    longitude: 174.7633,
    fullAddress: '123 Main St, Auckland, 1010',
    toSuburbId: 456,
});

describe('splitJobApi', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('splitJob', () => {
        it('should call apiClient.post with correct URL and request body', async () => {
            mockApiClient.post.mockResolvedValueOnce(undefined);
            const request: SplitJobRequest = {
                jobId: 123,
                meetingPointAddress: createMockAddress(),
            };
            await splitJob(request);
            expect(mockApiClient.post).toHaveBeenCalledWith('job/splitJob', request);
        });

        it('should not include meetingPointSuburbId in request', async () => {
            mockApiClient.post.mockResolvedValueOnce(undefined);
            const request: SplitJobRequest = {
                jobId: 123,
                meetingPointAddress: createMockAddress(),
            };
            await splitJob(request);

            // Verify the request doesn't have meetingPointSuburbId property
            const calledWith = mockApiClient.post.mock.calls[0][1] as SplitJobRequest;
            expect(calledWith).not.toHaveProperty('meetingPointSuburbId');
            expect(Object.keys(calledWith)).toEqual(['jobId', 'meetingPointAddress']);
        });

        it('should work with address that has no toSuburbId', async () => {
            mockApiClient.post.mockResolvedValueOnce(undefined);
            const addressWithoutSuburbId: AddressViewModel = {
                addressLine1: '456 New St',
                addressLine2: '',
                addressLine3: '',
                addressLine4: '',
                addressLine5: 'Wellington',
                addressLine6: '',
                addressLine7: '6011',
                addressLine8: '',
                latitude: -41.2865,
                longitude: 174.7762,
                fullAddress: '456 New St, Wellington, 6011',
                // toSuburbId intentionally omitted
            };
            const request: SplitJobRequest = {
                jobId: 456,
                meetingPointAddress: addressWithoutSuburbId,
            };
            await splitJob(request);
            expect(mockApiClient.post).toHaveBeenCalledWith('job/splitJob', request);
        });

        it('should include all address fields in request', async () => {
            mockApiClient.post.mockResolvedValueOnce(undefined);
            const address = createMockAddress();
            const request: SplitJobRequest = {
                jobId: 789,
                meetingPointAddress: address,
            };
            await splitJob(request);

            const calledWith = mockApiClient.post.mock.calls[0][1] as SplitJobRequest;
            expect(calledWith.meetingPointAddress.addressLine1).toBe(address.addressLine1);
            expect(calledWith.meetingPointAddress.addressLine5).toBe(address.addressLine5);
            expect(calledWith.meetingPointAddress.addressLine7).toBe(address.addressLine7);
            expect(calledWith.meetingPointAddress.latitude).toBe(address.latitude);
            expect(calledWith.meetingPointAddress.longitude).toBe(address.longitude);
            expect(calledWith.meetingPointAddress.fullAddress).toBe(address.fullAddress);
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
            ['splitJob', () => splitJob({jobId: 123, meetingPointAddress: createMockAddress()})],
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
            expect(splitJobApi.restoreSplitJobs).toBe(restoreSplitJobs);
            expect(splitJobApi.unSplitJob).toBe(unSplitJob);
        });
    });
});
