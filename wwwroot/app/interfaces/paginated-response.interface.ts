import ICourierCompliance from "../components/driver-management-dashboard/interfaces/ICourierCompliance";
import ITodayActiveDrivers from "../components/driver-management-dashboard/interfaces/ITodayActiveDrivers";
import IDriverEmail from "../components/driver-management-dashboard/interfaces/IDriverEmail";

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

export interface ITodayActiveDriverPaginated extends IPaginatedResponse<ITodayActiveDrivers> {
    totalActiveDrivers: number;
    totalDriversActiveToday: number;
    averageSessionTime: number;
}

export interface ICourierDailyEarningsPaginated extends IPaginatedResponse<ICourierDailyEarnings> {
    totalEarningsToday: number;
    averageHourlyRate: number;
    totalActiveDrivers: number;
    totalDeliveriesToday: number;
}