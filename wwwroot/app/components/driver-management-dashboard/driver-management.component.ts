import "./driver-management.styles.less";
import BaseController from "../base-controller";
import DriverManagementService from "./driver-management.service";
import dayjs, {Dayjs} from "dayjs";
import ToastrService from "../../services/toastr.service";
import {ICourierDataDashboard} from "./interfaces/ICourierDataDashboard";
import IDriverEmail from "./interfaces/IDriverEmail";
import {IAppConfig} from "../../interfaces/app-config.interface";
import greetUser from "../../functions/greetUser";
import {ISuggestion} from "../../interfaces/job.interface";
import {
    IAfterHoursFilter,
    ICourierComplianceFilter,
    ITodayActiveDriverFilter
} from "./interfaces/ICourierComplianceFilter";
import {IPaginatedRequest} from "../../interfaces/paginated-request.interfaces";
import DriverManagementTabs from "./enums/DriverManagementTabs";
import {
    ICourierAfterHoursPaginated,
    ICourierCompliancePaginated, ICourierDailyEarningsPaginated, IPaginatedResponse,
    ITodayActiveDriverPaginated
} from "../../interfaces/paginated-response.interface";
import {ComposeEmailDialogService} from "../dialogs/compose-email-dialog/compose-email-dialog.service";
import EditAfterhoursDialogService from "../dialogs/edit-afterhours-dialog/edit-afterhours-dialog.service";
import {IAfterHoursCourierSchedule} from "./interfaces/IAfterHoursCourierSchedule";
import {AppPage} from "../../enums/app-pages.enum";
import {ITodayActiveDrivers} from "./interfaces/ITodayActiveDrivers";
import {ICourierCompliance} from "./interfaces/ICourierCompliance";

class DriverManagementController extends BaseController {
    static $inject = [
        "$mdDialog",
        "$mdSidenav",
        "$window",
        "$timeout",
        "$interval",
        "$scope",
        "APP_CONFIG",
        "driverManagementService",
        "toastrService",
        "composeEmailDialogService",
        "editAfterhoursDialogService",
    ];

    private readonly LastActiveTabKey = `lastActiveTab-${AppPage.DriverManagement}-${ContactID}`;
    
    isUsCustomer: boolean = false;

    // Tab state
    selectedTab: number = 0;

    // Driver Details
    selectedDriver?: ICourierDataDashboard;
    selectedDriverId?: number;
    driversLoading: boolean = false;
    driverSearchText?: string;

    // Compliance
    compliancePromise?: Promise<ICourierCompliancePaginated>;
    complianceQuery: IPaginatedRequest = {
        orderBy: "code",
        pageSize: 10,
        page: 1,
        searchTerm: '',
        sortDescending: false,
    };
    complianceItems: ICourierCompliance[] = [];
    complianceFilters: ICourierComplianceFilter = {
        type: 'all',
        status: 'all',
        fleet: 0
    };
    complianceStats = {
        expired: 0,
        expiring: 0,
        valid: 0,
        totalDrivers: 0
    };

    // After Hours
    afterHoursSchedulePromise?: Promise<ICourierAfterHoursPaginated>;
    afterHoursQuery: IPaginatedRequest = {
        orderBy: "name",
        pageSize: 10,
        page: 1,
        searchTerm: '',
        sortDescending: false,
    };
    afterHoursSchedule: IAfterHoursCourierSchedule[] = [];
    afterHoursFilters: IAfterHoursFilter = {
        day: 'all'
    };
    afterHoursStats = {
        totalAssignments: 0,
        activeDrivers: 0,
        todayCoverage: false
    };

    // Today Active Drivers
    todayActiveDriversPromise?: Promise<ITodayActiveDriverPaginated>;
    todayActiveDriversList: ITodayActiveDrivers[] = [];
    todayActiveDriversQuery: IPaginatedRequest = {
        orderBy: "name",
        pageSize: 10,
        page: 1,
        searchTerm: '',
        sortDescending: false,
    };
    todayActiveDriversFilters: ITodayActiveDriverFilter = {
        location: 'all',
        status: 'all',
        fleet: 0
    };
    todayActiveDriversStats = {
        totalActiveDrivers: 0,
        totalDriversActiveToday: 0,
        onBreak: 0,
        averageSession: '0h 0m'
    };

