/**
 * Hook for job field update mutations
 */

import {useMutation, useQueryClient} from '@tanstack/react-query';
import {queryKeys} from '../../../../query/queryClient';
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
} from '../../../../services/jobDetailApi';
import type {IJob, IAddressViewModel, UpdatePodDetailsRequest} from '../JobDetails.types';

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

    const invalidateJob = () => {
        queryClient.invalidateQueries({queryKey: queryKeys.jobs.all});
    };

    const updateFieldMutation = useMutation({
        mutationFn: async ({job, field, value, isRecurring, timezone}: UpdateFieldParams) => {
            if (job.isBulkJob) {
                await updateBulkJobDetail(job.id, field, value, timezone);
            } else {
                await updateJobDetail(job.id, field, value, isRecurring, timezone);
            }
        },
        onSuccess: (_data, {job}) => {
            showToast(`${job.jobNo} updated`, 'success');
            invalidateJob();
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
        },
        onSuccess: (_data, {job}) => {
            showToast(`${job.jobNo} updated`, 'success');
            invalidateJob();
        },
        onError: () => {
            showToast('Failed to update address. Please try again.', 'error');
        },
    });

    const updatePodMutation = useMutation({
        mutationFn: (data: UpdatePodDetailsRequest) => updatePodDetails(data),
        onSuccess: () => {
            invalidateJob();
        },
        onError: () => {
            showToast('Failed to update POD details.', 'error');
        },
    });

    const toggleReadStatusMutation = useMutation({
        mutationFn: ({jobId, hasBeenRead}: {jobId: number; hasBeenRead: boolean}) =>
            updateJobReadStatus(jobId, hasBeenRead),
        onSuccess: () => {
            invalidateJob();
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
                    const display = courier.id && courier.id !== 'undefined' && courier.id.trim() !== ''
                        ? `${courier.id}: ${courier.name}`
                        : courier.name;
                    return display;
                }
            } catch {
                // Ignore
            }
            return null;
        },
        onSuccess: (courierDisplay) => {
            if (courierDisplay) {
                showToast(`Dispatched to ${courierDisplay}`, 'success');
            } else {
                showToast('Job dispatched successfully', 'success');
            }
            invalidateJob();
        },
        onError: () => {
            showToast('Failed to dispatch job.', 'error');
        },
    });

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
    };
}
