/**
 * Additional Services API Service
 *
 * React-native API service for additional services operations.
 * Used by the additional-services-dialog for managing job services.
 */

import { apiClient } from './apiClient';
import { AdditionalService, PaginatedResponse } from '../components/dialogs/additional-services-dialog/types';

/**
 * Additional Services API Service Class
 * Handles all additional services-related API operations.
 */
export class AdditionalServicesApiService {
    /**
     * Check if client has any additional services available
     */
    async hasClientItemsAvailable(clientId: number, speedId: number): Promise<boolean> {
        return apiClient.get<boolean>('job/HasClientItemsAvailable', {
            clientId,
            speedId,
        });
    }

    /**
     * Get all available services for a client/speed/job combination
     */
    async getServices(
        clientId: number,
        speedId: number,
        jobId: number
    ): Promise<PaginatedResponse<AdditionalService>> {
        return apiClient.get<PaginatedResponse<AdditionalService>>('job/GetAllClientItems', {
            clientId,
            speedId,
            jobId,
        });
    }

    /**
     * Calculate the PPD exclusive amount (excludes GST)
     */
    async calculatePpdExclusiveAmount(clientId: number, amount: number): Promise<number> {
        return apiClient.get<number>('job/PPDExclusiveAmount', {
            clientId,
            amount,
        });
    }

    /**
     * Add services to a job
     */
    async addServicesToJob(
        jobId: number,
        serviceIds: number[],
        totalCost: number
    ): Promise<void> {
        await apiClient.post('job/AddClientItemsToJob', {
            serviceIds,
            totalCost,
        }, {
            params: { jobId },
        });
    }
}

export const additionalServicesApi = new AdditionalServicesApiService();

export default additionalServicesApi;
