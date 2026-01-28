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
            // Use parseDateFromApi to preserve airport-local times without conversion
            return {
                arrivalTime: parseDateFromApi(dto.arrivalTime),
                processingTimeMins: dto.processingTimeMins,
                cargoOpeningTime: parseDateFromApi(dto.cargoOpeningTime),
                cargoClosingTime: parseDateFromApi(dto.cargoClosingTime),
                deliverByTime: dto.deliverByTime ? parseDateFromApi(dto.deliverByTime) : undefined,
            };
        } catch (error) {
            console.error('Error fetching cargo ready time:', error);
            return null;
        }
    }

    /**
     * Get scheduled flight options for a job
     */
    async getScheduledFlightOptions(params: GetFlightOptionsParams): Promise<FlightViewModel[]> {
        try {
            const flights = await apiClient.get<FlightViewModelDto[]>(
                'nationwideJob/GetScheduledFlightOptions',
                {
                    departureDate: params.departureDate,
                    jobId: params.jobId,
                    ...(params.airlineId !== undefined && { airlineId: params.airlineId }),
                    ...(params.departureAirportId !== undefined && { departureAirportId: params.departureAirportId }),
                    ...(params.arrivalAirportId !== undefined && { arrivalAirportId: params.arrivalAirportId }),
                    minimumLayoverMinutes: params.minimumLayoverMinutes ?? 60,
                }
            );

            if (!flights || flights.length === 0) {
                return [];
            }

            // Transform DTOs to domain models with Dayjs objects
            return flights.map((dto) => this.transformFlightDto(dto));
        } catch (error) {
            console.error('Error fetching scheduled flight options:', error);
            throw error;
        }
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
