import {Coordinates} from "../components/overview/overview.interfaces";

export interface HereMapCredentials {
    apiKey: string;
}

export interface JobLocation {
    lat: number;
    lng: number;
}

export interface ChildJob {
    id: number | string;
    pickup: JobLocation;
    delivery: JobLocation;
    flight: boolean;
    index?: number; // Added by the service for tracking
}

export interface Job {
    id: number | string;
    pickup: JobLocation;
    delivery?: JobLocation;
    childJobs?: ChildJob[];
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
    job?: Job | null;
    courierLocation?: CourierLocation | null;
    selectedJobIndex?: number;
    timestamp?: number;
    disableAutoZoom?: boolean;
    preserveView?: boolean;
}