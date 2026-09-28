/**
 * Flight and flight-segment types for the Nationwide/air-freight domain.
 *
 * Lived in `components/Nationwide/nationwide.interfaces.ts` until that folder
 * became scheduled for removal with the AngularJS page. Both sides depend on
 * these — the AngularJS flight dialogs and `functions/dtoMappings`, and the
 * React flight-details dialog and `job-details` — so they belong in the shared
 * `interfaces/` folder that outlives the migration.
 *
 * Distinct from `react/interfaces/nationwideJobs.ts`, which carries the
 * React-side shapes with `Dayjs` fields; these are the DTO-facing ones.
 */

import type {Dayjs} from "dayjs";
// Type-only both ways: `job.interface` imports IFlightSegment back from here,
// and erased imports keep that cycle harmless.
import type {IAgent} from "./job.interface";

export interface IFlightViewModel {
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

    // Multi-segment support
    isMultiSegment: boolean;
    elapsedTime: number;
    score: number;
    connectionId: string;
    flightSegments: IFlightSegment[];

    // Private
    _departureTimeStr: string;
    _arrivalTimeStr: string;
    _arrivalTimeZoneStr: string;
    _departureTimeZoneStr: string;
}


export interface IFlightSegment {
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
    departureAirportCountry?: string;
    departureAirportTimeZone: string;
    departureAirportId?: number;
    arrivalAirportName?: string;
    arrivalAirportCity?: string;
    arrivalAirportCountry?: string;
    arrivalAirportTimeZone: string;
    arrivalAirportId?: number;
    aircraftName?: string;
    aircraftType?: string;
    airlineName?: string;
    
    // Private
    _departureTimeStr: string;
    _arrivalTimeStr: string;
    _arrivalTimeZoneStr: string;
    _departureTimeZoneStr: string;
}

export interface IFlightSegmentDto {
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
    departureAirportCountry?: string;
    departureAirportTimeZone: string;
    departureAirportId?: number;
    arrivalAirportName?: string;
    arrivalAirportCity?: string;
    arrivalAirportCountry?: string;
    arrivalAirportTimeZone: string;
    arrivalAirportId?: number;
    aircraftName?: string;
    aircraftType?: string;
    airlineName?: string;
}

export interface StatusChangeEvent {
    jobId: number;
    previousStatusId: number;
    newStatusId: number;
}

export interface AssignFlightToJobRequest {
    jobId: number;
    fromAirportId?: number;
    toAirportId?: number;
    flightNumber: string;
    departureDate: string;
    flightSegments: IFlightSegmentDto[];
    packageReadyTime?: string;
    packageDeliverByTime?: string;
    packageDeliveryNotes?: string;
}

export interface IFlightSearchResponseDto {
    flights: IFlightViewModelDto[];
    message?: string;
}

export interface IFlightViewModelDto {
    airline: string;
    flightNumber: string;
    departureTime: string; // ISO string from API
    arrivalTime: string;   // ISO string from API
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
    flightSegments: IFlightSegmentDto[];
}


export interface IGetFlightOptionsResponse {
    flights: IFlightViewModel[];
    message?: string;
    lastDepartureTime?: Dayjs;
}

export interface IGetAgentOptionsResponse {
    agents: IAgent[];
    message?: string;
}