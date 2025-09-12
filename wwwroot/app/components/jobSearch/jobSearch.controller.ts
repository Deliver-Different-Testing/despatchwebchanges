import "./jobSearch.styles.less";
import JobSearchService from "./jobSearch.service";
import DispatchExecutorService from "../../services/dispatch-executor.service";
import ToastrService from "../../services/toastr.service";
import DispatchCoreService from "../../services/dispatch-core.service";
import {IAppConfig} from "../../interfaces/app-config.interface";
import {IDispatchJob, ISuggestion} from "../../interfaces/job.interface";
import {Coordinates} from "../overview/overview.interfaces";
import BaseController from "../base-controller";
import {IBox, IColumn, ILayout} from "../../interfaces/layout.interfaces";
import {ContactID} from "../../contants";
import JobContextMenuService from "../../services/job-context-menu.service";
import {JobProperty} from "../../enums/job-property.enum";
import NavigationService from "../../services/navigation.service";
import greetUser from "../../functions/greetUser";
import {AppPages} from "../../enums/app-pages.enum";
import MessagingDialogService from "../dialogs/messaging-dialog/messaging-dialog.service";
import JobSearchBoxes from "./enums/jobSearchBoxes";
import {IDeliveryHistoryConfig} from "../common/task-history/task-history.interfaces";
import DensityMode from "../../enums/densityMode";
import ISearchCriteria from "./interfaces/ISearchCriteria";
import dayjs from "dayjs";
import JobListType from "../common/job-list/enums/jobListType";
import CreateJobDialogService from "../dialogs/create-job-dialog/create-job-dialog.service";
import AdditionalServicesDialogService from "../dialogs/additional-services-dialog/additional-services-dialog.service";
import JobFileUploadDialogService from "../dialogs/job-file-upload-dialog/job-file-upload-dialog.service";
import IScanDetailResult from "./interfaces/IScanDetailResult";

class JobSearchController extends BaseController {
    static $inject = [
        '$scope',
        '$log',
        'uCSData',
        '$mdDialog',
        '$document',
        '$timeout',
        '$interval',
        'dispatchJobService',
        'toastrService',
        'DispatchData',
        '$mdSidenav',
        'APP_CONFIG',
        'jobContextMenuService',
        "navigationService",
        "messagingDialogService",
        "createJobDialogService",
        "additionalServicesDialogService",
        "jobFileUploadDialogService",
    ];

    readonly isUsCustomer: boolean;
    readonly isAdmin: boolean;
    mapCenter: Coordinates;
    mapZoom: number;
    jobDetailFabIsOpen: boolean = false;
    dateSearchRange: number;
    searchBox: any;
    scanList: IScanDetailResult[];
    jobRecordSearchText: string;
    sort: any;
    searchCriteria: ISearchCriteria;
    clientSelectedItem: any;
    courierSelectedItem: any;
    clientSearchText: any;
    courierSearchText: any;
    showInput: any;
    inputWidth: any;
    followupClient: any;
    jobPromise: any;
    bulkJobPromise: any;
    scanPromise: any;
    options: any;
    boxes: any;

    jobListType = JobListType.JobSearchMainList;
    bulkJobListType = JobListType.JobSearchBulkList;

    layouts: ILayout[] = [];
    defaultLayout?: ILayout;
    currentLayoutName?: string;
    layout?: { columns: IColumn[] };

    timeZone: string = TimeZone;
    jobList?: IDispatchJob[];
    bulkJobList?: IDispatchJob[];
    pickRegions?: ISuggestion[];
    currentJob?: IDispatchJob;
    currentSelection?: string;
    currentJobId?: number;
    isBulkJob: boolean = false;

