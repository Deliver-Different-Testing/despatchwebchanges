export interface Courier {
    courierID: number;     // The primary key of for the courier
    id: number;           // The courier number
    name: string;         // The name of the courier
    dangerousGoods: 0 | 1; // 1 or 0 to show if courier can carry dangerous goods
    dgLicenseExpiry: Date; // Date the couriers dangerous goods license
    totalJobs: number;
    vehicleType: string;
    code: string;
    overDueJobs: number;
    latitude: number;
    longitude: number;
    fleetCode: string;
    label: string;        // The label for use in select/autocomplete
    text: string;         // The text for use in select/autocomplete. This looks to be a duplicate of label
}

export interface ActiveCourierViewModel {
    courierId: number;
    id: string; // This is the courier code
    name: string;
    dangerousGoods: number;
    dgLicenseExpiry: string | null;
    label: string;
    text: string;
    isActive: boolean;
    vehicleType: string;
}

export interface ITruckCourierStatus {
    courierId: number;
    courierCode: string;
    firstName: string;
    maxPallets?: number;
    maxPayLoad?: number;
    currentPallets?: number;
    currentWeight?: number;
    availablePalletCapacity?: number;
    availablePallets?: number;
    lastUpdated: Date;
}

export interface IAvailableCourierPosition {
    courierId: number;
    courierName: string;
    channelId: number;
    vehicleType: string;
    code: string;
    isUrgentArmyDriver: boolean;
    clearListAreaIDs: number[];
    longitude: number | null;
    latitude: number | null;
    totalJobs: number;
    overDueJobs: number;
    displayOrder?: number | null;
    courierFleetId?: number | null;
    courierFleetName?: string | null;
    /** Delivery address line 5 of the courier's most recent completed job: NZ suburb, US township/city. */
    lastDeliveryLocality?: string | null;
    /** Line 6 of that job: NZ city, US state. */
    lastDeliveryRegion?: string | null;
    /** When that delivery was completed, ISO 8601 in tenant time. */
    lastDeliveryTime?: string | null;
    /** Dollars behind the minimum hourly guarantee this pay period; absent when on target or not permitted. */
    earningsBehindBy?: number | null;
    /** Tenant-local ISO time today's minimum paid block ends; absent unless the alert is on. */
    minimumEndsAt?: string | null;
    /** Warning window in minutes; absent = alert off. */
    minimumAlertMinutes?: number | null;
}

export interface IDriverWorkOverview {
    courierId: number;
    name: string;
    vehicleType: string;
    jobCount: number;
    driverStatusText: string;
}