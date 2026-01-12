import "./jobSearch.styles.less";
import JobSearchService from "./jobSearch.service";
import DispatchExecutorService from "../../services/dispatch-executor.service";
import ToastrService from "../../services/toastr.service";
import DispatchCoreService from "../../services/dispatch-core.service";
import {IAppConfig} from "../../interfaces/app-config.interface";
import {IDispatchJob, IJobSearchResult, ISuggestion} from "../../interfaces/job.interface";
import {Coordinates} from "../overview/overview.interfaces";
import BaseController from "../base-controller";
import {IBox, IColumn, ILayout} from "../../interfaces/layout.interfaces";
import {ContactID, TimeZone} from "../../contants";
import JobContextMenuService from "../../services/job-context-menu.service";
import {JobProperty} from "../../enums/job-property.enum";
import NavigationService from "../../services/navigation.service";
import greetUser from "../../functions/greetUser";
import {AppPage} from "../../enums/app-pages.enum";
import MessagingDialogService from "../dialogs/messaging-dialog/messaging-dialog.service";
import JobSearchBoxes from "./enums/jobSearchBoxes";
import {IDeliveryHistoryConfig} from "../../react/components/common/task-history/TaskHistory.interfaces";
import DensityMode from "../../enums/densityMode";
import ISearchCriteria from "./interfaces/ISearchCriteria";
import dayjs, {Dayjs} from "dayjs";
import JobListType from "../common/job-list/enums/jobListType";
import CreateJobDialogService from "../dialogs/create-job-dialog/create-job-dialog.service";
import AdditionalServicesDialogService from "../dialogs/additional-services-dialog/additional-services-dialog.service";
import JobFileUploadDialogService from "../dialogs/job-file-upload-dialog/job-file-upload-dialog.service";
import BulkPriceUploadDialogService from "../dialogs/bulk-price-upload-dialog/bulk-price-upload-dialog.service";
import IScanDetailResult from "./interfaces/IScanDetailResult";
import InterCourierChargeDialogService
    from "../dialogs/inter-courier-charge-dialog/inter-courier-charge-dialog.service";
import JobSearchDateRange from "./enums/JobSearchDateRange";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import {getIanaTimezone} from "../../functions/formatDates";
import DashboardSettingsDialogService from "../dialogs/dashboard-settings-dialog/dashboard-settings-dialog.service";

dayjs.extend(utc);
dayjs.extend(timezone);

class JobSearchController extends BaseController {
    static $inject = [
        'uCSData',
        '$mdDialog',
        'dispatchJobService',
        'toastrService',
        'DispatchData',
        '$mdSidenav',
        '$document',
        'jobContextMenuService',
        "navigationService",
        "messagingDialogService",
        "createJobDialogService",
        "additionalServicesDialogService",
        "jobFileUploadDialogService",
        "bulkPriceUploadDialogService",
        'interCourierChargeDialogService',
        'dashboardSettingsDialogService',
        'APP_CONFIG',
        '$scope',
        '$timeout',
        '$interval',
    ];

    private readonly LayoutKey: string = `layoutsCS-${ContactID}`
    private readonly LastActiveLayoutKey: string = `lastActiveLayoutCS-${ContactID}`
    private readonly BoxVisibilityKey: string = `boxVisibility-${AppPage.JobSearch}-${ContactID}`

    readonly isAdmin: boolean;

    boxes?: Record<string, IBox>;
    currentLayoutName?: string;
    boxSortableOptions?: angular.ui.SortableOptions<any>;
    layouts: ILayout[] = [];
    defaultLayout?: ILayout;
    layout?: { columns: IColumn[] };

    isUsCustomer: boolean;
    mapCenter: Coordinates;
    mapZoom: number;
    jobDetailFabIsOpen: boolean = false;
    dateSearchRange: JobSearchDateRange;
    searchCriteria: ISearchCriteria;
    clientSearchText: string;
    courierSearchText: string;
    speedSearchText: string;

    scanPromise?: Promise<IScanDetailResult[]>;
    scanList: IScanDetailResult[];

    jobListType = JobListType.JobSearchMainList;
    bulkJobListType = JobListType.JobSearchBulkList;

    timeZone: string;
    jobList?: IDispatchJob[];
    bulkJobList?: IDispatchJob[];
    currentJob?: IDispatchJob;
    currentSelection?: string;
    currentJobId?: number;
    isBulkJob: boolean = false;
    deliveryHistoryConfig: IDeliveryHistoryConfig;
    isJobListLoading: boolean = false;
    isBulkJobListLoading: boolean = false;
    totalJobs?: number;
    currentSortColumn?: string;
    currentSortDirection?: string;