    // Daily Driver Earnings
    driverEarningsPromise?: Promise<ICourierDailyEarningsPaginated>;
    driverEarningsList: ICourierDailyEarnings[] = [];
    driverEarningsQuery: IPaginatedRequest = {
        orderBy: "name",
        pageSize: 10,
        page: 1,
        searchTerm: '',
        sortDescending: false,
    };
    driverEarningsStats = {
        totalEarningsToday: 0,
        averageHourlyRate: 0,
        totalActiveDrivers: 0,
        totalDeliveriesToday: 0
    };

    // Email Management
    driverEmailPromise?: Promise<IPaginatedResponse<IDriverEmail>>;
    driverEmailList: IDriverEmail[] = [];
    driverEmailQuery: IPaginatedRequest = {
        orderBy: "code",
        pageSize: 10,
        page: 1,
        searchTerm: '',
        sortDescending: false,
    };
    totalDriverEmails: number = 0;

    driverInformationLoading: boolean = false;
    fleetOptions?: ISuggestion[];

    constructor(
        private $mdDialog: angular.material.IDialogService,
        private $mdSidenav: angular.material.ISidenavService,
        private $window: angular.IWindowService,
        $timeout: angular.ITimeoutService,
        $interval: angular.IIntervalService,
        $scope: angular.IScope,
        appConfig: IAppConfig,
        private driverManagementService: DriverManagementService,
        private toastrService: ToastrService,
        private composeEmailDialogService: ComposeEmailDialogService,
        private editAfterhoursDialogService: EditAfterhoursDialogService
    ) {
        super();
        this.initServices($timeout, $interval, $scope);
        this.isUsCustomer = appConfig.US_Customer;
        this.loadLastActiveTab();
        this.bindFunctions();

        console.log('Driver management component initialized');
    }

    $onInit(): void {
        this.loadAllFleetOptions().then(() => {
            this.loadInitialData()
                .then(() => {
                    this.setupWatchers();
                })
                .catch(error => {
                    this.toastrService.showErrorToast('Failed to initialize driver management');
                    console.error('Initialization error:', error);
                });
        });
    }

    private bindFunctions() {
        this.selectDriver = this.selectDriver.bind(this);
        this.loadAfterHoursSchedule = this.loadAfterHoursSchedule.bind(this);
        this.loadComplianceData = this.loadComplianceData.bind(this);
        this.loadTodayActiveDrivers = this.loadTodayActiveDrivers.bind(this);
        this.loadDriverEmails = this.loadDriverEmails.bind(this);
    }

    private loadLastActiveTab() {
        if(Modernizr.localstorage) {
            const lastActiveTab = localStorage.getItem(this.LastActiveTabKey);
            console.log('Loading last active tab:', lastActiveTab);

            if (lastActiveTab) {
                this.selectedTab = parseInt(lastActiveTab);
                console.log('Last active tab loaded:', this.selectedTab);
            } else {
                console.warn("No active tab found");
            }
        } else {
            console.warn('No active tab found:', this.selectedTab);
        }
    }

    private setupWatchers(): void {
        this.watchScope(
            () => this.selectedTab,
            async (newValue: number, oldValue: number) => {
                if (newValue !== oldValue) {
                    // Save tab
                    this.saveLastActiveTab(newValue);
                    
                    console.log('Selected tab changed:', newValue);
                    await this.loadInitialData();
                }
            }
        );
    }

    private async loadAllFleetOptions() {
        this.fleetOptions = await this.driverManagementService.getAllFleetOptions();
    }

