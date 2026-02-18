import axios from 'axios';
import {apiClient} from './apiClient';
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

function downloadBlob(response: { data: Blob; headers: Record<string, unknown> }, fallbackFilename: string): void {
    const contentDisposition = response.headers['content-disposition'] as string | undefined;
    let filename = fallbackFilename;
    if (contentDisposition) {
        const match = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
        if (match?.[1]) filename = match[1].replace(/['"]/g, '');
    }
    const blob = new Blob([response.data]);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

const csvPostConfig = {
    responseType: 'blob' as const,
    headers: {'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest'},
    withCredentials: true,
};

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
        const response = await axios.post('courier/ExportTodayActiveDriversCsv', {
            ...query, ...filters,
        }, csvPostConfig);
        downloadBlob(response, 'today-active-drivers.csv');
    },

    async exportComplianceCsv(query: PaginatedRequest, filters: ComplianceFilter): Promise<void> {
        const response = await axios.post('courier/ExportComplianceCsv', {
            ...query, ...filters,
        }, csvPostConfig);
        downloadBlob(response, 'driver-compliance.csv');
    },

    async exportAfterHoursScheduleCsv(query: PaginatedRequest, filters: AfterHoursFilter): Promise<void> {
        const response = await axios.post('courier/ExportAfterHoursScheduleCsv', {
            ...query, ...filters,
        }, csvPostConfig);
        downloadBlob(response, 'after-hours-schedule.csv');
    },

    async exportDriverEmailsCsv(query: PaginatedRequest): Promise<void> {
        const response = await axios.post('courier/ExportDriverEmailsCsv', query, csvPostConfig);
        downloadBlob(response, 'driver-emails.csv');
    },

    async exportDriverEarningsCsv(query: PaginatedRequest): Promise<void> {
        const response = await axios.post('courier/ExportDriverEarningsCsv', query, csvPostConfig);
        downloadBlob(response, 'driver-earnings.csv');
    },
};
