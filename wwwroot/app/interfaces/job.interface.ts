import {JobStatus} from "../enums/job-status.enum";
import {LateEventType} from "../enums/late-event-type.enum";
import {DaysOfWeek} from "../enums/days-of-week.enum";
import {Frequency} from "../enums/frequency.enum";
import {HolidayDeliveryOptions} from "../enums/holiday-delivery-options.enum";

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
    vehicle: Suggestion;
    clientId?: number;
    jobType?: number;
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
    size: Suggestion;
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
    palletInfo: PalletInfo[];
    relatedJobs: Suggestion[];
    courierLatitude?: number;
    courierLongitude?: number;
    runOrder?: number;
    courierData: CourierData;
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
    pickupAddress: AddressViewModel;
    deliveryAddress: AddressViewModel;
    toAirportId?: number;
    fromAirportId?: number;
    assignedFlight: AssignedFlight;
    assignedAgent: IAgent;
    assignedCourier: Suggestion;
    parcelDimensions: ParcelDimensions[];
    deliverToLeaveId?: number;
    isActive: boolean;
    isArchived: boolean;
    clientColor?: string;
    searchText?: string;
    deliverByTime?: Date;
    distance: number;
    readTrackerInfo: IReadTrackerInfoViewModel;
    inActiveBy?: Suggestion;
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
}

export interface ParcelDimensions {
    itemId?: number;
    itemName: string;
    height?: number;
    length?: number;
    depth?: number;
    dimensions: string;
}

export interface AssignedFlight {
    flightNumber: string;
    expectedDeparture?: Date;
    departureTimeZone: string;
    expectedArrival?: Date;
    arrivalTimeZone: string;
    notes: string;
}

export interface PalletInfo {
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

export interface AddressViewModel {
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

export interface EditAddressDialogViewModel extends AddressViewModel {
    stateAbbreviation?: string;
}

export interface Suggestion {
    id: number;
    text: string;
    selected?: boolean;
}

export interface Views extends Suggestion {
    selected?: boolean;
}

export interface ClearListViewModel {
    areas: AreaClearList[];
}

export interface AreaClearList {
    id: number;
    name: string;
    order: number;
    percentHeight: number;
    top: ClearListSection[];
    middle: ClearListSection[];
    bottom: ClearListSection[];
    totalRemaining: number;
    isActive: boolean;
}

export interface ClearListSection {
    courierNumber: string;
    courierData: CourierData;
    destinations: Destination[];
}

export interface CourierData {
    courier: string;
    location: string;
    pu: string;
    del: string;
    lrm: string;
    eta2Lrm: string;
    courierId?: number;
    courierName: string;
    courierMobile: string;
    courierNumber: string;
    latitude?: number;
    longitude?: number;
}

export interface Destination {
    id: number;
    label: string;
}

export interface IAgent {
    agentId: number;
    agentName: string;
    agentRate: number;
    agentRanking: string;
    agentNotes: string;
}

export interface Pallet {
    id: number;
    quantity: number;
    weight: number;
    length: number;
    depth: number;
    height: number;
    pu: boolean;
    do: boolean;
    dgClass: string;
    notes: string;
}

export interface JobQueryParams {
    order?: string;
    orderDirection?: string;
    dateCutoff?: Date;
}

export interface PriceBreakdown {
    chargeId: number;
    name: string;
    amount: number;
    jobId?: number;
    prebookJobId?: number;
}

export interface JobRateDetails {
    jobId: number;
    clientId: number;
    speed: number;
    fromZipCode: string;
    toZipCode: string;
    weight: number;
    booked: Date;
    size: number;
    dangerousGoods: boolean;
    totalPallets: number;
    extraStopOffs: number;
    dryIceWeight: number;
    waitTime: number;
    fromLat: number;
    fromLong: number;
    toLat: number;
    toLong: number;
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

export interface SelectOption extends Suggestion {
}

export interface INoteType extends Suggestion {
    isPublic: boolean;
    description?: string;
}

export interface JobCreateViewModel {
    clientId: number;
    deliverToContact: string;
    podName: string;
    pickUpAddress: AddressViewModel;
    deliveryAddress: AddressViewModel;
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

export interface SuburbLookup extends Suggestion {
    alias: string;
}

export interface InternalStatus extends Suggestion {
    defaultSchedule: string;
    defaultMins: number | null;
}

export interface IJobNote {
    noteId?: number;
    noteTypeId: number;
    noteTypeName?: string;
    jobId?: number;
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
    id: number;
    jobNo: string;
    hasBeenRead: boolean;

    // Status and timing information
    statusId?: JobStatus;
    internalStatusId?: number;
    statusName?: string;
    status?: string;
    time?: Date;
    booked: Date;
    remain?: string;

    // Courier information
    courier?: string;
    assignedCourier?: Suggestion;
    courierData?: CourierData;

    // Addresses
    from?: string;
    toAddress?: string;
    toSuburbID?: number;
    pickupAddress?: AddressViewModel;
    deliveryAddress?: AddressViewModel;
    pickUpLongitude?: number;
    pickUpLatitude?: number;
    deliveryLongitude?: number;
    deliveryLatitude?: number;

    // Routing data
    direct?: boolean;
    speed?: string;
    notify?: string;
    vehicle?: Suggestion;

    // Job properties
    client?: string;
    clientId?: number;
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
    size?: Suggestion;
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
    relatedJobs?: Suggestion[];

    assignedFlight?: AssignedFlight;
    assignedAgent?: IAgent;

    // Search helper property
    [key: string]: any;
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

export interface BulkScanDetail {
    bulkScanId: number;
    scanDateTime: Date;
    scanDetail: string;
    courier: string;
}
