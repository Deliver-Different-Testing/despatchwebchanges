/**
 * Nationwide API Service
 *
 * React-native API service for nationwide job operations.
 * Used by the flight-agent-confirmation-dialog for cargo processing calculations.
 */

import { apiClient } from './apiClient';
import dayjs from 'dayjs';
import { FlightCargoProcessing } from '../components/dialogs/flight-agent-confirmation-dialog/types';

interface FlightCargoProcessingDto {
    arrivalTime: string;
    processingTimeMins: number;
    cargoOpeningTime: string;
    cargoClosingTime: string;
    deliverByTime?: string;
}

/**
 * Nationwide API Service Class
 * Handles all nationwide job-related API operations.
 */
export class NationwideApiService {
    /**
     * Calculate cargo ready time for a flight assignment
     */
    async calculateCargoReadyTime(
        jobId: number,
        carrierFsCode: string,
        arrivalTime: string
    ): Promise<FlightCargoProcessing | null> {
        try {
            const dto = await apiClient.get<FlightCargoProcessingDto>(
                'nationwideJob/CalculateCargoReadyTime',
                {
                    jobId,
                    carrierFsCode,
                    arrivalTime,
                }
            );

            if (!dto) return null;

            // Transform DTO to domain model with Dayjs objects
            return {
                arrivalTime: dayjs(dto.arrivalTime),
                processingTimeMins: dto.processingTimeMins,
                cargoOpeningTime: dayjs(dto.cargoOpeningTime),
                cargoClosingTime: dayjs(dto.cargoClosingTime),
                deliverByTime: dto.deliverByTime ? dayjs(dto.deliverByTime) : undefined,
            };
        } catch (error) {
            console.error('Error fetching cargo ready time:', error);
            return null;
        }
    }
}

export const nationwideApi = new NationwideApiService();

export default nationwideApi;
