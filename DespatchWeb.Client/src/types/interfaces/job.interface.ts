import {JobStatus} from "../enums/job-status.enum";
import {DaysOfWeek} from "../enums/days-of-week.enum";
import {Frequency} from "../enums/frequency.enum";
import {HolidayDeliveryOptions} from "../enums/holiday-delivery-options.enum";
import {IFlightSegment, IFlightSegmentDto} from "./nationwideFlight.interfaces";
import {Dayjs} from "dayjs";

export interface IJobGroupDto {
    job: IJobDto;
    relatedJobs: IJobDto[];
}

export interface IJobGroup {
    job: IJob;
    relatedJobs: IJob[];
}

/** Fields whose wire and client shapes are identical; IJob and IJobDto add the ones that differ. */
interface IJobCommon {
    id: number;
    rootParentId?: number;
    hasBeenRead: boolean;
    direct?: boolean;
    van: boolean;
    jobRelationshipTypeId?: number;
    vanOk?: boolean;
    done?: boolean;
    void?: boolean;
    truck?: boolean;
    saturdayDelivery?: boolean;
    return?: boolean;
    pedal?: boolean;
    reprice?: boolean;
    attention?: boolean;
    pickupFrom?: number;
    jobNo: string;
    speed: string;
    speedName: string;
    source: string;
    notifiedName: string;
    acceptedName: string;
    speedId?: number;
    notify: string;
    vehicle: ISuggestion;
    clientId?: number;
    jobType?: number;
    jobTypeDescription?: string;
    client: string;
    clientName: string;
    from: string;
    fromSuburbId?: number;
    fromSuburbName: string;
    fromPostCode: string;
    fromAddress: string;
    to: string;
    toSuburbId?: number;
    toSuburbName: string;
    toPostCode: string;
    toAddress: string;
    toCity: string;
    courier: string;
    gstRate?: number;
    remain?: number;
    pickupTime?: number;
    deliveryTime?: number;
    alertLatePickup?: number;
    alertLateDelivery?: number;
    minutes?: number;
    statusId?: number;
    /** The server's single resolved status. Render from this, not from statusId + done + void. */
    resolvedStatusId?: number;
    resolvedIsVoid?: boolean;
    resolvedIsComplete?: boolean;
    /** Bulk rows only: pushed to live dispatch. Distinct from `done`, which means delivered. */
    released?: boolean;
    status: string;
    statusName: string;
    lp?: number;
    ld?: number;
    contactName: string;
    loggedInContactName: string;
    deliverToContact: string;
    trackingMethod?: number;
    trackingMobile: string;
    trackingEmail: string;
    bookingContactEmail?: string;
    udStatus: string;
    podPhoto: Uint8Array;
    deliverySignature: Uint8Array;
    podPhotos: Uint8Array[];
    podName: string;
    toContactPhone: string;
    speedAccepted: string;
    acceptedJobTypeId?: number;
    notifiedJobTypeId?: number;
    size: ISuggestion;
    weight?: number;
    items?: number;
    refA: string;
    refB: string;
    ourRef: string;
    sigNotRequired: string;
    charge: number;
    date: string;
    clientNotes: string;
    internalNotes: string;
    internalStatusId?: number;
    childNotes: string;
    locked?: boolean;
    isPartnerJob?: boolean;
    /** Name of the OTHER tenant on a partner pairing — populated for sender + receiver. */
    partnerTenantName?: string | null;
    /**
     * IntMgrPartnerPairing.Id that this job belongs to. Sent on JobChangeRequest
     * payloads so the backend can disambiguate when a tenant has multiple active
     * pairings. Null for non-partner jobs or for legacy jobs predating the column.
     */
    partnerPairingId?: number | null;
    invoiced?: boolean;
    pickUpLongitude?: number;
    pickUpLatitude?: number;
    deliveryLongitude?: number;
    deliveryLatitude?: number;
    palletInfo: IPalletInfo[];
    relatedJobs: ISuggestion[];
    courierLatitude?: number;
    courierLongitude?: number;
    runOrder?: number;
    courierData: ICourierData;
    allowDispatch?: boolean;
    dgDocumentation?: boolean;
    dgClass?: number;
    displaySplitJobDetail?: boolean;
    truckWeightLimit?: number;
    truckHours?: number;
    privateRes?: boolean;
    allowSplit?: boolean;
    fromContactName: string;
    fromContactNumber: string;
    fromContactNumberSource?: string;
    ratedManually?: boolean;
    sizeId?: number;
    oneOff?: boolean;
    preBook: boolean;
    isBulkJob: boolean;
    /** The live job id behind a bulk row, whose own `id` is a BulkJobId. */
    linkedJobId?: number;
    runName: string;
    scheduleName: string;
    conNote: string;
    airportOnly?: boolean;
    hasNationwide?: boolean;
    dispatcherName: string;
    pickupAddress: IAddressViewModel;
    deliveryAddress: IAddressViewModel;
    toAirportId?: number;
    fromAirportId?: number;
    isAgentJob?: boolean;
    assignedAgent?: IAgent;
    assignedCourier?: ISuggestion;
    parcelDimensions: IParcelDimensions[];
    deliverToLeaveId?: number;
    isActive: boolean;
    isArchived: boolean;
    clientColor?: string;
    searchText?: string;
    distance: number;
    inActiveBy?: ISuggestion;
    active?: boolean;
    pickUpWindowMins?: number;
    deliverByWindowMins?: number;
    pickUpTimeZone: ISuggestion;
    deliveryTimeZone: ISuggestion;
    hasDgDocsString?: string;
    calculateDimsOncePerJob: boolean;
    customJobName?: string;
    tailLiftPu: boolean;
    tailLiftDo: boolean;
    deliverToPrivateRes: boolean;
    bookingSource?: ISuggestion;
    isInvoiced: boolean;
    barcode?: string;
    isFlightAssigned: boolean;
    isAgentAssigned: boolean;
}

