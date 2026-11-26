/**
 * Dispatch Job Interfaces for React Components
 *
 * Mirrors the AngularJS IDispatchJob model for use in the React job list.
 * These are the "already-transformed" domain models (Dayjs dates, not strings),
 * received from the home controller after DTO mapping.
 */

import type React from 'react';
import type {Dayjs} from 'dayjs';
import type {AddressViewModel} from './address';
import type {JobNumberMatchMode} from './interfaces/job.interface';
import type {ShowToastFn} from '../services/toastService';

import {RequestOptions} from "../api/requestOptions";

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
    selected?: boolean;
    /** Job search: an exact job-number match dated outside the searched window. */
    outsideDateRange?: boolean;
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
    /** The server's single resolved status. Render from this, never from statusId + done + void. */
    resolvedStatusId?: number;
    resolvedIsVoid?: boolean;
    resolvedIsComplete?: boolean;
    void?: boolean;
    /** Bulk rows only: pushed to live dispatch. Distinct from `done`, which means delivered. */
    released?: boolean;
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
    refA?: string;
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
    isPartnerJob?: boolean;
    invoiced?: boolean;
    allowSplit?: boolean;
    isActive?: boolean;
    done?: boolean;
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
    /** The live job id behind a bulk row, whose own `id` is a BulkJobId. */
    linkedJobId?: number;
    displaySplitJobDetail?: boolean;
    jobRelationshipTypeId?: number;

    // UI helper fields
    searchText?: string;
    relatedJobs?: DispatchJobSuggestion[];
    assignedFlight?: AssignedFlight;
    assignedAgent?: AssignedAgent;
    sentToPartnerName?: string | null;
    /** Network partner holding the job (tucJob.NpAgentId), whether or not it has dispatched its own driver yet. */
    networkPartnerName?: string | null;
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
    /** Job search: skip the exact/prefix job-number tiers and match anywhere in the number. */
    forceContains?: boolean;
    jobId?: number;
    bulkJobId?: number;
    sortColumn?: string;
    sortDirection?: string;
    /** When true, the list is disabled and shows no results */
    disabled?: boolean;
    // Dispatch specific
    isInternal?: boolean;
    despatchViewIds?: (string | number)[];
    selectedClearListId?: number;
    /** Current Work list: the courier whose available work to fetch. */
    courierId?: number;
}

export interface JobSearchResult {
    jobs: DispatchJob[];
    totalCount: number;
    hasMore: boolean;
    /** Stats-header counts over every match. Present on the first page only. */
    statusCounts?: JobListStatusCounts | null;
    /** Job search: how the job-number term matched, and what to tell the operator about it. */
    searchNotice?: JobSearchNotice | null;
}

/** What a job search tells the operator beyond the rows themselves. */
export interface JobSearchNotice {
    /** The job-number term this result was searched with, so the notice never pairs with a newer term. */
    jobTerm: string | null;
    /** How a job-number term matched; null when no job number was searched. */
    matchMode: JobNumberMatchMode | null;
    /** Empty job-number search: jobs starting with the term outside the dates (51 means "over 50"). */
    outsideWindowCount: number | null;
    /** Span of those out-of-window matches; only set when every one of them was found. */
    outsideWindowRange: {from: Dayjs; to: Dayjs} | null;
    /** The search hit its match cap, so the total is a lower bound. */
    totalIsCapped: boolean;
    /** The search was too broad to run (term too short, or it timed out). */
    searchTooBroad: boolean;
}

export interface JobListStatusCounts {
    total: number;
    /** What the Unassigned tab lists. */
    unassigned: number;
    /** What the Active tab lists — everything not done, so `transit` is a part of it. */
    active: number;
    transit: number;
    done: number;
}

export interface FetchConfig {
    fetchFn: (params: JobListSearchParams, options?: RequestOptions) => Promise<JobSearchResult>;
    queryKeyFn: (params: JobListSearchParams) => readonly unknown[];
    initialParams: JobListSearchParams;
    /** Auto-refresh interval in ms (React Query refetchInterval). `false`/undefined = off. */
    refetchInterval?: number | false;
    /**
     * Set when the fetch returns the full result set and has no backend search
     * support (e.g. Current Work, which loads a courier's whole job list with
     * no `searchText`/pagination params). The panel filters locally instead of
     * forwarding `searchText` to the fetch.
     */
    clientSideSearch?: boolean;
}

// ── React Component Props ────────────────────────────────────────────

export interface JobListPanelProps {
    showToast: ShowToastFn;
    isUsCustomer?: boolean;
    appPage: AppPage;
    onJobSelect?: (job: DispatchJob) => void;
    /**
     * Highlighted job, owned by the host page so sibling lists share one selection;
     * `null` means none. Leave unset for the panel to track its own clicks.
     */
    selectedJobId?: number | null;
    onJobDispatch?: (job: DispatchJob, courierId: number) => void;
    onSearchChange?: (searchText: string) => void;
    onCategoryChange?: (category: string) => void;
    onAddStop?: (job: DispatchJob) => void;
    /** Called when jobs are fetched/updated (fetchConfig mode) — used to sync map markers */
    onJobsLoaded?: (jobs: DispatchJob[]) => void;
    defaultCategory?: JobCategory;
    /**
     * Category that outranks both the stored preference and `defaultCategory`.
     * For scopes that dictate their own filter -- the dispatch clear-list, which
     * V1 forced to `needs-dispatch` on area click. Never persisted, so leaving
     * the scope restores whatever the operator had chosen.
     */
    forcedCategory?: JobCategory;
    /**
     * Category tabs this panel never offers, e.g. Unassigned on a single driver's
     * Current work. A stored or forced value naming one falls back to `defaultCategory`.
     */
    hiddenCategories?: readonly JobCategory[];
    /** Prefix for localStorage keys — prevents collisions between multiple instances */
    storagePrefix?: string;
    /** Drives the panel's React Query data fetching */
    fetchConfig: FetchConfig;
    /** Hide the "Logged-in only" toggle in the toolbar */
    hideLoggedInSwitch?: boolean;
    /** File Undeliverable jobs under Done instead of Active (Current Work). */
    undeliverableIsDone?: boolean;
    /**
     * Card header DOM node (from BoxShell). When provided, the view options
     * (density / reset columns / logged-in toggle) are portaled into the header
     * instead of the toolbar.
     */
    headerSlot?: HTMLElement | null;
    /**
     * Content rendered as the card's first row, above the stats header. Used by
     * the dispatch page for the views rail; left unset elsewhere.
     */
    topSlot?: React.ReactNode;
    /** Hands the host page a function for pushing search params into the panel's data fetch */
    setUpdateSearchParamsCallback?: (cb: (params: Partial<JobListSearchParams>) => void) => void;
    /** Job search: widen the page's date filter to take in this span, and search again. */
    onWidenDates?: (range: {from: Dayjs; to: Dayjs}) => void;
    /** What an empty list says when the page holds it to a date range (see `dateFilterEmptyState`). */
    dateEmptyState?: {title: string; message: string; actionText?: string; onAction?: () => void};
}
