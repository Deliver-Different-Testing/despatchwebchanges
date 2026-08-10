import {apiClient, downloadBlob} from './apiClient';
import {
    PaginatedRequest,
    PaginatedResponse,
    FleetOption,
    CourierDataDashboard,
    TodayActiveDriverFilter,
    TodayActiveDriverPaginated,
    ComplianceFilter,
    CourierCompliancePaginated,
    CourierCompliance,
    AfterHoursFilter,
    AfterHoursPaginated,
    AfterHoursCourierScheduleItem,
    DriverEmail,
    GroupEmailData,
    CourierDailyEarningsPaginated,
} from '../interfaces';
import {RequestOptions} from "./requestOptions";

export const driverManagementApi = {
    searchAllCouriers(searchTerm: string, options?: RequestOptions): Promise<FleetOption[]> {
        return apiClient.get<FleetOption[]>('courier/SearchAllCouriers', {searchTerm}, options);
    },

    getCourierDetailsForDashboard(courierId: number, options?: RequestOptions): Promise<CourierDataDashboard> {
        return apiClient.get<CourierDataDashboard>('courier/GetCourierDetailsForDashboard', {courierId}, options);
    },

    getCourierComplianceList(
        query: PaginatedRequest,
        filters: ComplianceFilter,
        options?: RequestOptions
    ): Promise<CourierCompliancePaginated> {
        return apiClient.post<CourierCompliancePaginated>('courier/GetCourierComplianceList', {
            page: query.page,
            pageSize: query.pageSize,
            orderBy: query.orderBy,
            sortDescending: query.sortDescending,
            searchTerm: query.searchTerm,
            type: filters.type,
            status: filters.status,
            fleet: filters.fleet,
        }, options);
    },

    sendComplianceReminder(item: CourierCompliance): Promise<void> {
        return apiClient.post<void>('courier/SendComplianceReminder', {
            code: item.code,
            type: item.complianceType,
        });
    },

    sendBulkComplianceReminders(items: CourierCompliance[]): Promise<void> {
        return apiClient.post<void>('courier/SendBulkComplianceReminders', {items});
    },

    getAfterHoursSchedule(
        query: PaginatedRequest,
        filters: AfterHoursFilter,
        options?: RequestOptions
    ): Promise<AfterHoursPaginated> {
        return apiClient.post<AfterHoursPaginated>('courier/GetAfterHoursCourierSchedule', {
            page: query.page,
            pageSize: query.pageSize,
            orderBy: query.orderBy,
            sortDescending: query.sortDescending,
            searchTerm: query.searchTerm,
            day: filters.day,
        }, options);
    },

    createAfterHoursSchedule(schedule: AfterHoursCourierScheduleItem): Promise<void> {
        return apiClient.post<void>('courier/CreateAfterHoursCourierSchedule', schedule);
    },

    updateAfterHoursSchedule(schedule: AfterHoursCourierScheduleItem): Promise<void> {
        return apiClient.post<void>('courier/UpdateAfterHoursCourierSchedule', schedule);
    },

    deleteAfterHoursSchedule(afterHoursScheduleId: number): Promise<void> {
        return apiClient.delete<void>('courier/DeleteAfterHoursCourierSchedule', {
            params: {afterHoursScheduleId},
        });
    },

    getTodayActiveDrivers(
        query: PaginatedRequest,
        filters: TodayActiveDriverFilter,
        options?: RequestOptions
    ): Promise<TodayActiveDriverPaginated> {
        return apiClient.post<TodayActiveDriverPaginated>('courier/GetTodayActiveDrivers', {
            page: query.page,
            pageSize: query.pageSize,
            orderBy: query.orderBy,
            sortDescending: query.sortDescending,
            searchTerm: query.searchTerm,
            location: filters.location,
            status: filters.status,
            fleet: filters.fleet,
        }, options);
    },

    getDriverEmails(query: PaginatedRequest, options?: RequestOptions): Promise<PaginatedResponse<DriverEmail>> {
        return apiClient.post<PaginatedResponse<DriverEmail>>('courier/GetAllCourierEmails', query, options);
    },

    sendEmailToCouriers(emailData: GroupEmailData): Promise<void> {
        return apiClient.post<void>('courier/SendEmailToCouriers', emailData);
    },

    getDriverDailyEarnings(query: PaginatedRequest, options?: RequestOptions): Promise<CourierDailyEarningsPaginated> {
        return apiClient.post<CourierDailyEarningsPaginated>('courier/GetCourierDailyEarnings', query, options);
    },

    getAllFleetOptions(options?: RequestOptions): Promise<FleetOption[]> {
        return apiClient.get<FleetOption[]>('courier/GetAllFleetOptions', undefined, options);
    },

    async exportTodayActiveDriversCsv(query: PaginatedRequest, filters: TodayActiveDriverFilter): Promise<void> {
        const response = await apiClient.postForBlob('courier/ExportTodayActiveDriversCsv', {
            ...query, ...filters,
        });
        downloadBlob(response, 'today-active-drivers.csv');
    },

    async exportComplianceCsv(query: PaginatedRequest, filters: ComplianceFilter): Promise<void> {
        const response = await apiClient.postForBlob('courier/ExportComplianceCsv', {
            ...query, ...filters,
        });
        downloadBlob(response, 'driver-compliance.csv');
    },

    async exportAfterHoursScheduleCsv(query: PaginatedRequest, filters: AfterHoursFilter): Promise<void> {
        const response = await apiClient.postForBlob('courier/ExportAfterHoursScheduleCsv', {
            ...query, ...filters,
        });
        downloadBlob(response, 'after-hours-schedule.csv');
    },

    async exportDriverEmailsCsv(query: PaginatedRequest): Promise<void> {
        const response = await apiClient.postForBlob('courier/ExportDriverEmailsCsv', query);
        downloadBlob(response, 'driver-emails.csv');
    },

    async exportDriverEarningsCsv(query: PaginatedRequest): Promise<void> {
        const response = await apiClient.postForBlob('courier/ExportDriverEarningsCsv', query);
        downloadBlob(response, 'driver-earnings.csv');
    },
};
