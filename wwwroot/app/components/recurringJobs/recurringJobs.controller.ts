import "./recurringJobs.styles.less";
import {IAppConfig} from "../../interfaces/app-config.interface";
import {IJob} from "../../interfaces/job.interface";
import {IBox, IColumn, ILayout} from "../../interfaces/layout.interfaces";
import BaseController from "../base-controller";
import {ClientInternal, ContactID, TimeZone} from "../../contants";
import RecurringJobsService from "./recurringJobs.service";
import {IPrebookListModel, IRecurringJobQuery} from "./recurringJobs.interface";
import ToastrService from "../../services/toastr.service";
import greetUser from "../../functions/greetUser";
import JobContextMenuService from "../../services/job-context-menu.service";
import IContextMenuOption from "../../interfaces/context-menu-option.interface";
import dayjs from "dayjs";
import {AppPages} from "../../enums/app-pages.enum";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import {getIanaTimezone} from "../../functions/formatDates";
import {IPaginatedResponse} from "../../interfaces/paginated-response.interface";

dayjs.extend(utc);
dayjs.extend(timezone);

class RecurringJobsController extends BaseController {
    static $inject = [
        '$mdDialog',
        '$mdSidenav',
        'uPBData',
        'toastrService',
        'jobContextMenuService',
        '$timeout',
        '$interval',
        '$scope',
        'APP_CONFIG',
    ];

    private readonly RecurringJobsLayoutKey: string = `layouts-${AppPages.Recurring}-${ContactID}`;
    private readonly RecurringJobsLastActiveLayoutKey: string = `lastActiveLayout-${AppPages.Recurring}-${ContactID}`

    readonly boxes: Record<string, IBox> = {
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
            showSearch: 0
        },
    };

    readonly isUsCustomer: boolean;

    currentJobId?: number;
    isAdmin: boolean = false;
    jobQuery: IRecurringJobQuery = {
        order: "booked",
        orderDirection: "asc",
        limit: 50,
        page: 1,
        active: true,
    };
    totalJobCount: number = 0;
    jobList: IPrebookListModel[] = [];
    prebookJobsPromise?: Promise<IPaginatedResponse<IPrebookListModel>>
    showInput: Record<string, boolean> = {};
    cancelledSelected?: boolean;
    layouts: ILayout[] = [];
    defaultLayout?: ILayout;
    layout?: { columns: IColumn[] };
    currentLayoutName?: string;
    timeZone: string;

    constructor(
        private $mdDialog: angular.material.IDialogService,
        private $mdSidenav: angular.material.ISidenavService,
        private recurringJobsService: RecurringJobsService,
        private toastrService: ToastrService,
        private jobContextMenuService: JobContextMenuService,
        $timeout: angular.ITimeoutService,
        $interval: angular.IIntervalService,
        $scope: angular.IScope,
        appConfig: IAppConfig,
    ) {
        super();
        this.initServices($timeout, $interval, $scope);
        
        this.bindFunctions();

        this.isUsCustomer = appConfig.US_Customer;
        this.isAdmin = ClientInternal;
        this.timeZone = getIanaTimezone(TimeZone);

        this.initializeLayout();
    }

    $onInit(): void {
        this.refreshData().then(() => console.log("Recurring Jobs Loaded!"));
    }

    private bindFunctions(): void {
        // Bind pagination and sorting functions
        this.onPaginate = this.onPaginate.bind(this);
        this.onReorder = this.onReorder.bind(this);
        this.searchJobs = this.searchJobs.bind(this);

        // Bind job action functions
        this.selectJobDetail = this.selectJobDetail.bind(this);
        this.voidPrebookJob = this.voidPrebookJob.bind(this);
        this.voidAllSelectPrebookJobs = this.voidAllSelectPrebookJobs.bind(this);

        // Bind UI functions
        this.refreshData = this.refreshData.bind(this);
        this.switchActiveFilter = this.switchActiveFilter.bind(this);
        this.getContextMenuOptions = this.getContextMenuOptions.bind(this);
        this.openSearch = this.openSearch.bind(this);

        // Bind layout functions
        this.saveLayout = this.saveLayout.bind(this);
        this.deleteLayout = this.deleteLayout.bind(this);
        this.loadLayout = this.loadLayout.bind(this);
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


    openSearch(boxName: string, index: number): void {
        const boxID = boxName + "-" + index;
        this.showInput[boxID] = !this.showInput[boxID];

        if (!this.showInput[boxID]) {
            this.jobQuery.searchText = "";
        }
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

    async refreshData(): Promise<void> {
        console.log("Refreshing data!")
        
        try {
            // Parse sort order
            let orderBy = this.jobQuery.order || "booked";
            let orderDirection = "asc";

            if (orderBy.startsWith("-")) {
                orderBy = orderBy.substring(1);
                orderDirection = "desc";
            }
            
            this.jobQuery.order = orderBy;
            this.jobQuery.orderDirection = orderDirection;
            
            this.currentJobId = undefined;
            this.prebookJobsPromise = this.recurringJobsService.getPreBookJobs(this.jobQuery);

            const response = await this.prebookJobsPromise;
            this.jobList = response.items;
            this.totalJobCount = response.total;

            console.log("Updated prebook jobs!")
        } catch (error) {
            console.error("Error loading prebook jobs:", error);
            this.jobList = [];
        } finally {
            this.applyScope();
        }
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
                this.recurringJobsService.voidPrebookJob(jobId)
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
        } finally {
            this.applyScope();
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
            await this.recurringJobsService.voidPrebookJob(jobId);

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
        } finally {
            this.applyScope();
        }
    }
    
    getContextMenuOptions(job: IPrebookListModel): any[] | IContextMenuOption[] {
        if (!job) return [];

        const callbacks = {
            onRefresh: () => this.refreshData(),
        };

        return this.jobContextMenuService.getRecurringJobMenuOptions(job, callbacks);
    }

    async onReorder() {
        this.jobQuery.page = 1;
        await this.refreshData();
    }
    
    async searchJobs(searchText: string): Promise<void> {
        if(searchText.length < 2) return;
        
        this.jobQuery.searchText = searchText;
        this.jobQuery.page = 1;
        
        await this.refreshData();
    }
    
    async switchActiveFilter(isActive: boolean): Promise<void> {
        this.jobQuery.active = isActive;
        this.jobQuery.page = 1;
        
        await this.refreshData();
    }
    
    async onPaginate() {
        console.log("Paginating!")
        await this.refreshData();
    }
}

const RecurringJobsComponent: angular.IComponentOptions = {
    template: require('./recurringJobs.template.html'),
    controller: RecurringJobsController,
    controllerAs: 'ctrl'
};

export default RecurringJobsComponent;
