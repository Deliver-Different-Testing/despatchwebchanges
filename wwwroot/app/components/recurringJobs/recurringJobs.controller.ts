import {AppConfig} from "../../interfaces/app-config.interface";
import {IJob, Suggestion} from "../../interfaces/job.interface";
import {IBox, IColumn, ILayout} from "../../interfaces/layout.interfaces";
import BaseController from "../base-controller";
import {ClientInternal, ContactID} from "../../contants";
import RecurringJobsService from "./recurringJobs.service";
import {IPrebookListModel, IRecurringJobQuery} from "./recurringJobs.interface";
import ToastrService from "../../services/toastr.service";
import greetUser from "../../functions/greetUser";
import JobContextMenuService from "../../services/job-context-menu.service";
import IContextMenuOption from "../../interfaces/context-menu-option.interface";

class RecurringJobsController extends BaseController {
    static $inject = [
        '$mdDialog',
        '$state',
        '$filter',
        '$mdSidenav',
        'uPBData',
        'toastrService',
        'jobContextMenuService',
        '$scope',
        '$timeout',
        '$interval',
        'APP_CONFIG',
    ];

    readonly boxes = {
        jobList: {
            title: "Recurring Jobs List",
            icon: "list_alt",
            templateUrl: "app/components/recurringJobs/partials/jobList.html",
            showSearch: 1,
            showRefresh: 1,
            showFilter: 1,
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
    jobQuery: IRecurringJobQuery = {
        order: "booked",
        limit: 50,
        page: 1
    };
    searchBox: string = "";
    totalCount: number = 0;
    jobList: IPrebookListModel[] = [];
    filteredData: IPrebookListModel[] = [];
    pagedData: IPrebookListModel[] = [];
    searchText: string = "";
    promise: angular.IPromise<any> | null = null;
    showInput: Record<string, boolean> = {};
    jobRecordSearchText: string = "";
    cancelledSelected?: boolean;
    layouts: ILayout[] = [];
    defaultLayout?: ILayout;
    layout?: { columns: IColumn[] };
    sort: Record<string, string> = {};
    currentLayoutName?: string;
    timeZone: string = TimeZone;
    activeFilter: boolean = true;

    constructor(
        private $mdDialog: angular.material.IDialogService,
        private $state: angular.ui.IStateService,
        private $filter: angular.IFilterService,
        private $mdSidenav: angular.material.ISidenavService,
        private recurringJobsService: RecurringJobsService,
        private toastrService: ToastrService,
        private jobContextMenuService: JobContextMenuService,
        $scope: angular.IScope,
        $timeout: angular.ITimeoutService,
        $interval: angular.IIntervalService,
        appConfig: AppConfig,
    ) {
        super();
        this.initServices($timeout, $interval, $scope);

        this.isUsCustomer = appConfig.US_Customer;
        this.isAdmin = ClientInternal;

        this.initializeLayout();
    }

    $onInit(): void {
        // Setup watchers
        this.watchScope("searchText", () => {
            this.jobQuery.page = 1; // Reset to the first page
            this.updateTable();
        });

        this.watchScope("jobQuery.order", () => {
            this.jobQuery.page = 1; // Reset to the first page
            this.updateTable();
        });

        // Initial data load
        this.refreshData().then(() => console.log("Data Refreshed"));
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
                    localStorage.setItem(`layouts-recurring-${ContactID}`, JSON.stringify(this.layouts));
                    localStorage.setItem(`lastActiveLayout-recurring-${ContactID}`, name);
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
                this.layouts.splice(index, 1);
                if (Modernizr.localstorage) {
                    localStorage.setItem(`layouts-${ContactID}`, JSON.stringify(this.layouts));
                }
                this.loadLayout(0);
                this.toastrService.showSuccessToast("Layout deleted successfully");
            });
    }

