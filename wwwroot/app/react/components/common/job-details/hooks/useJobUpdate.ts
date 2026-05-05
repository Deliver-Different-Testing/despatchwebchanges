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

export function useJobUpdate(
    showToast: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void,
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

    const updateFieldMutation = useMutation({
        mutationFn: async ({job, field, value, isRecurring, timezone}: UpdateFieldParams) => {
            if (job.isBulkJob) {
                await updateBulkJobDetail(job.id, field, value, timezone);
            } else {
                await updateJobDetail(job.id, field, value, isRecurring, timezone);
            }
            return {job, field};
        },
        onSuccess: async ({job, field}) => {
            showToast(`${job.jobNo} updated`, 'success');
            await invalidateJob(job.id);
            await invalidateJobLists();
            if (RERATE_FIELDS.has(field) && !job.ratedManually) {
                await checkForRateChange(job);
            }
        },
        onError: () => {
            showToast('Failed to update job. Please try again.', 'error');
        },
    });

    const updateAddressMutation = useMutation({
        mutationFn: async ({job, address, isDelivery}: UpdateAddressParams) => {
            if (isDelivery) {
                await updateDeliveryAddress(job.id, job.preBook, address);
            } else {
                await updatePickupAddress(job.id, job.preBook, address);
            }
            return {job};
        },
        onSuccess: async ({job}) => {
            showToast(`${job.jobNo} updated`, 'success');
            await invalidateJob(job.id);
            await invalidateJobLists();
            if (!job.ratedManually) {
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
