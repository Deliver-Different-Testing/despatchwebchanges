/**
 * useDriverManagementApi Hooks Tests
 */

import React from 'react';
import {renderHook, waitFor, act} from '@testing-library/react';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {
    useDriverSearch,
    useCourierDetails,
    useFleetOptions,
    useTodayActiveDrivers,
    useComplianceList,
    useAfterHoursSchedule,
    useDriverEmails,
    useDriverEarnings,
    useCreateAfterHoursSchedule,
    useUpdateAfterHoursSchedule,
    useDeleteAfterHoursSchedule,
    useSendComplianceReminder,
    useSendBulkComplianceReminders,
    useSendEmailToCouriers,
} from './useDriverManagementApi';
import {driverManagementApi} from '../services/driverManagementApi';

jest.mock('../services/driverManagementApi', () => ({
    driverManagementApi: {
        searchAllCouriers: jest.fn(),
        getCourierDetailsForDashboard: jest.fn(),
        getAllFleetOptions: jest.fn(),
        getTodayActiveDrivers: jest.fn(),
        getCourierComplianceList: jest.fn(),
        getAfterHoursSchedule: jest.fn(),
        getDriverEmails: jest.fn(),
        getDriverDailyEarnings: jest.fn(),
        createAfterHoursSchedule: jest.fn(),
        updateAfterHoursSchedule: jest.fn(),
        deleteAfterHoursSchedule: jest.fn(),
        sendComplianceReminder: jest.fn(),
        sendBulkComplianceReminders: jest.fn(),
        sendEmailToCouriers: jest.fn(),
    },
}));

const mockApi = driverManagementApi as jest.Mocked<typeof driverManagementApi>;

const createTestQueryClient = () =>
    new QueryClient({
        defaultOptions: {
            queries: {retry: false, gcTime: 0},
            mutations: {retry: false},
        },
    });

const createWrapper = () => {
    const queryClient = createTestQueryClient();
    return ({children}: {children: React.ReactNode}) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
};

// --- Query hooks ---

describe('useDriverSearch', () => {
    beforeEach(() => jest.clearAllMocks());

    it('should not fetch when search text is less than 2 characters', async () => {
        renderHook(() => useDriverSearch('j'), {wrapper: createWrapper()});

        await waitFor(() => {
            expect(mockApi.searchAllCouriers).not.toHaveBeenCalled();
        });
    });

    it('should fetch when search text is 2 or more characters', async () => {
        const mockResults = [{id: 1, text: 'John Smith'}];
        mockApi.searchAllCouriers.mockResolvedValueOnce(mockResults);

        const {result} = renderHook(() => useDriverSearch('jo'), {wrapper: createWrapper()});

        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(mockApi.searchAllCouriers).toHaveBeenCalledWith('jo', expect.anything());
        expect(result.current.data).toEqual(mockResults);
    });

    it('should handle errors', async () => {
        mockApi.searchAllCouriers.mockRejectedValueOnce(new Error('Search failed'));

        const {result} = renderHook(() => useDriverSearch('test'), {wrapper: createWrapper()});

        await waitFor(() => expect(result.current.isError).toBe(true));
        expect(result.current.error).toEqual(new Error('Search failed'));
    });
});

describe('useCourierDetails', () => {
    beforeEach(() => jest.clearAllMocks());

    it('should not fetch when courierId is 0', async () => {
        renderHook(() => useCourierDetails(0), {wrapper: createWrapper()});

        await waitFor(() => {
            expect(mockApi.getCourierDetailsForDashboard).not.toHaveBeenCalled();
        });
    });

    it('should not fetch when courierId is negative', async () => {
        renderHook(() => useCourierDetails(-1), {wrapper: createWrapper()});

        await waitFor(() => {
            expect(mockApi.getCourierDetailsForDashboard).not.toHaveBeenCalled();
        });
    });

    it('should fetch when courierId is positive', async () => {
        const mockDetails = {courierId: 10, basicInformation: {code: 'JS01'}} as any;
        mockApi.getCourierDetailsForDashboard.mockResolvedValueOnce(mockDetails);

        const {result} = renderHook(() => useCourierDetails(10), {wrapper: createWrapper()});

        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(mockApi.getCourierDetailsForDashboard).toHaveBeenCalledWith(10, expect.anything());
        expect(result.current.data).toEqual(mockDetails);
    });

    it('should handle errors', async () => {
        mockApi.getCourierDetailsForDashboard.mockRejectedValueOnce(new Error('Not found'));

        const {result} = renderHook(() => useCourierDetails(10), {wrapper: createWrapper()});

        await waitFor(() => expect(result.current.isError).toBe(true));
    });
});

