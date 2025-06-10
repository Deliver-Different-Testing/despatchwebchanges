import {AddressViewModel, AssignedFlight} from "../../interfaces/job.interface";
import {Dayjs} from "dayjs";

export interface OverviewQueryParams {
    statusGroup?: number;
    page: number;
    limit: number;
    search?: string;
    startDate?: Dayjs;
    endDate?: Dayjs;
    orderBy?: string;
    orderDirection?: string;
    regions?: number[];
    speeds?: number[];
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
    pickupLocation: AddressViewModel;
    deliveryLocation: AddressViewModel;
    courierLocation: CourierLocation;
    isFlightJob: boolean;
    flightInfo: AssignedFlight;
}

export interface CourierLocation {
    courierId: number;
    courierName: string;
    coordinates: Coordinates;
}

export interface OpenJobResponse {
    jobId: number;
    reference: string;
    status: string;
    pickupTime: Dayjs;
    pickupName: string;
    pickupAddress: string;
    deliveryTime: Dayjs;
    deliveryName: string;
    deliveryAddress: string;
    driverName: string;
    completedToday: number;
    lastCompleted: Dayjs | null;
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