    private async loadInitialData(): Promise<void> {
        console.log('[loadInitialData] Starting initial data load for tab:', this.selectedTab);

        // Load data based on the selected tab
        switch (this.selectedTab) {
            case DriverManagementTabs.DriverDetails:
                console.log('[loadInitialData] Tab 0 - Driver details already loaded');
                break;
            case DriverManagementTabs.TodayActive:
                console.log('[loadInitialData] Tab 1 - Loading today active drivers...');
                try {
                    await this.loadTodayActiveDrivers();
                    console.log('[loadInitialData] Today active drivers loaded successfully');
                } catch (error) {
                    console.error('[loadInitialData] Error loading today active drivers:', error);
                    throw error;
                }
                break;
            case DriverManagementTabs.DriverCompliance:
                console.log('[loadInitialData] Tab 2 - Loading compliance data...');
                try {
                    await this.loadComplianceData();
                    console.log('[loadInitialData] Compliance data loaded successfully');
                } catch (error) {
                    console.error('[loadInitialData] Error loading compliance data:', error);
                    throw error;
                }
                break;
            case DriverManagementTabs.AfterHours:
                console.log('[loadInitialData] Tab 3 - Loading after hours schedule...');
                try {
                    await this.loadAfterHoursSchedule();
                    console.log('[loadInitialData] After hours schedule loaded successfully');
                } catch (error) {
                    console.error('[loadInitialData] Error loading after hours schedule:', error);
                    throw error;
                }
                break;
            case DriverManagementTabs.DriverEmails:
                console.log('[loadInitialData] Tab 4 - Loading driver emails...');
                try {
                    await this.loadDriverEmails();
                    console.log('[loadInitialData] Driver emails loaded successfully');
                } catch (error) {
                    console.error('[loadInitialData] Error loading driver emails:', error);
                    throw error;
                }
                break;
            case DriverManagementTabs.DriverEarnings:
                console.log('[loadInitialData] Tab 5 - Loading driver earnings...');
                try {
                    await this.loadDriverTodayEarnings();
                    console.log('[loadInitialData] Driver earnings loaded successfully');
                } catch (error) {
                    console.error('[loadInitialData] Error loading driver earnings:', error);
                    throw error;
                }
                break;
            default:
                console.log('[loadInitialData] Tab', this.selectedTab, '- No data loading required');
                break;
        }

        console.log('[loadInitialData] Initial data load completed');
    }

    greetUser() {
        return greetUser(FirstName);
    }

    toggleSidenav() {
        const sidenavElement = angular.element('material-sidenav');
        const sidenavCtrl = sidenavElement.controller('materialSidenav');

        if (sidenavCtrl && typeof sidenavCtrl.toggleSidenav === 'function') {
            sidenavCtrl.toggleSidenav();
        } else {
            try {
                this.$mdSidenav("right").toggle();
            } catch (error) {
                console.log('Sidenav not available:', error);
            }
        }
    }

    async onTabChange(index: number): Promise<void> {
        if (this.selectedTab === index) return;

        console.log('Tab changed to:', index);
        this.selectedTab = index;

        // Save the last active tab
        this.saveLastActiveTab(index);

        await this.loadInitialData();
    }

    private saveLastActiveTab(index: number): void {
        if(Modernizr.localstorage) {
            localStorage.setItem(this.LastActiveTabKey, index.toString());
        } else {
            console.warn("Unable to save the last active tab. Local storage unavailable")
        }
    }
    
    async selectDriver(courier: ISuggestion): Promise<void> {
        try {
            this.driverInformationLoading = true;
            this.applyScope();

            if (!courier) {
                this.selectedDriver = undefined;
                return;
            }

            this.selectedDriverId = courier.id;
            this.selectedDriver = await this.driverManagementService.getCourierDetailsForDashboard(courier.id);
        } catch (error) {
            console.error('Error loading driver details:', error);
            this.toastrService.showErrorToast('Failed to load driver details');
        } finally {
            this.driverInformationLoading = false;
            this.applyScope();
        }
    }

    // Compliance Methods
    async loadComplianceData(): Promise<void> {
        try {
            this.compliancePromise = this.driverManagementService.getCourierComplianceList(
                this.complianceQuery,
                this.complianceFilters
            );

            const complianceResponse = await this.compliancePromise;
            this.complianceItems = complianceResponse.items;

            this.complianceStats = {
                expired: complianceResponse.totalExpired,
                expiring: complianceResponse.totalExpiringSoon,
                valid: complianceResponse.totalValid,
                totalDrivers: complianceResponse.total
            };
        } catch (error) {
            console.error('Error loading compliance data:', error);
            this.toastrService.showErrorToast('Failed to load compliance data');
        }
    }

    getComplianceStatus(expiryDate?: Dayjs): { status: string; class: string; daysUntil: number } {
        if (!expiryDate) {
            return {status: 'Not Set', class: 'status-invalid', daysUntil: -999};
        }

        const today = dayjs();
        const daysUntil = expiryDate.diff(today, 'day');

        if (daysUntil < 0) {
            return {status: 'Expired', class: 'status-expired', daysUntil};
        } else if (daysUntil <= 30) {
            return {status: 'Expiring Soon', class: 'status-expiring', daysUntil};
        } else {
            return {status: 'Valid', class: 'status-valid', daysUntil};
        }
    }

