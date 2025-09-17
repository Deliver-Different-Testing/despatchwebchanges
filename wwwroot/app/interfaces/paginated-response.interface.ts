import ICourierCompliance from "../components/driver-management-dashboard/interfaces/ICourierCompliance";

export interface IPaginatedResponse<T> {
    items: T[];
    total: number;
    page: number;
    pages: number;
}

export interface ICourierCompliancePaginated extends IPaginatedResponse<ICourierCompliance> {
    totalExpired: number;
    totalExpiringSoon: number;
    totalValid: number;
}

export interface ICourierAfterHoursPaginated extends IPaginatedResponse<IAfterHoursCourierSchedule> {
    totalActiveDrivers: number;
}
