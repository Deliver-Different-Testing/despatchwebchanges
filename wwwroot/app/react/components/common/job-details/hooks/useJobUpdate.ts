/**
 * Hook for job field update mutations
 */

import {useState, useCallback} from 'react';
import {useMutation, useQueryClient} from '@tanstack/react-query';
import {
    updateJobDetail,
    updateBulkJobDetail,
    updatePickupAddress,
    updateDeliveryAddress,
    updatePodDetails,
    updateJobReadStatus,
    restoreJobs,
    allocateJob,
    getCourierById,
    previewJobRate,
    applyJobRate,
} from '../../../../services/jobDetailApi';
import type {JobUpdateResponse} from '../../../../services/jobDetailApi';
import type {IJob, IAddressViewModel, UpdatePodDetailsRequest} from '../JobDetails.types';
import {JobProperty} from '../../../../../enums/job-property.enum';

const RERATE_FIELDS = new Set<string>([
    JobProperty.Date,
    JobProperty.Size,
    JobProperty.Items,
    JobProperty.SpeedID,
    JobProperty.AcceptedJobTypeID,
    JobProperty.Weight,
    JobProperty.ClientID,
    JobProperty.Reprice,
    JobProperty.Truck,
    JobProperty.Van,
    JobProperty.DGClass,
    JobProperty.DGDocumentation,
    JobProperty.Direct,
    JobProperty.BookedTime,
    JobProperty.TailLiftPu,
    JobProperty.TailLiftDo,
    JobProperty.DeliverToPrivateRes,
]);

/**
 * Maps the JobProperty identifier used by inline Job Details edits to the
 * JobChangeField string the partner change-request workflow expects
 * (mirrors DespatchWeb.Enums.JobChangeField on the backend, and the closed
 * set rendered by JobChangeRequestDialog.FIELD_OPTIONS).
 *
 * When an inline edit of one of these fields fails on a partner job, we
 * surface the change-request dialog preselected with the mapped field
 * instead of just toasting "managed by partner".
 */
export const PARTNER_CHANGE_REQUEST_FIELD_MAP: Record<string, string> = {
    [JobProperty.Amount]: 'PartnerAgreedRate',
    [JobProperty.SpeedID]: 'Speed',
    [JobProperty.Items]: 'Quantity',
};

export interface PendingRateChange {
    jobId: number;
    jobNo: string;
    oldPrice: number;
    newPrice: number;
    description: string | null;
    isPrebook: boolean;
}

interface UpdateFieldParams {
    job: IJob;
    field: string;
    value: unknown;
    isRecurring: boolean;
    timezone?: string;
}

interface UpdateAddressParams {
    job: IJob;
    address: IAddressViewModel;
    isDelivery: boolean;
}

interface DispatchJobParams {
    job: IJob;
    courierId: number;
}

export interface UseJobUpdateOptions {
    /**
     * Called when an inline field edit on a partner job is rejected by the
     * backend gate AND the field is mappable to a JobChangeRequest field
     * (see PARTNER_CHANGE_REQUEST_FIELD_MAP). The caller is expected to open
     * the JobChangeRequestDialog preselected with the mapped field. When this
     * fires, the generic error toast is suppressed so the user only sees the
     * dialog.
     */
    onPartnerJobBlocked?: (args: {field: string; value: unknown; message: string}) => void;
}

