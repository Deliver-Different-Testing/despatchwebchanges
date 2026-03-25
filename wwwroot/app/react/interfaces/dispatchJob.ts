/**
 * Dispatch Job Interfaces for React Components
 *
 * Mirrors the AngularJS IDispatchJob model for use in the React job list.
 * These are the "already-transformed" domain models (Dayjs dates, not strings),
 * received from the home controller after DTO mapping.
 */

import type {Dayjs} from 'dayjs';
import type {AddressViewModel} from './address';
import type {ShowToastFn} from '../services/toastService';
import type {RequestOptions} from '../services/apiClient';

// Re-export shared types that the AngularJS layer already defines
export interface DispatchJobSuggestion {
    id: number;
    text: string;
}

export interface AssignedFlight {
    flightNumber: string;
    expectedDeparture?: Dayjs;
    departureTimeZone: string;
    expectedArrival?: Dayjs;
    arrivalTimeZone: string;
    notes: string;
    flightSegments?: FlightSegment[];
}

export interface FlightSegment {
    carrierFsCode?: string;
    flightNumber?: string;
    departureAirportName?: string;
    departureAirportCity?: string;
    departureAirportCountry?: string;
    arrivalAirportName?: string;
    arrivalAirportCity?: string;
    arrivalAirportCountry?: string;
    airlineName?: string;
}

export interface AssignedAgent {
    agentId: number;
    agentName: string;
    agentRate: number;
    agentRanking: string;
    agentNotes: string;
    agentPhone?: string;
    agentEmail?: string;
}

export interface CourierData {
    courier: string;
    location?: string;
    pu?: string;
    del?: string;
    lrm?: string;
    eta2Lrm?: string;
    courierId?: number;
    courierName?: string;
    courierMobile?: string;
    courierNumber: string;
    latitude?: number;
    longitude?: number;
}

export interface AiCourierSuggestion {
    id: number;
    text: string;
    isAiSuggestion: boolean;
}

/**
 * Core dispatch job model — the transformed domain object
 * that React receives from the AngularJS home controller.
 */
export interface DispatchJob {
    // Core identifiers
    angularId: string;
    selected?: boolean;
    showCourierSearch: boolean;
    id: number;
    jobNo: string;
    hasBeenRead: boolean;
    isParentOrSingle?: boolean;
    parentId: number;
    isFlightJob: boolean;
    isAgentJob: boolean;
    isBulkJob: boolean;
    isArchived: boolean;

    // Status and timing
    speedId?: number;
    statusId?: number;
    internalStatusId?: number;
    statusName?: string;
    status?: string;
    time?: Dayjs;
    booked: Dayjs;
    remain?: number;

    // Courier information
    courier?: string;
    courierSearchLoading: boolean;
    assignedCourier?: DispatchJobSuggestion;
    courierData?: CourierData;

    // Addresses
    from?: string;
    toAddress?: string;
    toSuburbID?: number;
    pickupAddress: AddressViewModel;
    deliveryAddress: AddressViewModel;
    pickUpLongitude?: number;
    pickUpLatitude?: number;
    deliveryLongitude?: number;
    deliveryLatitude?: number;
    pickupContact?: string;
    deliveryContact?: string;

    // Routing data
    direct?: boolean;
    speed?: string;
    notify?: string;
    vehicle?: DispatchJobSuggestion;

    // Job properties
    client?: string;
    clientId?: number;
    clientName?: string;
    jobType?: number;
    minutes?: number;
    pickupTime?: number;
    alertLatePickup?: number;
    deliveryTime?: number;
    alertLateDelivery?: number;

    // Late call fields
    lp?: number;
    ld?: number;

    // Job flags
    locked?: boolean;
    invoiced?: boolean;
    allowSplit?: boolean;
    isActive?: boolean;
    done?: boolean;
    bulkJob?: boolean;
    preBook?: boolean;

    // Special delivery options
    size?: DispatchJobSuggestion;
    return?: boolean;
    dgClass?: number;
    saturdayDelivery?: boolean;

    // Special fields
    childNotes?: string;
    pickupFrom?: number;
    rootParentId?: number;
    displaySplitJobDetail?: boolean;

    // UI helper fields
    searchText?: string;
    relatedJobs?: DispatchJobSuggestion[];
    assignedFlight?: AssignedFlight;
    assignedAgent?: AssignedAgent;
    conNote?: string;
    followupTime?: Dayjs;
    fromAirportId?: number;
    toAirportId?: number;
    van?: boolean;
    truck?: boolean;
    pickUpTimeZone: DispatchJobSuggestion;
    deliveryTimeZone: DispatchJobSuggestion;
    accessorialChargeGroupId?: number;

    // Children (from backend grouping)
    children?: DispatchJob[];

    amount?: number;
    weight?: number;
    quantity?: number;

