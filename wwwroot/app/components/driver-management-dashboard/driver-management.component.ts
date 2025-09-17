import "./driver-management.styles.less";
import BaseController from "../base-controller";
import DriverManagementService from "./driver-management.service";
import dayjs from "dayjs";
import ToastrService from "../../services/toastr.service";
import ICourierCompliance from "./interfaces/ICourierCompliance";
import {ICourierDataDashboard} from "./interfaces/ICourierDataDashboard";
import IDriverEmail from "./interfaces/IDriverEmail";
import {formatMins, formatShortDateWithYear} from "../../functions/formatDates";
import {IAppConfig} from "../../interfaces/app-config.interface";
import greetUser from "../../functions/greetUser";
import {ISuggestion} from "../../interfaces/job.interface";
import {IAfterHoursFilter, ICourierComplianceFilter} from "./interfaces/ICourierComplianceFilter";
import {IPaginatedRequest} from "../../interfaces/paginated-request.interfaces";

class DriverManagementController extends BaseController {
    static $inject = [
        "$mdDialog",
        "$mdSidenav",
        "$document",
        "$log",
        "$window",
        "$timeout",
        "$interval",
        "$scope",
        "APP_CONFIG",
        "driverManagementService",
        "toastrService"
    ];

    private static LastActiveTabKey = `lastActiveTabDriverManagement_${ContactID}`;

    isUsCustomer: boolean = false;

    // Tab state
    selectedTab: number = 0;

    // Driver Details
    selectedDriver?: ICourierDataDashboard;
    selectedDriverId?: number;
    driversLoading: boolean = false;
    driverSearchText?: string;