    boxSortableOptions: {
        handle: string;
        connectWith: string;
        placeholder: string;
        tolerance: string;
        cursor: string;
        opacity: number;
        scroll: boolean;
        revert: number;
        delay: number;
        forcePlaceholderSize: boolean;
        start: (e: JQueryEventObject, ui: any) => void;
        over: (e: JQueryEventObject, ui: any) => void;
        out: (e: JQueryEventObject, ui: any) => void;
        stop: (e: JQueryEventObject, ui: any) => void
    };
    deliveryHistoryConfig: IDeliveryHistoryConfig;
    isJobListLoading: boolean = false;
    isBulkJobListLoading: boolean = false;

    constructor(
        $scope: angular.IScope,
        private $log: angular.ILogService,
        private jobSearchService: JobSearchService,
        private $mdDialog: angular.material.IDialogService,
        private $document: angular.IDocumentService,
        $timeout: angular.ITimeoutService,
        $interval: angular.IIntervalService,
        private dispatchJobService: DispatchExecutorService,
        private toastrService: ToastrService,
        private DispatchData: DispatchCoreService,
        private $mdSidenav: angular.material.ISidenavService,
        appConfig: IAppConfig,
        private jobContextMenuService: JobContextMenuService,
        private navigationService: NavigationService,
        private messagingDialogService: MessagingDialogService,
        private createJobDialogService: CreateJobDialogService,
        private additionalServicesDialogService: AdditionalServicesDialogService,
        private jobFileUploadDialogService: JobFileUploadDialogService
    ) {
        super();

        this.initServices($timeout, $interval, $scope);

        this.isUsCustomer = appConfig.US_Customer;
        this.isAdmin = ClientInternal;

        // New map
        this.mapCenter = appConfig.US_Customer ?
            appConfig.US_Coordinates_Center :
            appConfig.NZ_Coordinates_Center;
        this.mapZoom = 12;

        this.jobDetailFabIsOpen = false;
        this.dateSearchRange = 1; // Set to a fortnight

        this.searchBox = "";
        this.scanList = [];

        this.jobRecordSearchText = "";
        this.sort = [];

        const now = dayjs();
        const sevenDaysBefore = now.subtract(7, 'day');
        const sevenDaysAfter = now.add(7, 'day');

        this.searchCriteria = {
            date: now.toDate(),
            from_date: sevenDaysBefore.toDate(),
            to_date: sevenDaysAfter.toDate(),
            followupClient: "All",
            includeClosed: true
        };
        this.clientSelectedItem = this.searchCriteria.client;
        this.courierSelectedItem = this.searchCriteria.client;
        this.clientSearchText = '';
        this.courierSearchText = '';

        this.showInput = {};
        this.inputWidth = {};

        this.followupClient = {
            name: "All"
        };

        this.jobPromise = null;
        this.bulkJobPromise = null;
        this.scanPromise = null;

        this.options = {
            "detail": {
                "size": [{
                    "id": 1, "label": "Bike"
                }, {
                    "id": 2, "label": "Car"
                }, {
                    "id": 3, "label": "Van"
                }, {
                    "id": 4, "label": "Truck"
                }, {
                    "id": 5, "label": "Scooter"
                }], "tracking": [{
                    "id": 1, "label": "Email"
                }, {
                    "id": 2, "label": "Mobile"
                }, {
                    "id": 3, "label": "Email & Mobile"
                }], "DGClass": [{
                    "id": 0, "label": "0"
                }, {
                    "id": 1, "label": "1"
                }, {
                    "id": 2, "label": "2"
                }, {
                    "id": 3, "label": "3"
                }, {
                    "id": 4, "label": "4"
                }, {
                    "id": 5, "label": "5"
                }, {
                    "id": 6, "label": "6"
                }, {
                    "id": 7, "label": "7"
                }, {
                    "id": 8, "label": "8"
                }, {
                    "id": 9, "label": "9"
                }]
            }
        };

        this.boxes = {
            [JobSearchBoxes.SearchWidget]: {
                "title": "Filters",
                "icon": "filter_list",
                "templateUrl": "app/components/jobSearch/partials/pickDate.html",
                "showRefresh": 0
            },
            [JobSearchBoxes.JobList]: {
                "title": "Live Job Data",
                "icon": "list_alt",
                "templateUrl": "app/components/jobSearch/partials/jobList.html",
                "showRefresh": 1
            },
            [JobSearchBoxes.BulkJobList]: {
                "title": "Bulk Job Data",
                "icon": "format_list_bulleted",
                "templateUrl": "app/components/jobSearch/partials/bulkJobList.html",
                "showRefresh": 1
            },
            [JobSearchBoxes.JobDetail]: {
                "title": "Detail",
                "icon": "assignment",
                "templateUrl": "app/components/jobSearch/partials/jobDetail.html",
                "showDetailButtons": 1,
                "showRefresh": 1
            },
            [JobSearchBoxes.ScanList]: {
                "title": "Scan Detail",
                "icon": "document_scanner",
                "templateUrl": "app/components/jobSearch/partials/scanList.html",
                "showRefresh": 0
            },
            [JobSearchBoxes.Map]: {
                "title": "Map",
                "icon": "pin_drop",
                "templateUrl": "app/components/jobSearch/partials/map.html",
                "showRefresh": 0
            },
            [JobSearchBoxes.DeliveryJourney]: {
                "title": "Delivery Journey",
                "icon": "rocket_launch",
                "templateUrl": "app/components/jobSearch/partials/jobHistory.html",
                "showRefresh": 0
            }
        };

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

            // When the drag operation stops
            stop: (_: JQueryEventObject, ui: any) => {
                angular.element(this.$document[0]).off('mousemove.sortable');
                angular.element('#draggingItems').css('display', 'none');
                ui.item.removeClass('dragging');
                angular.element('.column-sortable').removeClass('ui-sortable-active');

                this.updateBoxMetrics();
                this.saveCurrentLayout()
            }
        };


