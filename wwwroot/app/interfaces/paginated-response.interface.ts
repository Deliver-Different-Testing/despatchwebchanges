import {
    ICourierCompliance,
    ICourierComplianceDto
} from "../components/driver-management-dashboard/interfaces/ICourierCompliance";
import {
    IAfterHoursCourierSchedule, IAfterHoursCourierScheduleDto
} from "../components/driver-management-dashboard/interfaces/IAfterHoursCourierSchedule";
import {
    ITodayActiveDrivers,
    ITodayActiveDriversDto
} from "../components/driver-management-dashboard/interfaces/ITodayActiveDrivers";

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

export interface ICourierCompliancePaginatedDto extends IPaginatedResponse<ICourierComplianceDto> {
    totalExpired: number;
    totalExpiringSoon: number;
    totalValid: number;
}

export interface ICourierAfterHoursPaginated extends IPaginatedResponse<IAfterHoursCourierSchedule> {
    totalActiveDrivers: number;
}

export interface ICourierAfterHoursPaginatedDto extends IPaginatedResponse<IAfterHoursCourierScheduleDto> {
    totalActiveDrivers: number;
}

export interface ITodayActiveDriverPaginated extends IPaginatedResponse<ITodayActiveDrivers> {
    totalActiveDrivers: number;
    totalDriversActiveToday: number;
    averageSessionTime: number;
}

export interface ITodayActiveDriverPaginatedDto extends IPaginatedResponse<ITodayActiveDriversDto> {
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