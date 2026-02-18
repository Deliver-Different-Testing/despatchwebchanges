// Driver Management Dashboard interfaces

// ----- Pagination -----

export interface PaginatedRequest {
    searchTerm?: string;
    page: number;
    pageSize: number;
    orderBy: string;
    sortDescending: boolean;
}

export interface PaginatedResponse<T> {
    items: T[];
    total: number;
    page: number;
    pages: number;
}

// ----- Fleet Options -----

export interface FleetOption {
    id: number;
    text: string;
}

// ----- Driver Details (Tab 0) -----

export interface CourierDataDashboard {
    courierId: number;
    basicInformation: BasicInformation;
    contactInformation: ContactInformation;
    vehicleInformation: VehicleInformation;
    compliance: ComplianceInfo;
    bankingAndEmergency: BankingAndEmergency;
    additionalInformation: AdditionalInformation;
}

export interface BasicInformation {
    code: string;
    firstName: string;
    surname: string;
    email: string;
    address: string;
}

export interface ContactInformation {
    mobile: string;
    home: string;
    gstNumber: string;
    irdNumber: string;
}

export interface VehicleInformation {
    rego: string;
    vehicleYear?: number;
    vehicleModel: string;
    vehicleInsurance: string;
}

export interface ComplianceInfo {
    dangerousGoods?: boolean;
    dangerousGoodsExpiry?: string;
    driversLicenceExpiry?: string;
}

export interface BankingAndEmergency {
    emergencyContact: boolean;
    bank: string;
    securityCheck: boolean;
}

export interface AdditionalInformation {
    contactSignDate?: string;
    mobileInsurence?: number;
    dailyProfitAdjust: number;
    notes: string;
}

// ----- Today Active Drivers (Tab 1) -----

export interface TodayActiveDriver {
    courierId: number;
    code: string;
    name: string;
    fleet: string;
    loginTime: string;
    logoutTime?: string;
    duration: string;
    deliveries: number;
    status: string;
}

export interface TodayActiveDriverFilter {
    location: string;
    status: string;
    fleet: number;
}

export interface TodayActiveDriverPaginated extends PaginatedResponse<TodayActiveDriver> {
    totalActiveDrivers: number;
    totalDriversActiveToday: number;
    averageSessionTime: number;
}

// ----- Compliance (Tab 2) -----

export interface CourierCompliance {
    courierId: number;
    code: string;
    name: string;
    complianceType: string;
    itemNumber: string;
    expiryDate?: string;
    status: string;
    daysUntilExpiry: string;
}

export interface ComplianceFilter {
    type: string;
    status: string;
    fleet: number;
}

export interface CourierCompliancePaginated extends PaginatedResponse<CourierCompliance> {
    totalExpired: number;
    totalExpiringSoon: number;
    totalValid: number;
}

// ----- After Hours (Tab 3) -----
// Reuses AfterHoursCourierSchedule from afterhours.ts for the schedule model

export interface AfterHoursFilter {
    day: string;
}

export interface AfterHoursPaginated extends PaginatedResponse<AfterHoursCourierScheduleItem> {
    totalActiveDrivers: number;
}

export interface AfterHoursCourierScheduleItem {
    afterHoursScheduleId: number;
    courierId: number;
    courierName: string;
    courierCode: string;
    days: string[];
    startTime?: string;
    endTime?: string;
    timezone?: string;
    duration: string;
}

// ----- Driver Emails (Tab 4) -----

export interface DriverEmail {
    courierId: number;
    code: string;
    name: string;
    email: string;
    phone: string;
    fleet: string;
}

export interface GroupEmailData {
    courierIds: number[];
    subject: string;
    body: string;
}

// ----- Driver Earnings (Tab 5) -----

export interface CourierDailyEarnings {
    courierId: number;
    name: string;
    hoursLogged: number;
    deliveries: number;
    earnings: number;
    hourlyRate: number;
}

export interface CourierDailyEarningsPaginated extends PaginatedResponse<CourierDailyEarnings> {
    totalEarningsToday: number;
    averageHourlyRate: number;
    totalActiveDrivers: number;
    totalDeliveriesToday: number;
}

// ----- Page Props -----

export interface DriverManagementPageProps {
    showToast: (message: string, type: 'success' | 'warning' | 'error' | 'info') => void;
    isUsCustomer?: boolean;
    setRefreshCallback?: (callback: () => void) => void;
}

export interface MountDriverManagementConfig {
    showToast: (message: string, type: 'success' | 'warning' | 'error' | 'info') => void;
    isUsCustomer?: boolean;
}
