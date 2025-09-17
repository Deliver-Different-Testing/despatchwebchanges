
export interface IPaginatedRequest {
    searchTerm?: string;
    page: number;
    pageSize: number;
    orderBy: string;
    sortDescending: boolean;
}


export interface ICourierComplianceFilterRequest extends IPaginatedRequest {
    type: string;
    status: string;
    fleet: string;
    search: string;
}

export interface CourierAfterHoursFilterRequest extends IPaginatedRequest {
    day: string;
    search: string;
}

export interface DriverEmailFilterRequest {
    fleet: string;
    search: string;
}