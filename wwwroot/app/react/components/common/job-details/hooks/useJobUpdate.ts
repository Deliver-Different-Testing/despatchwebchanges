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
    previewJobRates,
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
 * Primary path: `useJobActions.tryRoutePartnerEdit` intercepts partner-job
 * edits at the dialog-submit boundary so `updateField` is never called for a
 * gated field. This map is the DEFENSIVE BACKSTOP: if a code path slips
 * through and `updateField` runs, the backend rejects with 400 and we use
 * this lookup to surface the change-request dialog (locked, pre-populated)
 * instead of an opaque toast. Keep these two lists in lock-step.
 */
export const PARTNER_CHANGE_REQUEST_FIELD_MAP: Record<string, string> = {
    [JobProperty.Amount]: 'PartnerAgreedRate',
    [JobProperty.SpeedID]: 'Speed',
    [JobProperty.Items]: 'Quantity',
    [JobProperty.AcceptedJobTypeID]: 'AcceptedJobTypeID',
    [JobProperty.DGClass]: 'DGClass',
    [JobProperty.DGDocumentation]: 'DGDocumentation',
    [JobProperty.Direct]: 'Direct',
    [JobProperty.FromContactName]: 'FromContactName',
    [JobProperty.FromContactPhone]: 'FromContactPhone',
    [JobProperty.ToContactName]: 'ToContactName',
    [JobProperty.ToContactPhone]: 'ToContactPhone',
    [JobProperty.Date]: 'Date',
    [JobProperty.PuTime]: 'PuTime',
    [JobProperty.DeliverBy]: 'DeliverBy',
    [JobProperty.BookedTime]: 'BookedTime',
};

export interface PendingRateChange {
    jobId: number;
    jobNo: string;
    oldPrice: number;
    newPrice: number;
    description: string | null;
    isPrebook: boolean;
    /** Manually-priced jobs are shown but never selectable — a hand-set price must survive. */
    ratedManually?: boolean;
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
    const [pendingRateChanges, setPendingRateChanges] = useState<PendingRateChange[]>([]);
    const [selectedRateJobIds, setSelectedRateJobIds] = useState<Set<number>>(new Set());
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

    const openRateChanges = useCallback((rows: PendingRateChange[]) => {
        setPendingRateChanges(rows);
        setSelectedRateJobIds(new Set(rows.filter(r => !r.ratedManually).map(r => r.jobId)));
    }, []);

    const checkForRateChange = useCallback(async (job: IJob) => {
        try {
            const preview = await previewJobRate(job.id);
            if (Math.abs(preview.rate - job.charge) > 0.001) {
                openRateChanges([{
                    jobId: job.id,
                    jobNo: job.jobNo,
                    oldPrice: job.charge,
                    newPrice: preview.rate,
                    description: preview.description,
                    isPrebook: job.preBook,
                }]);
            }
        } catch {
            // Preview failure is non-fatal — user can still manually edit price
        }
    }, [openRateChanges]);

    /**
     * Batch equivalent used after a date cascade. Prices are compared against the DB's current
     * amounts rather than the client's cached charge, so a stale list can't mislead the user.
     * A 403 (no recalculate permission) is swallowed exactly like the single-job probe — the
     * user simply never sees a price step.
     */
    const checkForRateChanges = useCallback(async (jobIds: number[]) => {
        if (jobIds.length === 0) return;
        try {
            const previews = await previewJobRates(jobIds);
            openRateChanges(
                previews
                    // Manually-priced jobs are left out entirely rather than shown disabled —
                    // a hand-set price is a decision already made, not one to re-confirm.
                    .filter(p => !p.failed && !p.ratedManually
                        && Math.abs(p.rate - p.currentAmount) > 0.001)
                    .map(p => ({
                        jobId: p.jobId,
                        jobNo: p.jobNo ?? `Job ${p.jobId}`,
                        oldPrice: p.currentAmount,
                        newPrice: p.rate,
                        description: p.description,
                        isPrebook: p.isPrebook,
                    })),
            );
        } catch {
            // Same deliberate swallow as checkForRateChange.
        }
    }, [openRateChanges]);

    const toggleRateSelection = useCallback((jobId: number) => {
        setSelectedRateJobIds((prev) => {
            const next = new Set(prev);
            if (!next.delete(jobId)) next.add(jobId);
            return next;
        });
    }, []);

    const toggleAllRateSelection = useCallback(() => {
        setSelectedRateJobIds((prev) => {
            const selectable = pendingRateChanges.filter(r => !r.ratedManually);
            const allSelected = selectable.length > 0 && selectable.every(r => prev.has(r.jobId));
            return allSelected ? new Set() : new Set(selectable.map(r => r.jobId));
        });
    }, [pendingRateChanges]);

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
            await Promise.all([invalidateJob(job.id), invalidateJobLists()]);
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
            await Promise.all([invalidateJob(job.id), invalidateJobLists()]);
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
           await Promise.all([invalidateJob(variables.jobId), invalidateJobLists()]);
        },
        onError: (error: unknown) => {
            // A 404 carries an authored message from the backend (e.g. the job no longer
            // exists) — show it rather than a generic failure the operator can't act on.
            const message = (error as {message?: string})?.message;
            showToast(message || 'Failed to update POD details.', 'error');
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
            await Promise.all([invalidateJob(job.id), invalidateJobLists()]);
        },
        onError: () => {
            showToast('Failed to dispatch job.', 'error');
        },
    });

    const confirmRateChange = useCallback(async () => {
        const targets = pendingRateChanges.filter(r => selectedRateJobIds.has(r.jobId));
        if (targets.length === 0) return;
        setIsApplyingRate(true);
        const failed: string[] = [];
        try {
            // ApplyRecalculatedJobRate is per-job, so a family applies sequentially. One failure
            // must not strand the rest — the user is told exactly which jobs kept their price.
            for (const target of targets) {
                try {
                    await applyJobRate(target.jobId, target.isPrebook);
                } catch {
                    failed.push(target.jobNo);
                }
            }
            await Promise.all([
                queryClient.invalidateQueries({queryKey: ['jobs', 'detail']}),
                invalidateJobLists(),
                queryClient.invalidateQueries({queryKey: ['notes']}),
            ]);

            if (failed.length === 0) {
                showToast(targets.length === 1 ? 'Price updated' : `Price updated on ${targets.length} jobs`,
                    'success');
            } else {
                showToast(`Price updated on ${targets.length - failed.length} of ${targets.length} jobs — `
                    + `${failed.join(', ')} unchanged`, 'warning');
            }
        } finally {
            setIsApplyingRate(false);
            setPendingRateChanges([]);
            setSelectedRateJobIds(new Set());
        }
    }, [pendingRateChanges, selectedRateJobIds, showToast]);

    const dismissRateChange = useCallback(() => {
        setPendingRateChanges([]);
        setSelectedRateJobIds(new Set());
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
        checkForRateChanges,
        pendingRateChanges,
        selectedRateJobIds,
        toggleRateSelection,
        toggleAllRateSelection,
        isApplyingRate,
        confirmRateChange,
        dismissRateChange,
    };
}
