import {Dayjs} from "dayjs";
import {IAgent} from "../../interfaces/job.interface";

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