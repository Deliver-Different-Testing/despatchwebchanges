import GreetingService from "../../services/greeting.service";
import {AppConfig} from "../../interfaces/app-config.interface";
import {IJob} from "../../interfaces/job.interface";
import {IBox, IColumn, ILayout} from "../../interfaces/layout.interfaces";
import BaseController from "../base-controller";
import {ClientInternal, ContactID} from "../../contants";
import RecurringJobsService from "./recurringJobs.service";

class RecurringJobsController extends BaseController {
    static $inject = [
        '$document',
        'greetingService',
        '$mdDialog',
        '$scope',
        '$state',
        '$filter',
        '$timeout',
        '$mdSidenav',
        'uPBData',
        'APP_CONFIG'
    ];

    readonly options = {
        detail: {
            size: [
                {id: 1, label: "Bike"},
                {id: 2, label: "Car"},
                {id: 3, label: "Van"},
                {id: 4, label: "Truck"},
                {id: 5, label: "Scooter"}
            ],
            tracking: [
                {id: 1, label: "Email"},
                {id: 2, label: "Mobile"},
                {id: 3, label: "Email & Mobile"}
            ],
            DGClass: [
                {id: 0, label: "0"},
                {id: 1, label: "1"},
                {id: 2, label: "2"},
                {id: 3, label: "3"},
                {id: 4, label: "4"},
                {id: 5, label: "5"},
                {id: 6, label: "6"},
                {id: 7, label: "7"},
                {id: 8, label: "8"},
                {id: 9, label: "9"}
            ]
        }
    };

    readonly boxes = {
        jobList: {
            title: "Recurring Jobs List",
            icon: "list_alt",
            templateUrl: "app/components/recurringJobs/partials/jobList.html",
            showSearch: 1,
            showRefresh: 1,
        },
        jobDetail: {
            title: "Detail",
            icon: "assignment",
            templateUrl: "app/components/recurringJobs/partials/jobDetail.html",
            showSearch: 0,
            showDetailButtons: 1
        },
    };

    readonly isUsCustomer: boolean;

    currentJobId?: number;
    jobs: IJob[] = [];
    isAdmin: boolean = false;
    jobQuery: { order: string; limit: number; page: number } = {
        order: "booked",
        limit: 50,
        page: 1
    };
    searchBox: string = "";
    totalCount: number = 0;
    jobList: IJob[] = [];
    filteredData: IJob[] = [];
    pagedData: IJob[] = [];
    searchText: string = "";
    promise: angular.IPromise<any> | null = null;
    currentJob?: IJob;
    currentSelection?: string;
    showInput: Record<string, boolean> = {};
    jobRecordSearchText: string = "";
    selectedJobRecord: any;
    cancelledSelected?: boolean;
    layouts: ILayout[] = [];
    layout?: { columns: IColumn[] };
    sort: Record<string, string> = {};
    currentLayoutName?: string;
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

