import {JobStatus} from "../enums/job-status.enum";
import {LateEventType} from "../enums/late-event-type.enum";
import {DaysOfWeek} from "../enums/days-of-week.enum";
import {Frequency} from "../enums/frequency.enum";
import {HolidayDeliveryOptions} from "../enums/holiday-delivery-options.enum";
import {IFlightSegment, IFlightSegmentDto} from "../components/Nationwide/nationwide.interfaces";
import {AirportViewModel} from "../react/interfaces";
import {Dayjs} from "dayjs";

export interface IJobGroupDto {
    job: IJobDto;
    relatedJobs: IJobDto[];
}

export interface IJobGroup {
    job: IJob;
    relatedJobs: IJob[];
}

export interface IJob {
    angularId: string;
    id: number;
    rootParentId?: number;
    hasBeenRead: boolean;
    time?: Dayjs;
    bookedDate?: Dayjs;
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
    dispatchTime?: Dayjs;
    booked: Dayjs;
    puTime?: Dayjs;
    clientNotes: string;
    internalNotes: string;
    followupTime?: Dayjs;
    internalStatusId?: number;
    childNotes: string;
    locked?: boolean;
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
    truckStartTime?: Dayjs;
    truckHours?: number;
    privateRes?: boolean;
    allowSplit?: boolean;
    completedTime?: Dayjs;
    fromContactName: string;
    fromContactNumber: string;
    fromContactNumberSource?: string;
    ratedManually?: boolean;
    sizeId?: number;
    oneOff?: boolean;
    preBook: boolean;
    isBulkJob: boolean;
    runName: string;
    scheduleName: string;
    conNote: string;
    airportOnly?: boolean;
    hasNationwide?: boolean;
    dispatcherName: string;
    createdDate?: Dayjs;
    pickupAddress: IAddressViewModel;
    deliveryAddress: IAddressViewModel;
    toAirportId?: number;
    fromAirportId?: number;
    assignedFlight?: IAssignedFlight;
    assignedAgent?: IAgent;
    assignedCourier?: ISuggestion;
    parcelDimensions: IParcelDimensions[];
    deliverToLeaveId?: number;
    isActive: boolean;
    isArchived: boolean;
    clientColor?: string;
    searchText?: string;
    deliverByTime?: Dayjs;
    distance: number;
    readTrackerInfo?: IReadTrackerInfo;
    inActiveBy?: ISuggestion;
    inActiveDate?: Dayjs;
    firstDue?: Dayjs;
    nextDue?: Dayjs;
    lastDone?: Dayjs;
    stopDate?: Dayjs;
    restartDate?: Dayjs;
    active?: boolean;
    daysOfWeek?: DaysOfWeek
    frequency?: Frequency;
    holidayDeliveryOption: HolidayDeliveryOptions,
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
    deliverToPrivateResString: string;
    bookingSource?: ISuggestion;
    isInvoiced: boolean;
    barcode?: string;
    isFlightAssigned: boolean;
    isAgentAssigned: boolean;
    
