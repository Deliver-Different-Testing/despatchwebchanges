/**
 * Nationwide API Service
 *
 * React-native API service for nationwide job operations.
 * Used by the flight-agent-confirmation-dialog for cargo processing calculations.
 */

import {apiClient} from './apiClient';
import dayjs from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import {
    FlightCargoProcessing,
    FlightCargoProcessingDto
} from '../components/dialogs/flight-agent-confirmation-dialog/types';
import {parseDateFromApi} from '../utils/dateUtils';
import {
    AddAgentRecoveryRequest,
    FlightSearchResponseDto, FlightSearchResult, FlightViewModel,
    FlightViewModelDto, GetFlightOptionsParams, GetRecurringFlightOptionsParams, NationwideSuggestion,
    RecoveryAgentJobViewModel, RemoveAgentRecoveryRequest, UpdateAgentRecoveryRequest
} from "../interfaces/nationwideJobs";

// Extend dayjs with plugins so returned Dayjs objects have all required methods
dayjs.extend(isBetween);
dayjs.extend(utc);
dayjs.extend(timezone);

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
        // Use parseDateFromApi to preserve airport-local times without conversion
        return {
            arrivalTime: parseDateFromApi(dto.arrivalTime),
            processingTimeMins: dto.processingTimeMins,
            cargoOpeningTime: parseDateFromApi(dto.cargoOpeningTime),
            cargoClosingTime: parseDateFromApi(dto.cargoClosingTime),
            deliverByTime: dto.deliverByTime ? parseDateFromApi(dto.deliverByTime) : undefined,
        };
    }

    /**
     * Check if flight webhooks are active for a job
     */
    async getFlightWebhookStatus(jobId: number): Promise<{ active: boolean }> {
        return apiClient.get<{ active: boolean }>(
            'nationwideJob/GetFlightWebhookStatus',
            {jobId}
        );
    }

    /**
     * Get scheduled flight options for a job
     */
    async getScheduledFlightOptions(params: GetFlightOptionsParams): Promise<FlightSearchResult> {
        try {
            const response = await apiClient.get<FlightSearchResponseDto>(
                'nationwideJob/GetScheduledFlightOptions',
                {
                    departureDate: params.departureDate,
                    jobId: params.jobId,
                    ...(params.airlineId !== undefined && {airlineId: params.airlineId}),
                    ...(params.departureAirportId !== undefined && {departureAirportId: params.departureAirportId}),
                    ...(params.arrivalAirportId !== undefined && {arrivalAirportId: params.arrivalAirportId}),
                    minimumLayoverMinutes: params.minimumLayoverMinutes ?? 60,
                    includeNearbyAirports: params.includeNearbyAirports ?? false,
                }
            );

            const flightDtos = response.flights ?? [];

            return {
                flights: flightDtos.map((dto) => this.transformFlightDto(dto)),
                message: response.message,
            };
        } catch (error) {
            console.error('Error fetching scheduled flight options:', error);
            throw error;
        }
    }

    /**
     * Get flight options for a recurring booking's "saved flight" picker.
     * Route-based (airports supplied directly) and rate-free — the dialog only
     * needs to pick a flight number.
     */
    async getRecurringFlightOptions(params: GetRecurringFlightOptionsParams): Promise<FlightSearchResult> {
        try {
            const response = await apiClient.get<FlightSearchResponseDto>(
                'nationwideJob/GetRecurringFlightOptions',
                {
                    departureDate: params.departureDate,
                    bookingId: params.bookingId,
                    ...(params.departureAirportId !== undefined && {departureAirportId: params.departureAirportId}),
                    ...(params.arrivalAirportId !== undefined && {arrivalAirportId: params.arrivalAirportId}),
                    minimumLayoverMinutes: params.minimumLayoverMinutes ?? 60,
                    includeNearbyAirports: params.includeNearbyAirports ?? false,
                }
            );

            const flightDtos = response.flights ?? [];

            return {
                flights: flightDtos.map((dto) => this.transformFlightDto(dto)),
                message: response.message,
            };
        } catch (error) {
            console.error('Error fetching recurring flight options:', error);
            throw error;
        }
    }

    /**
     * Get the recovery agent assignments for a job
     */
    async getAgentRecoveryJobs(jobId: number): Promise<RecoveryAgentJobViewModel> {
        return apiClient.get<RecoveryAgentJobViewModel>(
            'nationwideJob/GetAgentRecoveryJobs',
            {jobId}
        );
    }

    /**
     * Get the active airports that have at least one agent — used for recovery
     * agent assignment, where only airports with agents are selectable.
     */
    async getAllActiveAirports(): Promise<NationwideSuggestion[]> {
        return apiClient.get<NationwideSuggestion[]>('nationwideJob/GetAllActiveAirports');
    }

    /**
     * Get all active airports (no agent filter) — used by the flight From/To
     * pickers, which must list every active airport.
     */
    async getAllActiveAirportSuggestions(): Promise<NationwideSuggestion[]> {
        return apiClient.get<NationwideSuggestion[]>('nationwideJob/GetAllActiveAirportSuggestions');
    }

    /**
     * Get the agents that operate out of a specific airport
     */
    async getAgentOptionsByAirport(airportId: number): Promise<NationwideSuggestion[]> {
        return apiClient.get<NationwideSuggestion[]>(
            'nationwideJob/GetAgentOptionsByAirport',
            {airportId}
        );
    }

    /**
     * Assign a recovery agent to a job for a given airport
     */
    async addAgentRecoveryJob(request: AddAgentRecoveryRequest): Promise<void> {
        await apiClient.post<void>('nationwideJob/AddAgentRecoveryJob', request);
    }

    /**
     * Update an existing recovery agent assignment (e.g. promote to primary)
     */
    async updateAgentRecoveryJob(request: UpdateAgentRecoveryRequest): Promise<void> {
        await apiClient.post<void>('nationwideJob/UpdateAgentRecoveryJob', request);
    }

    /**
     * Remove a recovery agent assignment from a job
     */
    async removeAgentRecoveryJob(recoveryId: number): Promise<void> {
        const request: RemoveAgentRecoveryRequest = {recoveryId};
        await apiClient.post<void>('nationwideJob/RemoveAgentRecoveryJob', request);
    }

    /**
     * Transform a FlightViewModelDto to FlightViewModel with Dayjs dates
     */
    private transformFlightDto = (dto: FlightViewModelDto): FlightViewModel => {
        return {
            ...dto,
            departureTime: parseDateFromApi(dto.departureTime),
            arrivalTime: parseDateFromApi(dto.arrivalTime),
            flightSegments: dto.flightSegments?.map((segment) => ({
                ...segment,
                departureTime: parseDateFromApi(segment.departureTime),
                arrivalTime: parseDateFromApi(segment.arrivalTime),
            })) ?? [],
        };
    };
}

export const nationwideApi = new NationwideApiService();

export default nationwideApi;
