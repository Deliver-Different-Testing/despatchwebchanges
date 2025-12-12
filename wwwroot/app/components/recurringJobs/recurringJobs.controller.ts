import "./recurringJobs.styles.less";
import {IAppConfig} from "../../interfaces/app-config.interface";
import {IAddressViewModel, IJob} from "../../interfaces/job.interface";
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
import {AppPage} from "../../enums/app-pages.enum";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import {getIanaTimezone} from "../../functions/formatDates";
import {IPaginatedResponse} from "../../interfaces/paginated-response.interface";
import {IDataTableColumn, IDataTableSort, IDataTableConfig} from "../common/data-table/data-table.interfaces";

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

    private readonly RecurringJobsLayoutKey: string = `layouts-${AppPage.Recurring}-${ContactID}`;
    private readonly RecurringJobsLastActiveLayoutKey: string = `lastActiveLayout-${AppPage.Recurring}-${ContactID}`
    private readonly timeZone: string;

    readonly boxes: Record<string, IBox> = {
        jobList: {
            title: "Recurring Jobs List",
            icon: "list_alt",
            templateUrl: "app/components/recurringJobs/partials/jobList.html",
            showSearch: true,
            showRefresh: true,
            showFilter: true,
        },
        jobDetail: {
            title: "Detail",
            icon: "assignment",
            templateUrl: "app/components/recurringJobs/partials/jobDetail.html",
            showSearch: false,
            showRefresh: false,
            showFilter: false,
        },
    };

    readonly isUsCustomer: boolean;
    readonly timeZoneShort: string;

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
    isLoading: boolean = false;
    showInput: Record<string, boolean> = {};
    cancelledSelected?: boolean;
    layouts: ILayout[] = [];
    defaultLayout?: ILayout;
    layout?: { columns: IColumn[] };
    currentLayoutName?: string;

    // Data table configuration
    tableColumns: IDataTableColumn[] = [];
    tableConfig: IDataTableConfig = {
        selectable: false,
        hoverEffect: true,
        stickyHeader: true,
        emptyMessage: 'No recurring jobs available',
        emptyIcon: 'event_repeat',
        trackBy: 'id'
    };
    tableSort: IDataTableSort = {
        column: 'booked',
        direction: 'asc'
    };

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

        this.isUsCustomer = appConfig.US_Customer;
        this.isAdmin = ClientInternal;
        this.timeZone = getIanaTimezone(TimeZone);
        this.timeZoneShort = this.getShortTimeZoneString();

        this.initializeLayout();
        this.initTableColumns();
    }

    $onInit(): void {
        this.refreshData().then(() => console.log("Recurring Jobs Loaded!"));
    }

    private initTableColumns(): void {
        this.tableColumns = [
            { key: 'booked', label: 'Booked', field: '_bookedStr', sortable: true, sortKey: 'booked' },
            { key: 'speed', label: 'Speed', field: 'speed', sortable: true },
            { key: 'customJobName', label: 'Job Name', field: 'customJobName', sortable: true, truncate: true },
            { key: 'client', label: 'Client', field: 'client', sortable: true },
            { key: 'from', label: 'From', sortable: true, truncate: true },
            { key: 'to', label: 'To', sortable: true, truncate: true },
            { key: 'nextDueTime', label: 'Next Due', field: '_nextDueTimeStr', sortable: true, sortKey: 'nextDueTime' },
            { key: 'courier', label: 'Courier', field: 'courier', sortable: true },
            { key: 'actions', label: 'Actions', sortable: false, align: 'center', width: '80px' }
        ];
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
                this.currentLayoutName = name;

                if (Modernizr.localstorage) {
                    localStorage.setItem(this.RecurringJobsLayoutKey, JSON.stringify(this.layouts));
                    localStorage.setItem(this.RecurringJobsLastActiveLayoutKey, name);
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

        this.isLoading = true;

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
            this.totalJobCount = 0;
        } finally {
            this.isLoading = false;
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

    onSort(sort: IDataTableSort): void {
        this.tableSort = sort;
        this.jobQuery.order = sort.column;
        this.jobQuery.orderDirection = sort.direction;
        this.jobQuery.page = 1;
        this.refreshData();
    }

    getAddressPrimary(address: IAddressViewModel): string {
        if (!address) return '';
        return address.addressLine1 || address.fullAddress?.substring(0, 30) || '';
    }

    getAddressSecondary(address: IAddressViewModel): string {
        if (!address) return '';
        if (this.isUsCustomer) {
            const parts = [address.addressLine5, address.addressLine6].filter(Boolean);
            return parts.join(', ');
        }
        return address.addressLine2 || address.addressLine3 || '';
    }

    getAddressTooltipLines(address: IAddressViewModel): string[] {
        if (!address) return [];
        const lines = [
            address.addressLine1,
            address.addressLine2,
            address.addressLine3,
            address.addressLine4,
            address.addressLine5,
            address.addressLine6,
            address.addressLine7,
            address.addressLine8
        ].filter(Boolean) as string[];

        if (lines.length === 0 && address.fullAddress) {
            return [address.fullAddress];
        }
        return lines;
    }

    async searchJobs(searchText: string): Promise<void> {
        if (searchText.length < 2) return;

        this.jobQuery.searchText = searchText;
        this.jobQuery.page = 1;

        await this.refreshData();
    }

    async switchActiveFilter(isActive: boolean): Promise<void> {
        this.jobQuery.active = isActive;
        this.jobQuery.page = 1;

        await this.refreshData();
    }

    onPaginate(page: number, limit: number): void {
        this.jobQuery.page = page;
        this.jobQuery.limit = limit;
        this.refreshData();
    }

    exportToCSV(jobList: IPrebookListModel[] = this.jobList): void {
        if (!jobList || jobList.length === 0) {
            this.toastrService.showWarningToast("No jobs to export");
            return;
        }

        // Define CSV headers
        const headers = [
            "Job Number",
            "Client",
            "Booked",
            "Next Due",
            "Courier",
            "Speed",
            "Pickup Address",
            "Delivery Address"
        ];

        // Convert jobs to CSV rows
        const rows = jobList.map(job => {
            const formatAddress = (addr: IAddressViewModel) => {
                if (!addr) return "";

                // Use fullAddress if available, otherwise build from address lines
                if (addr.fullAddress) {
                    return addr.fullAddress;
                }

                // Concatenate non-empty address lines
                const addressLines = [
                    addr.addressLine1,
                    addr.addressLine2,
                    addr.addressLine3,
                    addr.addressLine4,
                    addr.addressLine5,
                    addr.addressLine6,
                    addr.addressLine7,
                    addr.addressLine8
                ].filter(line => line && line.trim() !== "");

                return addressLines.join(", ");
            };

            return [
                job.jobNo || "",
                job.client || "",
                job.booked ? dayjs(job.booked).tz(this.timeZone).format("DD/MM/YYYY HH:mm") : "",
                job.nextDueTime ? dayjs(job.nextDueTime).tz(this.timeZone).format("DD/MM/YYYY HH:mm") : "",
                job.courier || "",
                job.speed || "",
                formatAddress(job.pickupAddress),
                formatAddress(job.deliveryAddress)
            ];
        });


        // Escape CSV values
        const escapeCsvValue = (value: string): string => {
            if (value.includes(',') || value.includes('"') || value.includes('\n')) {
                return `"${value.replace(/"/g, '""')}"`;
            }
            return value;
        };

        // Build CSV content
        const csvContent = [
            headers.map(escapeCsvValue).join(','),
            ...rows.map(row => row.map(escapeCsvValue).join(','))
        ].join('\n');

        // Create and trigger download
        const blob = new Blob([csvContent], {type: 'text/csv;charset=utf-8;'});
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);

        const defaultFilename = `recurring-jobs-${dayjs().format('YYYY-MM-DD-HHmm')}.csv`;

        link.setAttribute('href', url);
        link.setAttribute('download', defaultFilename);
        link.style.visibility = 'hidden';

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        URL.revokeObjectURL(url);

        this.toastrService.showSuccessToast(`Exported ${jobList.length} recurring job(s) to CSV`);
    }
}

const RecurringJobsComponent: angular.IComponentOptions = {
    template: require('./recurringJobs.template.html'),
    controller: RecurringJobsController,
    controllerAs: 'ctrl'
};

export default RecurringJobsComponent;
