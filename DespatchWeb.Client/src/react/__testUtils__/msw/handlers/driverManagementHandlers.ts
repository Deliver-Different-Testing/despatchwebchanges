/**
 * Driver Management API Handlers
 *
 * MSW handlers for driver management API endpoints.
 */

import {http, HttpResponse} from 'msw';
import type {
    FleetOption,
    CourierDataDashboard,
    TodayActiveDriverPaginated,
    CourierCompliancePaginated,
    AfterHoursPaginated,
    PaginatedResponse,
    DriverEmail,
    CourierDailyEarningsPaginated,
} from '../../../interfaces';

// Mock data
export const mockFleetOptions: FleetOption[] = [
    {id: 1, text: 'Fleet Alpha'},
    {id: 2, text: 'Fleet Beta'},
    {id: 3, text: 'Fleet Gamma'},
];

export const mockCourierSearchResults: FleetOption[] = [
    {id: 10, text: 'John Smith (JS001)'},
    {id: 20, text: 'Jane Doe (JD002)'},
    {id: 30, text: 'Bob Wilson (BW003)'},
];

export const mockCourierDetails: CourierDataDashboard = {
    courierId: 10,
    basicInformation: {code: 'JS001', firstName: 'John', surname: 'Smith', email: 'john@example.com', address: '123 Main St'},
    contactInformation: {mobile: '021-123-4567', home: '09-123-4567', gstNumber: '12-345-678', irdNumber: '12-345-678'},
    vehicleInformation: {rego: 'ABC123', vehicleYear: 2020, vehicleModel: 'Toyota Hiace', vehicleInsurance: 'Full Cover'},
    compliance: {dangerousGoods: true, dangerousGoodsExpiry: '2025-12-01', driversLicenceExpiry: '2026-06-15'},
    bankingAndEmergency: {emergencyContact: true, bank: 'ANZ', securityCheck: true},
    additionalInformation: {contactSignDate: '2023-01-15', mobileInsurence: 50, dailyProfitAdjust: 0, notes: 'Reliable driver'},
};

export const mockTodayActiveDrivers: TodayActiveDriverPaginated = {
    items: [
        {courierId: 10, code: 'JS001', name: 'John Smith', fleet: 'Fleet Alpha', loginTime: '2025-01-15T08:00:00Z', logoutTime: undefined, duration: '4h 30m', deliveries: 12, status: 'Active'},
        {courierId: 20, code: 'JD002', name: 'Jane Doe', fleet: 'Fleet Beta', loginTime: '2025-01-15T09:00:00Z', logoutTime: '2025-01-15T13:00:00Z', duration: '4h 0m', deliveries: 8, status: 'Offline'},
    ],
    total: 2,
    page: 1,
    pages: 1,
    totalActiveDrivers: 1,
    totalDriversActiveToday: 2,
    averageSessionTime: 255,
};

export const mockComplianceList: CourierCompliancePaginated = {
    items: [
        {courierId: 10, code: 'JS001', name: 'John Smith', complianceType: 'Driver\'s License', itemNumber: 'DL-12345', expiryDate: '2025-02-01', status: 'Expired', daysUntilExpiry: '-10'},
        {courierId: 20, code: 'JD002', name: 'Jane Doe', complianceType: 'Insurance', itemNumber: 'INS-67890', expiryDate: '2025-06-15', status: 'Valid', daysUntilExpiry: '120'},
    ],
    total: 2,
    page: 1,
    pages: 1,
    totalExpired: 1,
    totalExpiringSoon: 0,
    totalValid: 1,
};

export const mockAfterHoursSchedule: AfterHoursPaginated = {
    items: [
        {afterHoursScheduleId: 1, courierId: 10, courierName: 'John Smith', courierCode: 'JS001', days: ['Monday', 'Wednesday', 'Friday'], startTime: '2025-01-15T17:00:00Z', endTime: '2025-01-15T21:00:00Z', duration: '4h'},
        {afterHoursScheduleId: 2, courierId: 20, courierName: 'Jane Doe', courierCode: 'JD002', days: ['Tuesday', 'Thursday'], startTime: '2025-01-15T18:00:00Z', endTime: '2025-01-15T22:00:00Z', duration: '4h'},
    ],
    total: 2,
    page: 1,
    pages: 1,
    totalActiveDrivers: 2,
};

