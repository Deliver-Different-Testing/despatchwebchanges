import {Coordinates} from "../components/overview/overview.interfaces";

export interface HereMapCredentials {
    apiKey: string;
}

export interface JobLocation {
    lat: number;
    lng: number;
}

export interface IHereMapChildJob {
    id: number | string;
    pickup: JobLocation;
    delivery: JobLocation;
    flight: boolean;
    index?: number; // Added by the service for tracking
}

export interface IHereMapJob {
    id: number | string;
    pickup: JobLocation;
    delivery?: JobLocation;
    childJobs?: IHereMapChildJob[];
    flight?: boolean;
    timestamp?: number; // For forcing updates
}

export interface CourierLocation {
    lat: number;
    lng: number;
}

export interface HereMapConfig {
    center?: Coordinates;
    zoom?: number;
    job?: IHereMapJob;
    courierLocation?: CourierLocation;
    selectedJobIndex?: number;
    timestamp?: number;
    disableAutoZoom?: boolean;
    preserveView?: boolean;
}