import {AssignedFlight, Suggestion} from "../../interfaces/job.interface";

export interface OverviewQueryParams {
    statusGroup?: number;
    page: number;
    limit: number;
    search?: string;
    startDate?: Date;
    endDate?: Date;
    orderBy?: string;
    orderDirection?: string;
    regions?: Suggestion[];
    speeds?: Suggestion[];
}

export interface DateRange {
    start: Date | null;
    end: Date | null;
}

export interface OverviewStatsViewModel {
    active: number;
    inactive: number;
    completed: number;
}

export interface MapConfig {
    center: Coordinates;
    zoom: number;
    job: OverviewJobLocation | null;
    selectedJobIndex: number;
    courierLocation: Coordinates | null;
}

export interface OverviewChildJobLocation {
    id: number;
    pickup: Coordinates;
    delivery: Coordinates;
    flight: boolean;
}

export interface OverviewJobLocation {
    id: number;
    pickup: Coordinates;
    delivery: Coordinates;
    childJobs: OverviewChildJobLocation[];
}

export interface Coordinates {
    lat: number;
    lng: number;
}

export interface MegaMapResponse {
    jobId: number;
    jobNumber: string;
    jobStatus: string;
    estimatedDelivery: Date;
    pickupLocation: AddressDetails;
    deliveryLocation: AddressDetails;
    courierLocation: CourierLocation;
    isFlightJob: boolean;
    flightInfo: AssignedFlight;
}

export interface CourierLocation {
    courierId: number;
    courierName: string;
    coordinates: Coordinates;
}

export interface DriverStats {
    driverName: string;
    completedToday: number;
    lastCompleted: Date | null;
}

export interface OpenJobResponse {
    jobId: number;
    reference: string;
    status: string;
    pickupTime: Date;
    pickupName: string;
    pickupAddress: string;
    deliveryTime: Date;
    deliveryName: string;
    deliveryAddress: string;
    driverName: string;
    completedToday: number;
    lastCompleted: Date | null;
    quantity: number;
    packageType: string;
    mileage: number;
}

export interface OverviewTableChildJob {
    jobId: number;
    jobName: string;
    status: string;
    completion: number;
    pickup: string;
    delivery: string;
    driver: string;
    region: string;
}

export interface OverviewTableParentJob {
    jobId: number;
    jobName: string;
    status: string;
    completion: number;
    pickup: string;
    delivery: string;
    driver: string;
    region: string;
    childJobs: OverviewTableChildJob[];
}


export interface DriverViewModel {
    name: string;
    jobs: ViewJob[];
    completedToday: number;
    lastCompleted: string;
    expanded: boolean;
}

export interface ViewJob {
    jobId: number;
    reference: string;
    status: string;
    pickup: {
        time: Date;
        name: string;
        address: string;
    };
    delivery: {
        time: Date;
        name: string;
        address: string;
    };
    quantity: number;
    packageType: string;
    mileage: number;
    driverName: string;
}