export const mockDriverEmails: PaginatedResponse<DriverEmail> = {
    items: [
        {courierId: 10, code: 'JS001', name: 'John Smith', email: 'john@example.com', phone: '021-123-4567', fleet: 'Fleet Alpha'},
        {courierId: 20, code: 'JD002', name: 'Jane Doe', email: 'jane@example.com', phone: '021-234-5678', fleet: 'Fleet Beta'},
    ],
    total: 2,
    page: 1,
    pages: 1,
};

export const mockDriverEarnings: CourierDailyEarningsPaginated = {
    items: [
        {courierId: 10, name: 'John Smith', hoursLogged: 480, deliveries: 12, earnings: 250, hourlyRate: 31.25},
        {courierId: 20, name: 'Jane Doe', hoursLogged: 360, deliveries: 8, earnings: 180, hourlyRate: 30},
    ],
    total: 2,
    page: 1,
    pages: 1,
    totalEarningsToday: 430,
    averageHourlyRate: 30.63,
    totalActiveDrivers: 2,
    totalDeliveriesToday: 20,
};

export const driverManagementHandlers = [
    // Search all couriers
    http.get('*/courier/SearchAllCouriers', ({request}) => {
        const url = new URL(request.url);
        const searchTerm = url.searchParams.get('searchTerm');
        if (!searchTerm) return HttpResponse.json(mockCourierSearchResults);
        const filtered = mockCourierSearchResults.filter(c =>
            c.text.toLowerCase().includes(searchTerm.toLowerCase())
        );
        return HttpResponse.json(filtered);
    }),

    // Get courier details for dashboard
    http.get('*/courier/GetCourierDetailsForDashboard', ({request}) => {
        const url = new URL(request.url);
        const courierId = url.searchParams.get('courierId');
        if (!courierId) return new HttpResponse('Missing courierId', {status: 400});
        return HttpResponse.json(mockCourierDetails);
    }),

    // Get all fleet options
    http.get('*/courier/GetAllFleetOptions', () => {
        return HttpResponse.json(mockFleetOptions);
    }),

    // Get courier compliance list
    http.post('*/courier/GetCourierComplianceList', () => {
        return HttpResponse.json(mockComplianceList);
    }),

    // Send compliance reminder
    http.post('*/courier/SendComplianceReminder', () => {
        return new HttpResponse(null, {status: 200});
    }),

    // Send bulk compliance reminders
    http.post('*/courier/SendBulkComplianceReminders', () => {
        return new HttpResponse(null, {status: 200});
    }),

    // Get after hours schedule
    http.post('*/courier/GetAfterHoursCourierSchedule', () => {
        return HttpResponse.json(mockAfterHoursSchedule);
    }),

    // Create after hours schedule
    http.post('*/courier/CreateAfterHoursCourierSchedule', () => {
        return new HttpResponse(null, {status: 200});
    }),

    // Update after hours schedule
    http.post('*/courier/UpdateAfterHoursCourierSchedule', () => {
        return new HttpResponse(null, {status: 200});
    }),

    // Delete after hours schedule
    http.delete('*/courier/DeleteAfterHoursCourierSchedule', () => {
        return new HttpResponse(null, {status: 200});
    }),

    // Get today active drivers
    http.post('*/courier/GetTodayActiveDrivers', () => {
        return HttpResponse.json(mockTodayActiveDrivers);
    }),

    // Get driver emails
    http.post('*/courier/GetAllCourierEmails', () => {
        return HttpResponse.json(mockDriverEmails);
    }),

    // Send email to couriers
    http.post('*/courier/SendEmailToCouriers', () => {
        return new HttpResponse(null, {status: 200});
    }),

    // Get driver daily earnings
    http.post('*/courier/GetCourierDailyEarnings', () => {
        return HttpResponse.json(mockDriverEarnings);
    }),

    // CSV exports
    http.post('*/courier/ExportTodayActiveDriversCsv', () => {
        return new HttpResponse('csv-data', {headers: {'Content-Type': 'text/csv'}});
    }),

    http.post('*/courier/ExportComplianceCsv', () => {
        return new HttpResponse('csv-data', {headers: {'Content-Type': 'text/csv'}});
    }),

    http.post('*/courier/ExportAfterHoursScheduleCsv', () => {
        return new HttpResponse('csv-data', {headers: {'Content-Type': 'text/csv'}});
    }),

    http.post('*/courier/ExportDriverEmailsCsv', () => {
        return new HttpResponse('csv-data', {headers: {'Content-Type': 'text/csv'}});
    }),

    http.post('*/courier/ExportDriverEarningsCsv', () => {
        return new HttpResponse('csv-data', {headers: {'Content-Type': 'text/csv'}});
    }),
];
