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
}

export interface TruckCourierStatusViewModel {
    id: number;
    courierCode: string;
    firstName: string;
    maxPallets: number | null;
    maxPayLoad: number | null;
    currentPallets: number;
    currentWeight: number;
    availablePalletCapacity: number | null;
    availablePallets: number | null;
    lastUpdated: Date;
}

export interface AvailableCourierPosition {
    courierId: number;
    channelId: number;
    vehicleType: string;
    code: string;
    fleetCode: string;
    clearListAreaIDs: string;
    longitude: number | null;
    latitude: number | null;
    totalJobs: number;
    overDueJobs: number;
}