    // Compliance
    compliancePromise: any;
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
        fleet: 'all',
    };
    complianceStats = {
        expired: 0,
        expiring: 0,
        valid: 0,
        totalDrivers: 0
    };

    // After Hours
    afterHoursSchedulePromise: any;
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

    // Email Management
    driverEmails: IDriverEmail[] = [];
    emailsLoading: boolean = false;
    selectedEmails: Set<string> = new Set();
    selectAll: boolean = false;
    emailFilters = {
        fleet: '',
        search: ''
    };
    driverInformationLoading: boolean = false;

    constructor(
        private $mdDialog: angular.material.IDialogService,
        private $mdSidenav: angular.material.ISidenavService,
        private $document: angular.IDocumentService,
        private $log: angular.ILogService,
        private $window: angular.IWindowService,
        $timeout: angular.ITimeoutService,
        $interval: angular.IIntervalService,
        $scope: angular.IScope,
        appConfig: IAppConfig,
        private driverManagementService: DriverManagementService,
        private toastrService: ToastrService
    ) {
        super();
        this.initServices($timeout, $interval, $scope);
        this.isUsCustomer = appConfig.US_Customer;
        this.bindFunctions();

        this.$log.debug('Driver management component initialized');
    }

    $onInit(): void {
        this.loadInitialData()
            .then(() => {
                this.setupWatchers();
                this.loadLastActiveTab();
            })
            .catch(error => {
                this.toastrService.showErrorToast('Failed to initialize driver management');
                this.$log.error('Initialization error:', error);
            });
    }

    private bindFunctions() {
        this.selectDriver = this.selectDriver.bind(this);
        this.loadAfterHoursSchedule = this.loadAfterHoursSchedule.bind(this);
        this.loadComplianceData = this.loadComplianceData.bind(this);
    }

    private loadLastActiveTab() {
        const lastActiveTab = localStorage.getItem(DriverManagementController.LastActiveTabKey);
        if (lastActiveTab) {
            this.selectedTab = parseInt(lastActiveTab);
        }
    }

    private setupWatchers(): void {
        this.watchScope(
            () => this.selectedTab,
            (newValue: number, oldValue: number) => {
                if (newValue !== oldValue) {
                    return this.loadInitialData();
                }
            }
        );
    }

    private async loadInitialData(): Promise<void> {
        this.$log.debug('[loadInitialData] Starting initial data load for tab:', this.selectedTab);

        // Load data based on the selected tab
        if (this.selectedTab === 0) {
            this.$log.debug('[loadInitialData] Tab 0 - Driver details already loaded');
        } else if (this.selectedTab === 1) {
            this.$log.debug('[loadInitialData] Tab 1 - Loading compliance data...');
            try {
                await this.loadComplianceData();
                this.$log.debug('[loadInitialData] Compliance data loaded successfully');
            } catch (error) {
                this.$log.error('[loadInitialData] Error loading compliance data:', error);
                throw error;
            }
        } else if (this.selectedTab === 2) {
            this.$log.debug('[loadInitialData] Tab 2 - Loading after hours schedule...');
            try {
                await this.loadAfterHoursSchedule();
                this.$log.debug('[loadInitialData] After hours schedule loaded successfully');
            } catch (error) {
                this.$log.error('[loadInitialData] Error loading after hours schedule:', error);
                throw error;
            }
        } else if (this.selectedTab === 4) {
            this.$log.debug('[loadInitialData] Tab 4 - Loading driver emails...');
            try {
                await this.loadDriverEmails();
                this.$log.debug('[loadInitialData] Driver emails loaded successfully');
            } catch (error) {
                this.$log.error('[loadInitialData] Error loading driver emails:', error);
                throw error;
            }
        } else {
            this.$log.debug('[loadInitialData] Tab', this.selectedTab, '- No data loading required');
        }

        this.$log.debug('[loadInitialData] Initial data load completed');
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
                this.$log.debug('Sidenav not available:', error);
            }
        }
    }

    async onTabChange(index: number): Promise<void> {
        if (this.selectedTab === index) return;

        this.$log.debug('Tab changed to:', index);
        this.selectedTab = index;

        // Save the last active tab
        localStorage.setItem(DriverManagementController.LastActiveTabKey, index.toString());

        await this.loadInitialData();
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
            this.$log.error('Error loading driver details:', error);
            this.toastrService.showErrorToast('Failed to load driver details');
        } finally {
            this.driverInformationLoading = false;
            this.applyScope();
        }
    }

    editDriverDetails(): void {
        if (!this.selectedDriver) {
            this.toastrService.showWarningToast('Please select a driver first');
            return;
        }

        /* this.$mdDialog.show({
             template: require("./dialogs/driver-details-dialog.template.html"),
             controller: 'DriverDetailsDialogController',
             controllerAs: 'ctrl',
             locals: {
                 driver: angular.copy(this.selectedDriver)
             },
             parent: this.$document.parent(),
             clickOutsideToClose: false
         }).then(async (updatedDriver: ICourierDataDashboard) => {
             if (updatedDriver) {
                 await this.saveDriverDetails(updatedDriver);
             }
         });*/
    }

    private async saveDriverDetails(driver: ICourierDataDashboard): Promise<void> {
        try {
            await this.driverManagementService.updateCourierDetails(driver);
            this.selectedDriver = driver;
            this.toastrService.showSuccessToast('Driver details updated successfully');
        } catch (error) {
            this.$log.error('Error saving driver details:', error);
            this.toastrService.showErrorToast('Failed to update driver details');
        }
    }

    printDriverDetails(): void {
        if (!this.selectedDriver) {
            this.toastrService.showWarningToast('Please select a driver first');
            return;
        }
        this.$window.print();
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
            this.$log.error('Error loading compliance data:', error);
            this.toastrService.showErrorToast('Failed to load compliance data');
        }
    }

    getComplianceStatus(expiryDate: Date | undefined): { status: string; class: string; daysUntil: number } {
        if (!expiryDate) {
            return {status: 'Not Set', class: 'status-invalid', daysUntil: -999};
        }

        const today = dayjs();
        const expiry = dayjs(expiryDate);
        const daysUntil = expiry.diff(today, 'day');

        if (daysUntil < 0) {
            return {status: 'Expired', class: 'status-expired', daysUntil};
        } else if (daysUntil <= 30) {
            return {status: 'Expiring Soon', class: 'status-expiring', daysUntil};
        } else {
            return {status: 'Valid', class: 'status-valid', daysUntil};
        }
    }

    async onComplianceFilterChange(): Promise<void> {
        await this.loadComplianceData();
    }

    addComplianceItem(): void {
        /*  this.$mdDialog.show({
              template: require("./dialogs/compliance-dialog.template.html"),
              controller: 'ComplianceDialogController',
              controllerAs: 'ctrl',
              locals: {
                  item: null,
                  driversList: this.driversList
              },
              parent: this.$document.parent(),
              clickOutsideToClose: false
          }).then(async (newItem: ICourierCompliance) => {
              if (newItem) {
                  await this.saveComplianceItem(newItem);
              }
          });*/
    }

    editComplianceItem(item: ICourierCompliance): void {
        /*  this.$mdDialog.show({
              template: require("./dialogs/compliance-dialog.template.html"),
              controller: 'ComplianceDialogController',
              controllerAs: 'ctrl',
              locals: {
                  item: angular.copy(item),
                  driversList: this.driversList
              },
              parent: this.$document.parent(),
              clickOutsideToClose: false
          }).then(async (updatedItem: ICourierCompliance) => {
              if (updatedItem) {
                  await this.saveComplianceItem(updatedItem);
              }
          });*/
    }

    private async saveComplianceItem(item: ICourierCompliance): Promise<void> {
        try {
            await this.driverManagementService.saveComplianceItem(item);
            this.toastrService.showSuccessToast('Compliance item saved successfully');
            await this.loadComplianceData();
        } catch (error) {
            this.$log.error('Error saving compliance item:', error);
            this.toastrService.showErrorToast('Failed to save compliance item');
        }
    }

    async deleteComplianceItem(item: ICourierCompliance): Promise<void> {
        const confirm = this.$mdDialog.confirm()
            .title('Delete Compliance Item')
            .textContent(`Are you sure you want to delete the ${item.complianceType} compliance for ${item.name}?`)
            .ok('Delete')
            .cancel('Cancel');

        try {
            await this.$mdDialog.show(confirm);
            await this.driverManagementService.deleteComplianceItem(item);
            this.toastrService.showSuccessToast('Compliance item deleted');
            await this.loadComplianceData();
        } catch (error) {
            // User canceled or error occurred
            if (error !== undefined) {
                this.$log.error('Error deleting compliance item:', error);
                this.toastrService.showErrorToast('Failed to delete compliance item');
            }
        }
    }

    async sendComplianceReminder(item: ICourierCompliance): Promise<void> {
        try {
            await this.driverManagementService.sendComplianceReminder(item);
            this.toastrService.showSuccessToast(`Reminder sent to ${item.name}`);
        } catch (error) {
            this.$log.error('Error sending reminder:', error);
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
                this.$log.error('Error sending bulk reminders:', error);
                this.toastrService.showErrorToast('Failed to send reminders');
            }
        }
    }

    exportComplianceList(): void {
        const data = this.complianceItems.map(item => {
            const status = this.getComplianceStatus(item.expiryDate);
            return {
                Code: item.code,
                Name: item.name,
                Type: item.complianceType,
                Item: item.itemNumber,
                'Expiry Date': item.expiryDate ? formatShortDateWithYear(item.expiryDate, this.isUsCustomer) : 'Not Set',
                Status: status.status,
                'Days Until Expiry': status.daysUntil
            };
        });

        this.exportToCSV(data, 'Compliance_Report');
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
                todayCoverage: afterHoursResponse.totalAssignments > 0
            }
        } catch (error) {
            this.$log.error('Error loading after hours schedule:', error);
            this.toastrService.showErrorToast('Failed to load after hours schedule');
        }
    }

    formatScheduleTime(time: Date | undefined): string {
        if (!time) return '-';
        return formatMins(time);
    }

    addAfterHoursAssignment(): void {
        /*  this.$mdDialog.show({
              template: require("./dialogs/after-hours-dialog.template.html"),
              controller: 'AfterHoursDialogController',
              controllerAs: 'ctrl',
              locals: {
                  assignment: null,
                  driversList: this.driversList
              },
              parent: this.$document.parent(),
              clickOutsideToClose: false
          }).then(async (newAssignment: IAfterHoursCourierSchedule) => {
              if (newAssignment) {
                  await this.saveAfterHoursAssignment(newAssignment);
              }
          });*/
    }

    editAfterHoursAssignment(assignment: IAfterHoursCourierSchedule): void {
        /*    this.$mdDialog.show({
                template: require("./dialogs/after-hours-dialog.template.html"),
                controller: 'AfterHoursDialogController',
                controllerAs: 'ctrl',
                locals: {
                    assignment: angular.copy(assignment),
                    driversList: this.driversList
                },
                parent: this.$document.parent(),
                clickOutsideToClose: false
            }).then(async (updatedAssignment: IAfterHoursCourierSchedule) => {
                if (updatedAssignment) {
                    await this.saveAfterHoursAssignment(updatedAssignment);
                }
            });*/
    }

    private async saveAfterHoursAssignment(assignment: IAfterHoursCourierSchedule): Promise<void> {
        try {
            await this.driverManagementService.saveAfterHoursSchedule(assignment);
            this.toastrService.showSuccessToast('Assignment saved successfully');
            await this.loadAfterHoursSchedule();
        } catch (error) {
            this.$log.error('Error saving assignment:', error);
            this.toastrService.showErrorToast('Failed to save assignment');
        }
    }

    async deleteAfterHoursAssignment(assignment: IAfterHoursCourierSchedule): Promise<void> {
        const confirm = this.$mdDialog.confirm()
            .title('Delete Assignment')
            .textContent(`Are you sure you want to delete this assignment for ${assignment.courierName}?`)
            .ok('Delete')
            .cancel('Cancel');

        try {
            await this.$mdDialog.show(confirm);
            await this.driverManagementService.deleteAfterHoursSchedule(assignment);
            this.toastrService.showSuccessToast('Assignment deleted');
            await this.loadAfterHoursSchedule();
        } catch (error) {
            // User canceled or error occurred
            if (error !== undefined) {
                this.$log.error('Error deleting assignment:', error);
                this.toastrService.showErrorToast('Failed to delete assignment');
            }
        }
    }

    // Email Management Methods
    private async loadDriverEmails(): Promise<void> {
        this.emailsLoading = true;
        try {
            this.driverEmails = await this.driverManagementService.getDriverEmails();
        } catch (error) {
            this.$log.error('Error loading driver emails:', error);
            this.toastrService.showErrorToast('Failed to load driver emails');
        } finally {
            this.emailsLoading = false;
        }
    }

    getFilteredEmails(): IDriverEmail[] {
        let filtered = [...this.driverEmails];

        if (this.emailFilters.fleet) {
            filtered = filtered.filter(e => e.fleet === this.emailFilters.fleet);
        }

        if (this.emailFilters.search) {
            const search = this.emailFilters.search.toLowerCase();
            filtered = filtered.filter(e =>
                e.name.toLowerCase().includes(search) ||
                e.email.toLowerCase().includes(search) ||
                e.phone.toLowerCase().includes(search)
            );
        }

        return filtered;
    }

    toggleEmailSelection(email: string): void {
        if (this.selectedEmails.has(email)) {
            this.selectedEmails.delete(email);
        } else {
            this.selectedEmails.add(email);
        }
    }

    selectAllEmails(): void {
        this.getFilteredEmails().forEach(e => this.selectedEmails.add(e.email));
        this.selectAll = true;
    }

    deselectAllEmails(): void {
        this.selectedEmails.clear();
        this.selectAll = false;
    }

    isEmailSelected(email: string): boolean {
        return this.selectedEmails.has(email);
    }

    composeGroupEmail(): void {
        if (this.selectedEmails.size === 0) {
            this.toastrService.showWarningToast('Please select at least one driver');
            return;
        }

        /*  this.$mdDialog.show({
              template: require("./dialogs/group-email-dialog.template.html"),
              controller: 'GroupEmailDialogController',
              controllerAs: 'ctrl',
              locals: {
                  recipients: Array.from(this.selectedEmails)
              },
              parent: this.$document.parent(),
              clickOutsideToClose: false
          }).then(async (emailData: any) => {
              if (emailData) {
                  await this.sendGroupEmail(emailData);
              }
          });*/
    }

    private async sendGroupEmail(emailData: any): Promise<void> {
        try {
            await this.driverManagementService.sendGroupEmail(emailData);
            this.toastrService.showSuccessToast(`Email sent to ${this.selectedEmails.size} recipient(s)`);
            this.deselectAllEmails();
        } catch (error) {
            this.$log.error('Error sending group email:', error);
            this.toastrService.showErrorToast('Failed to send group email');
        }
    }

    emailDriver(email: string): void {
        this.$window.location.href = `mailto:${email}`;
    }

    exportEmailList(): void {
        const data = this.getFilteredEmails().map(item => ({
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
}

const DriverManagementComponent: angular.IComponentOptions = {
    template: require("./driver-management.template.html"),
    controller: DriverManagementController,
    controllerAs: "ctrl",
};

export default DriverManagementComponent;