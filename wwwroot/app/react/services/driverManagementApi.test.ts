/**
 * Driver Management API Service Tests
 */

import {driverManagementApi} from './driverManagementApi';
import {apiClient, downloadBlob} from './apiClient';
import {createMockApiError} from '../__testUtils__';

jest.mock('./apiClient', () => ({
    apiClient: {
        get: jest.fn(),
        post: jest.fn(),
        delete: jest.fn(),
        postForBlob: jest.fn(),
    },
    downloadBlob: jest.fn(),
}));

const mockApiClient = apiClient as jest.Mocked<typeof apiClient>;
const mockDownloadBlob = downloadBlob as jest.MockedFunction<typeof downloadBlob>;

describe('driverManagementApi', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('searchAllCouriers', () => {
        it('should call apiClient.get with correct endpoint and searchTerm', async () => {
            const mockResults = [{id: 1, text: 'John Smith'}];
            mockApiClient.get.mockResolvedValueOnce(mockResults);

            const result = await driverManagementApi.searchAllCouriers('John');

            expect(mockApiClient.get).toHaveBeenCalledWith('courier/SearchAllCouriers', {searchTerm: 'John'}, undefined);
            expect(result).toEqual(mockResults);
        });

        it('should return empty array when no results', async () => {
            mockApiClient.get.mockResolvedValueOnce([]);
            const result = await driverManagementApi.searchAllCouriers('xyz');
            expect(result).toEqual([]);
        });

        it.each([
            ['404 Not Found', createMockApiError({status: 404, statusText: 'Not Found', message: 'Not found'})],
            ['500 Server Error', createMockApiError({status: 500, statusText: 'Internal Server Error', message: 'Server error'})],
        ])('should propagate %s errors', async (_, error) => {
            mockApiClient.get.mockRejectedValueOnce(error);
            await expect(driverManagementApi.searchAllCouriers('test')).rejects.toEqual(error);
        });
    });

    describe('getCourierDetailsForDashboard', () => {
        it('should call apiClient.get with correct endpoint and courierId', async () => {
            const mockDetails = {courierId: 42, basicInformation: {code: 'JS01'}};
            mockApiClient.get.mockResolvedValueOnce(mockDetails);

            const result = await driverManagementApi.getCourierDetailsForDashboard(42);

            expect(mockApiClient.get).toHaveBeenCalledWith('courier/GetCourierDetailsForDashboard', {courierId: 42}, undefined);
            expect(result).toEqual(mockDetails);
        });

        it.each([
            ['404 Not Found', createMockApiError({status: 404, statusText: 'Not Found', message: 'Not found'})],
            ['500 Server Error', createMockApiError({status: 500, statusText: 'Internal Server Error', message: 'Server error'})],
        ])('should propagate %s errors', async (_, error) => {
            mockApiClient.get.mockRejectedValueOnce(error);
            await expect(driverManagementApi.getCourierDetailsForDashboard(1)).rejects.toEqual(error);
        });
    });

    describe('getCourierComplianceList', () => {
        it('should merge query and filter fields into flat body', async () => {
            const mockResponse = {items: [], total: 0, page: 1, pages: 0, totalExpired: 0, totalExpiringSoon: 0, totalValid: 0};
            mockApiClient.post.mockResolvedValueOnce(mockResponse);

            const query = {page: 1, pageSize: 50, orderBy: 'code', sortDescending: false, searchTerm: 'test'};
            const filters = {type: 'insurance', status: 'expired', fleet: 2};

            const result = await driverManagementApi.getCourierComplianceList(query, filters);

            expect(mockApiClient.post).toHaveBeenCalledWith('courier/GetCourierComplianceList', {
                page: 1, pageSize: 50, orderBy: 'code', sortDescending: false, searchTerm: 'test',
                type: 'insurance', status: 'expired', fleet: 2,
            }, undefined);
            expect(result).toEqual(mockResponse);
        });

        it.each([
            ['500 Server Error', createMockApiError({status: 500, statusText: 'Internal Server Error', message: 'Server error'})],
        ])('should propagate %s errors', async (_, error) => {
            mockApiClient.post.mockRejectedValueOnce(error);
            await expect(driverManagementApi.getCourierComplianceList(
                {page: 1, pageSize: 10, orderBy: 'code', sortDescending: false},
                {type: 'all', status: 'all', fleet: 0}
            )).rejects.toEqual(error);
        });
    });

    describe('sendComplianceReminder', () => {
        it('should map item.complianceType to type in body', async () => {
            mockApiClient.post.mockResolvedValueOnce(undefined);

            const item = {courierId: 1, code: 'JS01', name: 'John', complianceType: 'insurance', itemNumber: '123', status: 'expired', daysUntilExpiry: '-5'};
            await driverManagementApi.sendComplianceReminder(item);

            expect(mockApiClient.post).toHaveBeenCalledWith('courier/SendComplianceReminder', {
                code: 'JS01',
                type: 'insurance',
            });
        });
    });

    describe('sendBulkComplianceReminders', () => {
        it('should send items array in body', async () => {
            mockApiClient.post.mockResolvedValueOnce(undefined);

            const items = [
                {courierId: 1, code: 'JS01', name: 'John', complianceType: 'insurance', itemNumber: '123', status: 'expired', daysUntilExpiry: '-5'},
            ];
            await driverManagementApi.sendBulkComplianceReminders(items);

            expect(mockApiClient.post).toHaveBeenCalledWith('courier/SendBulkComplianceReminders', {items});
        });
    });

    describe('getAfterHoursSchedule', () => {
        it('should merge query and filter fields into flat body', async () => {
            const mockResponse = {items: [], total: 0, page: 1, pages: 0, totalActiveDrivers: 0};
            mockApiClient.post.mockResolvedValueOnce(mockResponse);

            const query = {page: 1, pageSize: 100, orderBy: 'name', sortDescending: false, searchTerm: ''};
            const filters = {day: 'monday'};

            const result = await driverManagementApi.getAfterHoursSchedule(query, filters);

            expect(mockApiClient.post).toHaveBeenCalledWith('courier/GetAfterHoursCourierSchedule', {
                page: 1, pageSize: 100, orderBy: 'name', sortDescending: false, searchTerm: '',
                day: 'monday',
            }, undefined);
            expect(result).toEqual(mockResponse);
        });
    });

    describe('createAfterHoursSchedule', () => {
        it('should post schedule to correct endpoint', async () => {
            mockApiClient.post.mockResolvedValueOnce(undefined);

            const schedule = {afterHoursScheduleId: 0, courierId: 1, courierName: 'John', courierCode: 'JS01', days: ['Monday'], startTime: '17:00', endTime: '21:00', duration: '4h'};
            await driverManagementApi.createAfterHoursSchedule(schedule);

            expect(mockApiClient.post).toHaveBeenCalledWith('courier/CreateAfterHoursCourierSchedule', schedule);
        });
    });

    describe('updateAfterHoursSchedule', () => {
        it('should post schedule to correct endpoint', async () => {
            mockApiClient.post.mockResolvedValueOnce(undefined);

            const schedule = {afterHoursScheduleId: 5, courierId: 1, courierName: 'John', courierCode: 'JS01', days: ['Monday', 'Tuesday'], startTime: '18:00', endTime: '22:00', duration: '4h'};
            await driverManagementApi.updateAfterHoursSchedule(schedule);

            expect(mockApiClient.post).toHaveBeenCalledWith('courier/UpdateAfterHoursCourierSchedule', schedule);
        });
    });

    describe('deleteAfterHoursSchedule', () => {
        it('should wrap ID in params object', async () => {
            mockApiClient.delete.mockResolvedValueOnce(undefined);

            await driverManagementApi.deleteAfterHoursSchedule(42);

            expect(mockApiClient.delete).toHaveBeenCalledWith('courier/DeleteAfterHoursCourierSchedule', {
                params: {afterHoursScheduleId: 42},
            });
        });

        it.each([
            ['404 Not Found', createMockApiError({status: 404, statusText: 'Not Found', message: 'Not found'})],
            ['500 Server Error', createMockApiError({status: 500, statusText: 'Internal Server Error', message: 'Server error'})],
        ])('should propagate %s errors', async (_, error) => {
            mockApiClient.delete.mockRejectedValueOnce(error);
            await expect(driverManagementApi.deleteAfterHoursSchedule(1)).rejects.toEqual(error);
        });
    });

    describe('getTodayActiveDrivers', () => {
        it('should merge query and filter fields into flat body', async () => {
            const mockResponse = {items: [], total: 0, page: 1, pages: 0, totalActiveDrivers: 0, totalDriversActiveToday: 0, averageSessionTime: 0};
            mockApiClient.post.mockResolvedValueOnce(mockResponse);

            const query = {page: 1, pageSize: 100, orderBy: 'name', sortDescending: false, searchTerm: ''};
            const filters = {location: 'auckland', status: 'active', fleet: 3};

            const result = await driverManagementApi.getTodayActiveDrivers(query, filters);

            expect(mockApiClient.post).toHaveBeenCalledWith('courier/GetTodayActiveDrivers', {
                page: 1, pageSize: 100, orderBy: 'name', sortDescending: false, searchTerm: '',
                location: 'auckland', status: 'active', fleet: 3,
            }, undefined);
            expect(result).toEqual(mockResponse);
        });
    });

    describe('getDriverEmails', () => {
        it('should post query to correct endpoint', async () => {
            const mockResponse = {items: [], total: 0, page: 1, pages: 0};
            mockApiClient.post.mockResolvedValueOnce(mockResponse);

            const query = {page: 1, pageSize: 50, orderBy: 'name', sortDescending: false};
            const result = await driverManagementApi.getDriverEmails(query);

            expect(mockApiClient.post).toHaveBeenCalledWith('courier/GetAllCourierEmails', query, undefined);
            expect(result).toEqual(mockResponse);
        });
    });

    describe('sendEmailToCouriers', () => {
        it('should post email data to correct endpoint', async () => {
            mockApiClient.post.mockResolvedValueOnce(undefined);

            const emailData = {courierIds: [1, 2], subject: 'Hello', body: 'Test'};
            await driverManagementApi.sendEmailToCouriers(emailData);

            expect(mockApiClient.post).toHaveBeenCalledWith('courier/SendEmailToCouriers', emailData);
        });
    });

    describe('getDriverDailyEarnings', () => {
        it('should post query to correct endpoint', async () => {
            const mockResponse = {items: [], total: 0, page: 1, pages: 0, totalEarningsToday: 0, averageHourlyRate: 0, totalActiveDrivers: 0, totalDeliveriesToday: 0};
            mockApiClient.post.mockResolvedValueOnce(mockResponse);

            const query = {page: 1, pageSize: 50, orderBy: 'name', sortDescending: false};
            const result = await driverManagementApi.getDriverDailyEarnings(query);

            expect(mockApiClient.post).toHaveBeenCalledWith('courier/GetCourierDailyEarnings', query, undefined);
            expect(result).toEqual(mockResponse);
        });
    });

    describe('getAllFleetOptions', () => {
        it('should call apiClient.get with correct endpoint', async () => {
            const mockOptions = [{id: 1, text: 'Fleet A'}, {id: 2, text: 'Fleet B'}];
            mockApiClient.get.mockResolvedValueOnce(mockOptions);

            const result = await driverManagementApi.getAllFleetOptions();

            expect(mockApiClient.get).toHaveBeenCalledWith('courier/GetAllFleetOptions', undefined, undefined);
            expect(result).toEqual(mockOptions);
        });

        it.each([
            ['500 Server Error', createMockApiError({status: 500, statusText: 'Internal Server Error', message: 'Server error'})],
        ])('should propagate %s errors', async (_, error) => {
            mockApiClient.get.mockRejectedValueOnce(error);
            await expect(driverManagementApi.getAllFleetOptions()).rejects.toEqual(error);
        });
    });

    describe('exportTodayActiveDriversCsv', () => {
        it('should call postForBlob and downloadBlob with correct filename', async () => {
            const mockBlob = new Blob(['csv-data']);
            const mockResponse = {data: mockBlob, headers: {} as Record<string, unknown>};
            mockApiClient.postForBlob.mockResolvedValueOnce(mockResponse);

            const query = {page: 1, pageSize: 100, orderBy: 'name', sortDescending: false};
            const filters = {location: 'all', status: 'all', fleet: 0};
            await driverManagementApi.exportTodayActiveDriversCsv(query, filters);

            expect(mockApiClient.postForBlob).toHaveBeenCalledWith('courier/ExportTodayActiveDriversCsv', {
                ...query, ...filters,
            });
            expect(mockDownloadBlob).toHaveBeenCalledWith(mockResponse, 'today-active-drivers.csv');
        });
    });

    describe('exportComplianceCsv', () => {
        it('should call postForBlob and downloadBlob with correct filename', async () => {
            const mockBlob = new Blob(['csv-data']);
            const mockResponse = {data: mockBlob, headers: {} as Record<string, unknown>};
            mockApiClient.postForBlob.mockResolvedValueOnce(mockResponse);

            const query = {page: 1, pageSize: 100, orderBy: 'code', sortDescending: false};
            const filters = {type: 'all', status: 'all', fleet: 0};
            await driverManagementApi.exportComplianceCsv(query, filters);

            expect(mockApiClient.postForBlob).toHaveBeenCalledWith('courier/ExportComplianceCsv', {
                ...query, ...filters,
            });
            expect(mockDownloadBlob).toHaveBeenCalledWith(mockResponse, 'driver-compliance.csv');
        });
    });

    describe('exportAfterHoursScheduleCsv', () => {
        it('should call postForBlob and downloadBlob with correct filename', async () => {
            const mockBlob = new Blob(['csv-data']);
            const mockResponse = {data: mockBlob, headers: {} as Record<string, unknown>};
            mockApiClient.postForBlob.mockResolvedValueOnce(mockResponse);

            const query = {page: 1, pageSize: 100, orderBy: 'name', sortDescending: false};
            const filters = {day: 'all'};
            await driverManagementApi.exportAfterHoursScheduleCsv(query, filters);

            expect(mockApiClient.postForBlob).toHaveBeenCalledWith('courier/ExportAfterHoursScheduleCsv', {
                ...query, ...filters,
            });
            expect(mockDownloadBlob).toHaveBeenCalledWith(mockResponse, 'after-hours-schedule.csv');
        });
    });

    describe('exportDriverEmailsCsv', () => {
        it('should call postForBlob and downloadBlob with correct filename', async () => {
            const mockBlob = new Blob(['csv-data']);
            const mockResponse = {data: mockBlob, headers: {} as Record<string, unknown>};
            mockApiClient.postForBlob.mockResolvedValueOnce(mockResponse);

            const query = {page: 1, pageSize: 100, orderBy: 'name', sortDescending: false};
            await driverManagementApi.exportDriverEmailsCsv(query);

            expect(mockApiClient.postForBlob).toHaveBeenCalledWith('courier/ExportDriverEmailsCsv', query);
            expect(mockDownloadBlob).toHaveBeenCalledWith(mockResponse, 'driver-emails.csv');
        });
    });

    describe('exportDriverEarningsCsv', () => {
        it('should call postForBlob and downloadBlob with correct filename', async () => {
            const mockBlob = new Blob(['csv-data']);
            const mockResponse = {data: mockBlob, headers: {} as Record<string, unknown>};
            mockApiClient.postForBlob.mockResolvedValueOnce(mockResponse);

            const query = {page: 1, pageSize: 100, orderBy: 'name', sortDescending: false};
            await driverManagementApi.exportDriverEarningsCsv(query);

            expect(mockApiClient.postForBlob).toHaveBeenCalledWith('courier/ExportDriverEarningsCsv', query);
            expect(mockDownloadBlob).toHaveBeenCalledWith(mockResponse, 'driver-earnings.csv');
        });
    });
});
