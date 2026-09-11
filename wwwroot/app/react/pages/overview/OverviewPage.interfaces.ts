import type {Dayjs} from 'dayjs';

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
    /*
     * Dayjs is accepted alongside Date so the Dispatch panels can pass the
     * toolbar's range through unconverted — a fresh Date per render would change
     * the React Query key every time. `formatDateForApi` treats both identically.
     */
    startDate?: Date | Dayjs;
    endDate?: Date | Dayjs;
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

/*
 * The list view-models live with the components that own them, now that Dispatch
 * mounts the same lists as panels. Re-exported here so this module stays the one
 * import site for the Overview page and its API layer.
 */
export type {
    OverviewTableChildJob,
    OverviewTableParentJob,
} from '../../components/common/deliveries-table';

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

/** Structurally the shared data-table sort state — one type, not a twin. */
export type {SortState as TableSort} from '../../components/common/data-table';