    // Private variables
    _createdDateStr?: string;
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

export interface IJobDto {
    angularId: string;
    id: number;
    rootParentId?: number;
    hasBeenRead: boolean;
    time?: string;
    bookedDate?: string;
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
    dispatchTime?: string;
    booked: string;
    puTime?: string;
    clientNotes: string;
    internalNotes: string;
    followupTime?: string;
    internalStatusId?: number;
    childNotes: string;
    locked?: boolean;
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
    truckStartTime?: string;
    truckHours?: number;
    privateRes?: boolean;
    allowSplit?: boolean;
    completedTime?: string;
    fromContactName: string;
    fromContactNumber: string;
    fromContactNumberSource?: string;
    ratedManually?: boolean;
    sizeId?: number;
    oneOff?: boolean;
    preBook: boolean;
    isBulkJob: boolean;
    runName: string;
    scheduleName: string;
    conNote: string;
    airportOnly?: boolean;
    hasNationwide?: boolean;
    dispatcherName: string;
    createdDate?: string;
    pickupAddress: IAddressViewModel;
    deliveryAddress: IAddressViewModel;
    toAirportId?: number;
    fromAirportId?: number;
    assignedFlight?: IAssignedFlightDto;
    assignedAgent?: IAgent;
    assignedCourier?: ISuggestion;
    parcelDimensions: IParcelDimensions[];
    deliverToLeaveId?: number;
    isActive: boolean;
    isArchived: boolean;
    clientColor?: string;
    searchText?: string;
    deliverByTime?: string;
    distance: number;
    readTrackerInfo?: IReadTrackerInfoDto;
    inActiveBy?: ISuggestion;
    inActiveDate?: string;
    firstDue?: string;
    nextDue?: string;
    lastDone?: string;
    stopDate?: string;
    restartDate?: string;
    active?: boolean;
    daysOfWeek?: number;
    frequency?: number;
    holidayDeliveryOption: number;
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

export interface UpdateBulkJobPackagesRequest extends UpdateJobPackagesBase {
    bulkJobId: number;
}

export interface UpdateJobPackagesRequest extends UpdateJobPackagesBase {
    jobId: number;
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
    dimensions: string;
    barcode?: string;
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
    pu?: boolean;
    do?: boolean;
    dgClass?: number;
    notes: string;
    itemId: number;
}

export interface IAddressViewModel {
    addressLine1: string;
    addressLine2: string;
    addressLine3: string;
    addressLine4: string;
    addressLine5: string;
    addressLine6: string;
    addressLine7: string;
    addressLine8: string;
    latitude?: number;
    longitude?: number;
    fullAddress: string;
    toSuburbId?: number;
    cbd?: boolean;
    address?: string;
    our_suburb?: string;
}

export interface IEditAddressDialogViewModel extends IAddressViewModel {
    stateAbbreviation?: string;
    shipmentDetails?: IShipmentDetails;
}

export interface IShipmentDetails {
    contactName?: string;
    contactMobile?: string;
    weight?: number;
    depth?: number;
    length?: number;
    height?: number;
    quantity?: number;
    jobNotes?: string;
}

export interface ISuggestion {
    id: number;
    text: string;
    selected?: boolean;
}

export interface IMultiSuggestion extends ISuggestion {
    selected: boolean;
}

export interface IAirlineSuggestion extends ISuggestion {
    fullAirlineName: string;
}

export interface IAirportSuggestion extends ISuggestion {
    timezone: string;
}

export interface ITimeZoneSuggestion extends ISuggestion {
    timeZoneIana: string;
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
}

export interface IDestination {
    id: number;
    label: string;
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

export interface IAgentInfoDialog extends IAgent {
    airports?: AirportViewModel[];
    address?: IAddressViewModel;
}

export interface IJobQueryParams {
    order?: string;
    orderDirection?: string;
    startDate?: Dayjs;
    endDate?: Dayjs;
    page?: number;
    pageSize?: number;
    searchText?: string;
    useTime?: boolean;
    statusFilter?: string; // 'needs-dispatch', 'all', 'active', etc.
}

export interface IJobQueryParamsDto {
    order?: string;
    orderDirection?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    pageSize?: number;
    searchText?: string;
    useTime?: boolean;
    statusFilter?: string; // 'needs-dispatch', 'all', 'active', etc.
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

export interface DfrntEvent {
    id: number;
    jobNumber: string;
    clientCode: string;
    eventDate: Dayjs;
    closedDate?: Dayjs;
    eventType?: string;
    notes?: string;
}

export interface ClientItemsViewModel {
    itemId: number;
    clientId: number;
    name: string;
    description: string;
    perItem: boolean;
    rate: number;
    onlyVan: boolean;
    selected: boolean;
}

export interface INoteType extends ISuggestion {
    isPublic: boolean;
    description?: string;
}

export interface JobCreateViewModelDto {
    clientId: number;
    deliverToContact: string;
    podName: string;
    pickUpAddress: IAddressViewModel;
    deliveryAddress: IAddressViewModel;
    date: string;
    fromContactName: string;
    refA: string;
    refB: string;
    deliveryNotes: string;
    pickupNotes: string;
    jobNotes: string;
    van: boolean;
    truck: boolean;
    pedal: boolean;
    attention: boolean;
    vanOk: boolean;
    reprice: boolean;
    void: boolean;
    done: boolean;
    charge: number;
    fromLat: number;
    fromLong: number;
    toLat: number;
    toLong: number;
    speedId: number;
    vehicleId: number;
}

export interface InternalStatus extends ISuggestion {
    defaultSchedule: string;
    defaultMins: number | null;
}

export interface IJobNote {
    noteId?: number;
    noteTypeId: number;
    noteTypeName?: string;
    jobId?: number;
    bulkJobId?: number;
    jobNumber?: string;
    jobBookingId?: number;
    noteText: string;
    isImportant: boolean;
    createdDate?: Dayjs;
    createdBy?: number;
    createdByName?: string;
    updatedDate?: Dayjs;
    updatedBy?: number;
    updatedByName?: string;
    noteTextSummary?: string;
    
