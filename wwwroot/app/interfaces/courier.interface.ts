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

export interface ActiveCourier {
    id: string;            // 'code' is serialized as 'id'
    courierId: number;
    name: string;
    dangerousGoods: number;
    dgLicenseExpiry: string | null; // dates are typically serialized as strings
    label: string;
    text: string;
}
