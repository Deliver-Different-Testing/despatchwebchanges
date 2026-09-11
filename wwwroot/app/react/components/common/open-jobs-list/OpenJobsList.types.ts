/** The open-jobs row as the API returns it. */
export interface IOpenJobResponseDto {
    jobId: number;
    reference: string;
    status: string;
    pickupTime?: string;
    pickupName: string;
    pickupAddress: string;
    deliveryTime?: string;
    deliveryName: string;
    deliveryAddress: string;
    driverName: string;
    completedToday: number;
    lastCompleted?: string;
    quantity: number;
    packageType: string;
    mileage: number;
}

/** The DTO plus the pre-formatted display times the service layer adds. */
export interface IOpenJobResponse extends IOpenJobResponseDto {
    _pickUpTimeStr?: string;
    _deliveryTimeStr?: string;
}

export interface ViewJob {
    jobId: number;
    reference: string;
    status: string;
    pickup: {
        time?: string;
        timeString?: string;
        name: string;
        address: string;
    };
    delivery: {
        time?: string;
        timeString?: string;
        name: string;
        address: string;
    };
    quantity: number;
    packageType: string;
    mileage: number;
    driverName: string;
}

export interface DriverViewModel {
    name: string;
    jobs: ViewJob[];
    completedToday: number;
    lastCompleted: string;
    expanded: boolean;
}
