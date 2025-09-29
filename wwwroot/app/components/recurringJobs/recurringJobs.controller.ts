import {IAppConfig} from "../../interfaces/app-config.interface";
import {IJob, ISuggestion} from "../../interfaces/job.interface";
import {IBox, IColumn, ILayout} from "../../interfaces/layout.interfaces";
import BaseController from "../base-controller";
import {ClientInternal, ContactID} from "../../contants";
import RecurringJobsService from "./recurringJobs.service";
import {IPrebookListModel, IRecurringJobQuery} from "./recurringJobs.interface";
import ToastrService from "../../services/toastr.service";
import greetUser from "../../functions/greetUser";
import JobContextMenuService from "../../services/job-context-menu.service";
import IContextMenuOption from "../../interfaces/context-menu-option.interface";
import IDateFilterData from "../common/date-filter-menu/IDateFilterData";
import dayjs from "dayjs";
import {AppPages} from "../../enums/app-pages.enum";
import setDateFilterDefaults from "../../functions/setDateFilterDefaults";

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
    
    private readonly RecurringJobsLayoutKey: string = `layouts-${AppPages.Recurring}-${ContactID}`;
    private readonly RecurringJobsLastActiveLayoutKey: string = `lastActiveLayout-${AppPages.Recurring}-${ContactID}`
    private readonly DateFilterKey: string = `dateFilter-${AppPages.Dispatch}-${ContactID}`;

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

    dateFilterData: IDateFilterData;
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
    promise?: Promise<IPrebookListModel[]>
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
        appConfig: IAppConfig,
    ) {
        super();
        this.initServices($timeout, $interval, $scope);

        this.isUsCustomer = appConfig.US_Customer;
        this.isAdmin = ClientInternal;

        // Date filter
        this.dateFilterData = setDateFilterDefaults();
        this.loadDateFilterFromStorage();

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
        this.refreshData().then(() => console.info("Data Refreshed"));
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
                    localStorage.setItem(this.RecurringJobsLayoutKey, JSON.stringify(this.layouts));
                    localStorage.setItem(this.RecurringJobsLastActiveLayoutKey, name);
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
                    localStorage.setItem(this.RecurringJobsLayoutKey, JSON.stringify(this.layouts));
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
                const storedLayouts: ILayout[] = JSON.parse(localStorage.getItem(this.RecurringJobsLayoutKey) || '[]');
                const lastActiveLayout = localStorage.getItem(this.RecurringJobsLastActiveLayoutKey);

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

    jobRecordSearch(searchText: string): ISuggestion[] {
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
                localStorage.setItem(this.RecurringJobsLastActiveLayoutKey, layout.name);
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
        console.info("goToRunViewer.");
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
            this.promise = this.recurringJobsService.getPreBookJobs(active, 
                this.dateFilterData.startDate.toDate(), this.dateFilterData.endDate.toDate());

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
        console.info('Selected job run: ', jobId);
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
                console.info("User Canceled");
            } else {
                console.info("Error inactivating recurring jobs:", error);

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
                console.info("User Canceled");
            } else {
                console.info("Error inactivating recurring job:", error);

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
                console.info("User Canceled");
            } else {
                console.info("Error sending prebook jobs:", error);

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
                console.info("User Canceled");
            } else {
                console.info("Error sending prebook job:", error);

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

    async refreshDataTimeSpan(dateFilterData: IDateFilterData): Promise<void> {
        console.log('refreshDataTimeSpan called with data ', dateFilterData);
        this.dateFilterData = dateFilterData;

        this.saveDateFilterToStorage();
        await this.refreshData();
    }

    private saveDateFilterToStorage(): void {
        if (Modernizr.localstorage && this.dateFilterData) {
            try {
                localStorage.setItem(this.DateFilterKey, JSON.stringify(this.dateFilterData));
            } catch (error) {
                console.error('Error saving date filter to storage:', error);
            }
        }
    }

    private loadDateFilterFromStorage(): void {
        if (Modernizr.localstorage) {
            try {
                const savedDateFilter = localStorage.getItem(this.DateFilterKey);
                if (savedDateFilter) {
                    const parsedDateFilter = JSON.parse(savedDateFilter);
                    this.dateFilterData = {
                        startDate: dayjs(parsedDateFilter.startDate),
                        endDate: dayjs(parsedDateFilter.endDate)
                    };
                }
            } catch (error) {
                console.error('Error loading date filter from storage:', error);
                // Keep default values if parsing fails
                this.dateFilterData = setDateFilterDefaults();
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
