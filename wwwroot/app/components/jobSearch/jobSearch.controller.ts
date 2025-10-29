import "./jobSearch.styles.less";
import JobSearchService from "./jobSearch.service";
import DispatchExecutorService from "../../services/dispatch-executor.service";
import ToastrService from "../../services/toastr.service";
import DispatchCoreService from "../../services/dispatch-core.service";
import {IAppConfig} from "../../interfaces/app-config.interface";
import {IJobSearchResult, IDispatchJob, ISuggestion} from "../../interfaces/job.interface";
import {Coordinates} from "../overview/overview.interfaces";
import BaseController from "../base-controller";
import {IBox, IColumn, IGridsterItem, IGridsterLayout, ILayout} from "../../interfaces/layout.interfaces";
import {ContactID, TimeZone} from "../../contants";
import JobContextMenuService from "../../services/job-context-menu.service";
import {JobProperty} from "../../enums/job-property.enum";
import NavigationService from "../../services/navigation.service";
import greetUser from "../../functions/greetUser";
import {AppPage} from "../../enums/app-pages.enum";
import MessagingDialogService from "../dialogs/messaging-dialog/messaging-dialog.service";
import JobSearchBoxes from "./enums/jobSearchBoxes";
import {IDeliveryHistoryConfig} from "../common/task-history/task-history.interfaces";
import DensityMode from "../../enums/densityMode";
import ISearchCriteria from "./interfaces/ISearchCriteria";
import dayjs, {Dayjs} from "dayjs";
import JobListType from "../common/job-list/enums/jobListType";
import CreateJobDialogService from "../dialogs/create-job-dialog/create-job-dialog.service";
import AdditionalServicesDialogService from "../dialogs/additional-services-dialog/additional-services-dialog.service";
import JobFileUploadDialogService from "../dialogs/job-file-upload-dialog/job-file-upload-dialog.service";
import IScanDetailResult from "./interfaces/IScanDetailResult";
import InterCourierChargeDialogService
    from "../dialogs/inter-courier-charge-dialog/inter-courier-charge-dialog.service";