    // Private 
    _createdDateStr?: string;
    _updatedDateStr?: string;
}

export interface IJobNoteDto {
    noteId?: number;
    noteTypeId: number;
    noteTypeName?: string;
    jobId?: number;
    bulkJobId?: number;
    jobNumber?: string;
    jobBookingId?: number;
    noteText: string;
    isImportant: boolean;
    createdDate?: string;
    createdBy?: number;
    createdByName?: string;
    updatedDate?: string;
    updatedBy?: number;
    updatedByName?: string;
    noteTextSummary?: string;
}

export interface IDispatchJob {
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

    // Status and timing information
    speedId?: number;
    statusId?: JobStatus;
    internalStatusId?: number;
    statusName?: string;
    status?: string;
    time?: Dayjs;
    booked: Dayjs;
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

    assignedFlight?: IAssignedFlight;
    assignedAgent?: IAgent;

    conNote?: string;
    followupTime?: Dayjs;
    fromAirportId?: number;
    toAirportId?: number;
    van?: boolean;
    truck?: boolean;

    pickUpTimeZone: ISuggestion;
    deliveryTimeZone: ISuggestion;
    
    
    // Children (from backend grouping)
    children?: IDispatchJob[];

    // Private
    _isExpanded?: boolean;
    _groupChildren?: IDispatchJob[];
    _deliveryTimeString?: string;
    _deliveryDateString?: string;
    _followupDateString?: string;
    _pickUpTimeZoneStr?: string;
    _deliveryTimeZoneStr?: string;
}

export interface IDispatchJobDto {
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

    // Status and timing information
    speedId?: number;
    statusId?: JobStatus;
    internalStatusId?: number;
    statusName?: string;
    status?: string;
    time?: string;
    booked: string;
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

    assignedFlight?: IAssignedFlightDto;
    assignedAgent?: IAgent;

    conNote?: string;
    followupTime: string;
    fromAirportId?: number;
    toAirportId?: number;
    van?: boolean;
    truck?: boolean;

    pickUpTimeZone: ISuggestion;
    deliveryTimeZone: ISuggestion;

    // Children (from backend grouping)
    children?: IDispatchJobDto[];
}

export interface ILateCallRequest {
    jobId: number;
    lateType: LateEventType;
    lateTime: number;
    calculationRequired: boolean;
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

export interface IBulkUpdateRequest {
    jobIds: number[];
}

export interface IBulkReadUpdateRequest extends IBulkUpdateRequest {
    shouldMarkAsRead: boolean;
}

export interface IJobSearchResultDto {
    jobs: IDispatchJobDto[];
    totalCount: number;
    hasMore: boolean;
    mapItems?: IDispatchMapItem[];
}

export interface IJobSearchResult {
    jobs: IDispatchJob[];
    totalCount: number;
    hasMore: boolean;
    mapItems?: IDispatchMapItem[];
}

export interface IDispatchMapItem {
    jobId: number;
    jobNo: string;
    pickupAddress: IAddressViewModel;
    deliveryAddress: IAddressViewModel;
    assignedCourier?: ISuggestion;
    statusId?: number; // Job status: 0 = New/Undispatched, 1 = Dispatched, etc.
}

export interface IDeletePriceComponentRequest {
    jobId: number;
    chargeId: number;
    isArchived?: boolean;
}

export interface ISimpleRepriceJobModel {
    jobId: number;
    isPrebook: boolean;
    isBulk: boolean;
    newPrice: number
}