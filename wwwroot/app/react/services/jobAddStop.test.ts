/** @jest-environment node */
import {addStopToJob, blankAddress, hasBothAddresses, stopKindForJob} from './jobAddStop';
import {apiClient} from './apiClient';
import {toastService} from './toastService';

jest.mock('./apiClient', () => ({apiClient: {post: jest.fn()}}));
jest.mock('./toastService', () => ({toastService: {showWarningToast: jest.fn()}}));

describe('jobAddStop', () => {
    beforeEach(() => jest.clearAllMocks());

    it('posts the pickup stop and returns the new job id', async () => {
        (apiClient.post as jest.Mock).mockResolvedValue(300);
        const a = {...blankAddress(), addressLine1: '1 Pickup Ln'};
        await expect(addStopToJob(10, a, undefined)).resolves.toBe(300);
        expect(apiClient.post).toHaveBeenCalledWith('job/AddStopToJob',
            {jobId: 10, pickUpAddress: a, deliveryAddress: undefined});
    });

    it('posts the delivery stop and propagates failures', async () => {
        const a = blankAddress();
        (apiClient.post as jest.Mock).mockResolvedValueOnce(400).mockRejectedValueOnce(new Error('boom'));
        await expect(addStopToJob(10, undefined, a)).resolves.toBe(400);
        expect(apiClient.post).toHaveBeenCalledWith('job/AddStopToJob',
            {jobId: 10, pickUpAddress: undefined, deliveryAddress: a});
        await expect(addStopToJob(10, undefined, a)).rejects.toThrow('boom');
    });

    it('blankAddress has all eight lines and fullAddress empty', () => {
        const a = blankAddress() as unknown as Record<string, string>;
        for (let i = 1; i <= 8; i++) expect(a[`addressLine${i}`]).toBe('');
        expect(a.fullAddress).toBe('');
    });

    it('hasBothAddresses requires pickup and delivery', () => {
        expect(hasBothAddresses({id: 1, pickupAddress: {}, deliveryAddress: {}})).toBe(true);
        expect(hasBothAddresses({id: 1, pickupAddress: undefined, deliveryAddress: {}})).toBe(false);
        expect(hasBothAddresses({id: 1, pickupAddress: {}, deliveryAddress: undefined})).toBe(false);
    });

    it('maps job number suffix to stop kind, warning otherwise', () => {
        expect(stopKindForJob('J0011')).toBe('pickup');
        expect(stopKindForJob('J0013')).toBe('delivery');
        expect(toastService.showWarningToast).not.toHaveBeenCalled();
        expect(stopKindForJob('J0012')).toBeUndefined();
        expect(stopKindForJob('J0019')).toBeUndefined();
        expect(toastService.showWarningToast).toHaveBeenCalledWith('Cannot add stop to this job');
    });
});
