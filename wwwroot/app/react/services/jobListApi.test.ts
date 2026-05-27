/** @jest-environment node */
/**
 * jobListApi Tests
 *
 * Tests the job list API service functions for context menu actions.
 */

import {
    updateJobReadStatus,
    bulkUpdateReadStatus,
    restoreNationwideJob,
    updateJobDetail,
    lateCall,
    reAllocateJobs,
    restoreJobs,
    setFirstJob,
    releaseBulkJob,
    splitJob,
    getSplitJobStatus,
    getEventGroups,
    markJobMissing,
    moveJobToReprice,
    getActivePartnerOptions,
    sendToPartner,
} from './jobListApi';
import {apiClient} from './apiClient';

jest.mock('./apiClient', () => ({
    apiClient: {
        get: jest.fn(),
        post: jest.fn(),
    },
}));

const mockedGet = apiClient.get as jest.Mock;
const mockedPost = apiClient.post as jest.Mock;

describe('jobListApi', () => {
    beforeEach(() => {
        mockedPost.mockResolvedValue(undefined);
        mockedGet.mockResolvedValue([]);
    });

    describe('updateJobReadStatus', () => {
        it('posts to correct endpoint with params', async () => {
            await updateJobReadStatus(123, true);

            expect(mockedPost).toHaveBeenCalledWith('job/UpdateJobReadStatus', null, {
                params: {jobId: 123, hasBeenRead: true},
            });
        });
    });

    describe('bulkUpdateReadStatus', () => {
        it('posts job IDs and mark-as-read flag', async () => {
            await bulkUpdateReadStatus([1, 2, 3], true);

            expect(mockedPost).toHaveBeenCalledWith('job/BulkUpdateReadStatus', {
                jobIds: [1, 2, 3],
                shouldMarkAsRead: true,
            });
        });
    });

    describe('restoreNationwideJob', () => {
        it('posts with jobId', async () => {
            await restoreNationwideJob(99);

            expect(mockedPost).toHaveBeenCalledWith('nationwideJob/RestoreJob', {jobId: 99});
        });
    });

    describe('updateJobDetail', () => {
        it('posts to UpdateJob for regular jobs', async () => {
            await updateJobDetail(1, 'Status', 5);

            expect(mockedPost).toHaveBeenCalledWith('job/UpdateJob', null, {
                params: {jobId: 1, field: 'Status', value: 5, isRecurring: false},
            });
        });

        it('posts to UpdateRecurringJob when isRecurring is true', async () => {
            await updateJobDetail(1, 'Status', 5, true);

            expect(mockedPost).toHaveBeenCalledWith('job/UpdateRecurringJob', null, {
                params: {jobId: 1, field: 'Status', value: 5, isRecurring: true},
            });
        });
    });

    describe('lateCall', () => {
        it('posts late call request', async () => {
            const request = {jobId: 1, lateType: 1, lateTime: 30, calculationRequired: true};
            await lateCall(request);

            expect(mockedPost).toHaveBeenCalledWith('job/LateCall', request);
        });
    });

    describe('reAllocateJobs', () => {
        it('posts courier and job IDs', async () => {
            await reAllocateJobs(10, [1, 2]);

            expect(mockedPost).toHaveBeenCalledWith('job/ReAllocate', {courierId: 10, jobIds: [1, 2]});
        });
    });

    describe('restoreJobs', () => {
        it('posts job IDs', async () => {
            await restoreJobs([5, 6]);

            expect(mockedPost).toHaveBeenCalledWith('job/RestoreJobs', {jobIds: [5, 6]});
        });
    });

    describe('setFirstJob', () => {
        it('posts with jobId and courierId params', async () => {
            await setFirstJob(1, 10);

            expect(mockedPost).toHaveBeenCalledWith('job/SetFirstJob', null, {
                params: {jobId: 1, courierId: 10},
            });
        });
    });

    describe('releaseBulkJob', () => {
        it('posts with bulkJobId param', async () => {
            await releaseBulkJob(77);

            expect(mockedPost).toHaveBeenCalledWith('job/ReleaseBulkJob', null, {
                params: {bulkJobId: 77},
            });
        });
    });

    describe('splitJob', () => {
        it('posts split job request and returns taskId', async () => {
            mockedPost.mockResolvedValue({taskId: 'task-123'});

            const result = await splitJob(1, {address: 'test'});

            expect(mockedPost).toHaveBeenCalledWith('job/splitJob', {
                jobId: 1,
                meetingPointAddress: {address: 'test'},
            });
            expect(result).toEqual({taskId: 'task-123'});
        });
    });

    describe('getSplitJobStatus', () => {
        it('gets split job status by taskId', async () => {
            mockedGet.mockResolvedValue({status: 'completed', errorMessage: null});

            const result = await getSplitJobStatus('task-123');

            expect(mockedGet).toHaveBeenCalledWith('job/splitJobStatus', {taskId: 'task-123'});
            expect(result).toEqual({status: 'completed', errorMessage: null});
        });
    });

    describe('getEventGroups', () => {
        it('gets event groups list', async () => {
            mockedGet.mockResolvedValue([{id: 1, text: 'Group A'}]);

            const result = await getEventGroups();

            expect(mockedGet).toHaveBeenCalledWith('task/GetEventGroups');
            expect(result).toEqual([{id: 1, text: 'Group A'}]);
        });
    });

    describe('markJobMissing', () => {
        it('updates job status to Missing (1001)', async () => {
            await markJobMissing(1);

            expect(mockedPost).toHaveBeenCalledWith('job/UpdateJob', null, {
                params: expect.objectContaining({jobId: 1, field: 'Status', value: 1001}),
            });
        });
    });

    describe('moveJobToReprice', () => {
        it('updates InternalStatusID to reprice (4)', async () => {
            await moveJobToReprice(1);

            expect(mockedPost).toHaveBeenCalledWith('job/UpdateJob', null, {
                params: expect.objectContaining({jobId: 1, field: 'InternalStatusID', value: 4}),
            });
        });
    });

    describe('getActivePartnerOptions', () => {
        it('fetches active partner options', async () => {
            mockedGet.mockResolvedValue([{id: 1, text: 'Partner A'}]);

            const result = await getActivePartnerOptions();

            expect(mockedGet).toHaveBeenCalledWith('job/GetActivePartnerOptions');
            expect(result).toEqual([{id: 1, text: 'Partner A'}]);
        });
    });

    describe('sendToPartner', () => {
        it('sends job to partner with agreed rate', async () => {
            const response = {success: true, trackingNumber: 'TRK-123', message: 'OK'};
            mockedPost.mockResolvedValue(response);

            const result = await sendToPartner(42, 5, 75.50);

            expect(mockedPost).toHaveBeenCalledWith('job/SendToPartner', {jobId: 42, partnerId: 5, agreedRate: 75.50});
            expect(result).toEqual(response);
        });
    });
});