export function useJobUpdate(
    showToast: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void,
    options?: UseJobUpdateOptions,
) {
    const queryClient = useQueryClient();
    const [pendingRateChange, setPendingRateChange] = useState<PendingRateChange | null>(null);
    const [isApplyingRate, setIsApplyingRate] = useState(false);

    const invalidateJob = async (jobId: number) => {
        await queryClient.invalidateQueries({queryKey: ['jobs', 'detail', jobId]});
    };

    /** Invalidate all job list caches so updated fields appear in the list */
    const invalidateJobLists = () => {
        return Promise.all([
            queryClient.invalidateQueries({queryKey: ['dispatch']}),
            queryClient.invalidateQueries({queryKey: ['jobSearch']}),
            queryClient.invalidateQueries({queryKey: ['nationwide']}),
        ]);
    };

    const checkForRateChange = useCallback(async (job: IJob) => {
        try {
            const preview = await previewJobRate(job.id);
            if (Math.abs(preview.rate - job.charge) > 0.001) {
                setPendingRateChange({
                    jobId: job.id,
                    jobNo: job.jobNo,
                    oldPrice: job.charge,
                    newPrice: preview.rate,
                    description: preview.description,
                    isPrebook: job.preBook,
                });
            }
        } catch {
            // Preview failure is non-fatal — user can still manually edit price
        }
    }, []);

    const invalidateChangeRequests = (jobId: number) =>
        queryClient.invalidateQueries({queryKey: ['jobChangeRequests', jobId]});

    const updateFieldMutation = useMutation({
        mutationFn: async ({job, field, value, isRecurring, timezone}: UpdateFieldParams) => {
            if (job.isBulkJob) {
                await updateBulkJobDetail(job.id, field, value, timezone);
                return {job, field, response: {} as JobUpdateResponse};
            }
            const response = await updateJobDetail(job.id, field, value, isRecurring, timezone);
            return {job, field, response};
        },
        onSuccess: async ({job, field, response}) => {
            // Partner-job responses: the gate either auto-applied (and forwarded to the
            // peer) or filed a Pending change request. Show the user what actually
            // happened rather than the generic "updated" toast.
            if (response?.pending) {
                showToast(`${job.jobNo}: change requested — awaiting partner approval`, 'info');
                await invalidateChangeRequests(job.id);
            } else if (response?.applied && job.isPartnerJob) {
                showToast(`${job.jobNo} synced with partner`, 'success');
                await invalidateChangeRequests(job.id);
            } else {
                showToast(`${job.jobNo} updated`, 'success');
            }
            await invalidateJob(job.id);
            await invalidateJobLists();
            // Pending changes haven't actually mutated the job — skip the rate-change probe.
            if (!response?.pending && RERATE_FIELDS.has(field) && !job.ratedManually) {
                await checkForRateChange(job);
            }
        },
        onError: (error: unknown, variables: UpdateFieldParams) => {
            // The apiClient interceptor reshapes axios errors into ApiError { status,
            // statusText, message }. Surface the backend's "managed by partner" /
            // "cannot be edited" message when present so the user sees why the save
            // was refused.
            const err = error as {status?: number; message?: string};
            const message = err?.message;
            // Partner-job gate rejected an inline edit of a field the user can
            // negotiate via the change-request workflow — route them to the dialog
            // pre-populated instead of just toasting an opaque error.
            const mappedField = PARTNER_CHANGE_REQUEST_FIELD_MAP[variables.field];
            if (err?.status === 400 && variables.job.isPartnerJob && mappedField && options?.onPartnerJobBlocked) {
                options.onPartnerJobBlocked({
                    field: mappedField,
                    value: variables.value,
                    message: message ?? '',
                });
                return;
            }
            showToast(message ?? 'Failed to update job. Please try again.', 'error');
        },
    });

    const updateAddressMutation = useMutation({
        mutationFn: async ({job, address, isDelivery}: UpdateAddressParams) => {
            const response = isDelivery
                ? await updateDeliveryAddress(job.id, job.preBook, address)
                : await updatePickupAddress(job.id, job.preBook, address);
            return {job, response};
        },
        onSuccess: async ({job, response}) => {
            // Partner-job address edits don't write locally — the gate files a Pending
            // change request (Manual policy for PickupAddress / DeliveryAddress) and
            // returns 202 with { pending: true }. Mirror the field-update toast so the
            // user knows the change is queued, not silently lost.
            if (response?.pending) {
                showToast(`${job.jobNo}: address change requested — awaiting partner approval`, 'info');
                await invalidateChangeRequests(job.id);
            } else if (response?.applied && job.isPartnerJob) {
                showToast(`${job.jobNo} synced with partner`, 'success');
                await invalidateChangeRequests(job.id);
            } else {
                showToast(`${job.jobNo} updated`, 'success');
            }
            await invalidateJob(job.id);
            await invalidateJobLists();
            // Pending changes haven't actually mutated the job — skip the rate-change probe.
            if (!response?.pending && !job.ratedManually) {
                await checkForRateChange(job);
            }
        },
        onError: () => {
            showToast('Failed to update address. Please try again.', 'error');
        },
    });

    const updatePodMutation = useMutation({
        mutationFn: (data: UpdatePodDetailsRequest) => updatePodDetails(data),
        onSuccess: async (_data, variables) => {
           await invalidateJob(variables.jobId);
           await invalidateJobLists();
        },
        onError: () => {
            showToast('Failed to update POD details.', 'error');
        },
    });

    const toggleReadStatusMutation = useMutation({
        mutationFn: ({jobId, hasBeenRead}: { jobId: number; hasBeenRead: boolean }) =>
            updateJobReadStatus(jobId, hasBeenRead),
        onSuccess: async (_data, {jobId}) => {
           await invalidateJob(jobId);
        },
        onError: (_err, {hasBeenRead}) => {
            const actionText = hasBeenRead ? 'read' : 'unread';
            showToast(`Failed to mark job as ${actionText}. Please try again.`, 'error');
        },
    });

    const dispatchJobMutation = useMutation({
        mutationFn: async ({job, courierId}: DispatchJobParams) => {
            // If job already has a courier, restore first
            if (job.courierData?.courierId || job.assignedCourier?.id) {
                await restoreJobs([job.id]);
            }
            await allocateJob(courierId, [job.id]);
            // Try to get courier details for the toast
            try {
                const courier = await getCourierById(courierId);
                if (courier) {
                    return courier.id && courier.id !== 'undefined' && courier.id.trim() !== ''
                        ? `${courier.id}: ${courier.name}`
                        : courier.name;
                }
            } catch {
                // Ignore
            }
            return null;
        },
        onSuccess: async (courierDisplay, {job}) => {
            if (courierDisplay) {
                showToast(`Dispatched to ${courierDisplay}`, 'success');
            } else {
                showToast('Job dispatched successfully', 'success');
            }
            await invalidateJob(job.id);
            await invalidateJobLists();
        },
        onError: () => {
            showToast('Failed to dispatch job.', 'error');
        },
    });

    const confirmRateChange = useCallback(async () => {
        if (!pendingRateChange) return;
        setIsApplyingRate(true);
        try {
            await applyJobRate(pendingRateChange.jobId, pendingRateChange.isPrebook);
            await invalidateJob(pendingRateChange.jobId);
            await invalidateJobLists();
            await queryClient.invalidateQueries({queryKey: ['notes']});
            showToast('Price updated', 'success');
        } catch {
            showToast('Failed to apply new price. Please try again.', 'error');
        } finally {
            setIsApplyingRate(false);
            setPendingRateChange(null);
        }
    }, [pendingRateChange, showToast]);

    const dismissRateChange = useCallback(() => {
        setPendingRateChange(null);
    }, []);

    return {
        updateField: updateFieldMutation.mutateAsync,
        updateAddress: updateAddressMutation.mutateAsync,
        updatePod: updatePodMutation.mutateAsync,
        toggleReadStatus: toggleReadStatusMutation.mutateAsync,
        dispatchJob: dispatchJobMutation.mutateAsync,
        isUpdating: updateFieldMutation.isPending
            || updateAddressMutation.isPending
            || updatePodMutation.isPending
            || dispatchJobMutation.isPending,
        invalidateJob,
        invalidateJobLists,
        checkForRateChange,
        pendingRateChange,
        isApplyingRate,
        confirmRateChange,
        dismissRateChange,
    };
}
