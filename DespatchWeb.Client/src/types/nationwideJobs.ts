import {Dayjs} from "dayjs";
import {Suggestion} from "./job";

export interface FlightCargoProcessingDto {
    arrivalTime: string;
    processingTimeMins: number;
    cargoOpeningTime: string;
    cargoClosingTime: string;
    deliverByTime?: string;
}

interface FlightSegmentBase<TTime> {
    segmentOrder: number;
    carrierFsCode: string;
    flightNumber: string;
    departureTime: TTime;
    arrivalTime: TTime;
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

export type FlightSegmentDto = FlightSegmentBase<string>;

export type FlightSegment = FlightSegmentBase<Dayjs>;

interface FlightViewModelBase<TTime, TSegment> {
    airline: string;
    flightNumber: string;
    departureTime: TTime;
    arrivalTime: TTime;
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
    flightSegments: TSegment[];
}

export type FlightViewModelDto = FlightViewModelBase<string, FlightSegmentDto>;

export type FlightViewModel = FlightViewModelBase<Dayjs, FlightSegment>;

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

export interface FlightSearchResponseDto {
    flights: FlightViewModelDto[];
    message?: string;
}

export interface FlightSearchResult {
    flights: FlightViewModel[];
    message?: string;
    /**
     * Departure time of the last flight returned — the paging cursor the
     * widget's "load more" / "next day" actions advance from. Undefined when
     * the search came back empty.
     */
    lastDepartureTime?: Dayjs;
}

// Flight assignment / lookup types

/**
 * Body for `POST nationwideJob/AssignFlightToJob`.
 * Mirrors `Models/AssignFlightToJobRequest.cs`.
 */
export interface AssignFlightToJobRequest {
    jobId: number;
    fromAirportId?: number | null;
    toAirportId?: number | null;
    flightNumber: string;
    departureDate: string;
    flightSegments: FlightSegmentDto[];
    packageReadyTime?: string | null;
    packageDeliverByTime?: string | null;
    packageDeliveryNotes?: string;
}

export interface AirlineSuggestion extends Suggestion {
    fullAirlineName: string;
}

export interface AirportSuggestion extends Suggestion {
    /** Windows timezone id, as stored on the airport record. */
    timezone: string;
}

// Recovery Agent Management types

export interface NationwideSuggestion extends Suggestion {
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
    assignedAgent: NationwideSuggestion;
    recoveryAgents: RecoveryAgentViewModel[];
}

export interface RecoveryAgentJobViewModel {
    jobId: number;
    jobNumber: string;
    assignedAgent: NationwideSuggestion;
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