    constructor(
        private jobSearchService: JobSearchService,
        private $mdDialog: angular.material.IDialogService,
        private dispatchJobService: DispatchExecutorService,
        private toastrService: ToastrService,
        private DispatchData: DispatchCoreService,
        private $mdSidenav: angular.material.ISidenavService,
        private $document: angular.IDocumentService,
        private jobContextMenuService: JobContextMenuService,
        private navigationService: NavigationService,
        private messagingDialogService: MessagingDialogService,
        private createJobDialogService: CreateJobDialogService,
        private additionalServicesDialogService: AdditionalServicesDialogService,
        private jobFileUploadDialogService: JobFileUploadDialogService,
        private bulkPriceUploadDialogService: BulkPriceUploadDialogService,
        private interCourierChargeDialogService: InterCourierChargeDialogService,
        private dashboardSettingsDialog: DashboardSettingsDialogService,
        appConfig: IAppConfig,
        $scope: angular.IScope,
        $timeout: angular.ITimeoutService,
        $interval: angular.IIntervalService,
    ) {
        super();

        this.initServices($timeout, $interval, $scope);

        this.timeZone = getIanaTimezone(TimeZone);
        this.isUsCustomer = appConfig.US_Customer;
        this.isAdmin = ClientInternal;

        // Layouts
        this.initializeBoxes();
        this.initializeOldLayoutSystem();

        // New map
        this.mapCenter = appConfig.US_Customer ?
            appConfig.US_Coordinates_Center :
            appConfig.NZ_Coordinates_Center;
        this.mapZoom = 12;

        this.jobDetailFabIsOpen = false;
        this.dateSearchRange = JobSearchDateRange.Fortnight;

        this.scanList = [];

        const now = dayjs();
        this.searchCriteria = {
            date: now,
            from_date: now.subtract(7, 'day'),
            to_date: now.add(7, 'day'),
            followupClient: "All",
            includeClosed: true,
            clients: [],
            couriers: [],
            speeds: []
        };
        this.clientSearchText = '';
        this.courierSearchText = '';
        this.speedSearchText = '';

        this.deliveryHistoryConfig = {
            showSummaryStats: true,
            densityMode: DensityMode.Normal
        }

        // Default to a fortnight
        this.onSearchRangeChange(this.dateSearchRange);
    }

    // Layout system
    private initializeOldLayoutSystem(): void {
        // Ensure draggingItems container exists
        if (angular.element('#draggingItems').length === 0) {
            angular.element('body').append('<div id="draggingItems"></div>');
        }

        this.layouts = [];
        this.defaultLayout = {
            name: "Default",
            layout: {
                columns: [
                    {
                        id: "col1",
                        width: "20%",
                        boxes: [{name: JobSearchBoxes.SearchWidget, height: "100%"}],
                    },
                    {
                        id: "col2",
                        width: "25%",
                        boxes: [
                            {name: JobSearchBoxes.JobList, height: "50%"},
                            {name: JobSearchBoxes.BulkJobList, height: "50%"}
                        ],
                    },
                    {
                        id: "col3",
                        width: "35%",
                        boxes: [
                            {name: JobSearchBoxes.JobDetail, height: "40%"},
                            {name: JobSearchBoxes.ScanList, height: "30%"},
                            {name: JobSearchBoxes.Map, height: "30%"}
                        ],
                    },
                    {
                        id: "col4",
                        width: "20%",
                        boxes: [{name: JobSearchBoxes.DeliveryJourney, height: "100%"}],
                    },
                ],
            },
        };

        // Load saved layouts or use default
        if (Modernizr.localstorage) {
            try {
                const storedLayouts: ILayout[] = JSON.parse(localStorage.getItem(this.LayoutKey) || '[]');
                const lastActiveLayout = localStorage.getItem(this.LastActiveLayoutKey);

                this.layouts = storedLayouts || [this.defaultLayout];
                this.layouts[0] = this.defaultLayout; // Ensure default is always up to date

                // Load last active layout or default
                const layoutToLoad = lastActiveLayout
                    ? this.layouts.findIndex((l: ILayout) => l.name === lastActiveLayout)
                    : 0;
                this.loadLayout(layoutToLoad >= 0 ? layoutToLoad : 0);
            } catch (error: any) {
                console.error('Error loading stored layouts:', error);
                this.layouts = [this.defaultLayout];
                this.loadLayout(0);
            }
        } else {
            this.layouts = [this.defaultLayout];
            this.loadLayout(0);
        }

        // Initialize box-sortable options
        this.boxSortableOptions = {
            handle: '.box-handle',
            connectWith: '.column-sortable',
            placeholder: 'box-placeholder',
            tolerance: 'pointer',
            cursor: 'move',
            opacity: 0.8,
            scroll: true,
            revert: 200,
            delay: 150,
            forcePlaceholderSize: true,
            disabled: false, // Will be updated when layout changes

            start: (e: JQueryEventObject, ui: any) => {
                // Prevent drag on default layout
                if (this.isDefaultLayout()) {
                    return false;
                }
                ui.item.addClass('dragging');

                const dragInfo = angular.element('#draggingItems');
                dragInfo.text(`Moving: ${ui.item.find('.md-headline-title').text().trim()}`);
                dragInfo.css({
                    display: 'block',
                    top: e.pageY + 20 + 'px',
                    left: e.pageX + 10 + 'px'
                });

                this.$document.on('mousemove.sortable', (event) => {
                    dragInfo.css({
                        top: (event.pageY || 0) + 20 + 'px',
                        left: (event.pageX || 0) + 10 + 'px'
                    });
                });
            },

            over: (e: JQueryEventObject, _: any) => {
                angular.element(e.target).addClass('ui-sortable-active');
            },

            out: (e: JQueryEventObject, _: any) => {
                angular.element(e.target).removeClass('ui-sortable-active');
            },

            stop: (_: JQueryEventObject, ui: any) => {
                angular.element(this.$document[0]).off('mousemove.sortable');
                angular.element('#draggingItems').css('display', 'none');
                ui.item.removeClass('dragging');
                angular.element('.column-sortable').removeClass('ui-sortable-active');

                this.updateBoxMetrics();
                this.saveCurrentLayout();
            }
        };
    }