describe('useFleetOptions', () => {
    beforeEach(() => jest.clearAllMocks());

    it('should fetch fleet options', async () => {
        const mockOptions = [{id: 1, text: 'Fleet A'}];
        mockApi.getAllFleetOptions.mockResolvedValueOnce(mockOptions);

        const {result} = renderHook(() => useFleetOptions(), {wrapper: createWrapper()});

        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(mockApi.getAllFleetOptions).toHaveBeenCalled();
        expect(result.current.data).toEqual(mockOptions);
    });

    it('should handle errors', async () => {
        mockApi.getAllFleetOptions.mockRejectedValueOnce(new Error('Failed'));

        const {result} = renderHook(() => useFleetOptions(), {wrapper: createWrapper()});

        await waitFor(() => expect(result.current.isError).toBe(true));
    });
});

describe('useTodayActiveDrivers', () => {
    beforeEach(() => jest.clearAllMocks());

    const query = {page: 1, pageSize: 100, orderBy: 'name', sortDescending: false, searchTerm: ''};
    const filters = {location: 'all', status: 'all', fleet: 0};

    it('should fetch active drivers', async () => {
        const mockData = {items: [{courierId: 1}], total: 1, page: 1, pages: 1, totalActiveDrivers: 1, totalDriversActiveToday: 1, averageSessionTime: 120};
        mockApi.getTodayActiveDrivers.mockResolvedValueOnce(mockData as any);

        const {result} = renderHook(() => useTodayActiveDrivers(query, filters), {wrapper: createWrapper()});

        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(mockApi.getTodayActiveDrivers).toHaveBeenCalledWith(query, filters, expect.anything());
    });

    it('should handle errors', async () => {
        mockApi.getTodayActiveDrivers.mockRejectedValueOnce(new Error('Failed'));

        const {result} = renderHook(() => useTodayActiveDrivers(query, filters), {wrapper: createWrapper()});

        await waitFor(() => expect(result.current.isError).toBe(true));
    });
});

describe('useComplianceList', () => {
    beforeEach(() => jest.clearAllMocks());

    const query = {page: 1, pageSize: 100, orderBy: 'code', sortDescending: false, searchTerm: ''};
    const filters = {type: 'all', status: 'all', fleet: 0};

    it('should fetch compliance list', async () => {
        const mockData = {items: [], total: 0, page: 1, pages: 0, totalExpired: 0, totalExpiringSoon: 0, totalValid: 0};
        mockApi.getCourierComplianceList.mockResolvedValueOnce(mockData);

        const {result} = renderHook(() => useComplianceList(query, filters), {wrapper: createWrapper()});

        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(mockApi.getCourierComplianceList).toHaveBeenCalledWith(query, filters, expect.anything());
    });
});

describe('useAfterHoursSchedule', () => {
    beforeEach(() => jest.clearAllMocks());

    const query = {page: 1, pageSize: 100, orderBy: 'name', sortDescending: false, searchTerm: ''};
    const filters = {day: 'all'};

    it('should fetch after hours schedule', async () => {
        const mockData = {items: [], total: 0, page: 1, pages: 0, totalActiveDrivers: 0};
        mockApi.getAfterHoursSchedule.mockResolvedValueOnce(mockData);

        const {result} = renderHook(() => useAfterHoursSchedule(query, filters), {wrapper: createWrapper()});

        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(mockApi.getAfterHoursSchedule).toHaveBeenCalledWith(query, filters, expect.anything());
    });
});

describe('useDriverEmails', () => {
    beforeEach(() => jest.clearAllMocks());

    it('should fetch driver emails', async () => {
        const mockData = {items: [{courierId: 1, email: 'test@test.com'}], total: 1, page: 1, pages: 1};
        mockApi.getDriverEmails.mockResolvedValueOnce(mockData as any);

        const query = {page: 1, pageSize: 50, orderBy: 'name', sortDescending: false};
        const {result} = renderHook(() => useDriverEmails(query), {wrapper: createWrapper()});

        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(mockApi.getDriverEmails).toHaveBeenCalledWith(query, expect.anything());
    });
});

describe('useDriverEarnings', () => {
    beforeEach(() => jest.clearAllMocks());

    it('should fetch driver earnings', async () => {
        const mockData = {items: [], total: 0, page: 1, pages: 0, totalEarningsToday: 0, averageHourlyRate: 0, totalActiveDrivers: 0, totalDeliveriesToday: 0};
        mockApi.getDriverDailyEarnings.mockResolvedValueOnce(mockData);

        const query = {page: 1, pageSize: 50, orderBy: 'name', sortDescending: false};
        const {result} = renderHook(() => useDriverEarnings(query), {wrapper: createWrapper()});

        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(mockApi.getDriverDailyEarnings).toHaveBeenCalledWith(query, expect.anything());
    });
});

