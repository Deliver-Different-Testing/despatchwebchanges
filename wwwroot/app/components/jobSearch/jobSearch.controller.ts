import JobSearchService from "./jobSearch.service";
import DispatchExecutorService from "../../services/dispatch-executor.service";
import ToastrService from "../../services/toastr.service";
import DispatchCoreService from "../../services/dispatch-core.service";
import {AppConfig} from "../../interfaces/app-config.interface";
import {BulkScanDetail, IDispatchJob, IJob, Suggestion} from "../../interfaces/job.interface";
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

class JobSearchController extends BaseController {
    static $inject = [
        '$scope',
        'uCSData',
        '$state',
        '$filter',
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
    ];

    readonly isUsCustomer: boolean;
    readonly isAdmin: boolean;
    mapCenter: Coordinates;
    mapZoom: number;
    jobs: IDispatchJob[];
    jobDetailFabIsOpen: boolean = false;
    dateSearchRange: number;
    searchBox: any;
    selectedEvents: any;
    maxSize: number;
    totalCount: number;
    pageIndex: number;
    pageSizeSelected: any;
    bulkTotalCount: number;
    bulkPageIndex: number;
    bulkPageSizeSelected: any;
    scanList: BulkScanDetail[];
    jobRecordSearchText: string;
    sort: any;
    pickDateService: any;
    clientSelectedItem: any;
    courierSelectedItem: any;
    clientSearchText: any;
    courierSearchText: any;
    showInput: any;
    inputWidth: any;
    followupClient: any;
    jobQuery: any;
    bulkJobQuery: any;
    jobPromise: any;
    bulkJobPromise: any;
    scanPromise: any;
    options: any;
    boxes: any;

    layouts: ILayout[] = [];
    defaultLayout?: ILayout;
    currentLayoutName?: string;
    layout?: { columns: IColumn[] };

