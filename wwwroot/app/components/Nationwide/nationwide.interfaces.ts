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
}

export interface IFlightPagination {
    items: IFlightViewModel[];
    totalCount: number;
    pageIndex: number;
    pageSize: number;
    lastDepartureTime: Date | null;
}

export interface HereMapsConfig {
    center: Coordinates;
    zoom: number;
    selectedJobIndex: number;
}

export interface StatusChangeEvent {
    jobId: number;
    previousStatusId: number;
    newStatusId: number;
}
