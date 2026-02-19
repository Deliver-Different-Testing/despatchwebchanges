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

export const driverManagementApi = {
    searchAllCouriers(searchTerm: string): Promise<FleetOption[]> {
        return apiClient.get<FleetOption[]>('courier/SearchAllCouriers', {searchTerm});
    },

    getCourierDetailsForDashboard(courierId: number): Promise<CourierDataDashboard> {
        return apiClient.get<CourierDataDashboard>('courier/GetCourierDetailsForDashboard', {courierId});
    },

    getCourierComplianceList(
        query: PaginatedRequest,
        filters: ComplianceFilter
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
        });
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
        filters: AfterHoursFilter
    ): Promise<AfterHoursPaginated> {
        return apiClient.post<AfterHoursPaginated>('courier/GetAfterHoursCourierSchedule', {
            page: query.page,
            pageSize: query.pageSize,
            orderBy: query.orderBy,
            sortDescending: query.sortDescending,
            searchTerm: query.searchTerm,
            day: filters.day,
        });
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
        filters: TodayActiveDriverFilter
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
        });
    },

    getDriverEmails(query: PaginatedRequest): Promise<PaginatedResponse<DriverEmail>> {
        return apiClient.post<PaginatedResponse<DriverEmail>>('courier/GetAllCourierEmails', query);
    },

    sendEmailToCouriers(emailData: GroupEmailData): Promise<void> {
        return apiClient.post<void>('courier/SendEmailToCouriers', emailData);
    },

    getDriverDailyEarnings(query: PaginatedRequest): Promise<CourierDailyEarningsPaginated> {
        return apiClient.post<CourierDailyEarningsPaginated>('courier/GetCourierDailyEarnings', query);
    },

    getAllFleetOptions(): Promise<FleetOption[]> {
        return apiClient.get<FleetOption[]>('courier/GetAllFleetOptions');
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