    loadLayout(index: number): void {
        const layout: ILayout = this.layouts[index] || this.layouts[0];
        this.currentLayoutName = layout.name;
        this.layout = angular.copy(layout.layout);

        this.applyLayoutDimensions();
        this.loadBoxVisibility();

        if (Modernizr.localstorage) {
            localStorage.setItem(this.LastActiveLayoutKey, layout.name);
        }

        this.applyScope();
    }

    saveLayout(): void {
        this.$mdDialog
            .show(this.$mdDialog
                .prompt()
                .title("Add Layout")
                .textContent("Please enter a name for this layout.")
                .required(true)
                .ok("Add")
                .cancel("Cancel"))
            .then((name) => {
                if (!name) return;

                const currentLayout: ILayout = {
                    name: name,
                    layout: {
                        columns: this.layout?.columns?.map((col: IColumn) => ({
                            ...col,
                            width: angular.element(`#co-${col.id}`).css("flex-basis"),
                            boxes: col.boxes.map((box: IBox) => ({
                                ...box, height: angular
                                    .element(`#box-${box.name}`)
                                    .css("flex-basis"),
                            })),
                        })) || [],
                    },
                };

                this.layouts.push(currentLayout);
                this.currentLayoutName = name;

                if (Modernizr.localstorage) {
                    localStorage.setItem(this.LayoutKey, JSON.stringify(this.layouts));
                    localStorage.setItem(this.LastActiveLayoutKey, name);
                }

                this.toastrService.showSuccessToast("Layout saved successfully");
            });
    }

    deleteLayout(index: number): void {
        if (index === 0) return; // Prevent deleting default layout

        this.$mdDialog
            .show(this.$mdDialog
                .confirm()
                .title("Delete Layout?")
                .textContent("Are you sure you want to delete this layout?")
                .ok("Delete")
                .cancel("Cancel"))
            .then(() => {
                this.layouts.splice(index, 1);
                if (Modernizr.localstorage) {
                    localStorage.setItem(this.LayoutKey, JSON.stringify(this.layouts));
                }
                this.loadLayout(0);
                this.toastrService.showSuccessToast("Layout deleted successfully");
            });
    }

    private updateBoxMetrics(): void {
        if (!this.layout || !this.layout.columns) return;

        this.layout.columns.forEach((column: IColumn) => {
            const columnEl = angular.element(`#co-${column.id}`);
            if (columnEl.length) {
                column.width = columnEl.css('flex-basis');

                column.boxes.forEach((box: IBox) => {
                    const boxEl = angular.element(`#box-${box.name}`);
                    if (boxEl.length) {
                        box.height = boxEl.css('flex-basis');
                    }
                });
            }
        });
    }

    private saveCurrentLayout(): void {
        if (!this.currentLayoutName || this.currentLayoutName === 'Default') {
            return;
        }

        this.updateBoxMetrics();

        const index = this.layouts.findIndex((l: ILayout) => l.name === this.currentLayoutName);
        if (index !== -1) {
            if (this.layout) {
                this.layouts[index].layout = angular.copy(this.layout);
            }

            if (Modernizr.localstorage) {
                localStorage.setItem(this.LayoutKey, JSON.stringify(this.layouts));
            }
        }
    }

    private applyLayoutDimensions(): void {
        if (!this.layout || !this.layout.columns) return;

        this.layout.columns.forEach((column: IColumn) => {
            const columnEl = angular.element(`#co-${column.id}`);
            if (columnEl.length) {
                columnEl.css('flex-basis', column.width);

                column.boxes.forEach((box: IBox) => {
                    const boxEl = angular.element(`#box-${box.name}`);
                    if (boxEl.length) {
                        boxEl.css('flex-basis', box.height || 'auto');
                    }
                });
            }
        });
    }

