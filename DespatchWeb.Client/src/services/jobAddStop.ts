import {apiClient} from '../api/client';
import {toastService} from './toastService';
import JobSuffix from '../types/enums/job-suffix.enum';
import type {EditAddressDialogViewModel} from '../types';

export interface AddStopJob {
    id: number;
    pickupAddress?: unknown;
    deliveryAddress?: unknown;
}

export interface AddStopJobWithNumber extends AddStopJob {
    jobNo: string;
}

export const blankAddress = (): EditAddressDialogViewModel => ({
    addressLine1: '',
    addressLine2: '',
    addressLine3: '',
    addressLine4: '',
    addressLine5: '',
    addressLine6: '',
    addressLine7: '',
    addressLine8: '',
    fullAddress: '',
});

export const hasBothAddresses = (job: AddStopJob): boolean => !!job.pickupAddress && !!job.deliveryAddress;

/** Returns the id of the job created for the new stop. */
export const addStopToJob = (
    jobId: number,
    pickUpAddress?: EditAddressDialogViewModel,
    deliveryAddress?: EditAddressDialogViewModel,
): Promise<number> => apiClient.post<number>('job/AddStopToJob', {jobId, pickUpAddress, deliveryAddress});

/** Which kind of stop a job number allows, or undefined (with a warning toast) when none. */
export function stopKindForJob(jobNo: string): 'pickup' | 'delivery' | undefined {
    const suffix = jobNo.toString().slice(-1);
    if (suffix === JobSuffix.Pickup) return 'pickup';
    if (suffix === JobSuffix.Delivery) return 'delivery';
    toastService.showWarningToast('Cannot add stop to this job');
    return undefined;
}