    async sendComplianceReminder(item: ICourierCompliance): Promise<void> {
        try {
            await this.driverManagementService.sendComplianceReminder(item);
            this.toastrService.showSuccessToast(`Reminder sent to ${item.name}`);
        } catch (error) {
            console.error('Error sending reminder:', error);
            this.toastrService.showErrorToast('Failed to send reminder');
        }
    }

    async sendBulkComplianceReminders(): Promise<void> {
        const toRemind = this.complianceItems.filter(item => {
            const status = this.getComplianceStatus(item.expiryDate);
            return status.daysUntil <= 30 && status.daysUntil >= -30;
        });

        if (toRemind.length === 0) {
            this.toastrService.showInfoToast('No drivers need reminders at this time');
            return;
        }

        const confirm = this.$mdDialog.confirm()
            .title('Send Bulk Reminders')
            .textContent(`Send reminder emails to ${toRemind.length} driver(s) with expiring/expired items?`)
            .ok('Send')
            .cancel('Cancel');

        try {
            await this.$mdDialog.show(confirm);
            await this.driverManagementService.sendBulkComplianceReminders(toRemind);
            this.toastrService.showSuccessToast(`Reminders sent to ${toRemind.length} driver(s)`);
        } catch (error) {
            // User canceled or error occurred
            if (error !== undefined) {
                console.error('Error sending bulk reminders:', error);
                this.toastrService.showErrorToast('Failed to send reminders');
            }
        }
    }

    exportComplianceList(): void {
        const data = this.complianceItems.map(item => ({
            Code: item.code,
            Name: item.name,
            Type: item.complianceType,
            'Item/Number': item.itemNumber,
            'Expiry Date': item.expiryDate ? dayjs(item.expiryDate).format('DD/MM/YYYY') : '',
            Status: this.getComplianceStatus(item.expiryDate).status,
            'Days Until Expiry': (() => {
                const status = this.getComplianceStatus(item.expiryDate);
                if (status.daysUntil === -999) return '—';
                if (status.daysUntil < 0) return `${Math.abs(status.daysUntil)} days overdue`;
                return `${status.daysUntil} days`;
            })()
        }));

        this.exportToCSV(data, 'Driver_Compliance');
    }

    // After Hours Methods
    async loadAfterHoursSchedule(): Promise<void> {
        try {
            this.afterHoursSchedulePromise = this.driverManagementService.getAfterHoursCourierScheduleList(
                this.afterHoursQuery,
                this.afterHoursFilters
            );

            const afterHoursResponse = await this.afterHoursSchedulePromise;
            this.afterHoursSchedule = afterHoursResponse.items;

            this.afterHoursStats = {
                totalAssignments: afterHoursResponse.total,
                activeDrivers: afterHoursResponse.totalActiveDrivers,
                todayCoverage: false // ToDo: Implement this
            }
        } catch (error) {
            console.error('Error loading after hours schedule:', error);
            this.toastrService.showErrorToast('Failed to load after hours schedule');
        }
    }

    formatScheduleTime(time: dayjs.Dayjs | undefined): string {
        return dayjs(time).format('HH:mm');
    }

    exportAfterHoursSchedule(): void {
        const data = this.afterHoursSchedule.map(item => ({
            'Driver Name': item.courierName,
            Days: item.days.join(', '),
            'Start Time': this.formatScheduleTime(item.startTime),
            'End Time': this.formatScheduleTime(item.endTime),
            Duration: item.duration
        }));

        this.exportToCSV(data, 'After_Hours_Schedule');
    }

// Email Management Methods
    async loadDriverEmails(): Promise<void> {
        try {
            this.driverEmailPromise = this.driverManagementService.getDriverEmails(this.driverEmailQuery);

            const driverEmailResponse = await this.driverEmailPromise;
            this.driverEmailList = driverEmailResponse?.items ?? [];
            this.totalDriverEmails = driverEmailResponse?.total ?? 0
        } catch (error) {
            console.error('Error loading today active drivers:', error);
            this.toastrService.showErrorToast('Failed to load today active drivers');
        }
    }

    selectAllEmails(): void {
        this.driverEmailList.forEach(e => e.selected = true);
    }

    deselectAllEmails(): void {
        this.driverEmailList.forEach(e => e.selected = false);
    }

    async sendSingleEmailToCourier($event: MouseEvent, email: IDriverEmail): Promise<void> {
        await this.openComposeEmailDialog($event, [email]);
    }