    private initializeBoxes(): void {
        this.boxes = {
            [JobSearchBoxes.SearchWidget]: {
                name: JobSearchBoxes.SearchWidget,
                title: 'Filters',
                icon: "filter_list",
                templateUrl: "app/components/jobSearch/partials/pickDate.html",
                showRefresh: false,
                visible: true,
                description: "Search filters and date range selection for job queries"
            },
            [JobSearchBoxes.JobList]: {
                name: JobSearchBoxes.JobList,
                title: 'Live Job Data',
                icon: "list_alt",
                templateUrl: "app/components/jobSearch/partials/jobList.html",
                showRefresh: true,
                visible: true,
                description: "Real-time list of active jobs with current status"
            },
            [JobSearchBoxes.BulkJobList]: {
                name: JobSearchBoxes.BulkJobList,
                title: 'Bulk Job Data',
                icon: "format_list_bulleted",
                templateUrl: "app/components/jobSearch/partials/bulkJobList.html",
                showRefresh: true,
                visible: true,
                description: "Aggregated view of multiple jobs for bulk operations"
            },
            [JobSearchBoxes.JobDetail]: {
                name: JobSearchBoxes.JobDetail,
                title: 'Detail',
                icon: "assignment",
                templateUrl: "app/components/jobSearch/partials/jobDetail.html",
                showDetailButtons: true,
                showRefresh: true,
                visible: true,
                description: "Comprehensive job information with action buttons"
            },
            [JobSearchBoxes.ScanList]: {
                name: JobSearchBoxes.ScanList,
                title: 'Scan Detail',
                icon: "document_scanner",
                templateUrl: "app/components/jobSearch/partials/scanList.html",
                showRefresh: false,
                visible: true,
                description: "Detailed scan information and document history"
            },
            [JobSearchBoxes.Map]: {
                name: JobSearchBoxes.Map,
                title: 'Map',
                icon: "pin_drop",
                templateUrl: "app/components/jobSearch/partials/map.html",
                showRefresh: false,
                visible: true,
                description: "Geographic visualization of job locations"
            },
            [JobSearchBoxes.DeliveryJourney]: {
                name: JobSearchBoxes.DeliveryJourney,
                title: 'Delivery Journey',
                icon: "rocket_launch",
                templateUrl: "app/components/jobSearch/partials/jobHistory.html",
                showRefresh: false,
                visible: true,
                description: "Timeline and history of job delivery progress"
            }
        };
    }

    private getBoxVisibilityKey(layoutName: string): string {
        return `${this.BoxVisibilityKey}-${layoutName}`;
    }

    private saveBoxVisibility(): void {
        if (!Modernizr.localstorage || !this.boxes || !this.currentLayoutName) return;

        try {
            const boxState: Record<string, { visible: boolean; collapsed: boolean }> = {};
            Object.keys(this.boxes).forEach(boxName => {
                boxState[boxName] = {
                    visible: this.boxes![boxName].visible ?? true,
                    collapsed: this.boxes![boxName].collapsed ?? false
                };
            });
            const key = this.getBoxVisibilityKey(this.currentLayoutName);
            localStorage.setItem(key, JSON.stringify(boxState));
        } catch (error) {
            console.error('Error saving box visibility to storage:', error);
        }
    }

    private loadBoxVisibility(): void {
        if (!Modernizr.localstorage || !this.boxes || !this.currentLayoutName) return;

        try {
            const key = this.getBoxVisibilityKey(this.currentLayoutName);
            const savedState = localStorage.getItem(key);
            if (savedState) {
                const boxState = JSON.parse(savedState);
                Object.keys(boxState).forEach(boxName => {
                    if (this.boxes && this.boxes[boxName]) {
                        // Handle both old format (boolean) and new format (object)
                        if (typeof boxState[boxName] === 'boolean') {
                            this.boxes[boxName].visible = boxState[boxName];
                            this.boxes[boxName].collapsed = false;
                        } else {
                            this.boxes[boxName].visible = boxState[boxName].visible ?? true;
                            this.boxes[boxName].collapsed = boxState[boxName].collapsed ?? false;
                        }
                    }
                });
            } else {
                // No saved state for this layout - reset all boxes to visible and expanded
                Object.keys(this.boxes).forEach(boxName => {
                    this.boxes![boxName].visible = true;
                    this.boxes![boxName].collapsed = false;
                });
            }
        } catch (error) {
            console.error('Error loading box visibility from storage:', error);
        }
    }

    toggleBoxCollapse(boxName: string): void {
        if (!this.boxes || !this.boxes[boxName]) return;
        if (this.isDefaultLayout()) return; // Don't allow collapse on default layout

        this.boxes[boxName].collapsed = !this.boxes[boxName].collapsed;
        this.saveBoxVisibility();
        this.applyScope();
    }

