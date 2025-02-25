export interface Job {
    id: number;
    rootParentId?: number;
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
    vehicle: Vehicle;
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
    active?: boolean;
    oneOff?: boolean;
    inActiveBy: string;
    inActiveDate?: Date;
    firstDue?: Date;
    nextDue?: Date;
    lastDone?: Date;
    stopDate?: Date;
    restartDate?: Date;
    days: string;
    preBook?: boolean;
    bulkJob?: boolean;
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
    assignedAgent: AgentViewModel;
    assignedCourier: Suggestion;
    parcelDimensions: ParcelDimensions[];
    deliverToLeaveId?: number;
    isActive: boolean;
}

export interface Vehicle {
    id?: number;
    label: string;
}

export interface Size {
    id: number;
    label: string;
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
    expectedArrival?: Date;
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
}


export interface Suggestion {
    id: number;
    text: string;
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
}

export interface Destination {
    id: number;
    label: string;
}

export interface AgentViewModel {
    agentId: number;
    agentName: string;
    agentRate: number;
    agentRanking: string;
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
    status?: number;
    order?: string;
    orderDirection?: string;
    page?: number;
    limit?: number;
}

export interface PriceBreakdown {
    chargeId: number;
    name: string;
    amount: number;
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