// --- Mutation hooks ---

describe('useCreateAfterHoursSchedule', () => {
    beforeEach(() => jest.clearAllMocks());

    it('should call createAfterHoursSchedule on mutateAsync', async () => {
        mockApi.createAfterHoursSchedule.mockResolvedValueOnce(undefined);

        const {result} = renderHook(() => useCreateAfterHoursSchedule(), {wrapper: createWrapper()});

        const schedule = {afterHoursScheduleId: 0, courierId: 1, courierName: 'John', courierCode: 'JS01', days: ['Monday'], duration: '4h'};
        await act(async () => {
            await result.current.mutateAsync(schedule);
        });

        expect(mockApi.createAfterHoursSchedule).toHaveBeenCalledWith(schedule);
    });

    it('should handle errors', async () => {
        mockApi.createAfterHoursSchedule.mockRejectedValueOnce(new Error('Failed'));

        const {result} = renderHook(() => useCreateAfterHoursSchedule(), {wrapper: createWrapper()});

        await act(async () => {
            await expect(result.current.mutateAsync({afterHoursScheduleId: 0, courierId: 1, courierName: '', courierCode: '', days: [], duration: ''})).rejects.toThrow('Failed');
        });
    });
});

describe('useUpdateAfterHoursSchedule', () => {
    beforeEach(() => jest.clearAllMocks());

    it('should call updateAfterHoursSchedule on mutateAsync', async () => {
        mockApi.updateAfterHoursSchedule.mockResolvedValueOnce(undefined);

        const {result} = renderHook(() => useUpdateAfterHoursSchedule(), {wrapper: createWrapper()});

        const schedule = {afterHoursScheduleId: 5, courierId: 1, courierName: 'John', courierCode: 'JS01', days: ['Tuesday'], duration: '3h'};
        await act(async () => {
            await result.current.mutateAsync(schedule);
        });

        expect(mockApi.updateAfterHoursSchedule).toHaveBeenCalledWith(schedule);
    });
});

describe('useDeleteAfterHoursSchedule', () => {
    beforeEach(() => jest.clearAllMocks());

    it('should call deleteAfterHoursSchedule on mutateAsync', async () => {
        mockApi.deleteAfterHoursSchedule.mockResolvedValueOnce(undefined);

        const {result} = renderHook(() => useDeleteAfterHoursSchedule(), {wrapper: createWrapper()});

        await act(async () => {
            await result.current.mutateAsync(42);
        });

        expect(mockApi.deleteAfterHoursSchedule).toHaveBeenCalledWith(42);
    });
});

describe('useSendComplianceReminder', () => {
    beforeEach(() => jest.clearAllMocks());

    it('should call sendComplianceReminder on mutateAsync', async () => {
        mockApi.sendComplianceReminder.mockResolvedValueOnce(undefined);

        const {result} = renderHook(() => useSendComplianceReminder(), {wrapper: createWrapper()});

        const item = {courierId: 1, code: 'JS01', name: 'John', complianceType: 'insurance', itemNumber: '123', status: 'expired', daysUntilExpiry: '-5'};
        await act(async () => {
            await result.current.mutateAsync(item);
        });

        expect(mockApi.sendComplianceReminder).toHaveBeenCalledWith(item);
    });
});

describe('useSendBulkComplianceReminders', () => {
    beforeEach(() => jest.clearAllMocks());

    it('should call sendBulkComplianceReminders on mutateAsync', async () => {
        mockApi.sendBulkComplianceReminders.mockResolvedValueOnce(undefined);

        const {result} = renderHook(() => useSendBulkComplianceReminders(), {wrapper: createWrapper()});

        const items = [
            {courierId: 1, code: 'JS01', name: 'John', complianceType: 'insurance', itemNumber: '123', status: 'expired', daysUntilExpiry: '-5'},
        ];
        await act(async () => {
            await result.current.mutateAsync(items);
        });

        expect(mockApi.sendBulkComplianceReminders).toHaveBeenCalledWith(items);
    });
});

describe('useSendEmailToCouriers', () => {
    beforeEach(() => jest.clearAllMocks());

    it('should call sendEmailToCouriers on mutateAsync', async () => {
        mockApi.sendEmailToCouriers.mockResolvedValueOnce(undefined);

        const {result} = renderHook(() => useSendEmailToCouriers(), {wrapper: createWrapper()});

        const emailData = {courierIds: [1, 2], subject: 'Hello', body: 'Test'};
        await act(async () => {
            await result.current.mutateAsync(emailData);
        });

        expect(mockApi.sendEmailToCouriers).toHaveBeenCalledWith(emailData);
    });
});