    timeZone: string = TimeZone;
    userName: any;
    selectJob: any;
    jobList?: IJob[];
    pickRegions?: Suggestion[];
    currentJob?: IJob;
    jobListLoading: any;
    bulkJobList: any;
    cancelledSelected: any;
    currentSelection?: string;
    currentJobId?: number;
    selected: any;
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
        private $scope: angular.IScope,
        private uCSData: JobSearchService,
        private $state: angular.ui.IStateService,
        private $filter: angular.IFilterService,
        private $mdDialog: angular.material.IDialogService,
        private $document: angular.IDocumentService,
        $timeout: angular.ITimeoutService,
        $interval: angular.IIntervalService,
        private dispatchJobService: DispatchExecutorService,
        private toastrService: ToastrService,
        private DispatchData: DispatchCoreService,
        private $mdSidenav: angular.material.ISidenavService,
        appConfig: AppConfig,
        private jobContextMenuService: JobContextMenuService,
        private navigationService: NavigationService,
        private messagingDialogService: MessagingDialogService,
    ) {
        super();

        this.initServices($timeout, $interval, this.$scope);

        this.isUsCustomer = appConfig.US_Customer;
        this.isAdmin = ClientInternal;

        // New map
        this.mapCenter = appConfig.US_Customer ?
            appConfig.US_Coordinates_Center :
            appConfig.NZ_Coordinates_Center;
        this.mapZoom = 12;
        this.jobs = [];

        this.jobDetailFabIsOpen = false;
        this.dateSearchRange = 1; // Set to a fortnight

        this.searchBox = "";
        this.selectedEvents = [];
        this.maxSize = 5;
        this.totalCount = 0;
        this.pageIndex = 1;
        this.pageSizeSelected = 50;
        this.bulkTotalCount = 0;
        this.bulkPageIndex = 1;
        this.bulkPageSizeSelected = 50;
        this.scanList = [];

        this.jobRecordSearchText = "";
        this.sort = [];

        const now = new Date();
        let sevenDaysBefore = new Date();
        sevenDaysBefore.setDate(now.getDate() - 7);
        let sevenDaysAfter = new Date();
        sevenDaysAfter.setDate(now.getDate() + 7);

        this.pickDateService = {
            "client": '',
            "courier": "",
            "date": now,
            "from_date": sevenDaysBefore,
            "to_date": sevenDaysAfter,
            "followupClient": "All",
            "includeClosed": true
        };
        this.clientSelectedItem = this.pickDateService.client;
        this.courierSelectedItem = this.pickDateService.client;
        this.clientSearchText = '';
        this.courierSearchText = '';

        this.showInput = {};
        this.inputWidth = {};

        this.followupClient = {
            name: "All"
        };

        this.jobQuery = {
            order: 'booked', limit: 50, page: 1
        };

        this.bulkJobQuery = {
            order: 'booked', limit: 50, page: 1
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
                "showSearch": 0
            },
            [JobSearchBoxes.JobList]: {
                "title": "Live Job Data",
                "icon": "list_alt",
                "templateUrl": "app/components/jobSearch/partials/jobList.html",
                "showSearch": 1,
            },
            [JobSearchBoxes.BulkJobList]: {
                "title": "Bulk Job Data",
                "icon": "format_list_bulleted",
                "templateUrl": "app/components/jobSearch/partials/bulkJobList.html",
                "showSearch": 1,
            },
            [JobSearchBoxes.JobDetail]: {
                "title": "Detail",
                "icon": "assignment",
                "templateUrl": "app/components/jobSearch/partials/jobDetail.html",
                "showSearch": 0,
                "showDetailButtons": 1
            },
            [JobSearchBoxes.ScanList]: {
                "title": "Scan Detail",
                "icon": "document_scanner",
                "templateUrl": "app/components/jobSearch/partials/scanList.html",
                "showSearch": 0,
            },
            [JobSearchBoxes.Map]: {
                "title": "Map",
                "icon": "pin_drop",
                "templateUrl": "app/components/jobSearch/partials/map.html",
                "showSearch": 0
            },
            [JobSearchBoxes.JobHistory]: {
                "title": "Job History",
                "icon": "history",
                "templateUrl": "app/components/jobSearch/partials/jobHistory.html",
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

            // When drag operation stops
            stop: (_: JQueryEventObject, ui: any) => {
                angular.element(this.$document[0]).off('mousemove.sortable');
                angular.element('#draggingItems').css('display', 'none');
                ui.item.removeClass('dragging');
                angular.element('.column-sortable').removeClass('ui-sortable-active');

                this._updateBoxMetrics();
                this._saveCurrentLayout()
            }
        };
        

        this.deliveryHistoryConfig = {
            showSummaryStats: true,
            densityMode: DensityMode.Dense
        }
        
        // Default to a fortnight
        this.onSearchRangeChange(this.dateSearchRange);
    }

    $onInit() {
        this.initLayoutSystem(ContactID);
    }

    private _updateBoxMetrics() {
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

    private _saveCurrentLayout() {
        if (!this.currentLayoutName || this.currentLayoutName === 'Default') {
            return;
        }

        this._updateBoxMetrics();

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
                        boxes: [{name: JobSearchBoxes.JobList, height: "50%"}, {name: JobSearchBoxes.BulkJobList, height: "50%"}],
                    },
                    {
                        id: "col3",
                        width: "35%",
                        boxes: [{name: JobSearchBoxes.JobDetail, height: "40%"}, {name: JobSearchBoxes.ScanList, height: "30%"}, {
                            name: JobSearchBoxes.Map,
                            height: "30%"
                        }],
                    },
                    {
                        id: "col4",
                        width: "20%",
                        boxes: [{name: JobSearchBoxes.JobHistory, height: "100%"}],
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
                this.layouts[0] = this.defaultLayout; // Ensure default is always up-to-date

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
        this.$scope.$watch("layout", (newValue: { columns: IColumn[] }, oldValue: { columns: IColumn[] }) => {
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
            this._applyLayoutDimensions();

            if (Modernizr.localstorage) {
                localStorage.setItem(`lastActiveLayoutCS-${ContactID}`, layout.name);
            }
        });
    }

    private _applyLayoutDimensions() {
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
            console.error('Error in selectAndDispatchJob:', error);
        }
    }

    async createNewJob($event: MouseEvent) {
        try {
            // Dialog
            const newJobId = await this.$mdDialog.show({
                controller: 'CreateJobDialogController',
                controllerAs: 'ctrl',
                parent: this.$document.parent(),
                targetEvent: $event,
                templateUrl: "app/components/dialogs/create-job-dialog/create-job-dialog.html",
                clickOutsideToClose: false,
                fullscreen: true,
                locals: {
                    staffId: ContactID, despatcherName: FirstName
                },
                bindToController: true
            });

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

            // Show additional services dialog
            await this.$mdDialog.show({
                controller: 'AdditionalServicesDialogController',
                controllerAs: "ctrl",
                templateUrl: "app/components/dialogs/additional-services-dialog/additional-services-dialog.html",
                parent: this.$document.parent(),
                targetEvent: $event,
                clickOutsideToClose: false,
                fullscreen: true,
                locals: {
                    job
                },
                bindToController: true
            });
        } catch (error) {
            console.error('Error in showAdditionalServicesMenu:', error);
        }
    }

    async openFileAttachmentDialog($event: MouseEvent, job: IDispatchJob) {
        try {
            await this.$mdDialog.show({
                controller: 'JobFileUploadController',
                controllerAs: 'ctrl',
                parent: this.$document.parent(),
                targetEvent: $event,
                templateUrl: "app/components/dialogs/job-file-upload-dialog/job-file-upload-dialog.html",
                clickOutsideToClose: false,
                fullscreen: true,
                locals: {
                    jobId: job.id
                },
                bindToController: true
            });

            console.log('Job File Upload Dialog Closed!');
        } catch (error) {
            if (error === undefined) {
                console.log('User canceled!');
            } else {
                throw error;
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

            console.log("Inter-courier Charge Added!");
        } catch (error) {
            console.log("Inter-courier Charge Canceled!");
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

    goToRunViewer() {
        console.log("goToRunViewer.");
        this.$state.go('home');
    }

    //Column Sorting
    orderList(list: string | number, prop: string): void {
        if (this.sort[list] !== prop) {
            this.sort[list] = prop;
            // @ts-ignore
            this.$scope[list] = this.$filter('orderBy')(this.$scope[list], prop);
        } else {
            this.sort[list] = "d-" + prop;
            // @ts-ignore
            this.$scope[list] = this.$filter('orderBy')(this.$scope[list], "-" + prop);
        }
    }

    jobRecordSearch(searchText: string) {
        if (!this.jobList) return [];

        return this.jobList
            .filter(job => job.jobNo.toLowerCase().includes(searchText.toLowerCase()))
            .map(job => ({id: job.id, text: job.jobNo}));
    }

    JobRecordSelected(selectedJobId: number) {
        if (!this.jobList) return [];

        const selectedJob = this.jobList.find(job => job.id === selectedJobId);
        return this.selectJob(selectedJob);
    }

    async filterRegion(region: Suggestion) {
        if (!this.pickRegions) return;

        try {
            const sr = this.pickRegions.find(obj => obj.id === region.id);
            this.pickDateService.regions = [sr];

            await Promise.all([this.refreshData(), this.refreshBulkData()]);
        } catch (error) {
            console.log('Error in filterRegion:', error);
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
            const msg = await this.uCSData.unSplitJob(this.currentJob.id);

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
            const secondJobId = await this.uCSData.validateSwapPOD(jobNumber);

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

            await this.uCSData.swapPOD(this.currentJob.jobNo, jobNumber);

            await this.$mdDialog.show(this.$mdDialog.alert()
                .clickOutsideToClose(true)
                .title('Successful')
                .textContent('POD Swap Completed Successfully')
                .ok('OK'));

            await this.uCSData.reSendJobs([secondJobId]);
            await this.uCSData.reAssignJobs([firstJobId]);
            await this.uCSData.reSendJobs([firstJobId]);
            await this.refreshData();

        } catch (error) {
            this._handleError(error);
        }
    }

    private _handleError(error: any) {
        if (!error) return;

        console.error("Error in _handleError:", error);
    }

    async sendPOD($event: MouseEvent) {
        if (!this.currentJob) return;

        try {
            if (!this.currentJob.podPhoto) {
                await this.$mdDialog.show(this.$mdDialog.alert()
                    .clickOutsideToClose(true)
                    .title('No Photo')
                    .textContent('Sorry no photo for this job.')
                    .ok('OK'));
                console.log("Alert closed.");
                return;
            }

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

            await this.uCSData.sendPOD(this.currentJob.id, email);

            await this.$mdDialog.show(this.$mdDialog.alert()
                .clickOutsideToClose(true)
                .title('Email Sent')
                .textContent('POD email has been sent')
                .ok('OK'));

        } catch (error) {
            this._handleError(error);
        }
    }

    async refreshAllData() {
        await Promise.all([this.refreshData(), this.refreshBulkData()]);
    }

    async refreshData() {
        try {
            this.isJobListLoading = true;
            
            this.jobListLoading = this.uCSData.getPodJobs(
                this.pickDateService.courier,
                this.pickDateService.client,
                (this.pickDateService.wild || ""),
                (this.pickDateService.job || ""),
                this.pickDateService.from_date,
                this.pickDateService.to_date,
                this.jobQuery.page,
                this.jobQuery.limit
            );

            const data = await this.jobListLoading;
            this.jobList = data.item2;
            this.totalCount = data.item1;
        } catch (error) {
            this._handleError(error);
        } finally {
            this.isJobListLoading = false;
        }
    }

    async refreshBulkData() {
        try {
            this.isBulkJobListLoading = true;
            
            this.bulkJobPromise = this.uCSData.searchBulkJobs(this.pickDateService.courier, this.pickDateService.client, (this.pickDateService.job || ""), (this.pickDateService.wild || ""),
                this.pickDateService.from_date, this.pickDateService.to_date, this.bulkJobQuery.page, this.bulkJobQuery.limit);

            const data = await this.bulkJobPromise;
            this.bulkJobList = data.item2;
            this.bulkTotalCount = data.item1;
        } catch (error) {
            console.error('Error in refreshBulkData:', error);
        } finally {
            this.isBulkJobListLoading = false;
        }
    }

    async downloadJobList() {
        try {
            const response: any = await this.uCSData.podJobsDownload(
                this.pickDateService.courier,
                this.pickDateService.client,
                (this.pickDateService.wild || ""),
                (this.pickDateService.job || ""),
                this.pickDateService.from_date,
                this.pickDateService.to_date
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
            await this.uCSData.uploadJobList(file);
            this.toastrService.showSuccessToast("Job list uploaded successfully.");
        } catch {
            this.toastrService.showErrorToast("Job list uploaded unsuccessfully.");
        } finally {
            fileElement.val(null);
        }
    }

    showItems(job: IDispatchJob) {
        if (job.client !== "Other") {
            if (this.cancelledSelected) {
                return true;
            } else {
                return job.status !== "Cancelled";
            }
        } else {
            return false;
        }
    }

    async loadRelatedJobDetail(jobId: number, jobNumber: string) {
        try {
            this.currentJob = await this.DispatchData.getJobDetail(jobId);
            this.currentSelection = " for Job " + jobNumber;

            // Ensure the view is updated

        } catch (error) {
            console.error('Error loading job detail:', error);
        }
    }

    async selectJobDetail(jobId: number) {
        try {
            console.log("select Job  " + jobId);

            this.currentJob = await this.DispatchData.getJobDetail(jobId);
            this.currentJobId = jobId;
            this.currentSelection = " for Job " + this.currentJob?.jobNo;

            // Update map with just this job
            if (this.currentJob.pickupAddress?.latitude && this.currentJob.pickupAddress?.longitude) {
                this.mapCenter = {
                    lat: this.currentJob.pickupAddress.latitude,
                    lng: this.currentJob.pickupAddress.longitude
                };
                this.jobs = [this.currentJob as any];
            }

            if (!this.currentJob?.bookedDate) return;
            this.scanPromise = this.uCSData.getScanDetail(this.currentJob.bookedDate, this.currentJob.jobNo);
            this.scanList = await this.scanPromise;
        } catch (error) {
            console.error('Error in selectJobDetail:', error);
        }
    }

    async selectBulkJobDetail(bulkJobId: number) {
        try {
            console.log("select Bulk Job  " + bulkJobId);

            this.currentJob = await this.uCSData.getBulkJobDetail(bulkJobId);
            this.currentSelection = " for Bulk Job " + this.currentJob.jobNo;

            // Update map with just this job
            if (this.currentJob.pickupAddress?.latitude && this.currentJob.pickupAddress?.longitude) {
                this.mapCenter = {
                    lat: this.currentJob.pickupAddress.latitude,
                    lng: this.currentJob.pickupAddress.longitude
                };
                this.jobs = [this.currentJob as any];
            }

            if (!this.currentJob?.bookedDate) return;
            this.scanPromise = this.uCSData.getScanDetail(this.currentJob.bookedDate, this.currentJob.jobNo);
            this.scanList = await this.scanPromise;
        } catch (error) {
            console.error('Error in selectBulkJobDetail:', error);
        }
    }

    async jobPageChanged(page: number, limit: number): Promise<void> {
        this.jobQuery.page = page;
        this.jobQuery.limit = limit;
        await this.refreshData();
    }

    async bulkJobPageChanged(page: number, limit: number) {
        this.bulkJobQuery.page = page;
        this.bulkJobQuery.limit = limit;
        await this.refreshBulkData();
    }

    async changeBulkPageSize(index: number) {
        this.bulkPageIndex = index;
        this.bulkPageSizeSelected = index;
        await this.refreshBulkData();
    }

    async bulkPageChanged(index: number) {
        this.bulkPageIndex = index;
        await this.refreshBulkData();
    }

    async changePageSize(index: number) {
        this.pageIndex = index;
        this.pageSizeSelected = index;
        await this.refreshData();
    }

    clientQuerySearch(searchText: string) {
        return this.uCSData.getActiveClients(searchText);
    }

    async selectedClientChange(item: Suggestion) {
        if (!item) {
            this.pickDateService.client = null;
            return;
        }

        this.pickDateService.client = item.id;
        await this.refreshAllData();
    }

    courierQuerySearch(searchText: string) {
        return this.uCSData.getActiveCouriersSearch(searchText);
    }

    async selectedCourierChange(item: Suggestion) {
        if (!item) {
            this.pickDateService.courier = null;
            return;
        }

        this.pickDateService.courier = item.id;
        await this.refreshAllData();
    }

    highlightEvent() {
        this.registerTimeout(() => {
            this.selectedEvents = this.selected || [];
        }, 10);
    }

    onSearchRangeChange(dateRangeOption: number) {
        try {
            let now = new Date();
            now.setHours(0, 0, 0, 0);

            let firstDayOfMonth = new Date();
            firstDayOfMonth.setDate(1);
            firstDayOfMonth.setHours(0, 0, 0, 0);

            let lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            lastDayOfMonth.setHours(0, 0, 0, 0);

            let oneWeekAgo = new Date();
            oneWeekAgo.setDate(now.getDate() - 7);
            oneWeekAgo.setHours(0, 0, 0, 0);

            let oneWeekAhead = new Date();
            oneWeekAhead.setDate(now.getDate() + 7);
            oneWeekAhead.setHours(0, 0, 0, 0);

            switch (dateRangeOption) {
                case 1:
                    this.pickDateService.from_date = oneWeekAgo;
                    this.pickDateService.to_date = oneWeekAhead;
                    break;
                case 2:
                    this.pickDateService.from_date = now;
                    this.pickDateService.to_date = now;
                    break;
                case 3:
                    this.pickDateService.from_date = firstDayOfMonth;
                    this.pickDateService.to_date = lastDayOfMonth;
                    break;
                case 4:
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

        return this.jobContextMenuService.getMenuOptions(job, callbacks, AppPages.JobSearch);
    }

    async openHubUrl() {
        await this.navigationService.openHubUrl();
    }
    
    async openMessagingDialog($event: MouseEvent) {
        await this.messagingDialogService.openMessagingDialog($event);
    }
}

const JobSearchComponent: angular.IComponentOptions = {
    template: require("./jobSearch.template.html"),
    controller: JobSearchController,
    controllerAs: "ctrl"
}

export default JobSearchComponent;
