/** @jest-environment node */
const openEditAddressDialogMock = jest.fn();
const addStopToJobMock = jest.fn();

jest.mock('../../../components/dialogs/edit-address-dialog/edit-address-dialog-react.module', () => ({
    openEditAddressDialog: (...args: unknown[]) => openEditAddressDialogMock(...args),
}));
jest.mock('../../../services/jobListApi', () => ({
    addStopToJob: (...args: unknown[]) => addStopToJobMock(...args),
}));

import {executeAddStopFlow} from './addStopFlow';
import type {DispatchJob} from '../../../interfaces/dispatchJob';

const makeJob = (jobNo: string): DispatchJob => ({id: 5, jobNo} as DispatchJob);
const address = {addressLine1: '1 Test St', fullAddress: '1 Test St'};

describe('executeAddStopFlow', () => {
    beforeEach(() => {
        openEditAddressDialogMock.mockReset().mockResolvedValue(address);
        addStopToJobMock.mockReset().mockResolvedValue(99);
    });

    it('adds a pick-up stop for a "1"-suffixed job', async () => {
        const showToast = jest.fn();
        const result = await executeAddStopFlow({job: makeJob('JOB1'), isUsCustomer: false, showToast});
        expect(result).toBe(99);
        expect(addStopToJobMock).toHaveBeenCalledWith(5, address, undefined);
    });

    it('adds a delivery stop for a "3"-suffixed job', async () => {
        const showToast = jest.fn();
        const result = await executeAddStopFlow({job: makeJob('JOB3'), isUsCustomer: false, showToast});
        expect(result).toBe(99);
        expect(addStopToJobMock).toHaveBeenCalledWith(5, undefined, address);
    });

    it('warns and skips for a non-pickup/delivery suffix', async () => {
        const showToast = jest.fn();
        const result = await executeAddStopFlow({job: makeJob('JOB2'), isUsCustomer: false, showToast});
        expect(result).toBeUndefined();
        expect(showToast).toHaveBeenCalledWith('Cannot add stop to this job', 'warning');
        expect(openEditAddressDialogMock).not.toHaveBeenCalled();
    });

    it('returns undefined when the address dialog is cancelled', async () => {
        openEditAddressDialogMock.mockResolvedValue(null);
        const result = await executeAddStopFlow({job: makeJob('JOB1'), isUsCustomer: false, showToast: jest.fn()});
        expect(result).toBeUndefined();
        expect(addStopToJobMock).not.toHaveBeenCalled();
    });
});
