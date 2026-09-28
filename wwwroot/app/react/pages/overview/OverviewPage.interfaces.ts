// ── Mount config (passed from AngularJS controller) ──

export interface MountOverviewConfig {
    showToast: ShowToastFn;
    isUsCustomer: boolean;
    onOpenJobDetail: (jobId: number) => void;
}

export type ShowToastFn = {
    showSuccessToast: (message: string) => void;
    showWarningToast: (message: string) => void;
    showErrorToast: (message?: string) => void;
    showInfoToast: (message: string) => void;
};

// ── Component props ──

export interface OverviewPageProps {
    showToast: ShowToastFn;
    isUsCustomer: boolean;
    onOpenJobDetail: (jobId: number) => void;
    setRefreshCallback: (cb: () => void) => void;
}

// ── API / Query types ──

export interface OverviewQueryParams {
    statusGroup?: number;
    page: number;
    limit: number;
    search?: string;
    startDate?: Date;
    endDate?: Date;
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
    expanded?: boolean;
}

export interface PaginatedResponse<T> {
    items: T[];
    total: number;
    page: number;
    pages: number;
}

// ── Map types ──

export interface Coordinates {
    lat: number;
    lng: number;
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

export interface MapConfig {
    center: Coordinates;
    zoom: number;
    job: OverviewJobLocation | null;
    selectedJobIndex: number;
    courierLocation: Coordinates | null;
}

// ── Filter types ──

export interface ISuggestion {
    id: number;
    text: string;
    selected?: boolean;
}

export interface DateRange {
    start?: Date;
    end?: Date;
}

// ── Open Jobs types ──

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

export interface IOpenJobResponse {
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
    _pickUpTimeStr?: string;
    _deliveryTimeStr?: string;
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
        time?: string;
        timeString?: string;
        name: string;
        address: string;
    };
    delivery: {
        time?: string;
        timeString?: string;
        name: string;
        address: string;
    };
    quantity: number;
    packageType: string;
    mileage: number;
    driverName: string;
}

// ── Table types ──

export interface TableSort {
    column: string;
    direction: 'asc' | 'desc';
}
