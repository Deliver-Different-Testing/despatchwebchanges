/**
 * Split Job Flow — Self-contained orchestration
 *
 * Pure async function that handles the entire split job flow:
 * 1. Validate (archived check)
 * 2. Address dialog (meeting point)
 * 3. Courier dialog (optional courier for delivery leg)
 * 4. API call (split job — synchronous from frontend's perspective)
 * 5. Toast (success/failure)
 *
 * No confirmation dialog — the caller handles that
 * (context menu uses its confirm dialog; the AngularJS template button uses window.confirm).
 */

import type {DispatchJob} from '../interfaces/dispatchJob';
import type {ShowToastFn} from './toastService';
import {splitJob} from './splitJobApi';
import {openEditAddressDialog} from '../components/dialogs/edit-address-dialog/edit-address-dialog-react.module';
import {openSplitJobCourierDialog} from '../components/dialogs/split-job-courier-dialog/openSplitJobCourierDialog';

export interface SplitJobFlowOptions {
    job: DispatchJob;
    showToast: ShowToastFn;
    onComplete?: () => void;
    setLoading?: (loading: boolean) => void;
}

/**
 * Executes the split job flow after the user has already confirmed.
 * Opens address dialog → courier dialog → calls API → shows result toast.
 */
export async function executeSplitJobFlow(options: SplitJobFlowOptions): Promise<void> {
    const {job, showToast, onComplete, setLoading} = options;

    // ── Validate ──
    if (job.isArchived) {
        showToast('Splitting archived jobs is not currently supported.', 'error');
        return;
    }

    if (!job.deliveryAddress) {
        showToast('No delivery address found', 'error');
        return;
    }

    // ── Address dialog ──
    const meetingPointAddress = await openEditAddressDialog(
        job.deliveryAddress,
        'Set Meeting Point',
        'Split Job',
    );

    if (!meetingPointAddress) {
        // User cancelled
        return;
    }

    if (!meetingPointAddress.fullAddress) {
        showToast('Invalid meeting point address', 'error');
        return;
    }

    // ── Courier dialog ──
    const courierResult = await openSplitJobCourierDialog();

    if (courierResult.action === 'cancel') {
        return;
    }

    const courierIdForLegB = courierResult.action === 'assign' ? courierResult.courierId : null;

    // ── API call ──
    setLoading?.(true);
    try {
        await splitJob({
            jobId: job.id,
            meetingPointAddress,
            courierIdForLegB,
        });
        showToast(`Job ${job.jobNo} successfully split`, 'success');
        try {
            onComplete?.();
        } catch (e) {
            console.error('Error refreshing after split:', e);
        }
    } catch (error) {
        console.error('Splitting job failed:', error);
        showToast('Error splitting job', 'error');
    } finally {
        setLoading?.(false);
    }
}