    // UI state (set by AngularJS)
    _isExpanded?: boolean;
    _groupChildren?: DispatchJob[];
    _deliveryTimeString?: string;
    _deliveryDateString?: string;
    _followupDateString?: string;
    _pickUpTimeZoneStr?: string;
    _deliveryTimeZoneStr?: string;
    _aiCourierSuggestions?: AiCourierSuggestion[];
    _aiSuggestionsLoading?: boolean;
}

// ── Category / Filtering ─────────────────────────────────────────────

export type JobCategory = 'all' | 'needs-dispatch' | 'in-progress' | 'delivered';

// ── Density Modes ────────────────────────────────────────────────────

export type DensityMode = 'normal' | 'dense' | 'ultra-dense';

// ── Sort State ───────────────────────────────────────────────────────

export interface JobListSort {
    column: string | null;
    direction: 'asc' | 'desc' | null;
}

// ── App Page Context ─────────────────────────────────────────────────

export enum AppPage {
    Dispatch = 1,
    Domestic = 2,
    JobSearch = 3,
}

// ── Search Parameters for React-managed data fetching ────────────────

export interface JobListSearchParams {
    order?: string;
    orderDirection?: string;
    startDate?: Dayjs;
    endDate?: Dayjs;
    page?: number;
    pageSize?: number;
    searchText?: string;
    useTime?: boolean;
    statusFilter?: string;
    // Job search specific
    courierIds?: number[];
    clientIds?: number[];
    speedIds?: number[];
    wild?: string;
    job?: string;
    jobId?: number;
    sortColumn?: string;
    sortDirection?: string;
    // Dispatch specific
    isInternal?: boolean;
    despatchViewIds?: (string | number)[];
    selectedClearListId?: number;
}

export interface JobSearchResult {
    jobs: DispatchJob[];
    totalCount: number;
    hasMore: boolean;
}

export interface FetchConfig {
    fetchFn: (params: JobListSearchParams, options?: RequestOptions) => Promise<JobSearchResult>;
    queryKeyFn: (params: JobListSearchParams) => readonly unknown[];
    initialParams: JobListSearchParams;
}

// ── Mount Configuration ──────────────────────────────────────────────

export interface MountJobListConfig {
    showToast: ShowToastFn;
    isUsCustomer?: boolean;
    appPage?: AppPage | number;
    onJobSelect?: (job: DispatchJob) => void;
    onJobDispatch?: (job: DispatchJob, courierId: number) => void;
    onRefresh?: () => void;
    onSearchChange?: (searchText: string) => void;
    onCategoryChange?: (category: string) => void;
    onBackendFilter?: (column: string, direction: string) => void;
    onLoadMoreJobs?: (page: number, pageSize: number) => Promise<{ jobs: DispatchJob[]; totalCount: number; hasMore: boolean }>;
    onAddStop?: (job: DispatchJob) => void;
    defaultCategory?: JobCategory;
    /** Prefix for localStorage keys — prevents collisions between multiple instances */
    storagePrefix?: string;
    /** If provided, React manages its own data fetching via React Query */
    fetchConfig?: FetchConfig;
}

// ── React Component Props ────────────────────────────────────────────

export interface JobListPanelProps {
    showToast: ShowToastFn;
    isUsCustomer?: boolean;
    appPage: AppPage;
    onJobSelect?: (job: DispatchJob) => void;
    onJobDispatch?: (job: DispatchJob, courierId: number) => void;
    onRefresh?: () => void;
    onSearchChange?: (searchText: string) => void;
    onCategoryChange?: (category: string) => void;
    onBackendFilter?: (column: string, direction: string) => void;
    onLoadMoreJobs?: (page: number, pageSize: number) => Promise<{ jobs: DispatchJob[]; totalCount: number; hasMore: boolean }>;
    onAddStop?: (job: DispatchJob) => void;
    defaultCategory?: JobCategory;
    /** Prefix for localStorage keys — prevents collisions between multiple instances */
    storagePrefix?: string;
    /** If provided, React manages its own data fetching via React Query */
    fetchConfig?: FetchConfig;
    /** Called by mount module to allow pushing jobs from AngularJS (legacy, used when no fetchConfig) */
    setJobsCallback?: (cb: (jobs: DispatchJob[], totalCount: number) => void) => void;
    /** Called by mount module to allow triggering refresh from AngularJS */
    setRefreshCallback?: (cb: () => void) => void;
    /** Called by mount module to allow setting selected job from AngularJS */
    setSelectJobCallback?: (cb: (jobId: number) => void) => void;
    /** Called by mount module to allow updating search params from AngularJS */
    setUpdateSearchParamsCallback?: (cb: (params: Partial<JobListSearchParams>) => void) => void;
    /** Dispatch page views (geographic territory filters) shown as inline toggle buttons */
    views?: Array<{ id: number; name: string; selected: boolean }> | null;
    onToggleView?: (view: { id: number; name: string; selected: boolean }) => void;
    onClearViews?: () => void;
}