export interface IJob extends IJobCommon {
    parentId?: number;
    time?: Dayjs;
    bookedDate?: Dayjs;
    dispatchTime?: Dayjs;
    booked: Dayjs;
    puTime?: Dayjs;
    followupTime?: Dayjs;
    truckStartTime?: Dayjs;
    completedTime?: Dayjs;
    createdDate?: Dayjs;
    // Speed-grouping classification (mirrors live jobs). Gates the flight UI.
    isFlightJob?: boolean;
    // Recurring flight: complete flight number (e.g. "NZ123") saved against the
    // booking so the same flight auto-assigns on each push-to-live.
    savedFlightNumber?: string;
    assignedFlight?: IAssignedFlight;
    deliverByTime?: Dayjs;
    readTrackerInfo?: IReadTrackerInfo;
    inActiveDate?: Dayjs;
    firstDue?: Dayjs;
    nextDue?: Dayjs;
    lastDone?: Dayjs;
    stopDate?: Dayjs;
    restartDate?: Dayjs;
    daysOfWeek?: DaysOfWeek
    frequency?: Frequency;
    holidayDeliveryOption: HolidayDeliveryOptions,
    // Create-ahead offset (days). Backed by tucJobBooking.RecurringInitialDays.
    // Drives uspPrebookSet's @TargetDate = today + N. Raising the value
    // triggers CreateAheadBackfillDialog. Zero / null = legacy same-day push.
    recurringInitialDays?: number;
    // Recurring Route assignment. Null when not assigned to any route.
    // Cascades through booking tree on update via JobProperty.RouteId.
    routeId?: number | null;
    deliverToPrivateResString: string;
    pickupArrivalTime?: Dayjs;
    deliveryArrivalTime?: Dayjs;
    accessorialChargeGroupId?: number;

    // Private variables
    _createdDateStr?: string;
    _createdDateTimeStr?: string;
    _readyStr?: string;
    _pickupArrivalTimeStr?: string;
    _deliveryArrivalTimeStr?: string;
    _startTimeStr?: string;
    _puTimeStr?: string;
    _dispatchTimeStr?: string;
    _followupTimeStr?: string;
    _bookedStr?: string;
    _completedTimeStr?: string;
    _completedTimeLongStr?: string;
    _inActiveDateStr?: string;
    _deliverByTimeStr?: string;
    _readTrackerTimeStr?: string;
    _pickUpTimeZoneStr?: string;
    _deliveryTimeZoneStr?: string;
    _stopDateStr?: string;
    _restartDateStr?: string;
}

export interface IJobDto extends IJobCommon {
    time?: string;
    bookedDate?: string;
    dispatchTime?: string;
    booked: string;
    puTime?: string;
    followupTime?: string;
    truckStartTime?: string;
    completedTime?: string;
    createdDate?: string;
    isFlightJob?: boolean;
    savedFlightNumber?: string;
    assignedFlight?: IAssignedFlightDto;
    deliverByTime?: string;
    readTrackerInfo?: IReadTrackerInfoDto;
    inActiveDate?: string;
    firstDue?: string;
    nextDue?: string;
    lastDone?: string;
    stopDate?: string;
    restartDate?: string;
    daysOfWeek?: number;
    frequency?: number;
    holidayDeliveryOption: number;
    // See IJob.recurringInitialDays. Wire-format INT (nullable) — direct
    // pass-through from tucJobBooking.RecurringInitialDays column.
    recurringInitialDays?: number;
    // Recurring Route assignment from JobRecurringMapping. Null when
    // unassigned. dtoMappings maps this to IJob.routeId.
    routeId?: number | null;
    pickupArrivalTime?: string;
    deliveryArrivalTime?: string;
}

