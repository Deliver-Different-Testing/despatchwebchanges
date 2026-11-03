// Driver Management Dashboard interfaces

import type {ShowToastFn} from '../services/toastService';

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
    wofExpiry?: string | null;
    registrationExpiry?: string | null;
}

export interface BankingAndEmergency {
    emergencyContact: boolean;
    bank: string;
    securityCheck: boolean;
    emergencyContactName?: string | null;
    emergencyContactPhone?: string | null;
    emergencyContactRelationship?: string | null;
    securityCheckDate?: string | null;
}

export interface AdditionalInformation {
    contactSignDate?: string;
    mobileInsurence?: number;
    dailyProfitAdjust?: number;
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

export type TodayActiveStatus = 'all' | 'active' | 'inactive';

export interface TodayActiveDriverFilter {
    status: TodayActiveStatus;
    fleet: number;
}

export interface TodayActiveDriverPaginated extends PaginatedResponse<TodayActiveDriver> {
    totalActiveDrivers: number;
    totalDriversActiveToday: number;
    averageSessionTime: number;
}

// ----- Compliance (Tab 2) -----

export type ComplianceTypeFilter = '' | 'drivers_license' | 'dg_endorsement' | 'wof' | 'registration';
export type ComplianceStatusFilter = '' | 'expired' | 'expiring' | 'valid' | 'not_set' | 'attention';
export type ComplianceStatus = 'Expired' | 'Expiring soon' | 'Valid' | 'Not set';
export type ComplianceType = 'Driver licence' | 'DG endorsement' | 'WOF' | 'Registration';
export type ComplianceReminderChannel = 1 | 2;

export interface CourierCompliance {
    courierId: number;
    code: string;
    name: string;
    complianceType: ComplianceType;
    complianceTypeKey: string;
    expiryDate: string | null;
    status: ComplianceStatus;
    /** Negative when overdue; null when no expiry is set. */
    daysUntilExpiry: number | null;
}

export interface ComplianceFilter {
    type: ComplianceTypeFilter;
    status: ComplianceStatusFilter;
    fleet: number;
}

export interface CourierCompliancePaginated extends PaginatedResponse<CourierCompliance> {
    totalExpired: number;
    totalExpiringSoon: number;
    totalValid: number;
    totalNotSet: number;
}

export interface ComplianceReminderRequest {
    courierIds?: number[];
    filter?: {searchTerm: string; fleet: number; type: ComplianceTypeFilter; status: ComplianceStatusFilter};
    channel: ComplianceReminderChannel;
    /** Counts who would be reminded without sending anything. */
    preview?: boolean;
}

export interface ComplianceReminderFailure {
    courierId: number;
    name: string;
    reason: string;
}

export interface ComplianceReminderResult {
    recipients: number;
    sent: number;
    nothingDue: number;
    failed: number;
    failures: ComplianceReminderFailure[];
    maxRecipients: number;
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
    minutesLogged: number;
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
    showToast: ShowToastFn;
    isUsCustomer?: boolean;
    setRefreshCallback?: (callback: () => void) => void;
}

export interface MountDriverManagementConfig {
    /** Ignored: the module supplies toasts from the Mantine toastService. */
    showToast?: ShowToastFn;
    isUsCustomer?: boolean;
}
