import {keepPreviousData, useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {queryKeys} from '../query';
import {driverManagementApi} from '../services/driverManagementApi';
import {
    AfterHoursCourierScheduleItem,
    AfterHoursFilter,
    AfterHoursPaginated,
    ComplianceFilter,
    CourierCompliance,
    CourierCompliancePaginated,
    CourierDailyEarningsPaginated,
    CourierDataDashboard,
    DriverEmail,
    FleetOption,
    GroupEmailData,
    PaginatedRequest,
    PaginatedResponse,
    TodayActiveDriverFilter,
    TodayActiveDriverPaginated,
} from '../interfaces';

// ----- Query hooks -----

export function useDriverSearch(searchText: string) {
    return useQuery<FleetOption[], Error>({
        queryKey: queryKeys.driverManagement.searchCouriers(searchText),
        queryFn: ({signal}) => driverManagementApi.searchAllCouriers(searchText, {signal}),
        enabled: searchText.length >= 2,
        staleTime: 60 * 1000,
    });
}

export function useCourierDetails(courierId: number) {
    return useQuery<CourierDataDashboard, Error>({
        queryKey: queryKeys.driverManagement.courierDetails(courierId),
        queryFn: ({signal}) => driverManagementApi.getCourierDetailsForDashboard(courierId, {signal}),
        enabled: courierId > 0,
    });
}

export function useFleetOptions() {
    return useQuery<FleetOption[], Error>({
        queryKey: queryKeys.driverManagement.fleetOptions,
        queryFn: ({signal}) => driverManagementApi.getAllFleetOptions({signal}),
        staleTime: 5 * 60 * 1000,
    });
}

export function useTodayActiveDrivers(query: PaginatedRequest, filters: TodayActiveDriverFilter) {
    return useQuery<TodayActiveDriverPaginated, Error>({
        queryKey: queryKeys.driverManagement.todayActive(query, filters),
        queryFn: ({signal}) => driverManagementApi.getTodayActiveDrivers(query, filters, {signal}),
        placeholderData: keepPreviousData,
    });
}

export function useComplianceList(query: PaginatedRequest, filters: ComplianceFilter) {
    return useQuery<CourierCompliancePaginated, Error>({
        queryKey: queryKeys.driverManagement.compliance(query, filters),
        queryFn: ({signal}) => driverManagementApi.getCourierComplianceList(query, filters, {signal}),
        placeholderData: keepPreviousData,
    });
}

export function useAfterHoursSchedule(query: PaginatedRequest, filters: AfterHoursFilter) {
    return useQuery<AfterHoursPaginated, Error>({
        queryKey: queryKeys.driverManagement.afterHours(query, filters),
        queryFn: ({signal}) => driverManagementApi.getAfterHoursSchedule(query, filters, {signal}),
        placeholderData: keepPreviousData,
    });
}

export function useDriverEmails(query: PaginatedRequest) {
    return useQuery<PaginatedResponse<DriverEmail>, Error>({
        queryKey: queryKeys.driverManagement.driverEmails(query),
        queryFn: ({signal}) => driverManagementApi.getDriverEmails(query, {signal}),
        placeholderData: keepPreviousData,
    });
}

export function useDriverEarnings(query: PaginatedRequest) {
    return useQuery<CourierDailyEarningsPaginated, Error>({
        queryKey: queryKeys.driverManagement.earnings(query),
        queryFn: ({signal}) => driverManagementApi.getDriverDailyEarnings(query, {signal}),
        placeholderData: keepPreviousData,
    });
}

// ----- Mutation hooks -----

export function useCreateAfterHoursSchedule() {
    const queryClient = useQueryClient();
    return useMutation<void, Error, AfterHoursCourierScheduleItem>({
        mutationFn: (schedule) => driverManagementApi.createAfterHoursSchedule(schedule),
        onSuccess: async () => {
            await queryClient.invalidateQueries({queryKey: queryKeys.driverManagement.all});
        },
    });
}

export function useUpdateAfterHoursSchedule() {
    const queryClient = useQueryClient();
    return useMutation<void, Error, AfterHoursCourierScheduleItem>({
        mutationFn: (schedule) => driverManagementApi.updateAfterHoursSchedule(schedule),
        onSuccess: async () => {
            await queryClient.invalidateQueries({queryKey: queryKeys.driverManagement.all});
        },
    });
}

export function useDeleteAfterHoursSchedule() {
    const queryClient = useQueryClient();
    return useMutation<void, Error, number>({
        mutationFn: (id) => driverManagementApi.deleteAfterHoursSchedule(id),
        onSuccess: async () => {
            await queryClient.invalidateQueries({queryKey: queryKeys.driverManagement.all});
        },
    });
}

export function useSendComplianceReminder() {
    return useMutation<void, Error, CourierCompliance>({
        mutationFn: (item) => driverManagementApi.sendComplianceReminder(item),
    });
}

export function useSendBulkComplianceReminders() {
    return useMutation<void, Error, CourierCompliance[]>({
        mutationFn: (items) => driverManagementApi.sendBulkComplianceReminders(items),
    });
}

export function useSendEmailToCouriers() {
    return useMutation<void, Error, GroupEmailData>({
        mutationFn: (data) => driverManagementApi.sendEmailToCouriers(data),
    });
}