    private initializeLayout(): void {
        this.layouts = []

        this.defaultLayout = {
            name: "Default",
            layout: {
                columns: [
                    {
                        id: "col1",
                        width: "55%",
                        boxes: [{
                            name: "jobList"
                        }]
                    },
                    {
                        id: "col2",
                        width: "45%",
                        boxes: [{
                            name: "jobDetail",
                        }]
                    }
                ],
            },
        };

        // Load saved layouts or use default
        if (Modernizr.localstorage) {
            try {
                const storedLayouts: ILayout[] = JSON.parse(localStorage.getItem(`layouts-recurring-${ContactID}`) || '[]');
                const lastActiveLayout = localStorage.getItem(`lastActiveLayout-recurring-${ContactID}`);

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
    }

    greetUser(): string {
        return greetUser(FirstName);
    }

    toggleSidenav(): void {
        try {
            this.$mdSidenav("right").toggle();
        } catch (error) {
            console.warn('Sidenav not available yet:', error);
            this.registerTimeout(() => {
                try {
                    this.$mdSidenav("right").toggle();
                } catch (retryError) {
                    console.error('Sidenav still not available:', retryError);
                }
            }, 100);
        }
    }

    updateTable(): void {
        // Apply search filter
        let orderedData = this.$filter("filter")(this.jobList, this.searchText) as IPrebookListModel[];

        // Apply sorting
        orderedData = this.$filter("orderBy")(orderedData, this.jobQuery.order) as IPrebookListModel[];

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
        }
    }

    jobRecordSearch(searchText: string): Suggestion[] {
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


    loadLayout(index: number): void {
        const layout: ILayout = this.layouts[index] || this.layouts[0];
        this.currentLayoutName = layout.name;
        this.layout = angular.copy(layout.layout);

        // Apply dimensions on next digest cycle
        this.registerTimeout(() => {
            this.applyLayoutDimensions();

            if (Modernizr.localstorage) {
                localStorage.setItem(`lastActiveLayout-recurring-${ContactID}`, layout.name);
            }
        });
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

    async refreshData(active = this.activeFilter): Promise<IPrebookListModel[]> {
        try {
            this.currentJobId = undefined;
            this.activeFilter = active;
            this.promise = this.recurringJobsService.getPreBookJobs(active);

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

    onOrderChange(order: string): Promise<IPrebookListModel[]> {
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
            `This will inactivate all ${selectedPrebookCount} selected recurring jobs, ` +
            `but not cancel them for good. Please confirm that you wish to do this?`;

        const confirm = this.$mdDialog.confirm()
            .title("Inactivate Recurring Jobs")
            .textContent(confirmMessage)
            .ok("Yes")
            .cancel("No");

        try {
            await this.$mdDialog.show(confirm);

            // User clicked 'Yes'
            const voidJobs = jobIds.map(jobId =>
                this.recurringJobsService.voidPrebookJob(jobId, FirstName, ContactID)
            );

            await Promise.all(voidJobs);

            await this.refreshData();

            // Optionally, show a success message
            this.$mdDialog.show(
                this.$mdDialog.alert()
                    .title("Success")
                    .textContent(`Successfully inactivated ${selectedPrebookCount} recurring job(s).`)
                    .ok("OK")
            );
        } catch (error) {
            if (!error) {
                console.log("User Canceled");
            } else {
                console.log("Error inactivating recurring jobs:", error);

                // Show an error dialog to the user
                this.$mdDialog.show(
                    this.$mdDialog.alert()
                        .title("Error")
                        .textContent("An error occurred while inactivating the recurring jobs. Please try again.")
                        .ok("OK")
                );
            }
        }
    }

    async voidPrebookJob(jobId: number): Promise<void> {
        const confirmMessage =
            "This will inactivate this recurring job. " +
            "Please confirm that you wish to do this?";

        const confirm = this.$mdDialog.confirm()
            .title("Inactivate Recurring Job")
            .textContent(confirmMessage)
            .ok("Yes")
            .cancel("No");

        try {
            await this.$mdDialog.show(confirm);

            // User clicked 'Yes'
            await this.recurringJobsService.voidPrebookJob(jobId, FirstName, ContactID);

            await this.refreshData();

            // Show a success message
            await this.$mdDialog.show(
                this.$mdDialog.alert()
                    .title("Success")
                    .textContent("The recurring job has been successfully inactivated.")
                    .ok("OK")
            );
        } catch (error) {
            if (!error) {
                console.log("User Canceled");
            } else {
                console.log("Error inactivating recurring job:", error);

                // Show an error dialog to the user
                await this.$mdDialog.show(
                    this.$mdDialog.alert()
                        .title("Error")
                        .textContent("An error occurred while inactivating the recurring job. Please try again.")
                        .ok("OK")
                );
            }
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
            const sendJobs = jobIds.map(jobId => this.recurringJobsService.sendPrebookJob(jobId));
            await Promise.all(sendJobs);

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
            await this.recurringJobsService.sendPrebookJob(jobId);

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

    getContextMenuOptions(job: IPrebookListModel): any[] | IContextMenuOption[] {
        if (!job) return [];

        const callbacks = {
            onRefresh: () => this.refreshData(),
        };

        return this.jobContextMenuService.getRecurringJobMenuOptions(job, callbacks);
    }
}

const RecurringJobsComponent: angular.IComponentOptions = {
    template: require('./recurringJobs.template.html'),
    controller: RecurringJobsController,
    controllerAs: 'ctrl'
};

export default RecurringJobsComponent;
