import {openEditAddressDialog} from '../components/dialogs/edit-address-dialog/edit-address-dialog-react.module';
import {addStopToJob} from '../services/jobListApi';
import {AddressType} from '../../enums/address-type.enum';
import JobSuffix from '../../enums/job-suffix.enum';
import type {DispatchJob} from '../interfaces/dispatchJob';
import type {ShowToastFn} from '../services/toastService';

export interface AddStopFlowOptions {
    job: DispatchJob;
    isUsCustomer: boolean;
    showToast: ShowToastFn;
}

/**
 * Add-stop flow, shared by Dispatch and Nationwide. Mirrors V1 JobAddStopService:
 * the job number's suffix decides whether we add a pick-up ("1") or delivery
 * ("3") stop; collect the address via the shared edit-address dialog, then
 * `addStopToJob` creates the linked job. Returns the new job id, or undefined
 * if the job can't take a stop or the dialog is cancelled.
 */
export async function executeAddStopFlow(
    {job, isUsCustomer, showToast}: AddStopFlowOptions,
): Promise<number | undefined> {
    const suffix = (job.jobNo ?? '').toString().slice(-1);
    const isPickup = suffix === JobSuffix.Pickup;
    const isDelivery = suffix === JobSuffix.Delivery;

    if (!isPickup && !isDelivery) {
        showToast('Cannot add stop to this job', 'warning');
        return undefined;
    }

    const title = isPickup ? 'Add Pick Up Stop' : 'Add Delivery Stop';
    const address = await openEditAddressDialog(
        null,
        title,
        'Add Stop',
        true,
        isUsCustomer,
        {showToast},
        isPickup ? AddressType.Pickup : AddressType.Delivery,
    );
    if (!address) return undefined;

    try {
        return isPickup
            ? await addStopToJob(job.id, address, undefined)
            : await addStopToJob(job.id, undefined, address);
    } catch (err) {
        console.error('[addStopFlow] failed to add stop:', err);
        showToast('Failed to add stop to job', 'error');
        return undefined;
    }
}