    isDefaultLayout(): boolean {
        return this.currentLayoutName === 'Default';
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

    greetUser() {
        return greetUser(FirstName);
    }

    async selectAndDispatchJob($event: MouseEvent, job: IDispatchJob) {
        try {
            const dispatchDialog = this.$mdDialog.prompt()
                .title("Dispatch To Courier")
                .textContent('Enter the courier number to dispatch job to')
                .placeholder("Courier Number")
                .ariaLabel("courier to dispatch too")
                .targetEvent($event)
                .required(true)
                .ok("Dispatch")
                .cancel('Cancel');

            const courierNumber = await this.$mdDialog.show(dispatchDialog);

            if (courierNumber) {
                await this.dispatchJobService.assignSingleJobToCourier(courierNumber, job);
                await this.selectJob(job);
                this.toastrService.showSuccessToast('Job dispatched to courier ' + courierNumber);
            }
        } catch (error) {
            if (!error) return;
            console.error('Error in selectAndDispatchJob:', error);
        }
    }

    async selectJob(job: IDispatchJob | undefined) {
        if (!job) return;
        return this.selectJobDetail(job.id);
    }

    async createNewJob($event: MouseEvent) {
        try {
            // Dialog
            const newJobId = await this.createJobDialogService.showCreateJobDialog($event);
            // Refresh data
            await this.refreshData();

            // Then load the new job
            await this.selectJobDetail(newJobId);
            console.log('Dialog closed!');
        } catch (error) {
            console.error('Error in createNewJob:', error);
        }
    }

    async showAdditionalServicesMenu($event: MouseEvent, job: IDispatchJob) {
        try {
            if (!job.clientId || !job.speedId) return;
            const isClientItemsAvailable = await this.DispatchData.hasClientItemsAvailable(job.clientId, job.speedId);

            if (!isClientItemsAvailable) {
                await this.$mdDialog.show(this.$mdDialog.alert()
                    .clickOutsideToClose(true)
                    .title('No Additional Services')
                    .targetEvent($event)
                    .textContent('No additional services has been set up for this client. Please add a service through Admin Manager and try again.')
                    .ok('OK'));
                return;
            }

            await this.additionalServicesDialogService.showAdditionalServicesDialog($event, job);
        } catch (error) {
            console.error('Error in showAdditionalServicesMenu:', error);
        }
    }

    async openFileAttachmentDialog($event: MouseEvent, job: IDispatchJob) {
        try {
            await this.jobFileUploadDialogService.openJobFileUploadDialog($event, job);
            console.log('Job File Upload Dialog Closed!');
        } catch (error) {
            if (error === undefined) {
                console.log('User canceled!');
            } else {
                console.error('Error in openFileAttachmentDialog:', error);
            }
        }
    }

    async interCourierCharge($event: MouseEvent) {
        try {
            await this.interCourierChargeDialogService.showInterCourierCharge($event);
            console.log("Inter-courier Charge Added!");
        } catch (error) {
            if (!error) return;
            console.log("Inter-courier Charge Canceled!");
        }
    }

    async unlockJob(currentJob: IDispatchJob) {
        await this.DispatchData.updateJobDetail(currentJob.id, JobProperty.Locked, false, currentJob.preBook ?? false)
    }

    async lockJob(currentJob: IDispatchJob) {
        await this.DispatchData.updateJobDetail(currentJob.id, JobProperty.Locked, true, currentJob.preBook ?? false)
    }

    async unSplitJob() {
        try {
            const confirm = this.$mdDialog.confirm()
                .title('Un-Split Job?')
                .textContent('Are you sure you wish to un-split this job?')
                .ok('Yes')
                .cancel('No');

            await this.$mdDialog.show(confirm);

            if (!this.currentJob) {
                this.toastrService.showErrorToast('Please select a job to un-split.');
                return;
            }
            const msg = await this.jobSearchService.unSplitJob(this.currentJob.id);

            if ((msg || "").length > 2) {
                const alert = this.$mdDialog.alert()
                    .title('Error')
                    .textContent(msg)
                    .ok('Close');

                await this.$mdDialog.show(alert);
            }
        } catch (error) {
            // User clicked 'No' or an error occurred
            console.log('Un-split job cancelled or error occurred:', error);
        }
    }

    async restoreJob(job: IDispatchJob) {
        try {
            const jobIds: number[] = [];
            await this.DispatchData.addRestoreEvent(job.id);

            if (job.displaySplitJobDetail) {
                jobIds.push(job.id);
            } else {
                jobIds.push(job.id);
            }

            if (jobIds.length === 0) return;

            const promises = [];
            if (job.displaySplitJobDetail) {
                promises.push(this.DispatchData.restoreSplitJobs(jobIds));
            } else {
                promises.push(this.DispatchData.restoreJobs(jobIds));
            }

            await Promise.all(promises);
            await this.selectJobDetail(job.id);
        } catch (error) {
            this.toastrService.showErrorToast('Error in restoring job');
            console.error('Error in restoreJob:', error);
        }
    }

    async swapPOD($event: MouseEvent) {
        try {
            const jobNumberPrompt = this.$mdDialog.prompt()
                .title('Enter the other job number')
                .textContent('Please enter the Job Number to swap the POD.')
                .placeholder('Job Number')
                .ariaLabel('Job Number')
                .initialValue('')
                .targetEvent($event)
                .required(true)
                .ok('Submit')
                .cancel('Cancel');

            const jobNumber = await this.$mdDialog.show(jobNumberPrompt);
            const secondJobId = await this.jobSearchService.validateSwapPOD(jobNumber);

            if (!secondJobId) {
                await this.$mdDialog.show(this.$mdDialog.alert()
                    .clickOutsideToClose(true)
                    .title('Invalid Job')
                    .textContent('This job is invalid.')
                    .ok('OK'));
                return;
            }

            if (!this.currentJob) {
                this.toastrService.showErrorToast('Please select a job to swap POD.');
                return;
            }

            const firstJobId = this.currentJob.id;
            if (!firstJobId) {
                this.toastrService.showErrorToast('Please select a job to swap POD.');
                return;
            }

            const confirmSwap = this.$mdDialog.confirm()
                .title('Swap Delivery Info?')
                .textContent(`Are you sure you wish to swap delivery info between ${this.currentJob?.jobNo} and ${jobNumber}?`)
                .ariaLabel('Lucky day')
                .targetEvent($event)
                .ok('Yes')
                .cancel('No');

            await this.$mdDialog.show(confirmSwap);

            await this.jobSearchService.swapPOD(this.currentJob.jobNo, jobNumber);

            await this.$mdDialog.show(this.$mdDialog.alert()
                .clickOutsideToClose(true)
                .title('Successful')
                .textContent('POD Swap Completed Successfully')
                .ok('OK'));

            await this.jobSearchService.reSendJobs([secondJobId]);
            await this.jobSearchService.reAssignJobs([firstJobId]);
            await this.jobSearchService.reSendJobs([firstJobId]);
            await this.refreshData();

        } catch (error) {
            this.handleError(error);
        }
    }

    private handleError(error: any) {
        if (!error) return;

        console.error("Error in _handleError:", error);
    }

    async sendPOD($event: MouseEvent) {
        if (!this.currentJob) return;

        try {
            const confirm = this.$mdDialog.prompt()
                .title('Email the photo POD')
                .textContent('Please enter an email address to send the POD.')
                .placeholder('Email Address')
                .ariaLabel('Email Address')
                .targetEvent($event)
                .required(true)
                .ok('Send')
                .cancel('Cancel');

            const email = await this.$mdDialog.show(confirm);

            await this.jobSearchService.sendPOD(this.currentJob.id, email);

            await this.$mdDialog.show(this.$mdDialog.alert()
                .clickOutsideToClose(true)
                .title('Email Sent')
                .textContent('POD email has been sent')
                .ok('OK'));

        } catch (error) {
            this.handleError(error);
        }
    }

    async refreshAllData() {
        await Promise.all([this.refreshData(), this.refreshBulkData()]);
    }

    async refreshData() {
        try {
            this.isJobListLoading = true;

            const response = await this.handleLoadMoreJobs(0, 50);
            this.jobList = response.jobs;
            this.totalJobs = response.totalCount;
        } catch (error) {
            this.handleError(error);
        } finally {
            this.isJobListLoading = false;
            this.applyScope();
        }
    }

    async refreshBulkData() {
        try {
            this.isBulkJobListLoading = true;

            const response = await this.handleLoadMoreBulkJobs(0, 50);
            this.bulkJobList = response.jobs;
        } catch (error) {
            console.error('Error in refreshBulkData:', error);
        } finally {
            this.isBulkJobListLoading = false;
            this.applyScope();
        }
    }

    downloadJobList() {
        const downloadUrl = this.jobSearchService.getPodJobsDownloadUrl(
            this.searchCriteria.from_date,
            this.searchCriteria.to_date,
            this.getCourierIds(),
            this.getClientIds(),
            this.getSpeedIds(),
            this.searchCriteria.wild,
            this.searchCriteria.job
        );

        // Open in new window to trigger browser's native download
        window.open(downloadUrl, '_blank');
    }

    isClientJobsReportEnabled(): boolean {
        return !!(
            this.searchCriteria.clients?.length > 0 &&
            this.searchCriteria.from_date &&
            this.searchCriteria.to_date
        );
    }

    downloadClientJobsReport() {
        const downloadUrl = this.jobSearchService.getClientJobsReportDownloadUrl(
            this.searchCriteria.from_date,
            this.searchCriteria.to_date,
            this.getClientIds(),
        );

        // Open in new window to trigger browser's native download
        window.open(downloadUrl, '_blank');
    }

    async uploadJobList($event: MouseEvent) {
        try {
            const result = await this.bulkPriceUploadDialogService.openBulkPriceUploadDialog($event);
            if (result) {
                // Refresh the job list after successful upload
                await this.refreshAllData();
            }
        } catch {
            // Dialog was cancelled, do nothing
        }
    }

    async selectJobDetail(jobId: number) {
        try {
            console.log("select Job  " + jobId);

            this.isBulkJob = false;
            this.currentJob = await this.DispatchData.getDispatchJobDetail(jobId);
            this.currentJobId = jobId;
            this.currentSelection = " for Job " + this.currentJob?.jobNo;

            // Update the map with just this job
            if (!this.currentJob) {
                console.log("Job not found");
                return;
            }

            if (this.currentJob.pickupAddress?.latitude && this.currentJob.pickupAddress?.longitude) {
                this.mapCenter = {
                    lat: this.currentJob.pickupAddress.latitude,
                    lng: this.currentJob.pickupAddress.longitude
                };
            }

            if (!this.currentJob?.booked) return;

            this.scanPromise = this.jobSearchService.getScanDetail(this.currentJob.booked, this.currentJob.jobNo);
            this.scanList = await this.scanPromise;
        } catch (error) {
            console.error('Error in selectJobDetail:', error);
        } finally {
            this.applyScope();
        }
    }

    async selectBulkJobDetail(bulkJobId: number) {
        try {
            console.log("select Job  " + bulkJobId);

            this.isBulkJob = true;
            this.currentJob = await this.jobSearchService.getDispatchBulkJobDetail(bulkJobId);
            this.currentJobId = bulkJobId;
            this.currentSelection = " for Bulk Job " + this.currentJob?.jobNo;

            // Update the map with just this job
            if (this.currentJob.pickupAddress?.latitude && this.currentJob.pickupAddress?.longitude) {
                this.mapCenter = {
                    lat: this.currentJob.pickupAddress.latitude,
                    lng: this.currentJob.pickupAddress.longitude
                };
            }

            if (!this.currentJob?.booked) return;
            this.scanPromise = this.jobSearchService.getScanDetail(this.currentJob.booked, this.currentJob.jobNo);
            this.scanList = await this.scanPromise;
        } catch (error) {
            console.error('Error in selectJobDetail:', error);
        } finally {
            this.applyScope();
        }
    }

    clientQuerySearch(searchText: string) {
        return this.jobSearchService.getActiveClients(searchText);
    }

    async speedQuerySearch(searchText: string) {
        if (!searchText || searchText.length < 2) return [];

        try {
            return await this.DispatchData.searchSpeedOptions(searchText);
        } catch(error) {
            console.error('Error in speedQuerySearch:', error);
            return [];
        }
    }

    async courierQuerySearch(searchText: string) {
        if (!searchText || searchText.length < 2) return [];

        try {
            const results = await this.jobSearchService.getActiveCouriersSearch(searchText);

            // If the search text is purely numeric (courier code), filter for exact matches only
            const trimmedSearch = searchText.trim();
            if (/^\d+$/.test(trimmedSearch)) {
                // Filter results to only show exact courier code matches
                const exactMatches = results.filter((r: any) => {
                    if (!r.text) return false;
                    // Extract the courier code (before space or parenthesis)
                    const courierCode = r.text.split(/[\s(]/)[0];
                    return courierCode === trimmedSearch;
                });

                // Return exact matches if found, otherwise return all results
                return exactMatches.length > 0 ? exactMatches : results;
            }

            return results;
        } catch (error) {
            console.error('Error in courierQuerySearch:', error);
            return [];
        }
    }

    // Helper methods to extract IDs from selected items
    private getClientIds(): number[] | undefined {
        const ids = this.searchCriteria.clients?.map(c => c.id) || [];
        return ids.length > 0 ? ids : undefined;
    }

    private getCourierIds(): number[] | undefined {
        const ids = this.searchCriteria.couriers?.map(c => c.id) || [];
        return ids.length > 0 ? ids : undefined;
    }

    private getSpeedIds(): number[] | undefined {
        const ids = this.searchCriteria.speeds?.map(s => s.id) || [];
        return ids.length > 0 ? ids : undefined;
    }

    onSearchRangeChange(dateRangeOption: JobSearchDateRange) {
        try {
            const tenantTimezone = getIanaTimezone(this.timeZone);

            const now = dayjs().tz(tenantTimezone);
            const firstDayOfMonth = now.startOf('month');
            const lastDayOfMonth = now.endOf('month');
            const oneWeekAgo = now.subtract(7, 'day');
            const oneWeekAhead = now.add(7, 'day');

            switch (dateRangeOption) {
                case JobSearchDateRange.Fortnight:
                    this.searchCriteria.from_date = oneWeekAgo;
                    this.searchCriteria.to_date = oneWeekAhead;
                    break;
                case JobSearchDateRange.Today:
                    this.searchCriteria.from_date = now;
                    this.searchCriteria.to_date = now;
                    break;
                case JobSearchDateRange.Month:
                    this.searchCriteria.from_date = firstDayOfMonth;
                    this.searchCriteria.to_date = lastDayOfMonth;
                    break;
                case JobSearchDateRange.Custom:
                    // This option is empty as ng-if is used on the page to show custom date range options
                    break;
            }
        } catch (error) {
            console.log("Error: ", error);
        }
    }

    getContextMenuOptions(job: IDispatchJob) {
        if (!job) return [];

        const callbacks = {
            onRefresh: () => this.refreshAllData()
        };

        return this.jobContextMenuService.getMenuOptions(job, callbacks, AppPage.JobSearch);
    }

    async openHubUrl() {
        await this.navigationService.openHubUrl();
    }

    async openMessagingDialog($event: MouseEvent) {
        await this.messagingDialogService.openMessagingDialog($event);
    }

    async onRefreshButtonClicked(boxName: string): Promise<void> {
        console.log('🔄 Refresh clicked for:', boxName);
        console.log('🔄 Current job ID:', this.currentJobId);
        console.log('🔄 Is bulk job list?:', this.bulkJobList);

        switch (boxName) {
            case JobSearchBoxes.JobList:
                console.log('🔄 Refreshing JobList');
                await this.refreshData();
                break;
            case JobSearchBoxes.BulkJobList:
                console.log('🔄 Refreshing BulkJobList');
                await this.refreshBulkData();
                break;
            case JobSearchBoxes.JobDetail:
                console.log('🔄 Refreshing JobDetail');
                if (!this.currentJobId) {
                    console.log('❌ No current job ID');
                    return;
                }
                // Store the job ID and determine if it's a bulk job
                const jobIdToRefresh = this.currentJobId;
                const isBulkJob = this.bulkJobList?.some((job: IDispatchJob) => job.id === jobIdToRefresh) ?? false;

                // Clear current job state
                this.currentJobId = undefined;
                this.currentJob = undefined;
                this.scanList = [];

                // Reselect to trigger refresh based on a job type
                if (isBulkJob) {
                    await this.selectBulkJobDetail(jobIdToRefresh);
                } else {
                    await this.selectJobDetail(jobIdToRefresh);
                }
                break;
        }
    }

    async onJobSelect(job: IDispatchJob): Promise<void> {
        await this.selectJobDetail(job.id);
    }

    async onBulkJobSelect(job: IDispatchJob): Promise<void> {
        await this.selectBulkJobDetail(job.id);
    }

    async handleJobDispatch(job: IDispatchJob, courierId: number): Promise<boolean> {
        try {
            const jobsToDispatch = [job];
            await this.dispatchJobService.dispatchJobs(courierId, jobsToDispatch);

            // Inform the user
            this.toastrService.showSuccessToast(`${job.jobNo} successfully dispatched`);
            await this.refreshData();

            // Update the job's assigned courier display
            job.assignedCourier = {id: courierId, text: ''};

            return true;
        } catch (error: any) {
            console.error("Error in dispatch:", error);
            throw error;
        }
    }

    async handleLoadMoreBulkJobs(page: number, pageSize: number): Promise<IJobSearchResult> {
        try {
            return await this.jobSearchService.searchBulkJobs(
                this.searchCriteria.from_date,
                this.searchCriteria.to_date,
                page,
                pageSize,
                this.getCourierIds(),
                this.getClientIds(),
                this.getSpeedIds(),
                this.searchCriteria.job,
                this.searchCriteria.wild,
            );
        } catch (error) {
            console.error('Error loading bulk jobs:', error);
            throw error;
        }
    }

    async handleLoadMoreJobs(page: number, pageSize: number): Promise<IJobSearchResult> {
        try {
            return await this.jobSearchService.getPodJobs(
                this.searchCriteria.from_date,
                this.searchCriteria.to_date,
                page,
                pageSize,
                this.getCourierIds(),
                this.getClientIds(),
                this.getSpeedIds(),
                this.searchCriteria.wild,
                this.searchCriteria.job,
                this.currentSortColumn,
                this.currentSortDirection,
            );
        } catch (error) {
            console.error('Error loading jobs:', error);
            throw error;
        }
    }

    async handleBackendSort(sortData: { column: string, direction: string }): Promise<void> {
        this.currentSortColumn = sortData.column;
        this.currentSortDirection = sortData.direction;
        await this.refreshData();
    }

    async openSettingsDialog($event: MouseEvent): Promise<void> {
        if (!this.boxes) return;

        try {
            const result = await this.dashboardSettingsDialog.openSettingsDialog(
                $event,
                AppPage.JobSearch,
                this.currentLayoutName ?? 'Default',
                this.boxes
            );

            if (!result) return;

            if (result.boxes) {
                this.boxes = result.boxes;
                this.saveBoxVisibility();
            }

            this.saveCurrentLayout();
            this.applyScope();
            this.toastrService.showSuccessToast('Settings saved and applied successfully');
        } catch (error) {
            if (!error) return;
            console.error('Error opening settings dialog:', error);
            this.toastrService.showErrorToast('Failed to open settings dialog');
        }
    }

    updateFromDatePicker(dateTime: Dayjs): void {
        this.updateDateField(dateTime, 'from_date');
    }

    updateToDatePicker(dateTime: Dayjs): void {
        this.updateDateField(dateTime, 'to_date');
    }

    private updateDateField(dateTime: Dayjs, field: 'from_date' | 'to_date'): void {
        if (!dateTime.isValid()) {
            console.error("Returned datetime is invalid!");
            return;
        }

        this.searchCriteria[field] = dateTime.startOf('day');
    }
}

const JobSearchComponent: angular.IComponentOptions = {
    template: require("./jobSearch.template.html"),
    controller: JobSearchController,
    controllerAs: "ctrl"
}

export default JobSearchComponent;