interface UpdateJobPackagesBase {
    parcels: IParcelDimensions[];
}

export interface IParcelDimensions {
    itemId?: number;
    itemName: string;
    height?: number;
    length?: number;
    depth?: number;
    weight?: number;
    cubic?: number;
    dimensions: string;
    barcode?: string;
    itemTypes?: Array<{name: string; quantity: number}>;
}

export interface IAssignedFlight {
    flightNumber: string;
    expectedDeparture?: Dayjs;
    departureTimeZone: string;
    expectedArrival?: Dayjs;
    arrivalTimeZone: string;
    notes: string;
    flightSegments?: IFlightSegment[];
}

export interface IAssignedFlightDto {
    flightNumber: string;
    expectedDeparture?: string;
    departureTimeZone: string;
    expectedArrival?: string;
    arrivalTimeZone: string;
    notes: string;
    flightSegments?: IFlightSegmentDto[];
}

export interface IPalletInfo {
    id: number;
    quantity: number;
    weight: number;
    length: number;
    depth: number;
    height: number;
    cubic: number;
    pu?: boolean;
    do?: boolean;
    dgClass?: number;
    notes: string;
    itemId: number;
    /** #860/#861: 0 active, 1 not picked up (driver), 2 not for delivery (removed in Dispatch). */
    itemStatus?: number;
}

export interface IAddressViewModel {
    addressLine1: string;  // Company/Building/Complex
    addressLine2: string;  // Unit/Suite
    addressLine3: string;  // Street Number
    addressLine4: string;  // Street Name
    addressLine5: string;  // City (US) or Suburb (NZ)
    addressLine6: string;  // State (US) or City (NZ)
    addressLine7: string;  // ZIP Code (US) or Post Code (NZ)
    addressLine8: string;  // Country
    latitude?: number;
    longitude?: number;
    fullAddress: string;
    toSuburbId?: number;
    cbd?: boolean;
    address?: string;
    our_suburb?: string;
}

export interface ISuggestion {
    id: number;
    text: string;
    selected?: boolean;
}

export interface IAiCourierSuggestion extends ISuggestion {
    isAiSuggestion: boolean;
}

export interface IClearListViewModel {
    areas: IAreaClearList[];
}

export interface IAreaClearList {
    id: number;
    name: string;
    order: number;
    percentHeight: number;
    top: IClearListSection[];
    middle: IClearListSection[];
    bottom: IClearListSection[];
    totalRemaining: number;
    isActive: boolean;
}

export interface IClearListSection {
    courierNumber: string;
    courierData: ICourierData;
    destinations: IDestination[];
}

export interface ICourierData {
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
    /** Dollars behind the minimum hourly guarantee this pay period; absent when on target or not permitted. */
    earningsBehindBy?: number | null;
    /** Tenant-local ISO time today's minimum paid block ends; absent unless the alert is on. */
    minimumEndsAt?: string | null;
    /** Warning window in minutes; absent = alert off. */
    minimumAlertMinutes?: number | null;
}

export interface IDestination {
    id: number;
    label: string;
}

export interface IClearListDebugViewModel {
    courierId: number;
    courierCode: string;
    courierName: string;
    channelId: number | null;
    fleetName: string | null;
    gpsPolygonId: number | null;
    gpsPolygonName: string | null;
    gpsPolygonSuburbs: string[];
    gpsLatitude: number | null;
    gpsLongitude: number | null;
    gpsTimestamp: string | null;
    gpsAgeMinutes: number | null;
    assignedClearListAreaId: number | null;
    assignedClearListAreaName: string | null;
    assignedStatus: number | null;
    assignedStatusLabel: string;
    polygonAreaMappings: IPolygonAreaMapping[];
    isLoggedIn: boolean;
    loginTime: string | null;
    explanation: string;
}

export interface IPolygonAreaMapping {
    clearListAreaId: number;
    clearListAreaName: string;
    areaChannelId: number | null;
    channelMatches: boolean;
}

export interface IAgent {
    agentId: number;
    agentName: string;
    agentRate: number;
    agentRanking: string;
    agentNotes: string;
    agentPhone?: string;
    agentEmail?: string;
}

export interface PriceBreakdown {
    chargeId: number;
    name: string;
    amount: number;
    jobId?: number;
    prebookJobId?: number;
    costAmount?: number;
    childJobId?: number;
    isArchived?: boolean;
}

