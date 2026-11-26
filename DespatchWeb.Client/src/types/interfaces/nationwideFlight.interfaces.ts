/**
 * Flight and flight-segment types for the Nationwide/air-freight domain.
 *
 * Shared by the AngularJS flight dialogs and `functions/dtoMappings`, and the
 * React flight-details dialog and `job-details`.
 *
 * Distinct from `react/interfaces/nationwideJobs.ts`, which carries the
 * React-side shapes with `Dayjs` fields; these are the DTO-facing ones.
 */

import type {Dayjs} from "dayjs";
// Type-only both ways: `job.interface` imports IFlightSegment back from here,
// and erased imports keep that cycle harmless.

export interface IFlightViewModel {
    airline: string;
    airlineCode?: string;
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

interface IFlightSegmentCommon<TTime> {
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

export interface IFlightSegment extends IFlightSegmentCommon<Dayjs> {
    // Private
    _departureTimeStr: string;
    _arrivalTimeStr: string;
    _arrivalTimeZoneStr: string;
    _departureTimeZoneStr: string;
}

export type IFlightSegmentDto = IFlightSegmentCommon<string>;

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

