/**
 * Accessorial Charges API Service
 *
 * React-native API service for accessorial charge operations.
 * Used by the accessorial-charges-dialog for managing job charges.
 */

import { apiClient } from './apiClient';
import {
    AccessorialChargeDto,
    JobAccessorialChargeDto,
    JobAccessorialChargeCreateRequest,
    JobAccessorialChargeUpdateRequest,
} from '../components/dialogs/accessorial-charges-dialog/types';

class AccessorialChargesApiService {
    /**
     * Get available accessorial charges for a group, with already-applied flags.
     */
    async getAvailableCharges(accessorialChargeGroupId: number, jobId: number): Promise<AccessorialChargeDto[]> {
        return apiClient.get<AccessorialChargeDto[]>('AccessorialCharge/GetAvailable', {
            accessorialChargeGroupId,
            jobId,
        });
    }

    /**
     * Get applied accessorial charges on a job.
     */
    async getAppliedCharges(jobId: number): Promise<JobAccessorialChargeDto[]> {
        return apiClient.get<JobAccessorialChargeDto[]>('AccessorialCharge/GetApplied', { jobId });
    }

    /**
     * Bulk-add selected charges to a job.
     */
    async addCharges(jobId: number, charges: JobAccessorialChargeCreateRequest[]): Promise<void> {
        await apiClient.post<void>('AccessorialCharge/Add', charges, { params: { jobId } });
    }

    /**
     * Update a single applied charge (inputValue, notes) and recalculate amount.
     */
    async updateCharge(
        jobAccessorialChargeId: number,
        data: JobAccessorialChargeUpdateRequest
    ): Promise<JobAccessorialChargeDto> {
        return apiClient.put<JobAccessorialChargeDto>('AccessorialCharge/Update', data, {
            params: { jobAccessorialChargeId },
        });
    }

    /**
     * Remove an applied charge from a job.
     */
    async deleteCharge(jobAccessorialChargeId: number): Promise<void> {
        await apiClient.delete<void>('AccessorialCharge/Delete', {
            params: { jobAccessorialChargeId },
        });
    }

    /**
     * Get the current ucjbAmount for a job directly from the DB.
     * Used to avoid relying on the stale prop from the AngularJS scope.
     */
    async getJobAmount(jobId: number): Promise<number> {
        return apiClient.get<number>('AccessorialCharge/JobAmount', { jobId });
    }
}

export const accessorialChargesApi = new AccessorialChargesApiService();
export default accessorialChargesApi;