import JobSearchDateRange from "./enums/JobSearchDateRange";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import {getIanaTimezone} from "../../functions/formatDates";
import GRIDSTER_BASE_CONFIG from "../../gridster.config";
import isDefaultLayout from "../../functions/isDefaultLayout";
import NationwideBoxes from "../Nationwide/enums/NationwideBoxes";
import DashboardSettingsDialogService from "../dialogs/dashboard-settings-dialog/dashboard-settings-dialog.service";
import GridsterLayoutService from "../../services/gridster-layout.service";

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
        'interCourierChargeDialogService',
        'dashboardSettingsDialogService',
        'gridsterLayoutService',
        'APP_CONFIG',
        '$scope',
        '$timeout',
        '$interval',
    ];

    private readonly LayoutKey: string = `layoutsCS-${ContactID}`
    private readonly LastActiveLayoutKey: string = `lastActiveLayoutCS-${ContactID}`

    readonly isAdmin: boolean;

    // Gridster layout
    boxes?: Record<string, IBox>;
    layouts: IGridsterLayout[] = [];
    defaultLayout?: IGridsterLayout;
    currentLayoutName?: string;
    gridsterOpts?: angular.gridster.GridsterConfig;
    gridsterItems: IGridsterItem[] = [];

    // Old layout 
    boxSortableOptions?: angular.ui.SortableOptions<any>;
    oldLayouts: ILayout[] = [];
    oldDefaultLayout?: ILayout;
    layout?: { columns: IColumn[] };
    
    isUsCustomer: boolean;
    mapCenter: Coordinates;
    mapZoom: number;
    jobDetailFabIsOpen: boolean = false;
    dateSearchRange: JobSearchDateRange;
    searchCriteria: ISearchCriteria;
    clientSelectedItem?: number;
    courierSelectedItem?: number;
    clientSearchText: string;
    courierSearchText: string;

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
        private interCourierChargeDialogService: InterCourierChargeDialogService,
        private dashboardSettingsDialog: DashboardSettingsDialogService,
        private gridsterLayoutService: GridsterLayoutService,
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

        // Init layouts
        if(!this.isUsCustomer) {
            this.initializeGridster();
            this.initializeBoxes();
            this.loadGridsterLayoutsFromStorage();
        } else {
            this.initializeBoxes();
            this.initializeOldLayoutSystem();
        }


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
            includeClosed: true
        };
        this.clientSelectedItem = this.searchCriteria.client;
        this.courierSelectedItem = this.searchCriteria.client;
        this.clientSearchText = '';
        this.courierSearchText = '';
        
        this.deliveryHistoryConfig = {
            showSummaryStats: true,
            densityMode: DensityMode.Normal
        }

        // Default to a fortnight
        this.onSearchRangeChange(this.dateSearchRange);
    }
    
    // Old layout system
    private initializeOldLayoutSystem(): void {
        // Set up layout watchers
        this.watchScope(() => this.layout, () => {
            this.registerTimeout(() => this.applyLayoutDimensions());
        }, true);

        // Ensure draggingItems container exists
        if (angular.element('#draggingItems').length === 0) {
            angular.element('body').append('<div id="draggingItems"></div>');
        }

        this.oldLayouts = [];
        this.oldDefaultLayout = {
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

                this.oldLayouts = storedLayouts || [this.oldDefaultLayout];
                this.oldLayouts[0] = this.oldDefaultLayout; // Ensure default is always up to date

                // Load last active layout or default
                const layoutToLoad = lastActiveLayout
                    ? this.oldLayouts.findIndex((l: ILayout) => l.name === lastActiveLayout)
                    : 0;
                this.loadLayout(layoutToLoad >= 0 ? layoutToLoad : 0);
            } catch (error: any) {
                console.error('Error loading stored layouts:', error);
                this.oldLayouts = [this.oldDefaultLayout];
                this.loadLayout(0);
            }
        } else {
            this.oldLayouts = [this.oldDefaultLayout];
            this.loadLayout(0);
        }

        // Auto-save changes
        this.watchScope("layout", (newValue: { columns: IColumn[] }, oldValue: { columns: IColumn[] }) => {
            if (newValue !== oldValue && this.currentLayoutName) {
                const index = this.oldLayouts.findIndex((l: ILayout) => l.name === this.currentLayoutName);
                if (index !== -1) {
                    this.oldLayouts[index].layout = angular.copy(newValue);
                    if (Modernizr.localstorage) {
                        localStorage.setItem(this.LayoutKey, JSON.stringify(this.layouts));
                    }
                }
            }
        }, true);

        // Initialize box sortable options
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

            start: (e: JQueryEventObject, ui: any) => {
                ui.item.addClass('dragging');

                const dragInfo = angular.element('#draggingItems');
                dragInfo.html(`Moving: ${ui.item.find('.md-headline-title').text().trim()}`);
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
        const layout: ILayout = this.oldLayouts[index] || this.oldLayouts[0];
        this.currentLayoutName = layout.name;
        this.layout = angular.copy(layout.layout);

        this.applyLayoutDimensions();

        if (Modernizr.localstorage) {
            localStorage.setItem(this.LastActiveLayoutKey, layout.name);
        }

        this.applyScope();
    }

    saveLayout(): void {
        this.$mdDialog
            .show(this.$mdDialog
                .prompt()
                .title("Save Layout")
                .textContent("Please enter a name for this layout.")
                .required(true)
                .ok("Save")
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

                this.oldLayouts.push(currentLayout);

                if (Modernizr.localstorage) {
                    localStorage.setItem(this.LayoutKey, JSON.stringify(this.oldLayouts));
                    localStorage.setItem(this.LastActiveLayoutKey, name);
                }
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
                this.oldLayouts.splice(index, 1);
                if (Modernizr.localstorage) {
                    localStorage.setItem(this.LayoutKey, JSON.stringify(this.oldLayouts));
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

        const index = this.oldLayouts.findIndex((l: ILayout) => l.name === this.currentLayoutName);
        if (index !== -1) {
            if (this.layout) {
                this.oldLayouts[index].layout = angular.copy(this.layout);
            }

            if (Modernizr.localstorage) {
                localStorage.setItem(this.LayoutKey, JSON.stringify(this.oldLayouts));
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

    // Gridster layouts
    private initializeGridster(): void {
        this.gridsterOpts = this.gridsterLayoutService.createGridsterConfig(
            this.currentLayoutName,
            () => this.updateCurrentLayout(),
            this.$scopeService
        );
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

    private loadGridsterLayoutsFromStorage(): void {
        this.layouts = this.gridsterLayoutService.loadLayoutsFromStorage(AppPage.JobSearch);

        // Always recreate the default layout
        this.defaultLayout = this.createDefaultGridsterLayout();
        this.layouts.unshift(this.defaultLayout);

        // Load last active layout or default
        const lastActiveLayoutName = this.gridsterLayoutService.getLastActiveLayoutName(AppPage.JobSearch);
        const layoutToLoad = this.layouts.find(l => l.name === lastActiveLayoutName) || this.defaultLayout;
        this.loadGridsterLayout(this.layouts.indexOf(layoutToLoad));
    }
    
    private createDefaultGridsterLayout(): IGridsterLayout {
        return {
            name: 'Default',
            items: [
                // Column 1 (20% width, left side)
                {
                    name: JobSearchBoxes.SearchWidget,
                    sizeX: 2,
                    sizeY: 8,
                    row: 0,
                    col: 0,
                    visible: true
                },

                // Column 2 (25% width)
                {
                    name: JobSearchBoxes.JobList,
                    sizeX: 3,
                    sizeY: 4,
                    row: 0,
                    col: 2,
                    visible: true
                },
                {
                    name: JobSearchBoxes.BulkJobList,
                    sizeX: 3,
                    sizeY: 4,
                    row: 4,
                    col: 2,
                    visible: true
                },

                // Column 3 (35% width)
                {
                    name: JobSearchBoxes.JobDetail,
                    sizeX: 4,
                    sizeY: 3,
                    row: 0,
                    col: 5,
                    visible: true
                },
                {
                    name: JobSearchBoxes.ScanList,
                    sizeX: 4,
                    sizeY: 2,
                    row: 3,
                    col: 5,
                    visible: true
                },
                {
                    name: JobSearchBoxes.Map,
                    sizeX: 4,
                    sizeY: 3,
                    row: 5,
                    col: 5,
                    visible: true
                },

                // Column 4 (20% width, right side)
                {
                    name: JobSearchBoxes.DeliveryJourney,
                    sizeX: 2,
                    sizeY: 8,
                    row: 0,
                    col: 9,
                    visible: true
                }
            ]
        };
    }

    loadGridsterLayout(index: number): void {
        const success = this.gridsterLayoutService.loadLayout(
            this.layouts,
            index,
            AppPage.JobSearch,
            (layoutName, items) => {
                this.currentLayoutName = layoutName;
                this.gridsterItems = items;
                this.initializeGridster();
            }
        );

        if (success) {
            this.registerTimeout(() => {
                this.$scopeService?.$broadcast('gridster-resized');
            }, 50);
            this.applyScope();
        }
    }

    async saveGridsterLayout(): Promise<void> {
        try {
            const layoutName: string = await this.$mdDialog
                .show(this.$mdDialog
                    .prompt()
                    .title("Save Layout")
                    .textContent("Please enter a name for this layout.")
                    .required(true)
                    .ok("Save")
                    .cancel("Cancel"));

            const result = this.gridsterLayoutService.saveNewLayout(
                this.layouts,
                layoutName,
                this.gridsterItems,
                AppPage.JobSearch,
            );

            if (result.success) {
                this.currentLayoutName = layoutName.trim();
                this.toastrService.showSuccessToast(result.message);
            } else {
                this.toastrService.showErrorToast(result.message);
            }

            this.applyScope();
        } catch (error) {
            if (!error) return;
            console.error('Error saving gridster layout:', error);
            this.toastrService.showErrorToast('Error saving layout');
        }
    }

    updateCurrentLayout(): void {
        const result = this.gridsterLayoutService.updateLayout(
            AppPage.JobSearch,
            this.layouts,
            this.currentLayoutName,
            this.gridsterItems,
        );

        if (result.success) {
            this.toastrService.showSuccessToast(result.message);
        } else {
            this.toastrService.showWarningToast(result.message);
        }

        this.applyScope();
    }

    async deleteGridsterLayout(index: number): Promise<void> {
        try {
            if (index < 0 || index >= this.layouts.length) {
                console.error('Invalid layout index:', index);
                return;
            }

            const layout = this.layouts[index];

            if (layout.name === 'Default') {
                this.toastrService.showErrorToast('Cannot delete the Default layout');
                return;
            }

            const confirmed: boolean = await this.$mdDialog
                .show(this.$mdDialog
                    .confirm()
                    .title("Delete Layout?")
                    .textContent(`Are you sure you want to delete the layout "${layout.name}"?`)
                    .ok("Delete")
                    .cancel("Cancel"));

            if (!confirmed) return;

            const result = this.gridsterLayoutService.deleteLayout(
                AppPage.JobSearch,
                this.layouts,
                index,
                this.currentLayoutName,
            );

            if (result.success) {
                if (result.shouldLoadDefault) {
                    const defaultIndex = this.layouts.findIndex(l => l.name === 'Default');
                    this.loadGridsterLayout(defaultIndex);
                }
                this.toastrService.showSuccessToast(result.message);
            } else {
                this.toastrService.showErrorToast(result.message);
            }

            this.applyScope();
        } catch (error) {
            if (!error) return;
            console.error('Error deleting gridster layout:', error);
            this.toastrService.showErrorToast('Error deleting layout');
        }
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

    async downloadJobList() {
        try {
            const response: any = await this.jobSearchService.podJobsDownload(
                this.searchCriteria.from_date,
                this.searchCriteria.to_date,
                this.searchCriteria.courier,
                this.searchCriteria.client,
                this.searchCriteria.wild,
                this.searchCriteria.job
            );

            if (response.status === 200) {
                let filename = "jobs.csv";  // default filename
                const contentDisposition = response.headers()["content-disposition"];

                if (contentDisposition) {
                    const filenameMatch = contentDisposition.split(';')
                        .find((part: string) => part.trim().startsWith('filename='));
                    if (filenameMatch) {
                        filename = filenameMatch.split('=')[1].trim().replace(/"/g, '');
                    }
                }

                const blob = new Blob([response.data], {type: 'text/csv'});
                const url = window.URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = filename;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                window.URL.revokeObjectURL(url);
            } else {
                console.error("Error downloading jobs");
            }
        } catch (error) {
            console.error("Failed to download jobs:", error);
        } finally {
            this.applyScope();
        }
    }

    uploadJobList() {
        const element: any = angular.element("#jobListUpload");
        element.trigger('click');
    }

    async onUploadJobList() {
        const fileElement: any = angular.element("#jobListUpload");
        const files = fileElement[0].files;
        if (!files || files.length !== 1) {
            fileElement.val(null);
            return;
        }
        // Check right file extension
        const file = files[0];
        const index = file.name.lastIndexOf(".");
        if (index < 1 || !['.xls', '.xlsx', '.csv'].includes(file.name.substring(index, file.name.length).toLowerCase())) {
            fileElement.val(null);
            console.error("Please upload correct file type, file extension should be .xls, .xlsx or .csv");
            return;
        }

        try {
            await this.jobSearchService.uploadJobList(file);
            this.toastrService.showSuccessToast("Job list uploaded successfully.");
        } catch {
            this.toastrService.showErrorToast("Job list uploaded unsuccessfully.");
        } finally {
            fileElement.val(null);
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

    async selectedClientChange(item: ISuggestion) {
        if (!item) {
            this.searchCriteria.client = undefined;
            return;
        }

        this.searchCriteria.client = item.id;
        await this.refreshAllData();
    }

    courierQuerySearch(searchText: string) {
        return this.jobSearchService.getActiveCouriersSearch(searchText);
    }

    async selectedCourierChange(item: ISuggestion) {
        if (!item) {
            this.searchCriteria.courier = undefined;
            return;
        }

        this.searchCriteria.courier = item.id;
        await this.refreshAllData();
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

    async onRefreshButtonClicked(boxName: string) {
        switch (boxName) {
            case JobSearchBoxes.JobList:
                await this.refreshData();
                break;
            case JobSearchBoxes.BulkJobList:
                await this.refreshBulkData();
                break;
            case JobSearchBoxes.JobDetail:
                if (!this.currentJobId) return;

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
                this.searchCriteria.courier,
                this.searchCriteria.client,
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
                this.searchCriteria.courier,
                this.searchCriteria.client,
                this.searchCriteria.wild,
                this.searchCriteria.job,
            );
        } catch (error) {
            console.error('Error loading jobs:', error);
            throw error;
        }
    }

    async openSettingsDialog($event: MouseEvent): Promise<void> {
        if (!this.boxes) return;

        try {
            // Sync boxes with items
            this.syncVisibilityToBoxes();

            const result = await this.dashboardSettingsDialog.openSettingsDialog(
                $event,
                AppPage.JobSearch,
                this.currentLayoutName ?? 'Default',
                this.boxes
            );

            if (!result) return;

            // Update gridsterItems visibility based on boxes visibility
            this.syncVisibilityToGridsterItems();

            this.updateCurrentLayout();
            this.applyScope();
            this.toastrService.showSuccessToast('Settings saved and applied successfully');
        } catch (error) {
            if (!error) return;
            console.error('Error opening settings dialog:', error);
            this.toastrService.showErrorToast('Failed to open settings dialog');
        }
    }

    private syncVisibilityToGridsterItems(): void {
        if (!this.boxes) return;
        this.gridsterLayoutService.syncVisibilityToGridsterItems(this.gridsterItems, this.boxes);
    }

    private syncVisibilityToBoxes(): void {
        if (!this.boxes) return;
        this.gridsterLayoutService.syncVisibilityToBoxes(this.gridsterItems, this.boxes);
    }
}

const JobSearchComponent: angular.IComponentOptions = {
    template: require("./jobSearch.template.html"),
    controller: JobSearchController,
    controllerAs: "ctrl"
}

export default JobSearchComponent;
