import {IAddressViewModel, IAssignedFlight} from "../../interfaces/job.interface";
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
    couriers?: number[];
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
    pickupLocation: IAddressViewModel;
    deliveryLocation: IAddressViewModel;
    courierLocation: CourierLocation;
    isFlightJob: boolean;
    flightInfo: IAssignedFlight;
}

export interface CourierLocation {
    courierId: number;
    courierName: string;
    coordinates: Coordinates;
}

export interface IOpenJobResponse {
    jobId: number;
    reference: string;
    status: string;
    pickupTime?: Dayjs;
    pickupName: string;
    pickupAddress: string;
    deliveryTime?: Dayjs;
    deliveryName: string;
    deliveryAddress: string;
    driverName: string;
    completedToday: number;
    lastCompleted?: Dayjs;
    quantity: number;
    packageType: string;
    mileage: number;
    
    // Private
    _pickUpTimeStr?: string;
    _deliveryTimeStr?: string;
}

export interface IOpenJobResponseDto {
    jobId: number;
    reference: string;
    status: string;
    pickupTime?: string;
    pickupName: string;
    pickupAddress: string;
    deliveryTime?: string;
    deliveryName: string;
    deliveryAddress: string;
    driverName: string;
    completedToday: number;
    lastCompleted?: string;
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
        time?: Dayjs;
        timeString?: string;
        name: string;
        address: string;
    };
    delivery: {
        time?: Dayjs;
        timeString?: string;
        name: string;
        address: string;
    };
    quantity: number;
    packageType: string;
    mileage: number;
    driverName: string;
}

export interface IOverViewDateSearchRange {
    start?: Dayjs;
    end?: Dayjs;
}

export interface IOverviewStatistics {
    active: number;
    inactive: number;
    completed: number;
}

export interface IOverviewQuery {
    order: string;
    direction: string;
    page: number;
    limit: number;
    total: number;
}