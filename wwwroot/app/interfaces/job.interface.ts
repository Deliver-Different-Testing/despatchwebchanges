import {JobStatus} from "../enums/job-status.enum";
import {LateEventType} from "../enums/late-event-type.enum";
import {DaysOfWeek} from "../enums/days-of-week.enum";
import {Frequency} from "../enums/frequency.enum";
import {HolidayDeliveryOptions} from "../enums/holiday-delivery-options.enum";
import {IFlightSegment } from "../components/Nationwide/nationwide.interfaces";
import {AirportViewModel} from "../components/dialogs/flight-details-dialog/flight-details-dialog.interfaces";

export interface IJob {
    id: number;
    rootParentId?: number;
    hasBeenRead: boolean;
    time?: Date;
    bookedDate?: Date;
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
    charge: string;
    date: string;
    dispatchTime?: Date;
    booked: Date;
    puTime?: Date;
    clientNotes: string;
    internalNotes: string;
    followupTime?: Date;
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
    truckStartTime?: Date;
    truckHours?: number;
    privateRes?: boolean;
    allowSplit?: boolean;
    completedTime?: Date;
    fromContactName: string;
    fromContactNumber: string;
    ratedManually?: boolean;
    sizeId?: number;
    oneOff?: boolean;
    preBook: boolean;
    bulkJob: boolean;
    runName: string;
    scheduleName: string;
    conNote: string;
    airportOnly?: boolean;
    hasNationwide?: boolean;
    dispatcherName: string;
    createdDate?: Date;
    pickupAddress: IAddressViewModel;
    deliveryAddress: IAddressViewModel;
    toAirportId?: number;
    fromAirportId?: number;
    assignedFlight: IAssignedFlight;
    assignedAgent: IAgent;
    assignedCourier: ISuggestion;
    parcelDimensions: IParcelDimensions[];
    deliverToLeaveId?: number;
    isActive: boolean;
    isArchived: boolean;
    clientColor?: string;
    searchText?: string;
    deliverByTime?: Date;
    distance: number;
    readTrackerInfo: IReadTrackerInfoViewModel;
    inActiveBy?: ISuggestion;
    inActiveDate?: Date;
    firstDue?: Date;
    nextDue?: Date;
    lastDone?: Date;
    stopDate?: Date;
    restartDate?: Date;
    active?: boolean;
    daysOfWeek?: DaysOfWeek
    frequency?: Frequency;
    holidayDeliveryOption: HolidayDeliveryOptions,
    pickUpWindowMins?: number;
    deliverByWindowMins?: number;
    pickUpTimeZone?: ISuggestion;
    deliveryTimeZone?: ISuggestion;
    hasDgDocsString?: string;
    calculateDimsOncePerJob: boolean;
}

export interface UpdateJobPackagesRequest {
    jobId: number;
    parcels: IParcelDimensions[];
}

export interface IParcelDimensions {
    itemId?: number;
    itemName: string;
    height?: number;
    length?: number;
    depth?: number;
    dimensions: string;
}

export interface IAssignedFlight {
    flightNumber: string;
    expectedDeparture?: Date;
    departureTimeZone: string;
    expectedArrival?: Date;
    arrivalTimeZone: string;
    notes: string;
    flightSegments?: IFlightSegment[];
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

export interface IAgentInfoDialog extends  IAgent {
    airports?: AirportViewModel[];
    address?: IAddressViewModel;
}

export interface IJobQueryParams {
    order?: string;
    orderDirection?: string;
    startDate?: Date;
    endDate?: Date;
}

export interface PriceBreakdown {
    chargeId: number;
    name: string;
    amount: number;
    jobId?: number;
    prebookJobId?: number;
    costAmount?: number;
}

export interface DfrntEvent {
    id: number;
    jobNumber: string;
    clientCode: string;
    eventDate: Date;
    closedDate?: Date;
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

export interface JobCreateViewModel {
    clientId: number;
    deliverToContact: string;
    podName: string;
    pickUpAddress: IAddressViewModel;
    deliveryAddress: IAddressViewModel;
    date: Date;
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
    createdDate?: Date;
    createdBy?: number;
    createdByName?: string;
    updatedDate?: Date;
    updatedBy?: number;
    updatedByName?: string;
    noteTextSummary?: string;
}

export interface IDispatchJob {
    // Core identifiers
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

    // Status and timing information
    speedId?: number;
    statusId?: JobStatus;
    internalStatusId?: number;
    statusName?: string;
    status?: string;
    time?: Date;
    booked: Date;
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
    pickupAddress?: IAddressViewModel;
    deliveryAddress?: IAddressViewModel;
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
    followupTime: Date;
    fromAirportId?: number;
    toAirportId?: number;
    van?: boolean;
    truck?: boolean;

    _isExpanded?: boolean;
    _groupChildren?: IDispatchJob[];
}

export interface IClearListEnvelope {
    minimumLatitude: number;
    maximumLatitude: number;
    minimumLongitude: number;
    maximumLongitude: number;
}

export interface ILateCallRequest {
    jobId: number;
    lateType: LateEventType;
    lateTime: number;
    staffId: number;
    despatcherName: string;
    calculationRequired: boolean;
}

export interface IReadTrackerInfoViewModel {
    hasBeenRead: boolean;
    readBy: string;
    readDate: Date | null;
}

export interface JobGroup {
    job: ISuggestion;
    subJobs: ISuggestion[];
}

export interface VoidJobRequest {
    jobId: number;
    voidSingleJobOnly: boolean;
    voidReason?: string;
}

export interface IBulkUpdateRequest {
    jobIds: number[];
}

export interface IBulkReadUpdateRequest extends  IBulkUpdateRequest {
    shouldMarkAsRead: boolean;
}