    constructor(
        private $document: angular.IDocumentService,
        private greetingService: GreetingService,
        private $mdDialog: angular.material.IDialogService,
        private $scope: angular.IScope,
        private $state: angular.ui.IStateService,
        private $filter: angular.IFilterService,
        private $timeout: angular.ITimeoutService,
        private $mdSidenav: angular.material.ISidenavService,
        private uPBData: RecurringJobsService,
        APP_CONFIG: AppConfig,
    ) {
        super();

        this.isUsCustomer = APP_CONFIG.US_Customer;
        this.isAdmin = ClientInternal;
        // Initialize layouts
        this._initializeLayout();

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
                        top: event.pageY + 20 + 'px',
                        left: event.pageX + 10 + 'px'
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

                // Update box metrics and save layout
                this.$timeout(() => {
                    this._updateBoxMetrics();
                    this._saveCurrentLayout();
                }, 100);
            }
        }
    }

    $onInit(): void {
        // Setup watchers
        this.$scope.$watchGroup(["searchText", "jobQuery.order"], () => {
            this.jobQuery.page = 1; // Reset to first page
            this.updateTable();
        });

        // Initial data load
        this.refreshData().then(() => console.log("Data Refreshed"));
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

    private _initializeLayout(): void {
        this.layouts = [{
            name: "Default",
            layout: {
                columns: [
                    {
                        id: "col1",
                        width: "65%",
                        boxes: [{
                            name: "jobList"
                        }]
                    },
                    {
                        id: "col2",
                        width: "35%",
                        boxes: [{
                            name: "jobDetail",
                        }]
                    }
                ]
            }
        }];

        this.layout = angular.copy(this.layouts[0].layout);
    }

    greetUser(): string {
        return this.greetingService.greetUser(FirstName);
    }

    toggleSidenav(): void {
        this.$mdSidenav("right").toggle();
    }

    updateTable(): void {
        // Apply search filter
        let orderedData = this.$filter("filter")(this.jobList, this.searchText) as IJob[];

        // Apply sorting
        orderedData = this.$filter("orderBy")(orderedData, this.jobQuery.order) as IJob[];

        this.filteredData = orderedData;

        // Apply pagination
        const start = (this.jobQuery.page - 1) * this.jobQuery.limit;
        this.pagedData = orderedData.slice(start, start + this.jobQuery.limit);
    }

    onPaginate(page: number, limit: number): void {
        this.jobQuery.page = page;
        this.jobQuery.limit = limit;
        this.updateTable();
    }

    openSearch(boxName: string, index: number): void {
        const boxID = boxName + "-" + index;
        this.showInput[boxID] = !this.showInput[boxID];

        if (!this.showInput[boxID]) {
            this.jobRecordSearchText = "";
            this.selectedJobRecord = null;
        }
    }

    jobRecordSearch(searchText: string): { text: string; id: number }[] {
        if (!searchText) {
            return [];
        }

        searchText = searchText.toLowerCase();

        return this.jobList
            .filter(job => job.jobNo.toLowerCase().includes(searchText))
            .map(job => ({
                text: job.jobNo,
                id: job.id
            }));
    }

    JobRecordSelected(selectedJobId: number): Promise<void> {
        return this.selectJobDetail(selectedJobId);
    }

    loadLayout(index: number): void {
        this.layout = angular.copy(this.layouts[index].layout);
    }

    goToRunViewer(): void {
        console.log("goToRunViewer.");
        this.$state.go("home");
    }

    orderList(list: string, prop: string): void {
        if (this.sort[list] !== prop) {
            this.sort[list] = prop;
            (this as any)[list] = this.$filter("orderBy")((this as any)[list], prop);
        } else {
            this.sort[list] = `d-${prop}`;
            (this as any)[list] = this.$filter("orderBy")((this as any)[list], `-${prop}`);
        }
    }

    async refreshData(): Promise<IJob[]> {
        try {
            this.promise = this.uPBData.getPreBookJobs();

            this.jobList = await this.promise;
            this.updateTable();

            return this.jobList;
        } catch (error) {
            console.error("Error loading prebook jobs:", error);
            this.jobList = [];
            this.updateTable();

            return [];
        }
    }

    onOrderChange(order: string): Promise<IJob[]> {
        this.jobQuery.order = order;
        this.updateTable();
        return this.refreshData();
    }

    showItems(job: IJob): boolean {
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

    async selectJobDetail(jobId: number): Promise<void> {
        console.log('Selected job run: ', jobId);
        if (!jobId) return;
        this.currentJobId = jobId;
    }

    pageChanged(page: number): void {
        this.jobQuery.page = page;
        this.updateTable();
    }

    changePageSize(size: number): void {
        this.jobQuery.page = 1;
        this.jobQuery.limit = size;
        this.updateTable();
    }

    async voidAllSelectPrebookJobs(jobIds: number[]): Promise<void> {
        const selectedPrebookCount = jobIds.length;

        const confirmMessage =
            `This will void TODAY's copy of all ${selectedPrebookCount} selected prebooks, ` +
            `but not cancel them for good. Please confirm that you wish to do this?`;

        const confirm = this.$mdDialog.confirm()
            .title("Accelerate Prebooks")
            .textContent(confirmMessage)
            .ok("Yes")
            .cancel("No");

        try {
            await this.$mdDialog.show(confirm);

            // User clicked 'Yes'
            const voidJobs = jobIds.map(jobId =>
                this.uPBData.voidPrebookJob(jobId, FirstName, ContactID)
            );

            await Promise.all(voidJobs);

            this.currentJob = undefined;
            await this.refreshData();

            // Optionally, show a success message
            this.$mdDialog.show(
                this.$mdDialog.alert()
                    .title("Success")
                    .textContent(`Successfully voided ${selectedPrebookCount} prebook(s).`)
                    .ok("OK")
            );
        } catch (error) {
            if (error === undefined) {
                console.log("User Canceled");
            } else {
                console.log("Error voiding prebook jobs:", error);

                // Show an error dialog to the user
                this.$mdDialog.show(
                    this.$mdDialog.alert()
                        .title("Error")
                        .textContent("An error occurred while voiding the prebook jobs. Please try again.")
                        .ok("OK")
                );
            }
            // If error is falsy, it means the user clicked 'No', so we do nothing
        }
    }

    async voidPrebookJob(jobId: number): Promise<void> {
        const confirmMessage =
            "This will void TODAY'S copy of this prebook but not cancel it for good. " +
            "Please confirm that you wish to do this?";

        const confirm = this.$mdDialog.confirm()
            .title("Void Prebook")
            .textContent(confirmMessage)
            .ok("Yes")
            .cancel("No");

        try {
            await this.$mdDialog.show(confirm);

            // User clicked 'Yes'
            await this.uPBData.voidPrebookJob(jobId, FirstName, ContactID);

            this.currentJob = undefined;
            await this.refreshData();

            // Show a success message
            await this.$mdDialog.show(
                this.$mdDialog.alert()
                    .title("Success")
                    .textContent("The prebook job has been successfully voided for today.")
                    .ok("OK")
            );
        } catch (error) {
            if (!error) {
                console.log("User Canceled");
            } else {
                console.log("Error voiding prebook job:", error);

                // Show an error dialog to the user
                await this.$mdDialog.show(
                    this.$mdDialog.alert()
                        .title("Error")
                        .textContent("An error occurred while voiding the prebook job. Please try again.")
                        .ok("OK")
                );
            }
            // If error is falsy, it means the user clicked 'No', so we do nothing
        }
    }

    async sendAllSelectPrebookJobs(jobIds: number[]): Promise<void> {
        const selectedPrebookCount = jobIds.length;

        const confirmMessage =
            `This will send all ${selectedPrebookCount} selected prebooks to the live dispatch screen now. ` +
            `Please confirm that you wish to do this?`;

        const confirm = this.$mdDialog.confirm()
            .title("Accelerate Prebooks")
            .textContent(confirmMessage)
            .ok("Yes")
            .cancel("No");

        try {
            await this.$mdDialog.show(confirm);

            // User clicked 'Yes'
            const sendJobs = jobIds.map(jobId => this.uPBData.sendPrebookJob(jobId));
            await Promise.all(sendJobs);

            this.currentJob = undefined;
            await this.refreshData();

            // Show a success message
            await this.$mdDialog.show(
                this.$mdDialog.alert()
                    .title("Success")
                    .textContent(`Successfully sent ${selectedPrebookCount} prebook(s) to the live dispatch screen.`)
                    .ok("OK")
            );
        } catch (error) {
            if (!error) {
                console.log("User Canceled");
            } else {
                console.log("Error sending prebook jobs:", error);

                // Show an error dialog to the user
                await this.$mdDialog.show(
                    this.$mdDialog.alert()
                        .title("Error")
                        .textContent("An error occurred while sending the prebook jobs. Please try again.")
                        .ok("OK")
                );
            }
        }
    }

    async sendPrebookJob(jobId: number): Promise<void> {
        const confirmMessage =
            "This will send this prebook to the live dispatch screen now. " +
            "Please confirm that you wish to do this?";

        const confirm = this.$mdDialog.confirm()
            .title("Accelerate Prebook")
            .textContent(confirmMessage)
            .ok("Yes")
            .cancel("No");

        try {
            await this.$mdDialog.show(confirm);

            // User clicked 'Yes'
            await this.uPBData.sendPrebookJob(jobId);

            this.currentJob = undefined;
            await this.refreshData();

            // Show a success message
            await this.$mdDialog.show(
                this.$mdDialog.alert()
                    .title("Success")
                    .textContent("The prebook job has been successfully sent to the live dispatch screen.")
                    .ok("OK")
            );
        } catch (error) {
            if (!error) {
                console.log("User Canceled");
            } else {
                console.log("Error sending prebook job:", error);

                // Show an error dialog to the user
                await this.$mdDialog.show(
                    this.$mdDialog.alert()
                        .title("Error")
                        .textContent("An error occurred while sending the prebook job. Please try again.")
                        .ok("OK")
                );
            }
        }
    }
}

const RecurringJobsComponent: angular.IComponentOptions = {
    template: require('./recurringJobs.template.html'),
    controller: RecurringJobsController,
    controllerAs: 'ctrl'
};

export default RecurringJobsComponent;
