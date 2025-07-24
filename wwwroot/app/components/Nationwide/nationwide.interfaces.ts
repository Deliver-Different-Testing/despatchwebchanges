import {Coordinates} from "../overview/overview.interfaces";

export interface IFlightViewModel {
    airline: string;
    flightNumber: string;
    departureTime: Date;
    arrivalTime: Date;
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

    // Multi-segment support
    isMultiSegment: boolean;
    elapsedTime: number;
    score: number;
    connectionId: string;
    flightSegments: FlightSegmentViewModel[];
}

export interface FlightSegmentViewModel {
    segmentOrder: number;
    carrierFsCode: string;
    flightNumber: string;
    departureTime: Date;
    arrivalTime: Date;
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
    departureAirportTimeZone?: string;
    arrivalAirportName?: string;
    arrivalAirportCity?: string;
    arrivalAirportCountry?: string;
    arrivalAirportTimeZone?: string;
    aircraftName?: string;
    aircraftType?: string;
    airlineName?: string;
}

export interface HereMapsConfig {
    center: Coordinates;
    zoom: number;
    selectedJobIndex: number;
    timestamp: Date;
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
   departureDate: Date;
    flightSegments: FlightSegmentViewModel[];
}
