/**
 * Add Stop Flow — Self-contained orchestration
 *
 * Handles the full add-stop flow:
 * 1. Determine stop type (pickup/delivery) from job suffix
 * 2. Open edit address dialog for new address
 * 3. Call addStopToJob API
 * 4. Return new job ID on success
 */

import type {DispatchJob} from '../interfaces/dispatchJob';
import type {ShowToastFn} from './toastService';
import {addStopToJob} from './dispatchApi';
import {openEditAddressDialog} from '../components/dialogs/edit-address-dialog/edit-address-dialog-react.module';
import type {IAddressViewModel} from '../../interfaces/job.interface';

export interface AddStopFlowOptions {
    job: DispatchJob;
    showToast: ShowToastFn;
    onComplete?: (newJobId: number) => void;
    setLoading?: (loading: boolean) => void;
}

function generateBlankAddress(): IAddressViewModel {
    return {
        addressLine1: '',
        addressLine2: '',
        addressLine3: '',
        addressLine4: '',
        addressLine5: '',
        addressLine6: '',
        addressLine7: '',
        addressLine8: '',
        fullAddress: '',
    };
}

function getJobSuffix(jobNo: string): string {
    return jobNo.toString().slice(-1);
}

export async function executeAddStopFlow(options: AddStopFlowOptions): Promise<void> {
    const {job, showToast, onComplete, setLoading} = options;

    if (!job.pickupAddress || !job.deliveryAddress) {
        showToast('Job is missing address information', 'error');
        return;
    }

    const suffix = getJobSuffix(job.jobNo ?? '');
    const isPickup = suffix === 'P';
    const isDelivery = suffix === 'D';

    if (!isPickup && !isDelivery) {
        showToast('Cannot add stop to this job', 'warning');
        return;
    }

    const title = isPickup ? 'Add Pick Up Stop' : 'Add Delivery Stop';

    // Open address dialog
    const newAddress = await openEditAddressDialog(
        generateBlankAddress() as any,
        title,
        'Add Stop',
    );

    if (!newAddress) return; // User cancelled

    // Call API
    setLoading?.(true);
    try {
        const newJobId = await addStopToJob(
            job.id,
            isPickup ? newAddress : undefined,
            isDelivery ? newAddress : undefined,
        );
        showToast(`Stop added successfully`, 'success');
        onComplete?.(newJobId);
    } catch (error) {
        console.error('Error adding stop:', error);
        showToast('Error adding stop to job', 'error');
    } finally {
        setLoading?.(false);
    }
}
