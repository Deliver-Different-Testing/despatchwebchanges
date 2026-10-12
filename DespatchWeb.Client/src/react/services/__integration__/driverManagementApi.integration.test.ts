/** @jest-environment jest-fixed-jsdom */
/**
 * Driver Management API Integration Tests
 *
 * Tests the driverManagementApi service using MSW to intercept real HTTP requests.
 */

import {server} from '../../__testUtils__/msw/setupIntegration';
import {http, HttpResponse} from 'msw';
import {driverManagementApi} from '../driverManagementApi';
import {
    mockCourierSearchResults,
    mockCourierDetails,
    mockTodayActiveDrivers,
    mockComplianceList,
    mockAfterHoursSchedule,
    mockFleetOptions,
} from '../../__testUtils__/msw/handlers';

describe('driverManagementApi integration', () => {
    describe('searchAllCouriers', () => {
        it('searches couriers with searchTerm parameter', async () => {
            let capturedUrl = '';
            server.use(
                http.get('*/courier/SearchAllCouriers', ({request}) => {
                    capturedUrl = request.url;
                    return HttpResponse.json(mockCourierSearchResults);
                })
            );

            const result = await driverManagementApi.searchAllCouriers('John');

            expect(capturedUrl).toContain('searchTerm=John');
            expect(result).toHaveLength(3);
        });

        it('returns results with id and text', async () => {
            const result = await driverManagementApi.searchAllCouriers('Smith');

            expect(result[0]).toMatchObject({id: 10, text: 'John Smith (JS001)'});
        });

        it('handles server errors', async () => {
            server.use(
                http.get('*/courier/SearchAllCouriers', () => {
                    return new HttpResponse('Server error', {status: 500});
                })
            );

            await expect(driverManagementApi.searchAllCouriers('test')).rejects.toMatchObject({status: 500});
        });
    });

    describe('getCourierDetailsForDashboard', () => {
        it('fetches courier details with courierId', async () => {
            let capturedUrl = '';
            server.use(
                http.get('*/courier/GetCourierDetailsForDashboard', ({request}) => {
                    capturedUrl = request.url;
                    return HttpResponse.json(mockCourierDetails);
                })
            );

            const result = await driverManagementApi.getCourierDetailsForDashboard(10);

            expect(capturedUrl).toContain('courierId=10');
            expect(result.basicInformation.code).toBe('JS001');
        });

        it('handles not found error', async () => {
            server.use(
                http.get('*/courier/GetCourierDetailsForDashboard', () => {
                    return HttpResponse.json({message: 'Not found'}, {status: 404});
                })
            );

            await expect(driverManagementApi.getCourierDetailsForDashboard(999)).rejects.toMatchObject({status: 404});
        });
    });

    describe('getAllFleetOptions', () => {
        it('fetches fleet options', async () => {
            // Override the shared courierHandlers stub so this test gets the
            // driverManagement-shaped fleet list (3 items) rather than the
            // 4-item courier list — both handlers register for the same URL.
            server.use(
                http.get('*/courier/GetAllFleetOptions', () => HttpResponse.json(mockFleetOptions))
            );

            const result = await driverManagementApi.getAllFleetOptions();

            expect(result).toHaveLength(3);
            expect(result[0]).toMatchObject({id: 1, text: 'Fleet Alpha'});
        });

        it('handles server errors', async () => {
            server.use(
                http.get('*/courier/GetAllFleetOptions', () => {
                    return new HttpResponse('Server error', {status: 500});
                })
            );

            await expect(driverManagementApi.getAllFleetOptions()).rejects.toMatchObject({status: 500});
        });
    });

    describe('getTodayActiveDrivers', () => {
        it('posts query and returns paginated active drivers', async () => {
            let capturedBody: unknown;
            server.use(
                http.post('*/courier/GetTodayActiveDrivers', async ({request}) => {
                    capturedBody = await request.json();
                    return HttpResponse.json(mockTodayActiveDrivers);
                })
            );

            const query = {page: 1, pageSize: 100, orderBy: 'name', sortDescending: false, searchTerm: ''};
            const filters = {location: 'all', status: 'all', fleet: 0};
            const result = await driverManagementApi.getTodayActiveDrivers(query, filters);

            expect(capturedBody).toMatchObject({page: 1, pageSize: 100, location: 'all', status: 'all', fleet: 0});
            expect(result.items).toHaveLength(2);
            expect(result.totalActiveDrivers).toBe(1);
        });

        it('handles server errors', async () => {
            server.use(
                http.post('*/courier/GetTodayActiveDrivers', () => {
                    return new HttpResponse('Server error', {status: 500});
                })
            );

            await expect(driverManagementApi.getTodayActiveDrivers(
                {page: 1, pageSize: 10, orderBy: 'name', sortDescending: false},
                {location: 'all', status: 'all', fleet: 0}
            )).rejects.toMatchObject({status: 500});
        });
    });

    describe('getCourierComplianceList', () => {
        it('posts query and returns paginated compliance data', async () => {
            let capturedBody: unknown;
            server.use(
                http.post('*/courier/GetCourierComplianceList', async ({request}) => {
                    capturedBody = await request.json();
                    return HttpResponse.json(mockComplianceList);
                })
            );

            const query = {page: 1, pageSize: 100, orderBy: 'code', sortDescending: false, searchTerm: ''};
            const filters = {type: 'all', status: 'expired', fleet: 0};
            const result = await driverManagementApi.getCourierComplianceList(query, filters);

            expect(capturedBody).toMatchObject({page: 1, type: 'all', status: 'expired'});
            expect(result.items).toHaveLength(2);
            expect(result.totalExpired).toBe(1);
        });
    });

    describe('sendComplianceReminder', () => {
        it('sends reminder with code and type', async () => {
            let capturedBody: unknown;
            server.use(
                http.post('*/courier/SendComplianceReminder', async ({request}) => {
                    capturedBody = await request.json();
                    return new HttpResponse(null, {status: 200});
                })
            );

            const item = {courierId: 10, code: 'JS001', name: 'John', complianceType: 'insurance', itemNumber: 'INS-123', status: 'expired', daysUntilExpiry: '-5'};
            await driverManagementApi.sendComplianceReminder(item);

            expect(capturedBody).toMatchObject({code: 'JS001', type: 'insurance'});
        });
    });

    describe('sendBulkComplianceReminders', () => {
        it('sends bulk reminders with items array', async () => {
            let capturedBody: unknown;
            server.use(
                http.post('*/courier/SendBulkComplianceReminders', async ({request}) => {
                    capturedBody = await request.json();
                    return new HttpResponse(null, {status: 200});
                })
            );

            const items = [
                {courierId: 10, code: 'JS001', name: 'John', complianceType: 'insurance', itemNumber: 'INS-123', status: 'expired', daysUntilExpiry: '-5'},
            ];
            await driverManagementApi.sendBulkComplianceReminders(items);

            expect(capturedBody).toMatchObject({items});
        });
    });

    describe('getAfterHoursSchedule', () => {
        it('posts query and returns paginated after hours data', async () => {
            let capturedBody: unknown;
            server.use(
                http.post('*/courier/GetAfterHoursCourierSchedule', async ({request}) => {
                    capturedBody = await request.json();
                    return HttpResponse.json(mockAfterHoursSchedule);
                })
            );

            const query = {page: 1, pageSize: 100, orderBy: 'name', sortDescending: false, searchTerm: ''};
            const filters = {day: 'monday'};
            const result = await driverManagementApi.getAfterHoursSchedule(query, filters);

            expect(capturedBody).toMatchObject({page: 1, day: 'monday'});
            expect(result.items).toHaveLength(2);
            expect(result.totalActiveDrivers).toBe(2);
        });
    });

    describe('createAfterHoursSchedule', () => {
        it('posts schedule data', async () => {
            let capturedBody: unknown;
            server.use(
                http.post('*/courier/CreateAfterHoursCourierSchedule', async ({request}) => {
                    capturedBody = await request.json();
                    return new HttpResponse(null, {status: 200});
                })
            );

            const schedule = {afterHoursScheduleId: 0, courierId: 10, courierName: 'John', courierCode: 'JS001', days: ['Monday'], startTime: '17:00', endTime: '21:00', duration: '4h'};
            await driverManagementApi.createAfterHoursSchedule(schedule);

            expect(capturedBody).toMatchObject({courierId: 10, days: ['Monday']});
        });
    });

    describe('updateAfterHoursSchedule', () => {
        it('posts updated schedule data', async () => {
            let capturedBody: unknown;
            server.use(
                http.post('*/courier/UpdateAfterHoursCourierSchedule', async ({request}) => {
                    capturedBody = await request.json();
                    return new HttpResponse(null, {status: 200});
                })
            );

            const schedule = {afterHoursScheduleId: 5, courierId: 10, courierName: 'John', courierCode: 'JS001', days: ['Monday', 'Tuesday'], startTime: '18:00', endTime: '22:00', duration: '4h'};
            await driverManagementApi.updateAfterHoursSchedule(schedule);

            expect(capturedBody).toMatchObject({afterHoursScheduleId: 5, days: ['Monday', 'Tuesday']});
        });
    });

    describe('deleteAfterHoursSchedule', () => {
        it('sends delete request with afterHoursScheduleId param', async () => {
            let capturedUrl = '';
            server.use(
                http.delete('*/courier/DeleteAfterHoursCourierSchedule', ({request}) => {
                    capturedUrl = request.url;
                    return new HttpResponse(null, {status: 200});
                })
            );

            await driverManagementApi.deleteAfterHoursSchedule(42);

            expect(capturedUrl).toContain('afterHoursScheduleId=42');
        });

        it('handles server errors', async () => {
            server.use(
                http.delete('*/courier/DeleteAfterHoursCourierSchedule', () => {
                    return new HttpResponse('Server error', {status: 500});
                })
            );

            await expect(driverManagementApi.deleteAfterHoursSchedule(1)).rejects.toMatchObject({status: 500});
        });
    });

    describe('getDriverEmails', () => {
        it('posts query and returns paginated emails', async () => {
            const result = await driverManagementApi.getDriverEmails({page: 1, pageSize: 50, orderBy: 'name', sortDescending: false});

            expect(result.items).toHaveLength(2);
            expect(result.items[0]).toMatchObject({code: 'JS001', email: 'john@example.com'});
        });
    });

    describe('sendEmailToCouriers', () => {
        it('posts email data', async () => {
            let capturedBody: unknown;
            server.use(
                http.post('*/courier/SendEmailToCouriers', async ({request}) => {
                    capturedBody = await request.json();
                    return new HttpResponse(null, {status: 200});
                })
            );

            await driverManagementApi.sendEmailToCouriers({courierIds: [1, 2], subject: 'Hello', body: 'Test'});

            expect(capturedBody).toMatchObject({courierIds: [1, 2], subject: 'Hello'});
        });
    });

    describe('getDriverDailyEarnings', () => {
        it('posts query and returns paginated earnings', async () => {
            const result = await driverManagementApi.getDriverDailyEarnings({page: 1, pageSize: 50, orderBy: 'name', sortDescending: false});

            expect(result.items).toHaveLength(2);
            expect(result.totalEarningsToday).toBe(430);
        });
    });
});
