import {Coordinates} from "../overview/overview.interfaces";
import dayjs from "dayjs";

export interface IFlightViewModel {
    airline: string;
    flightNumber: string;
    departureTime: dayjs.Dayjs;
    arrivalTime: dayjs.Dayjs;
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
    departureTime: dayjs.Dayjs;
    arrivalTime: dayjs.Dayjs;
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
    departureAirportId?: number;
    arrivalAirportName?: string;
    arrivalAirportCity?: string;
    arrivalAirportCountry?: string;
    arrivalAirportTimeZone?: string;
    arrivalAirportId?: number;
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
    departureDate: string;
    flightSegments: IFlightSegment[];
    packageReadyTime?: string;
    packageDeliverByTime?: Date | string;
    packageDeliveryNotes?: string;
}
