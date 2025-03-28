import {Coordinates} from "../overview/overview.interfaces";
import JobDataType from "./enums/JobDataType";

export interface FlightViewModel {
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
}

export interface AgentViewModel {
    agentId: number;
    agentName: string;
    agentRate: number;
    agentRanking: string;
}

export interface Filter {
    value: number;
    label: string;
    icon: string;
    active: boolean;
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

export type StatusToListMap = Record<number, JobDataType[]>;