    async sendEmailToCourier($event: MouseEvent): Promise<void> {
        try {
            const selectedEmails = this.driverEmailList.filter(e => e.selected);
            if (selectedEmails.length === 0) {
                this.toastrService.showWarningToast('No recipients selected');
                return;
            }

            await this.openComposeEmailDialog($event, selectedEmails);
        } catch (error) {
            console.error('Error sending email:', error);
            this.toastrService.showErrorToast('Failed to send email');
        }
    }

    private async openComposeEmailDialog($event: MouseEvent, selectedEmails: IDriverEmail[]) {
        const emailData = await this.composeEmailDialogService.openComposeEmailDialog($event, selectedEmails);
        if (!emailData) return;

        await this.driverManagementService.sendEmailToCouriers(emailData);
        this.toastrService.showSuccessToast(`Email${selectedEmails.length > 1 ? 's' : ''} sent successfully`);
    }

    exportEmailList(): void {
        const data = this.driverEmailList.map(item => ({
            Code: item.code,
            Name: item.name,
            Email: item.email,
            Phone: item.phone,
            Fleet: item.fleet
        }));

        this.exportToCSV(data, 'Driver_Emails');
    }

    // Utility Methods
    private exportToCSV(data: any[], filename: string): void {
        if (!data || data.length === 0) {
            this.toastrService.showWarningToast('No data to export');
            return;
        }

        const headers = Object.keys(data[0]);
        const csv = [
            headers.join(','),
            ...data.map(row => headers.map(h => `"${row[h] || ''}"`).join(','))
        ].join('\n');

        const blob = new Blob([csv], {type: 'text/csv'});
        const url = this.$window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${filename}_${dayjs().format('YYYY-MM-DD')}.csv`;
        a.click();
        this.$window.URL.revokeObjectURL(url);
    }

    async queryDrivers(searchText: string) {
        return await this.driverManagementService.searchAllCouriers(searchText);
    }

    shouldTriggerSearch(searchTerm: string): boolean {
        return searchTerm.length >= 2;
    }

    async refreshAfterHoursSchedule(): Promise<void> {
        await this.loadAfterHoursSchedule();
        this.toastrService.showSuccessToast('After hours schedule refreshed');
    }

    /* Today Active Drivers */
    async loadTodayActiveDrivers(): Promise<void> {
        try {
            this.todayActiveDriversPromise = this.driverManagementService.getTodayActiveDriversAsync(
                this.todayActiveDriversQuery,
                this.todayActiveDriversFilters
            );

            const todayActiveResponse = await this.todayActiveDriversPromise;
            this.todayActiveDriversList = todayActiveResponse.items;

            this.todayActiveDriversStats = {
                totalActiveDrivers: todayActiveResponse.totalActiveDrivers,
                totalDriversActiveToday: todayActiveResponse.totalDriversActiveToday,
                onBreak: 0, // ToDo: Implement this
                averageSession: this.formatSessionTime(todayActiveResponse.averageSessionTime)
            };
        } catch (error) {
            console.error('Error loading today active drivers:', error);
            this.toastrService.showErrorToast('Failed to load today active drivers');
        }
    }

    async refreshTodaySchedule(): Promise<void> {
        await this.loadTodayActiveDrivers();
        this.toastrService.showSuccessToast('Today schedule refreshed');
    }


    private formatSessionTime(totalMinutes: number): string {
        if (totalMinutes === 0) return '0h 0m';
        const hours = Math.floor(totalMinutes / 60);
        const minutes = Math.round(totalMinutes % 60);
        return `${hours}h ${minutes}m`;
    }

    exportTodayActiveDrivers(): void {
        const data = this.todayActiveDriversList.map(item => ({
            Code: item.code,
            Name: item.name,
            Fleet: item.fleet,
            'Login Time': item.loginTime ? dayjs(item.loginTime).format('HH:mm:ss') : '',
            'Logout Time': item.logoutTime ? dayjs(item.logoutTime).format('HH:mm:ss') : '',
            Duration: item.duration,
            Deliveries: item.deliveries,
            Status: item.status
        }));

        this.exportToCSV(data, 'Today_Active_Drivers');
    }

    /* Daily Driver Earnings */
    async loadDriverTodayEarnings(): Promise<void> {
        try {
            this.driverEarningsPromise = this.driverManagementService.getDriverDailyEarnings(this.driverEarningsQuery);

            const earningsResponse = await this.driverEarningsPromise;
            this.driverEarningsList = earningsResponse.items;

            this.driverEarningsStats = {
                totalEarningsToday: earningsResponse.totalEarningsToday,
                totalActiveDrivers: earningsResponse.totalActiveDrivers,
                averageHourlyRate: earningsResponse.averageHourlyRate,
                totalDeliveriesToday: earningsResponse.totalDeliveriesToday
            };
        } catch (error) {
            console.error('Error loading driver earnings:', error);
            this.toastrService.showErrorToast('Failed to load driver earnings');
        }
    }

    async refreshDriverEarnings(): Promise<void> {
        await this.loadDriverTodayEarnings();
        this.toastrService.showSuccessToast('Driver earnings refreshed');
    }

    exportDriverEarnings(): void {
        const data = this.driverEarningsList.map(item => ({
            Name: item.name,
            'Hours Logged': item.hoursLogged,
            Deliveries: item.deliveries,
            Earnings: item.earnings,
            'Hourly Rate': item.hourlyRate
        }));

        this.exportToCSV(data, 'Driver_Earnings');
    }

    // Update createNewSchedule method to ensure proper async handling:
    async createNewSchedule($event: MouseEvent) {
        try {
            const today = dayjs();
            const startTime = today.hour(17).minute(0).second(0);
            const endTime = today.hour(21).minute(0).second(0);

            const newSchedule: IAfterHoursCourierSchedule = {
                afterHoursScheduleId: 0,
                courierId: 0,
                courierName: '',
                courierCode: '',
                days: [today.format('dddd')],
                startTime: startTime,
                endTime: endTime,
                duration: '4 hours',
            };

            const result = await this.openEditAfterHoursDialog($event, newSchedule);
            if(!result) return;

            await this.driverManagementService.createAfterHoursCourierSchedule(result);
            this.toastrService.showSuccessToast('Successfully created');
            await this.loadAfterHoursSchedule();

            this.applyScope();
        } catch (error) {
            console.error('Error creating new schedule:', error);
            this.toastrService.showErrorToast('Failed to create schedule');
        }
    }
    
    async deleteAfterHoursSchedule($event: MouseEvent, afterHoursSchedule: IAfterHoursCourierSchedule) {
        try {
            const dialog = this.$mdDialog.confirm()
                .title('Delete Schedule')
                .targetEvent($event)
                .textContent(`Are you sure you want to delete this schedule for ${afterHoursSchedule.courierName}?`)
                .ok('Delete')
                .cancel('Cancel');
            
            const confirm: boolean = await this.$mdDialog.show(dialog);
            if(!confirm) return;
            
            await this.driverManagementService.deleteAfterHoursCourierSchedule(afterHoursSchedule.afterHoursScheduleId);
            this.toastrService.showSuccessToast('Schedule deleted successfully');

            await this.loadAfterHoursSchedule();
        } catch (error) {
            if(!error) return;
            console.error('Error deleting schedule:', error);
            this.toastrService.showErrorToast('Failed to delete schedule');
        }
    }
    
    async editAfterHoursSchedule($event: MouseEvent, afterHoursSchedule: IAfterHoursCourierSchedule) {
        const result = await this.openEditAfterHoursDialog($event, afterHoursSchedule);
        if(!result) return;
        
        await this.driverManagementService.updateAfterHoursCourierSchedule(result);
        this.toastrService.showSuccessToast('After hours schedule updated successfully. Refreshing schedules..');
        await this.loadAfterHoursSchedule();
    }

    private async openEditAfterHoursDialog($event: MouseEvent, afterHoursSchedule: IAfterHoursCourierSchedule): Promise<IAfterHoursCourierSchedule | undefined> {
        try {
            const result = await this.editAfterhoursDialogService.openEditAfterhoursDialog($event, afterHoursSchedule);
            if (!result) {
                console.log('Edit after hours is empty');
                return;
            }

          return result;
        } catch (error) {
            if (!error) {
                console.log('Edit after hours is cancelled');
                return;
            }

            console.error('Error editing after hours schedule:', error);
            this.toastrService.showErrorToast('Failed to edit after hours schedule');
        }
    }
    
    displayDaysOnAfterHoursTable(days: string[]): string {
        return days.join(', ');
    }
}

const DriverManagementComponent: angular.IComponentOptions = {
    template: require("./driver-management.template.html"),
    controller: DriverManagementController,
    controllerAs: "ctrl",
};

export default DriverManagementComponent;