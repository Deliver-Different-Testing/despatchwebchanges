/** @jest-environment node */
/**
 * Dispatch Executor API Service Tests
 */

import {
    getCourierById,
    getDispatchJobDetail,
    addFollowupEvent,
    addRestoreEvent,
    reAssignJobs,
    reSendJobs,
    isJobParent,
    isBulkJobParent,
    canAssignAgentToJob,
    recalculateJobRate,
    applyRecalculatedJobRate,
    simpleRepriceJobManual,
    repriceJobWithBaseAmount,
    searchSpeedOptions,
    createInterCourierCharge,
    dispatchExecutorApi,
} from './dispatchExecutorApi';
import {apiClient} from './apiClient';

jest.mock('./apiClient', () => ({
    apiClient: {
        get: jest.fn(),
        post: jest.fn(),
    },
}));

jest.mock('../../functions/dtoMappings', () => ({
    transformDispatchJobDTO: jest.fn((dto: any) => ({...dto, _transformed: true})),
}));

const mockApiClient = apiClient as jest.Mocked<typeof apiClient>;

describe('dispatchExecutorApi', () => {
    beforeEach(() => jest.clearAllMocks());

    describe('getCourierById', () => {
        const mockCourier = {
            courierId: 42,
            id: 'C42',
            name: 'Test Courier',
            dangerousGoods: 1,
            dgLicenseExpiry: '2027-01-01',
            label: 'C42 - Test',
            text: 'C42 - Test Courier',
            isActive: true,
            vehicleType: 'Van',
        };

        it('should call apiClient.get with correct endpoint and params', async () => {
            mockApiClient.get.mockResolvedValueOnce(mockCourier);

            const result = await getCourierById(42);

            expect(mockApiClient.get).toHaveBeenCalledWith('courier/GetCourier', {courierId: 42}, undefined);
            expect(result).toEqual(mockCourier);
        });

        it('should return null when the API throws', async () => {
            mockApiClient.get.mockRejectedValueOnce(new Error('Not found'));

            const result = await getCourierById(999);

            expect(result).toBeNull();
        });
    });

    describe('getDispatchJobDetail', () => {
        it('should call apiClient.get and transform the DTO', async () => {
            const mockDto = {id: 100, jobNo: 'J100'};
            mockApiClient.get.mockResolvedValueOnce(mockDto);

            const result = await getDispatchJobDetail(100);

            expect(mockApiClient.get).toHaveBeenCalledWith('job/DispatchJobDetail', {jobId: 100}, undefined);
            expect(result).toEqual(expect.objectContaining({id: 100, jobNo: 'J100', _transformed: true}));
        });
    });

    describe('addFollowupEvent', () => {
        it('should call apiClient.post with correct endpoint and params', async () => {
            mockApiClient.post.mockResolvedValueOnce(undefined);

            await addFollowupEvent(55);

            expect(mockApiClient.post).toHaveBeenCalledWith('courier/AddFollowupEvent', null, {params: {jobId: 55}});
        });
    });

    describe('addRestoreEvent', () => {
        it('should call apiClient.post with correct endpoint and params', async () => {
            mockApiClient.post.mockResolvedValueOnce(undefined);

            await addRestoreEvent(66);

            expect(mockApiClient.post).toHaveBeenCalledWith('job/AddRestoreEvent', null, {params: {jobId: 66}});
        });
    });

    describe('reAssignJobs', () => {
        it('should call apiClient.post with correct endpoint and jobIds', async () => {
            mockApiClient.post.mockResolvedValueOnce(undefined);

            await reAssignJobs([1, 2, 3]);

            expect(mockApiClient.post).toHaveBeenCalledWith('job/ReAssignSelected', null, {params: {jobIds: [1, 2, 3]}});
        });
    });

    describe('reSendJobs', () => {
        it('should call apiClient.post with correct endpoint and jobIds', async () => {
            mockApiClient.post.mockResolvedValueOnce(undefined);

            await reSendJobs([4, 5]);

            expect(mockApiClient.post).toHaveBeenCalledWith('job/ReSendSelected', null, {params: {jobIds: [4, 5]}});
        });
    });

    describe('isJobParent', () => {
        it('should call apiClient.get and return boolean', async () => {
            mockApiClient.get.mockResolvedValueOnce(true);

            const result = await isJobParent(10);

            expect(mockApiClient.get).toHaveBeenCalledWith('job/IsJobParent', {jobId: 10}, undefined);
            expect(result).toBe(true);
        });
    });

    describe('isBulkJobParent', () => {
        it('should call apiClient.get and return boolean', async () => {
            mockApiClient.get.mockResolvedValueOnce(false);

            const result = await isBulkJobParent(20);

            expect(mockApiClient.get).toHaveBeenCalledWith('job/IsBulkJobParent', {bulkJobId: 20}, undefined);
            expect(result).toBe(false);
        });
    });

    describe('canAssignAgentToJob', () => {
        it('should call apiClient.get with correct endpoint and params', async () => {
            mockApiClient.get.mockResolvedValueOnce(true);

            const result = await canAssignAgentToJob(30);

            expect(mockApiClient.get).toHaveBeenCalledWith('nationwideJob/CanAssignAgentToJob', {agentJobId: 30}, undefined);
            expect(result).toBe(true);
        });
    });

    describe('recalculateJobRate', () => {
        it('should call apiClient.get with jobId and isBooking', async () => {
            mockApiClient.get.mockResolvedValueOnce(150.50);

            const result = await recalculateJobRate(40, true);

            expect(mockApiClient.get).toHaveBeenCalledWith('job/RecalculateJobRate', {jobId: 40, isBooking: true}, undefined);
            expect(result).toBe(150.50);
        });
    });

    describe('applyRecalculatedJobRate', () => {
        it('should call apiClient.post with correct params', async () => {
            mockApiClient.post.mockResolvedValueOnce(undefined);

            await applyRecalculatedJobRate(50, false);

            expect(mockApiClient.post).toHaveBeenCalledWith('job/ApplyRecalculatedJobRate', null, {params: {jobId: 50, isPrebook: false}});
        });
    });

    describe('simpleRepriceJobManual', () => {
        it('should call apiClient.post with pricing data in body', async () => {
            mockApiClient.post.mockResolvedValueOnce(undefined);

            await simpleRepriceJobManual(60, true, false, 200);

            expect(mockApiClient.post).toHaveBeenCalledWith('job/SimpleRepriceJobManual', {
                jobId: 60, isPrebook: true, isBulk: false, newPrice: 200,
            });
        });
    });

    describe('repriceJobWithBaseAmount', () => {
        it('should call apiClient.post and return the new price', async () => {
            mockApiClient.post.mockResolvedValueOnce(175.25);

            const result = await repriceJobWithBaseAmount(70, false, 100);

            expect(mockApiClient.post).toHaveBeenCalledWith('job/RepriceJobWithBaseAmount', {
                jobId: 70, isPrebook: false, baseAmount: 100,
            });
            expect(result).toBe(175.25);
        });
    });

    describe('searchSpeedOptions', () => {
        it('should call apiClient.get with searchTerm', async () => {
            const mockOptions = [{id: 1, text: 'Express'}, {id: 2, text: 'Standard'}];
            mockApiClient.get.mockResolvedValueOnce(mockOptions);

            const result = await searchSpeedOptions('Exp');

            expect(mockApiClient.get).toHaveBeenCalledWith('job/SearchSpeedOptions', {searchTerm: 'Exp'}, undefined);
            expect(result).toEqual(mockOptions);
        });
    });

    describe('createInterCourierCharge', () => {
        it('should call apiClient.post with charge data', async () => {
            mockApiClient.post.mockResolvedValueOnce(undefined);
            const data = {fromCourierId: 10, toCourierId: 20, clientId: 30, reference: 'REF-001', amount: 50};

            await createInterCourierCharge(data);

            expect(mockApiClient.post).toHaveBeenCalledWith('job/InterCourierCharge', data);
        });
    });

    describe('aggregate export', () => {
        it('should expose all functions on the dispatchExecutorApi object', () => {
            expect(dispatchExecutorApi.getCourierById).toBe(getCourierById);
            expect(dispatchExecutorApi.getDispatchJobDetail).toBe(getDispatchJobDetail);
            expect(dispatchExecutorApi.addFollowupEvent).toBe(addFollowupEvent);
            expect(dispatchExecutorApi.addRestoreEvent).toBe(addRestoreEvent);
            expect(dispatchExecutorApi.reAssignJobs).toBe(reAssignJobs);
            expect(dispatchExecutorApi.reSendJobs).toBe(reSendJobs);
            expect(dispatchExecutorApi.isJobParent).toBe(isJobParent);
            expect(dispatchExecutorApi.isBulkJobParent).toBe(isBulkJobParent);
            expect(dispatchExecutorApi.canAssignAgentToJob).toBe(canAssignAgentToJob);
            expect(dispatchExecutorApi.recalculateJobRate).toBe(recalculateJobRate);
            expect(dispatchExecutorApi.applyRecalculatedJobRate).toBe(applyRecalculatedJobRate);
            expect(dispatchExecutorApi.simpleRepriceJobManual).toBe(simpleRepriceJobManual);
            expect(dispatchExecutorApi.repriceJobWithBaseAmount).toBe(repriceJobWithBaseAmount);
            expect(dispatchExecutorApi.searchSpeedOptions).toBe(searchSpeedOptions);
            expect(dispatchExecutorApi.createInterCourierCharge).toBe(createInterCourierCharge);
        });
    });
});
