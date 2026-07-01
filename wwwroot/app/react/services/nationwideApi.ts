/**
 * Nationwide API Service
 *
 * React-native API service for nationwide job operations.
 * Used by the flight-agent-confirmation-dialog for cargo processing calculations.
 */

import { apiClient } from './apiClient';
import dayjs from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { FlightCargoProcessing } from '../components/dialogs/flight-agent-confirmation-dialog/types';
import { Dayjs } from 'dayjs';
import { parseDateFromApi } from '../utils/dateUtils';

// Extend dayjs with plugins so returned Dayjs objects have all required methods
dayjs.extend(isBetween);
dayjs.extend(utc);
dayjs.extend(timezone);

interface FlightCargoProcessingDto {
    arrivalTime: string;
    processingTimeMins: number;
    cargoOpeningTime: string;
    cargoClosingTime: string;
    deliverByTime?: string;
}

export interface FlightSegmentDto {
    segmentOrder: number;
    carrierFsCode: string;
    flightNumber: string;
    departureTime: string;
    arrivalTime: string;
    departureAirportFsCode: string;
    departureTerminal?: string;
    arrivalAirportFsCode: string;
    arrivalTerminal?: string;
    flightEquipmentIataCode: string;
    elapsedTime: number;
    stopsInSegment: number;
    departureAirportName?: string;
    departureAirportCity?: string;
    departureAirportTimeZone: string;
    departureAirportId?: number;
    arrivalAirportName?: string;
    arrivalAirportCity?: string;
    arrivalAirportTimeZone: string;
    arrivalAirportId?: number;
    aircraftName?: string;
    airlineName?: string;
}

export interface FlightViewModelDto {
    airline: string;
    flightNumber: string;
    departureTime: string;
    arrivalTime: string;
    departureAirport: string;
    arrivalAirport: string;
    duration: string;
    stops: number;
    aircraft: string;
    serviceClasses: string[];
    isCodeShare: boolean;
    serviceType: string;
    isCharter: boolean;
    serviceTypeDescription: string;
    amount: number;
    codeShareAirline: string;
    airlineId: number;
    departureTimeZone: string;
    arrivalTimeZone: string;
    isMultiSegment: boolean;
    elapsedTime: number;
    score: number;
    connectionId: string;
    flightSegments: FlightSegmentDto[];
}

export interface FlightSegment {
    segmentOrder: number;
    carrierFsCode: string;
    flightNumber: string;
    departureTime: Dayjs;
    arrivalTime: Dayjs;
    departureAirportFsCode: string;
    departureTerminal?: string;
    arrivalAirportFsCode: string;
    arrivalTerminal?: string;
    flightEquipmentIataCode: string;
    elapsedTime: number;
    stopsInSegment: number;
    departureAirportName?: string;
    departureAirportCity?: string;
    departureAirportTimeZone: string;
    departureAirportId?: number;
    arrivalAirportName?: string;
    arrivalAirportCity?: string;
    arrivalAirportTimeZone: string;
    arrivalAirportId?: number;
    aircraftName?: string;
    airlineName?: string;
}

export interface FlightViewModel {
    airline: string;
    flightNumber: string;
    departureTime: Dayjs;
    arrivalTime: Dayjs;
    departureAirport: string;
    arrivalAirport: string;
    duration: string;
    stops: number;
    aircraft: string;
    serviceClasses: string[];
    isCodeShare: boolean;
    serviceType: string;
    isCharter: boolean;
    serviceTypeDescription: string;
    amount: number;
    codeShareAirline: string;
    airlineId: number;
    departureTimeZone: string;
    arrivalTimeZone: string;
    isMultiSegment: boolean;
    elapsedTime: number;
    score: number;
    connectionId: string;
    flightSegments: FlightSegment[];
}

export interface GetFlightOptionsParams {
    jobId: number;
    departureDate: string;
    airlineId?: number;
    departureAirportId?: number;
    arrivalAirportId?: number;
    minimumLayoverMinutes?: number;
    includeNearbyAirports?: boolean;
}

export interface GetRecurringFlightOptionsParams {
    bookingId: number;
    departureDate: string;
    departureAirportId?: number;
    arrivalAirportId?: number;
    minimumLayoverMinutes?: number;
    includeNearbyAirports?: boolean;
}

interface FlightSearchResponseDto {
    flights: FlightViewModelDto[];
    message?: string;
}

export interface FlightSearchResult {
    flights: FlightViewModel[];
    message?: string;
}

// Recovery Agent Management types

export interface Suggestion {
    id: number;
    text: string;
    selected?: boolean;
}

export interface RecoveryAddressViewModel {
    fullAddress: string;
}

export interface RecoveryAgentViewModel {
    recoveryId: number;
    agentName: string;
    airport: string;
    primaryRecoveryAgent: boolean;
    assignStatus: string;
}

export interface RecoveryJobViewModel {
    jobId: number;
    assignedAgent: Suggestion;
    recoveryAgents: RecoveryAgentViewModel[];
}

export interface RecoveryAgentJobViewModel {
    jobId: number;
    jobNumber: string;
    assignedAgent: Suggestion;
    pickUpAddress: RecoveryAddressViewModel;
    deliveryAddress: RecoveryAddressViewModel;
    packageType: string;
    priority: string;
    lastKnownLocation: string;
    customer: string;
    recoveryJobs: RecoveryJobViewModel[];
}

export interface AddAgentRecoveryRequest {
    jobId: number;
    agentId: number;
    airportId: number;
    isPrimaryRecoveryAgent: boolean;
}

export interface UpdateAgentRecoveryRequest {
    recoveryId: number;
    isPrimaryRecoveryAgent: boolean;
}

export interface RemoveAgentRecoveryRequest {
    recoveryId: number;
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
            { jobId }
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
                    ...(params.airlineId !== undefined && { airlineId: params.airlineId }),
                    ...(params.departureAirportId !== undefined && { departureAirportId: params.departureAirportId }),
                    ...(params.arrivalAirportId !== undefined && { arrivalAirportId: params.arrivalAirportId }),
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
                    ...(params.departureAirportId !== undefined && { departureAirportId: params.departureAirportId }),
                    ...(params.arrivalAirportId !== undefined && { arrivalAirportId: params.arrivalAirportId }),
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
     * Get the active airports available for recovery assignment
     */
    async getAllActiveAirports(): Promise<Suggestion[]> {
        return apiClient.get<Suggestion[]>('nationwideJob/GetAllActiveAirports');
    }

    /**
     * Get the agents that operate out of a specific airport
     */
    async getAgentOptionsByAirport(airportId: number): Promise<Suggestion[]> {
        return apiClient.get<Suggestion[]>(
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