export interface InternalStatus extends ISuggestion {
    defaultSchedule: string;
    defaultMins: number | null;
}

/** Dispatch row fields whose wire and client shapes are identical; IDispatchJob and IDispatchJobDto add the ones that differ. */
interface IDispatchJobCommon {
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

    // Status and timing information
    speedId?: number;
    statusId?: JobStatus;
    internalStatusId?: number;
    statusName?: string;
    status?: string;
    remain?: number;

    // Courier information
    courier?: string;
    courierSearchLoading: boolean;
    assignedCourier?: ISuggestion;
    courierData?: ICourierData;

    // Addresses
    from?: string;
    toAddress?: string;
    toSuburbID?: number;
    pickupAddress: IAddressViewModel;
    deliveryAddress: IAddressViewModel;
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
    vehicle?: ISuggestion;

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
    /**
     * IntMgrPartnerPairing.Id that this job belongs to. Sent on JobChangeRequest
     * payloads so the backend can disambiguate when a tenant has multiple active
     * pairings. Null for non-partner jobs or for legacy jobs predating the column.
     */
    partnerPairingId?: number | null;
    invoiced?: boolean;
    allowSplit?: boolean;
    isActive?: boolean;
    done?: boolean;
    bulkJob?: boolean;
    preBook?: boolean;

    // Special delivery options
    size?: ISuggestion;
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
    relatedJobs?: ISuggestion[];

    assignedAgent?: IAgent;

    conNote?: string;
    fromAirportId?: number;
    toAirportId?: number;
    van?: boolean;
    truck?: boolean;

    pickUpTimeZone: ISuggestion;
    deliveryTimeZone: ISuggestion;
}

export interface IDispatchJob extends IDispatchJobCommon {
    time?: Dayjs;
    booked: Dayjs;
    followupTime?: Dayjs;
    assignedFlight?: IAssignedFlight;

    accessorialChargeGroupId?: number;

    // Children (from backend grouping)
    children?: IDispatchJob[];

    amount?: number;
    weight?: number;
    quantity?: number;

    // Private
    _isExpanded?: boolean;
    _groupChildren?: IDispatchJob[];
    _deliveryTimeString?: string;
    _deliveryDateString?: string;
    _followupDateString?: string;
    _pickUpTimeZoneStr?: string;
    _deliveryTimeZoneStr?: string;
    _aiCourierSuggestions?: IAiCourierSuggestion[];
    _aiSuggestionsLoading?: boolean;
}

export interface IDispatchJobDto extends IDispatchJobCommon {
    time?: string;
    booked: string;
    followupTime: string;
    assignedFlight?: IAssignedFlightDto;

    // Children (from backend grouping)
    children?: IDispatchJobDto[];
}

export interface IReadTrackerInfoDto {
    hasBeenRead: boolean;
    readBy: string;
    readDate?: string;
}

export interface IReadTrackerInfo {
    hasBeenRead: boolean;
    readBy: string;
    readDate?: Dayjs;
    
    // Private
    _readDateStr?: string
}

export interface VoidJobRequest extends VoidJobRequestBase {
    jobId: number;
    selectedJobIds?: number[];
}

export interface VoidBulkJobRequest extends VoidJobRequestBase {
    bulkJobId: number;
    selectedJobIds?: number[];
}

interface VoidJobRequestBase {
    voidSingleJobOnly: boolean;
    voidReason?: string;
}

export interface IJobSearchResultDto {
    jobs: IDispatchJobDto[];
    totalCount: number;
    hasMore: boolean;
    mapItems?: IDispatchMapItem[];
    statusCounts?: IJobListStatusCounts;
    matchMode?: JobNumberMatchMode | null;
    outsideWindowCount?: number | null;
    outsideWindowFrom?: string | null;
    outsideWindowTo?: string | null;
    totalIsCapped?: boolean;
    searchTooBroad?: boolean;
}

/** How a job-number search matched the typed term. */
export type JobNumberMatchMode = 'exact' | 'prefix' | 'contains';

/**
 * The job list's stats header, counted server-side over every match — before any category filter,
 * so switching tabs cannot move the numbers. Answered with the first page only.
 */
export interface IJobListStatusCounts {
    total: number;
    unassigned: number;
    active: number;
    transit: number;
    done: number;
}

export interface IDispatchMapItem {
    jobId: number;
    jobNo: string;
    pickupAddress: IAddressViewModel;
    deliveryAddress: IAddressViewModel;
    assignedCourier?: ISuggestion;
    statusId?: number; // Job status: 0 = New/Undispatched, 1 = Dispatched, etc.
}

