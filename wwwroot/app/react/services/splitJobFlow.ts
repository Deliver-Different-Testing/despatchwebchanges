/**
 * Split Job Flow — Self-contained orchestration
 *
 * Pure async function that handles the entire split job flow:
 * 1. Validate (archived check)
 * 2. Address dialog (meeting point)
 * 3. Courier dialog (optional courier for delivery leg)
 * 4. Pricing dialog (confirm how the price divides across the legs)
 * 5. API call (split job — synchronous from frontend's perspective)
 * 6. Toast (success/failure)
 *
 * No *intent* confirmation dialog — the caller handles that (context menu uses its confirm dialog;
 * the AngularJS template button uses window.confirm). The pricing dialog in step 4 is separate: it
 * confirms the money, and cancelling it leaves the job unsplit.
 */

import type {DispatchJob} from '../interfaces/dispatchJob';
import type {ShowToastFn} from './toastService';
import {
    previewSplitPricing,
    splitJob,
    type SplitPricingAllocationItem,
    type SplitPricingLineAllocationItem,
    type SplitPricingPreview,
} from './splitJobApi';
import {openEditAddressDialog} from '../components/dialogs/edit-address-dialog/edit-address-dialog-react.module';
import {openSplitJobCourierDialog} from '../components/dialogs/split-job-courier-dialog/openSplitJobCourierDialog';
import {openSplitPricingDialog} from '../components/dialogs/split-pricing-dialog/openSplitPricingDialog';
import type {SplitPricingResult} from '../components/dialogs/split-pricing-dialog/SplitPricingDialog';

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

    // ── Pricing dialog ──
    // Only the preview is best-effort: it writes nothing, so when it can't be loaded we fall through
    // to the split with no allocation and let the server derive the division rather than blocking the
    // split outright. A dialog that fails to open is different — the user never saw the numbers, so
    // nothing is split.
    let preview: SplitPricingPreview | null = null;
    try {
        preview = await previewSplitPricing({jobId: job.id, meetingPointAddress});
    } catch (error) {
        console.error('Split pricing preview failed:', error);
        showToast(
            `Could not preview split pricing — the split will use the calculated division. ${serverReason(error)}`.trim(),
            'warning',
        );
    }

    let pricingAllocation: SplitPricingAllocationItem[] | null = null;
    let lineAllocation: SplitPricingLineAllocationItem[] | null = null;
    if (preview) {
        let pricingResult: SplitPricingResult;
        try {
            pricingResult = await openSplitPricingDialog(job.jobNo, preview);
        } catch (error) {
            console.error('Split pricing dialog failed:', error);
            showToast('Could not confirm split pricing — the job has not been split.', 'error');
            return;
        }

        if (pricingResult.action === 'cancel') {
            return;
        }

        pricingAllocation = pricingResult.allocation;
        lineAllocation = pricingResult.lineAllocation;
    }

    // ── API call ──
    setLoading?.(true);
    try {
        await splitJob({
            jobId: job.id,
            meetingPointAddress,
            courierIdForLegB,
            pricingAllocation,
            lineAllocation,
        });
        showToast(`Job ${job.jobNo} successfully split`, 'success');
        try {
            onComplete?.();
        } catch (e) {
            console.error('Error refreshing after split:', e);
        }
    } catch (error) {
        console.error('Splitting job failed:', error);
        showToast(`Error splitting job. ${serverReason(error)}`.trim(), 'error');
    } finally {
        setLoading?.(false);
    }
}

/**
 * The server's own explanation of a failure, or '' when there isn't one.
 *
 * Split failures are otherwise indistinguishable from each other on staging and production, where
 * the backend sanitises unrecognised exceptions and the operator has no access to server logs.
 * `apiClient` rejects with an `ApiError` whose `message` holds the response body.
 */
function serverReason(error: unknown): string {
    const message = (error as {message?: unknown} | null)?.message;
    return typeof message === 'string' ? message : '';
}