        this.deliveryHistoryConfig = {
            showSummaryStats: true,
            densityMode: DensityMode.Normal
        }

        // Default to a fortnight
        this.onSearchRangeChange(this.dateSearchRange);
    }

    $onInit() {
        this.initLayoutSystem(ContactID);
    }

    private updateBoxMetrics() {
        if (!this.layout || !this.layout.columns) return;

        this.layout.columns.forEach((column: IColumn) => {
            // Get column width from DOM
            const columnEl = angular.element(`#co-${column.id}`);
            if (columnEl.length) {
                column.width = columnEl.css('flex-basis');

                // Update heights for all boxes in this column
                column.boxes.forEach((box: IBox) => {
                    const boxEl = angular.element(`#box-${box.name}`);
                    if (boxEl.length) {
                        box.height = boxEl.css('flex-basis');
                    }
                });
            }
        });
    }

    private saveCurrentLayout() {
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
                localStorage.setItem(`layouts-${ContactID}`, JSON.stringify(this.layouts));
            }
        }
    }

    // Layouts
    initLayoutSystem(ContactID: number) {
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
                        boxes: [{name: JobSearchBoxes.JobList, height: "50%"}, {
                            name: JobSearchBoxes.BulkJobList,
                            height: "50%"
                        }],
                    },
                    {
                        id: "col3",
                        width: "35%",
                        boxes: [{name: JobSearchBoxes.JobDetail, height: "40%"}, {
                            name: JobSearchBoxes.ScanList,
                            height: "30%"
                        }, {
                            name: JobSearchBoxes.Map,
                            height: "30%"
                        }],
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
                const storedLayouts: ILayout[] = JSON.parse(localStorage.getItem(`layoutsCS-${ContactID}`) || '[]');
                const lastActiveLayout = localStorage.getItem(`lastActiveLayoutCS-${ContactID}`);

                this.layouts = storedLayouts || [this.defaultLayout];
                this.layouts[0] = this.defaultLayout; // Ensure default is always up to date

                // Load last active layout or default
                const layoutToLoad = lastActiveLayout ? this.layouts.findIndex((l: ILayout) => l.name === lastActiveLayout) : 0;
                this.loadLayout(layoutToLoad >= 0 ? layoutToLoad : 0);
            } catch (error: any) {
                this.layouts = [this.defaultLayout];
                this.loadLayout(0);
            }
        } else {
            this.layouts = [this.defaultLayout];
            this.loadLayout(0);
        }

        // Auto-save changes
        this.watchScope("layout", (newValue: { columns: IColumn[] }, oldValue: { columns: IColumn[] }) => {
            if (newValue !== oldValue && this.currentLayoutName) {
                const index = this.layouts.findIndex((l: ILayout) => l.name === this.currentLayoutName);
                if (index !== -1) {
                    this.layouts[index].layout = angular.copy(newValue);
                    if (Modernizr.localstorage) {
                        localStorage.setItem(`layoutsCS-${ContactID}`, JSON.stringify(this.layouts));
                    }
                }
            }
        }, true);
    }

    loadLayout(index: number) {
        const layout: ILayout = this.layouts[index] || this.layouts[0];
        this.currentLayoutName = layout.name;
        this.layout = angular.copy(layout.layout);

        // Apply dimensions on next digest cycle
        this.registerTimeout(() => {
            this.applyLayoutDimensions();

            if (Modernizr.localstorage) {
                localStorage.setItem(`lastActiveLayoutCS-${ContactID}`, layout.name);
            }
        });
    }

    private applyLayoutDimensions() {
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

    saveLayout() {
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

                this.layouts.push(currentLayout);

                if (Modernizr.localstorage) {
                    localStorage.setItem(`layoutsCS-${ContactID}`, JSON.stringify(this.layouts));
                    localStorage.setItem(`lastActiveLayoutCS-${ContactID}`, name);
                }
            });
    }

    deleteLayout(index: number) {
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
                    localStorage.setItem(`layoutsCS-${ContactID}`, JSON.stringify(this.layouts));
                }
                this.loadLayout(0);
                this.toastrService.showSuccessToast("Layout deleted successfully");
            });
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
                console.warn('Sidenav not available:', error);
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
                await this.dispatchJobService.dispatchJob(courierNumber, job);
                await this.selectJob(job);
                this.toastrService.showSuccessToast('Job dispatched to courier ' + courierNumber);
            }
            // If courierNumber is falsy, it means the user clicked cancel, so we do nothing
        } catch (error) {
            this.$log.error('Error in selectAndDispatchJob:', error);
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
            this.$log.debug('Dialog closed!');
        } catch (error) {
            this.$log.error('Error in createNewJob:', error);
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
            this.$log.error('Error in showAdditionalServicesMenu:', error);
        }
    }

    async openFileAttachmentDialog($event: MouseEvent, job: IDispatchJob) {
        try {
            await this.jobFileUploadDialogService.openJobFileUploadDialog($event, job);
            this.$log.debug('Job File Upload Dialog Closed!');
        } catch (error) {
            if (error === undefined) {
                this.$log.debug('User canceled!');
            } else {
                this.$log.error('Error in openFileAttachmentDialog:', error);
            }
        }
    }

    async interCourierCharge($event: MouseEvent) {
        try {
            await this.$mdDialog.show({
                controller: 'InterCourierChargeDialog',
                controllerAs: 'ctrl',
                parent: this.$document.parent(),
                targetEvent: $event,
                templateUrl: "app/components/dialogs/inter-courier-charge-dialog/inter-courier-charge-dialog.html",
                clickOutsideToClose: false,
                fullscreen: true,
                locals: {
                    staffId: ContactID,
                },
                bindToController: true
            });

            this.$log.debug("Inter-courier Charge Added!");
        } catch (error) {
            this.$log.debug("Inter-courier Charge Canceled!");
        }
    }

    openSearch(boxName: string, index: number) {
        const boxID = boxName + '-' + index;
        if (this.showInput[boxID]) {
            this.showInput[boxID] = false;
            this.inputWidth[boxID] = 31;
        } else {
            this.inputWidth[boxID] = 200;
            this.showInput[boxID] = true;
        }
    }

    async filterRegion(region: ISuggestion) {
        if (!this.pickRegions) return;

        try {
            const sr = this.pickRegions.find(obj => obj.id === region.id);
            if (!sr) return;
            this.searchCriteria.regions = [sr];

            await Promise.all([this.refreshData(), this.refreshBulkData()]);
        } catch (error) {
            this.$log.debug('Error in filterRegion:', error);
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
            this.$log.debug('Un-split job cancelled or error occurred:', error);
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
            this.$log.error('Error in restoreJob:', error);
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

        this.$log.error("Error in _handleError:", error);
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
            this.jobList = await this.jobSearchService.getPodJobs(
                this.searchCriteria.from_date,
                this.searchCriteria.to_date,
                this.searchCriteria.courier,
                this.searchCriteria.client,
                this.searchCriteria.wild,
                this.searchCriteria.job,
            );
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
            this.bulkJobList = await this.jobSearchService.searchBulkJobs(
                this.searchCriteria.from_date,
                this.searchCriteria.to_date,
                this.searchCriteria.courier,
                this.searchCriteria.client,
                this.searchCriteria.job,
                this.searchCriteria.wild,
            );
        } catch (error) {
            this.$log.error('Error in refreshBulkData:', error);
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
                this.$log.error("Error downloading jobs");
            }
        } catch (error) {
            this.$log.error("Failed to download jobs:", error);
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
            this.$log.error("Please upload correct file type, file extension should be .xls, .xlsx or .csv");
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
            this.$log.debug("select Job  " + jobId);

            this.isBulkJob = false;
            this.currentJob = await this.DispatchData.getDispatchJobDetail(jobId);
            this.currentJobId = jobId;
            this.currentSelection = " for Job " + this.currentJob?.jobNo;

            // Update the map with just this job
            if (!this.currentJob) {
                this.$log.debug("Job not found");
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
            this.$log.error('Error in selectJobDetail:', error);
        } finally {
            this.applyScope();
        }
    }

    async selectBulkJobDetail(bulkJobId: number) {
        try {
            this.$log.debug("select Job  " + bulkJobId);

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
            this.$log.error('Error in selectJobDetail:', error);
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

    onSearchRangeChange(dateRangeOption: number) {
        try {
            const now = dayjs().startOf('day');
            const firstDayOfMonth = now.startOf('month');
            const lastDayOfMonth = now.endOf('month').startOf('day');
            const oneWeekAgo = now.subtract(7, 'day');
            const oneWeekAhead = now.add(7, 'day');

            switch (dateRangeOption) {
                case 1:
                    this.searchCriteria.from_date = oneWeekAgo.toDate();
                    this.searchCriteria.to_date = oneWeekAhead.toDate();
                    break;
                case 2:
                    this.searchCriteria.from_date = now.toDate();
                    this.searchCriteria.to_date = now.toDate();
                    break;
                case 3:
                    this.searchCriteria.from_date = firstDayOfMonth.toDate();
                    this.searchCriteria.to_date = lastDayOfMonth.toDate();
                    break;
                case 4:
                    // This option is empty as ng-if is used on the page to show custom date range options
                    break;
            }
        } catch (error) {
            this.$log.debug("Error: ", error);
        }
    }

    getContextMenuOptions(job: IDispatchJob) {
        if (!job) return [];

        const callbacks = {
            onRefresh: () => this.refreshAllData()
        };

        return this.jobContextMenuService.getMenuOptions(job, callbacks, AppPages.JobSearch);
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
}

const JobSearchComponent: angular.IComponentOptions = {
    template: require("./jobSearch.template.html"),
    controller: JobSearchController,
    controllerAs: "ctrl"
}

export default JobSearchComponent;
