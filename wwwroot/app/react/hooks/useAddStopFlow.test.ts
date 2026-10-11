import {renderHook} from '@testing-library/react';
import {useAddStopFlow} from './useAddStopFlow';
import {addStopToJob, blankAddress} from '../services/jobAddStop';
import {toastService} from '../services/toastService';
import {AddressType} from '../../enums/address-type.enum';

jest.mock('../services/toastService', () => ({
    toastService: {showErrorToast: jest.fn(), showWarningToast: jest.fn()},
}));
jest.mock('../session', () => ({getSession: () => ({isUsCustomer: true})}));
jest.mock('../services/jobAddStop', () => ({
    ...jest.requireActual('../services/jobAddStop'),
    addStopToJob: jest.fn(),
}));

const job = {id: 10, pickupAddress: blankAddress(), deliveryAddress: blankAddress()};

function setup(dialogResult: unknown) {
    const open = jest.fn().mockResolvedValue(dialogResult);
    const {result} = renderHook(() => useAddStopFlow({openDialog: async () => ({open}) as never}));
    return {open, ...result.current};
}

describe('useAddStopFlow', () => {
    beforeEach(() => jest.clearAllMocks());

    it('pickup: opens the pickup dialog and posts the pickup address', async () => {
        const addr = {...blankAddress(), addressLine1: '1 Pickup Ln'};
        (addStopToJob as jest.Mock).mockResolvedValue(300);
        const {open, addRecurringJobStop} = setup(addr);
        await expect(addRecurringJobStop(job, true)).resolves.toBe(300);
        expect(open).toHaveBeenCalledWith(expect.objectContaining({addressLine1: ''}),
            'Add Pick Up Stop', 'Add Stop', true, true, toastService, AddressType.Pickup);
        expect(addStopToJob).toHaveBeenCalledWith(10, addr, undefined);
    });

    it('delivery: opens the delivery dialog and posts the delivery address', async () => {
        const addr = {...blankAddress(), addressLine1: '2 Delivery Ln'};
        (addStopToJob as jest.Mock).mockResolvedValue(400);
        const {open, addRecurringJobStop} = setup(addr);
        await expect(addRecurringJobStop(job, false)).resolves.toBe(400);
        expect(open.mock.calls[0][1]).toBe('Add Delivery Stop');
        expect(open.mock.calls[0][6]).toBe(AddressType.Delivery);
        expect(addStopToJob).toHaveBeenCalledWith(10, undefined, addr);
    });

    it.each([
        ['no pickup', {...job, pickupAddress: undefined}],
        ['no delivery', {...job, deliveryAddress: undefined}],
    ])('skips the dialog when job has %s', async (_n, j) => {
        const {open, addRecurringJobStop} = setup(blankAddress());
        await expect(addRecurringJobStop(j, true)).resolves.toBeUndefined();
        expect(open).not.toHaveBeenCalled();
        expect(addStopToJob).not.toHaveBeenCalled();
    });

    it('does not post when the dialog is cancelled', async () => {
        const {addRecurringJobStop} = setup(null);
        await expect(addRecurringJobStop(job, true)).resolves.toBeUndefined();
        expect(addStopToJob).not.toHaveBeenCalled();
    });

    it('toasts when the dialog bundle is missing', async () => {
        const {result} = renderHook(() => useAddStopFlow({openDialog: () => Promise.reject(new Error('bundle missing'))}));
        await expect(result.current.addRecurringJobStop(job, true)).resolves.toBeUndefined();
        expect(toastService.showErrorToast).toHaveBeenCalledWith('Edit address dialog is not loaded.');
    });

    it('toasts an error when the API call fails', async () => {
        (addStopToJob as jest.Mock).mockRejectedValue(new Error('boom'));
        jest.spyOn(console, 'error').mockImplementation(() => undefined);
        const {addRecurringJobStop} = setup(blankAddress());
        await expect(addRecurringJobStop(job, true)).resolves.toBeUndefined();
        expect(toastService.showErrorToast).toHaveBeenCalledWith('Could not add the stop. Please try again.');
    });

    it('addNewStop routes by job suffix and warns for others', async () => {
        const addr = blankAddress();
        (addStopToJob as jest.Mock).mockResolvedValue(1);
        const {addNewStop} = setup(addr);
        await addNewStop({...job, jobNo: 'J0013'});
        expect(addStopToJob).toHaveBeenCalledWith(10, undefined, addr);
        await expect(addNewStop({...job, jobNo: 'J0012'})).resolves.toBeUndefined();
        expect(toastService.showWarningToast).toHaveBeenCalledWith('Cannot add stop to this job');
    });
});
