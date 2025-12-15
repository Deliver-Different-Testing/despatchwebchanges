import "./job-list.styles.less";
import {IAddressViewModel, IAssignedFlight, IDispatchJob, ISuggestion} from "../../../interfaces/job.interface";
import BaseController from "../../base-controller";
import dayjs from "dayjs";
import JobCategory from "./enums/jobCategory";
import {JobStatus} from "../../../enums/job-status.enum";
import {ContactID, TimeZone} from "../../../contants";
import {IAppConfig} from "../../../interfaces/app-config.interface";
import DispatchCoreService from "../../../services/dispatch-core.service";
import JobListType from "./enums/jobListType";
import JobHighlightService from "./job-highlight.service";
import DensityMode from "../../../enums/densityMode";
import AutoCompleteDialogService from "../../dialogs/auto-complete-dialog/auto-complete-dialog.service";
import ToastrService from "../../../services/toastr.service";
import {formatLongDateTime, formatMins, getIanaTimezone} from "../../../functions/formatDates";

class JobsListController extends BaseController {
    static $inject = [
        'DispatchData',
        'jobHighlightService',
        'autoCompleteDialogService',
        'toastrService',
        '$document',
        '$mdDialog',
        'APP_CONFIG',
        '$timeout',
        '$interval',
        '$scope',
    ];

    private readonly DENSE_MODE_SAVE_KEY: string = `jobListComponentDenseViewMode_${ContactID}`;
    private readonly COLUMN_WIDTHS_SAVE_KEY: string = `jobListColumnWidths_${ContactID}`;
    private readonly SORT_STATE_SAVE_KEY: string = `jobListSortState_${ContactID}`;
    private readonly COURIER_URL: string = "/courier/AllActiveSearch";

    unsubscribeFromHighlights?: () => void;

    // Parent-provided data
    jobs?: IDispatchJob[];
    selectedJob?: IDispatchJob;
    onSearchChange?: (data: { searchText: string, jobType: JobListType }) => void;
    onCategoryChange?: (data: { category: string }) => Promise<void>;
    onJobSelect?: (data: { job: IDispatchJob }) => Promise<void>;
    onJobDispatch?: (data: { job: IDispatchJob, courierId: number }) => Promise<void>;
    getContextMenuOptions?: (data: { job: IDispatchJob }) => any[];
    onRefresh?: () => Promise<void>;
    onLoadMoreJobs?: (data: { page: number, pageSize: number }) => Promise<{
        jobs: IDispatchJob[],
        totalCount: number,
        hasMore: boolean
    }>;
    setBackendFilter?: (data: { column: string, direction: string }) => Promise<void>;
    defaultCategory?: JobCategory; // Allow parent to set an initial category
    isUsCustomer?: boolean;
    timeZoneShort: string;
    jobListType: JobListType = JobListType.DispatchJobList;
    allowDispatch: boolean = false;
    allowSearch: boolean = true;
    highlightedRelatedJobIds: number[] = [];

    // Local component state
    filteredJobs?: IDispatchJob[] = [];
    loading: boolean = false;
    selectedCategory: JobCategory = JobCategory.All;
    searchQuery: string = '';
    densityMode: DensityMode = DensityMode.Normal;

    // Stats for the header
    stats = {
        total: 0,
        urgent: 0,
        active: 0,
        transit: 0,
        done: 0,
        issues: 0
    };

    // Column resizing
    private defaultColumnWidths = {
        priority: 50,
        date: 80,
        time: 80,
        speed: 80,
        isArchived: 80,
        vehicle: 100,
        jobNo: 130,
        client: 85,
        pickup: 120,
        delivery: 380,
        courier: 150,
        remaining: 90,
        status: 100
    };
    columnWidths = {...this.defaultColumnWidths};
    isResizing = false;
    resizingColumn: string | null = null;
    startX = 0;
    startWidth = 0;

    // Sorting state
    sortState: {
        column: string | null;
        direction: 'asc' | 'desc' | null;
    } = {
        column: null,
        direction: null
    };

    // Select all
    selectedJobs: IDispatchJob[] = [];
    selectAllState: boolean = false;

    // Scroll
    private readonly DEFAULT_PAGE_SIZE = 50;
    enableVirtualScrolling: boolean = false;
    currentPage: number = 0;
    totalJobsCount: number = 0;
    isLoadingMore: boolean = false;
    allJobsLoaded: boolean = false;
    private readonly debouncedSearchHandler: (...args: Parameters<(searchText: string) => void>) => void;

    constructor(
        private DispatchData: DispatchCoreService,
        private jobHighlightService: JobHighlightService,
        private autoCompleteDialogService: AutoCompleteDialogService,
        private toastrService: ToastrService,
        private $document: angular.IDocumentService,
        private $mdDialog: angular.material.IDialogService,
        appConfig: IAppConfig,
        $timeout: angular.ITimeoutService,
        $interval: angular.IIntervalService,
        $scope: angular.IScope
    ) {
        super();
        this.initServices($timeout, $interval, $scope);
        this.isUsCustomer = appConfig.US_Customer;

        this.timeZoneShort = this.getShortTimeZoneString();

        this.debouncedSearchHandler = this.debounce((searchText: string) => {
            if (this.onSearchChange) {
                this.onSearchChange({
                    searchText: searchText,
                    jobType: this.jobListType
                });
            }
        }, 300, 'job-list-search');
    }

    $onInit() {
        this.setupJobListVariables();
        this.loadColumnWidths();
        this.loadSortState();

        this.calculateStats();
        this.applyFilters();

        // Subscribe to highlight changes
        this.unsubscribeFromHighlights = this.jobHighlightService.subscribe((jobIds: number[]) => {
            this.highlightedRelatedJobIds = jobIds;
            this.applyScope();
        });

        // Initialize with current highlights
        this.highlightedRelatedJobIds = this.jobHighlightService.getHighlightedRelatedJobIds();
        this.ensureHeaderSticky();

        if (this.enableVirtualScrolling) {
            this.setupScrollListener();
        }
    }

    $onDestroy() {
        super.$onDestroy();

        if (this.enableVirtualScrolling) {
            const selector = this.getScrollContainerSelector();
            const scrollContainer = angular.element(selector);
            if (scrollContainer.length) {
                scrollContainer.off('scroll');
            }
        }

        if (this.unsubscribeFromHighlights) {
            this.unsubscribeFromHighlights();
        }

        // Clean up resize event listeners
        this.$document.off('mousemove', this.onMouseMove);
        this.$document.off('mouseup', this.onMouseUp);
        this.$document.find('body').css('cursor', '');
        this.$document.find('body').css('userSelect', '');
    }

    private setupJobListVariables() {
        switch (this.jobListType) {
            case JobListType.DispatchJobList:
                this.allowDispatch = true;
                this.allowSearch = true;
                break;
            case JobListType.JobSearchMainList:
                this.allowDispatch = true;
                this.allowSearch = false;
                break;
            case JobListType.NationwideJobList:
                this.allowDispatch = !this.isUsCustomer;
                this.allowSearch = true;
                break;
            case JobListType.CurrentWorkList:
            case JobListType.NationwidePodJobList:
            case JobListType.NationwideRepriceJobList:
                this.allowDispatch = false;
                this.allowSearch = true;
                break;
            case JobListType.JobSearchBulkList:
                this.allowDispatch = false;
                this.allowSearch = false;
                break;
        }

        // Default all too dense
        this.densityMode = DensityMode.Dense;

        // Use saved dense mode variable if exists
        if (Modernizr.localstorage) {
            const savedDenseMode = localStorage.getItem(`${this.DENSE_MODE_SAVE_KEY}_${this.jobListType}`);
            if (savedDenseMode) this.densityMode = savedDenseMode as DensityMode;
        }
    }

    $onChanges(changes: angular.IOnChangesObject) {
        if (changes['jobs'] && changes['jobs'].currentValue) {
            if (this.enableVirtualScrolling && changes['jobs'].previousValue !== changes['jobs'].currentValue) {
                this.currentPage = 0;
                // Check if all jobs are already loaded in the initial batch
                this.allJobsLoaded = !!(this.totalJobsCount > 0 && this.jobs && this.jobs.length >= this.totalJobsCount);
            }

            this.calculateStats();
            this.applyFilters();
            this.ensureHeaderSticky();
        }

        if (changes['selectedJob'] && changes['selectedJob'].currentValue) {
            this.selectedJob = changes['selectedJob'].currentValue;
        }

        // Update selected category when defaultCategory changes
        if (changes['defaultCategory'] && changes['defaultCategory'].currentValue) {
            this.selectedCategory = changes['defaultCategory'].currentValue;
            this.applyFilters();
        }

        // Add these:
        if (changes['jobListType'] && !changes['jobListType'].isFirstChange()) {
            this.setupJobListVariables();
            this.loadColumnWidths();
            this.loadSortState();

            this.applyFilters();
        }

        if (changes['enableVirtualScrolling'] && !changes['enableVirtualScrolling'].isFirstChange()) {
            if (changes['enableVirtualScrolling'].currentValue) {
                this.setupScrollListener();
            } else {
                // Clean up scroll listener if disabled
                const selector = this.getScrollContainerSelector();
                const scrollContainer = angular.element(selector);
                if (scrollContainer.length) {
                    scrollContainer.off('scroll');
                }
            }
        }

        if (changes['totalJobsCount'] && changes['totalJobsCount'].currentValue) {
            this.totalJobsCount = changes['totalJobsCount'].currentValue;
        }
    }

    private calculateStats() {
        if (!this.jobs) return;

        // Active now includes urgent and issues, so we calculate it using isActive which merges all three
        this.stats = {
            total: this.jobs.length,
            urgent: 0, // No longer used separately
            active: this.jobs.filter(job => this.isActive(job)).length,
            transit: this.jobs.filter(job => this.isInTransit(job)).length,
            done: this.jobs.filter(job => this.isDelivered(job)).length,
            issues: 0 // No longer used separately
        };
    }

    async filterByCategory(category: JobCategory): Promise<void> {
        this.selectedCategory = category;

        // Notify parent of the category change (for backend filtering when ClearListArea is active)
        if (this.onCategoryChange) {
            await this.onCategoryChange({category: category});
        }

        this.applyFilters();
        this.updateSelectAllState();
        this.applyScope();
    }

    searchJobs(query: string): void {
        if (query.length > 0 && query.length < 3)
            return;

        this.searchQuery = query.toLowerCase();

        if (this.onSearchChange && this.debouncedSearchHandler) {
            this.debouncedSearchHandler(query);
        } else {
            // Fallback to local filtering
            this.applyFilters();
            this.updateSelectAllState();
        }
    }

    setDensityMode(mode: DensityMode) {
        this.densityMode = mode;

        // Save to local storage
        if (Modernizr.localstorage) {
            localStorage.setItem(`${this.DENSE_MODE_SAVE_KEY}_${this.jobListType}`, mode);
        }

        // Apply a CSS class to THIS component root only
        this.registerTimeout(() => {
            const componentElement = angular.element(`.job-list-component.job-list-${this.jobListType}`);
            if (componentElement.length > 0) {
                // Remove existing density classes
                componentElement.removeClass('normal dense ultra-dense');

                // Add a new density class
                switch (mode) {
                    case DensityMode.Dense:
                        componentElement.addClass('dense');
                        break;
                    case DensityMode.UltraDense:
                        componentElement.addClass('ultra-dense');
                        break;
                    default:
                        componentElement.addClass('normal');
                        break;
                }
            }
        });
    }

    getDensityClass(): string {
        switch (this.densityMode) {
            case DensityMode.Dense:
                return 'dense';
            case DensityMode.UltraDense:
                return 'ultra-dense';
            default:
                return 'normal';
        }
    }

    shouldShowMinimalDetails(): boolean {
        return this.densityMode === DensityMode.UltraDense;
    }
    
    isOverdue(job: IDispatchJob): boolean {
        const now = dayjs();
        const deliveryTime = dayjs(job.time || job.booked);
        return deliveryTime.isBefore(now);
    }

    getPickupAddress(job: IDispatchJob): string {
        // In normal mode, show the full address starting from line 2
        if (job.pickupAddress) {
            const addr = job.pickupAddress;
            const addressParts = [
                addr.addressLine2,
                addr.addressLine3,
                addr.addressLine4,
                addr.addressLine5,
                addr.addressLine6,
                addr.addressLine7,
                addr.addressLine8
            ].filter(line => line && line.trim());

            return addressParts.join(', ');
        }

        // For non-structured addresses, parse the 'from' field and start from line 2
        const fromLines = (job.from || '').split(',').map(line => line.trim());
        return fromLines.join(', ');
    }

    getDeliveryAddress(job: IDispatchJob): string {
        // In normal mode, show the full address starting from line 2
        if (job.deliveryAddress) {
            const addr = job.deliveryAddress;
            // Start from address line 2 and include all relevant lines
            const addressParts = [
                addr.addressLine2,
                addr.addressLine3,
                addr.addressLine4,
                addr.addressLine5,
                addr.addressLine8
            ].filter(line => line && line.trim());

            return addressParts.join(', ');
        }

        // For non-structured addresses, parse the 'toAddress' field and start from line 2
        const toLines = (job.toAddress || '').split(',').map(line => line.trim());
        return toLines.join(', ');
    }

    getDeliveryAddressWithoutSuburb(job: IDispatchJob): string {
        // For NZ tenants, exclude addressLine5 (suburb) as it's displayed separately
        if (job.deliveryAddress) {
            const addr = job.deliveryAddress;
            const addressParts = [
                addr.addressLine5,
                addr.addressLine2,
                addr.addressLine3,
                addr.addressLine4,
                addr.addressLine8
            ].filter(line => line && line.trim());

            return addressParts.join(', ');
        }

        // For non-structured addresses, parse the 'toAddress' field
        const toLines = (job.toAddress || '').split(',').map(line => line.trim());
        return toLines.join(', ');
    }  
    
    getPickupAddressWithoutSuburb(job: IDispatchJob): string {
        // For NZ tenants, exclude addressLine5 (suburb) as it's displayed separately
        if (job.pickupAddress) {
            const addr = job.pickupAddress;
            const addressParts = [
                addr.addressLine5,
                addr.addressLine2,
                addr.addressLine3,
                addr.addressLine4,
                addr.addressLine8
            ].filter(line => line && line.trim());

            return addressParts.join(', ');
        }

        // For non-structured addresses, parse the 'fromAddress' field
        const fromLines = (job.from || '').split(',').map(line => line.trim());
        return fromLines.join(', ');
    }

    getCourierInitials(job: IDispatchJob): string {
        const name = this.getCourierName(job);
        if (!name) return '?';

        return name.split(' ')
            .map(word => word.charAt(0))
            .join('')
            .toUpperCase()
            .substring(0, 2);
    }

    getCourierColor(job: IDispatchJob): string {
        const name = this.getCourierName(job);
        if (!name) return '#3b82f6';

        // Generate a consistent color based on name
        const colors = [
            '#3b82f6', // blue
            '#8b5cf6', // purple  
            '#06b6d4', // cyan
            '#10b981', // emerald
            '#f59e0b', // amber
            '#ef4444', // red
            '#84cc16', // lime
            '#ec4899', // pink
        ];

        const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        return colors[hash % colors.length];
    }

    getStatusAbbreviation(job: IDispatchJob): string {
        const status = job.status || job.statusName || '';

        // Return the first letter for ultra-dense, full status otherwise
        if (this.densityMode === DensityMode.UltraDense) {
            return status.charAt(0).toUpperCase();
        }

        return status;
    }

    private applyFilters() {
        if (!this.jobs) {
            this.filteredJobs = [];
            return;
        }

        let filtered = [...this.jobs];

        // Apply category filter
        if (this.selectedCategory !== JobCategory.All) {
            filtered = filtered.filter(job => this.matchesCategory(job, this.selectedCategory));
        }

        // Apply search filter
        if (this.searchQuery) {
            filtered = filtered.filter(job => JobsListController.matchesSearch(job, this.searchQuery));
        }

        // Apply sorting
        filtered = this.sortJobs(filtered);

        this.filteredJobs = filtered;
    }

    private matchesCategory(job: IDispatchJob, category: JobCategory): boolean {
        switch (category) {
            case JobCategory.NeedsDispatch:
                return this.needsDispatch(job);
            case JobCategory.InProgress:
                // Show all jobs that are not delivered (both assigned and unassigned)
                return !this.isDelivered(job);
            case JobCategory.Delivered:
                return this.isDelivered(job);
            default:
                return true;
        }
    }

    private static matchesSearch(job: IDispatchJob, query: string): boolean {
        if (!query || query.trim() === '') return true;

        query = query.toLowerCase().trim();

        const safeIncludes = (value: any): boolean => {
            if (value === null || value === undefined) return false;
            return String(value).toLowerCase().includes(query);
        };

        const searchAddress = (address?: IAddressViewModel): boolean => {
            if (!address) return false;
            return (
                safeIncludes(address.addressLine1) ||
                safeIncludes(address.addressLine2) ||
                safeIncludes(address.addressLine3) ||
                safeIncludes(address.addressLine4) ||
                safeIncludes(address.addressLine5) ||
                safeIncludes(address.addressLine6) ||
                safeIncludes(address.addressLine7) ||
                safeIncludes(address.addressLine8) ||
                safeIncludes(address.fullAddress)
            );
        };

        // Helper function to search in flight information
        const searchFlight = (flight?: IAssignedFlight): boolean => {
            if (!flight) return false;
            return (
                safeIncludes(flight.flightNumber) ||
                flight.flightSegments?.some(segment =>
                    safeIncludes(segment.carrierFsCode) ||
                    safeIncludes(segment.flightNumber) ||
                    safeIncludes(segment.departureAirportName) ||
                    safeIncludes(segment.departureAirportCity) ||
                    safeIncludes(segment.departureAirportCountry) ||
                    safeIncludes(segment.arrivalAirportName) ||
                    safeIncludes(segment.arrivalAirportCity) ||
                    safeIncludes(segment.arrivalAirportCountry) ||
                    safeIncludes(segment.airlineName)
                ) || false
            );
        };

        return (
            // Core job information
            safeIncludes(job.jobNo) ||
            safeIncludes(job.client) ||
            safeIncludes(job.statusName) ||

            // Courier information
            safeIncludes(job.assignedCourier?.text) ||

            // Basic addresses
            safeIncludes(job.pickupContact) ||
            safeIncludes(job.deliveryContact) ||

            // Detailed address objects
            searchAddress(job.pickupAddress) ||
            searchAddress(job.deliveryAddress) ||

            // Job properties
            safeIncludes(job.speed) ||
            safeIncludes(job.notify) ||
            safeIncludes(job.conNote) ||

            // Agent information
            safeIncludes(job.assignedAgent?.agentName) ||

            // Flight information
            searchFlight(job.assignedFlight)
        );
    }

    getCourierName(job: IDispatchJob): string {
        return job.courierData?.courierName || job.assignedCourier?.text || '';
    }

    getCourierNumber(job: IDispatchJob): number | string {
        return job.courierData?.courierNumber || job.assignedCourier?.id || ''
    }

    getCourierCode(job: IDispatchJob): string {
        return job.courierData?.courier || '';
    }

    hasAssignedCourier(job: IDispatchJob): boolean {
        return !!(job.assignedCourier || job.courier);
    }

    isMultiPartJob(job: IDispatchJob): boolean {
        return (job.isParentOrSingle && job._groupChildren && job._groupChildren.length > 0) ?? false;
    }

    toggleJobGroup(job: IDispatchJob): void {
        if (!this.isMultiPartJob(job)) return;
        job._isExpanded = !job._isExpanded;
        this.applyScope();
    }

    getChildCount(job: IDispatchJob): number {
        return job._groupChildren?.length ?? 0;
    }

    isUrgent(job: IDispatchJob): boolean {
        const now = dayjs();
        const deliveryTime = dayjs(job.time);
        const minutesUntilDelivery = deliveryTime.diff(now, 'minutes');
        return minutesUntilDelivery <= 30 && minutesUntilDelivery > 0;
    }

    isActive(job: IDispatchJob): boolean {
        // Unassigned jobs should only show in UNASSIGNED filter, not ACTIVE
        if (this.needsDispatch(job)) {
            return false;
        }

        // Active includes: dispatched/in-progress jobs, urgent jobs, and jobs with issues
        const hasActiveStatus = [
            JobStatus.Dispatched,
            JobStatus.Accepted,
            JobStatus.PickedUp,
            JobStatus.InTransit
        ].includes(job.statusId || JobStatus.New);

        const isUrgentJob = this.isUrgent(job);
        const hasIssuesJob = this.hasIssues(job);

        return hasActiveStatus || isUrgentJob || hasIssuesJob;
    }

    isInTransit(job: IDispatchJob): boolean {
        return job.statusId === JobStatus.InTransit;
    }

    isDelivered(job: IDispatchJob): boolean {
        return job.statusId === JobStatus.Completed;
    }

    needsDispatch(job: IDispatchJob): boolean {
        // Unassigned filter should show all jobs without a courier, including those with warnings/issues
        // Exclude only completed jobs and jobs that are actively in progress
        if (job.assignedCourier) {
            return false; // Has a courier, not unassigned
        }

        // Exclude completed/delivered jobs
        if (this.isDelivered(job)) {
            return false;
        }

        // Exclude jobs that are actively in progress (should have a courier)
        const activeStatuses = [
            JobStatus.Dispatched,
            JobStatus.Accepted,
            JobStatus.PickedUp,
            JobStatus.InTransit
        ];
        if (activeStatuses.includes(job.statusId || JobStatus.New)) {
            return false;
        }

        // Include: New jobs, Warning jobs, and other issue jobs without courier
        return true;
    }

    hasIssues(job: IDispatchJob): boolean {
        return [
            JobStatus.Rejected,
            JobStatus.LatePickup,
            JobStatus.Warning,
            JobStatus.LateDelivery,
            JobStatus.Undeliverable
        ].includes(job.statusId || JobStatus.New);
    }

    getJobPriorityClass(job: IDispatchJob): string {
        if (this.isUrgent(job)) return 'urgent';
        if (this.isWarning(job)) return 'warning';
        if (this.needsDispatch(job)) return 'needs-dispatch';
        if (this.hasRelatedJobs(job)) return 'related-job';
        if (job.parentId) return 'parent-job';
        if (job.parentId && job.id !== job.parentId) return 'child-job';
        return 'normal';
    }

    formatDeliveryTime(job: IDispatchJob): string {
        return formatMins(job.booked);
    }

    formatDate(dateTime: Date | undefined): string {
        if (dateTime === undefined) return '';

        const date = dayjs(dateTime);
        const now = dayjs();

        if (date.isSame(now, 'day')) {
            return 'Today ' + formatMins(date);
        } else if (date.isSame(now.subtract(1, 'day'), 'day')) {
            return 'Yesterday ' + formatMins(date);
        } else {
            return formatLongDateTime(date);
        }
    }

    async selectJob(job: IDispatchJob, event?: MouseEvent): Promise<void> {
        // Mark job as read when clicked
        if (!job.hasBeenRead) {
            job.hasBeenRead = true;
            // Update backend asynchronously without blocking UI
            this.DispatchData.bulkUpdateReadStatus([job.id], true).catch(error => {
                console.error('Error updating read status:', error);
                // Revert on error
                job.hasBeenRead = false;
            });
        }

        if (event && (event.ctrlKey || event.metaKey)) {
            if (this.selectedJobs.length === 0 && this.selectedJob && !this.selectedJob.selected) {
                this.selectedJob.selected = true;
                this.selectedJobs.push(this.selectedJob);
            }

            job.selected = !job.selected;
            this.toggleJobSelection(job);

            if (job.selected) {
                this.selectedJob = job;
                this.jobHighlightService.updateHighlightedRelatedJobs(job);
                if (this.onJobSelect) {
                    await this.onJobSelect({job});
                }
            }
            return;
        }

        if (event && event.shiftKey && this.selectedJob) {
            // If we don't have any selected jobs yet, add the current selection to multiselect first
            if (this.selectedJobs.length === 0 && !this.selectedJob.selected) {
                this.selectedJob.selected = true;
                this.selectedJobs.push(this.selectedJob);
            }

            await this.selectJobRange(this.selectedJob, job);
            return;
        }

        this.clearSelection();

        this.selectedJob = job;

        this.jobHighlightService.updateHighlightedRelatedJobs(job);

        if (this.onJobSelect) {
            await this.onJobSelect({job});
        }
    }

    showCourierAssignment(job: IDispatchJob) {
        if (!this.allowDispatch) return;
        job.showCourierSearch = true;

        this.registerTimeout(() => {
            const inputField = angular.element(`input[name="courierSearch_${job.id}"]`);
            if (inputField.length > 0) {
                const element = inputField[0] as HTMLInputElement;
                element.focus();
                element.select();
            }
        });
    }

    hideCourierAssignment(job: IDispatchJob) {
        // Only hide if no courier was selected
        if (!job.assignedCourier) {
            job.showCourierSearch = false;
            job.searchText = ''; // Clear search text
        }
    }

    async handleKeyDown($event: KeyboardEvent, job: IDispatchJob): Promise<void> {
        if ($event.key === 'Enter') {
            $event.preventDefault();

            // If there's a highlighted item in the dropdown, select it
            const highlightedItem = angular.element('md-autocomplete .md-autocomplete-suggestion.selected');
            if (highlightedItem.length > 0) {
                // The md-autocomplete will handle this automatically
                return;
            }

            // If no item is highlighted but there are search results, select the first one
            // (performCourierSearch already filters for exact matches when numeric code is entered)
            if (job.searchText) {
                try {
                    const results = await this.performCourierSearch(job.searchText, job);
                    if (results && results.length > 0) {
                        await this.handleDispatchSelection(results[0], job);

                        // Clear the search text and close the dropdown
                        this.hideCourierAssignment(job);
                    }
                } catch (error) {
                    console.error('Error performing courier search:', error);
                    // Handle error appropriately - maybe show a toast or log
                }
            }
        }
    }

    async handleDispatchSelection(selectedCourier: ISuggestion, job: IDispatchJob) {
        if (!selectedCourier || !selectedCourier.id) return;

        try {
            if (this.onJobDispatch) {
                await this.onJobDispatch({job, courierId: selectedCourier.id});
            }

            job.assignedCourier = selectedCourier;
            job.showCourierSearch = false;
            if (job.searchText !== undefined) {
                job.searchText = '';
            }
        } catch (error) {
            console.error("Error in dispatch:", error);
            job.assignedCourier = undefined;
        }
    }

    getJobContextMenuOptions(job: IDispatchJob) {
        if (this.getContextMenuOptions) {
            return this.getContextMenuOptions({job});
        }

        return [];
    }

    // Delegated action methods
    getDisplayedJobsText(): string {
        const displayed = this.filteredJobs?.length || 0;
        const multiPart = this.filteredJobs?.filter(j => this.isMultiPartJob(j)).length || 0;
        if (this.enableVirtualScrolling) {
            if (this.isLoadingMore) {
                return `Loading more jobs...`;
            }
            if (!this.allJobsLoaded) {
                return `Showing ${displayed} of ${this.totalJobsCount} jobs (${multiPart} parent jobs with children) - Scroll for more`;
            }
            // All jobs loaded - show the total count from backend
            return `Showing ${this.totalJobsCount} jobs (${multiPart} parent jobs with children)`;
        }
        return `Showing ${displayed} jobs (${multiPart} parent jobs with children)`;
    }

    getLastUpdatedText(): string {
        return `Last updated: ${dayjs().format('h:mm A')}`;
    }

    async performCourierSearch(searchText: string, job?: IDispatchJob): Promise<ISuggestion[]> {
        if (!searchText) return [];

        try {
            // Check if this is a DG job
            const isDgJob = job && job.dgClass !== null && job.dgClass !== undefined && job.dgClass > 0;

            // Add dgOnly parameter if it's a DG job
            const url = isDgJob
                ? `${this.COURIER_URL}?dgOnly=true`
                : this.COURIER_URL;

            const results = await this.DispatchData.autocompleteSearch(searchText, url);

            // If the search text is purely numeric (courier code), filter for exact matches only
            const trimmedSearch = searchText.trim();
            if (/^\d+$/.test(trimmedSearch)) {
                // Filter results to only show exact courier code matches
                const exactMatches = results.filter(r => {
                    if (!r.text) return false;
                    // Extract the courier code (before space or parenthesis)
                    const courierCode = r.text.split(/[\s(]/)[0];
                    return courierCode === trimmedSearch;
                });

                // Return exact matches if found, otherwise return all results
                return exactMatches.length > 0 ? exactMatches : results;
            }

            return results;
        } catch (error: any) {
            console.error("Error in courier search:", error.message);
            return [];
        }
    }

    hasRelatedJobs(job: IDispatchJob): boolean {
        return this.jobHighlightService.isJobHighlighted(job.id);
    }

    isWarning(job: IDispatchJob): boolean {
        return [
            JobStatus.Warning,
            JobStatus.LatePickup
        ].includes(job.statusId || JobStatus.New);
    }

    getFlightIcon(job: IDispatchJob): string {
        const jobNumber = job.jobNo;
        if (!jobNumber) return '';

        const lastChar = jobNumber.toString().slice(-1);

        switch (lastChar) {
            case '1':
                return 'flight_takeoff';
            case '2':
                return 'local_airport';
            case '3':
                return 'flight_land';
            default:
                return 'question_mark';
        }
    }

    shouldShowPriorityColumn(job: IDispatchJob): boolean {
        return !!(job.toAirportId || job.fromAirportId);
    }

    private loadColumnWidths(): void {
        if (Modernizr.localstorage) {
            const saved = localStorage.getItem(`${this.COLUMN_WIDTHS_SAVE_KEY}_${this.jobListType}`);
            if (saved) {
                try {
                    const savedWidths = JSON.parse(saved);
                    this.columnWidths = {...this.defaultColumnWidths, ...savedWidths};
                } catch (error) {
                    console.error('Error loading column widths:', error);
                }
            }
        }
    }

    private saveColumnWidths(): void {
        if (Modernizr.localstorage) {
            localStorage.setItem(`${this.COLUMN_WIDTHS_SAVE_KEY}_${this.jobListType}`, JSON.stringify(this.columnWidths));
        }
    }

    private loadSortState(): void {
        if (Modernizr.localstorage) {
            const saved = localStorage.getItem(`${this.SORT_STATE_SAVE_KEY}_${this.jobListType}`);
            if (saved) {
                try {
                    const savedSort = JSON.parse(saved);
                    this.sortState = {...this.sortState, ...savedSort};
                } catch (error) {
                    console.error('Error loading sort state:', error);
                }
            }
        }
    }

    private saveSortState(): void {
        if (Modernizr.localstorage) {
            localStorage.setItem(`${this.SORT_STATE_SAVE_KEY}_${this.jobListType}`, JSON.stringify(this.sortState));
        }
    }

    getGridTemplateColumns(): string {
        if (this.isJobSearchPage()) {
            if (this.isUsCustomer) {
                return `${this.columnWidths.priority}px ${this.columnWidths.date}px ${this.columnWidths.time}px ${this.columnWidths.speed}px ${this.columnWidths.isArchived}px ${this.columnWidths.vehicle}px ${this.columnWidths.jobNo}px ${this.columnWidths.pickup}px ${this.columnWidths.delivery}px ${this.columnWidths.courier}px ${this.columnWidths.remaining}px ${this.columnWidths.status}px`;
            }
            return `${this.columnWidths.priority}px ${this.columnWidths.date}px ${this.columnWidths.time}px ${this.columnWidths.speed}px ${this.columnWidths.isArchived}px ${this.columnWidths.vehicle}px ${this.columnWidths.jobNo}px ${this.columnWidths.client}px ${this.columnWidths.pickup}px ${this.columnWidths.delivery}px ${this.columnWidths.courier}px ${this.columnWidths.remaining}px ${this.columnWidths.status}px`;
        }

        if (this.isUsCustomer) {
            return `${this.columnWidths.priority}px ${this.columnWidths.date}px ${this.columnWidths.time}px ${this.columnWidths.speed}px ${this.columnWidths.vehicle}px ${this.columnWidths.jobNo}px ${this.columnWidths.pickup}px ${this.columnWidths.delivery}px ${this.columnWidths.courier}px ${this.columnWidths.remaining}px ${this.columnWidths.status}px`;
        }
        return `${this.columnWidths.priority}px ${this.columnWidths.date}px ${this.columnWidths.time}px ${this.columnWidths.speed}px ${this.columnWidths.vehicle}px ${this.columnWidths.jobNo}px ${this.columnWidths.client}px ${this.columnWidths.pickup}px ${this.columnWidths.delivery}px ${this.columnWidths.courier}px ${this.columnWidths.remaining}px ${this.columnWidths.status}px`;
    }

    startResize(event: MouseEvent, column: string): void {
        event.preventDefault();
        event.stopPropagation();

        this.isResizing = true;
        this.resizingColumn = column;
        this.startX = event.clientX;
        this.startWidth = this.columnWidths[column as keyof typeof this.columnWidths];

        this.$document.on('mousemove', this.onMouseMove);
        this.$document.on('mouseup', this.onMouseUp);
        this.$document.find('body').css('cursor', 'col-resize');
        this.$document.find('body').css('userSelect', 'none');
    }

    private onMouseMove = (eventObject: JQueryEventObject): void => {
        if (!this.isResizing || !this.resizingColumn) return;

        const event = eventObject.originalEvent as MouseEvent;
        const deltaX = event.clientX - this.startX;
        this.columnWidths[this.resizingColumn as keyof typeof this.columnWidths] = Math.max(50, this.startWidth + deltaX);

        const headerElement = angular.element(`.job-list-${this.jobListType} .jobs-header`);
        if (headerElement.length) headerElement.css('grid-template-columns', this.getGridTemplateColumns());
        this.applyScope();
    };

    private onMouseUp = (): void => {
        this.isResizing = false;
        this.resizingColumn = null;

        this.$document.off('mousemove', this.onMouseMove);
        this.$document.off('mouseup', this.onMouseUp);
        this.$document.find('body').css('cursor', '');
        this.$document.find('body').css('userSelect', '');

        this.saveColumnWidths();
        this.applyScope();
    };

    resetColumnWidths(): void {
        this.columnWidths = {...this.defaultColumnWidths};
        this.saveColumnWidths();

        const headerElement = angular.element(`.job-list-${this.jobListType} .jobs-header`);
        if (headerElement.length) headerElement.css('grid-template-columns', this.getGridTemplateColumns());
        this.applyScope();
    }

    async sortBy(column: string): Promise<void> {
        if (this.sortState.column === column) {
            switch (this.sortState.direction) {
                case 'asc':
                    this.sortState.direction = 'desc';
                    break;
                case 'desc':
                    this.sortState.direction = 'asc';
                    break;
            }
        } else {
            // New column, start with ascending
            this.sortState.column = column;
            this.sortState.direction = 'asc';
        }

        this.saveSortState();

        if (this.setBackendFilter && this.totalJobsCount != (this.filteredJobs?.length || 0)) {
            await this.setBackendFilter({
                column: this.sortState.column,
                direction: this.sortState.direction ?? "desc"
            });
        }
        this.applyFilters();
    }

    getSortIcon(column: string): string {
        if (this.sortState.column !== column) {
            return 'unfold_more';
        }

        switch (this.sortState.direction) {
            case 'asc':
                return 'keyboard_arrow_up';
            case 'desc':
                return 'keyboard_arrow_down';
            default:
                return 'unfold_more';
        }
    }

    getSortClass(column: string): string {
        if (this.sortState.column !== column) return '';
        return this.sortState.direction === 'asc' ? 'sort-asc' : 'sort-desc';
    }

    private getSortValue(job: IDispatchJob, column: string): any {
        switch (column) {
            case 'date':
                // Sort by the date portion only
                return job.booked ? dayjs(job.booked).startOf('day').valueOf() : 0;
            case 'time':
                if (job.booked && job.time) {
                    const bookedDate = dayjs(job.booked);
                    const timeOnly = dayjs(job.time);

                    // Combine the date from booked with the time from time
                    const combined = bookedDate
                        .hour(timeOnly.hour())
                        .minute(timeOnly.minute())
                        .second(timeOnly.second());

                    return combined.valueOf();
                }

                // Fallback: use whichever is available
                return job.time ? dayjs(job.time).valueOf() : (job.booked ? dayjs(job.booked).valueOf() : 0);
            case 'speed':
                return job.speed || '';
            case 'vehicle':
                return job.vehicle?.text || '';
            case 'jobNo':
                return job.jobNo || '';
            case 'client':
                return job.client || '';
            case 'pickup':
                return this.getPickupAddress(job) || '';
            case 'delivery':
                return this.getDeliveryAddress(job) || '';
            case 'courier':
                return this.isUsCustomer
                    ? this.getCourierName(job)
                    : this.getCourierNumber;
            case 'remaining':
                const hasNoCourier = !this.hasAssignedCourier(job);
                const remainValue = job.remain !== undefined && job.remain !== null
                    ? job.remain
                    : Number.MAX_SAFE_INTEGER;

                if (hasNoCourier) return remainValue - 1000000;
                return remainValue;
            case 'status':
                return job.status || job.statusName || '';
            case 'isArchived':
                return job.isArchived ? 1 : 0;
            case 'priority':
                // Priority sort: urgent first, then by delivery time
                if (this.isUrgent(job)) return 0;
                if (this.hasIssues(job)) return 1;
                if (this.needsDispatch(job)) return 2;
                if (this.isActive(job)) return 3;
                if (this.isDelivered(job)) return 4;
                return 5;
            default:
                return '';
        }
    }

    private sortJobs(jobs: IDispatchJob[]): IDispatchJob[] {
        if (!this.sortState.column || !this.sortState.direction) {
            // Default sort: urgent first, then by delivery time
            return jobs.sort((a, b) => {
                const aUrgent = this.isUrgent(a);
                const bUrgent = this.isUrgent(b);

                if (aUrgent && !bUrgent) return -1;
                if (!aUrgent && bUrgent) return 1;

                const aTime = a.time ? dayjs(a.time).valueOf() : (a.booked ? dayjs(a.booked).valueOf() : 0);
                const bTime = b.time ? dayjs(b.time).valueOf() : (b.booked ? dayjs(b.booked).valueOf() : 0);

                return aTime - bTime;
            });
        }

        return jobs.sort((a, b) => {
            const aValue = this.getSortValue(a, this.sortState.column!);
            const bValue = this.getSortValue(b, this.sortState.column!);

            let comparison: number;

            if (typeof aValue === 'string' && typeof bValue === 'string') {
                comparison = aValue.localeCompare(bValue);
            } else if (typeof aValue === 'number' && typeof bValue === 'number') {
                comparison = aValue - bValue;
            } else {
                // Handle mixed types or other cases
                comparison = String(aValue).localeCompare(String(bValue));
            }

            return this.sortState.direction === 'desc' ? -comparison : comparison;
        });
    }

    private ensureHeaderSticky(): void {
        this.registerTimeout(() => {
            const headerElement = angular.element('.jobs-header');

            if (headerElement.length) {
                headerElement.css('position', 'sticky');
                headerElement.css('z-index', '49');
                headerElement.css('background', 'white');

                headerElement.css('grid-template-columns', this.getGridTemplateColumns());
            }
        }, 100);
    }

    toggleJobSelection(job: IDispatchJob): void {
        if (job.selected) {
            if (this.selectedJobs.indexOf(job) === -1) {
                this.selectedJobs.push(job);
            }
        } else {
            const index = this.selectedJobs.indexOf(job);
            if (index > -1) {
                this.selectedJobs.splice(index, 1);
            }
        }
        this.updateSelectAllState();
    }

    clearSelection(): void {
        this.selectedJobs.forEach(job => {
            job.selected = false;
        });
        this.selectedJobs = [];
        this.selectAllState = false;
    }

    updateSelectAllState(): void {
        const visibleJobs = this.getVisibleJobs();
        const selectedVisibleJobs = visibleJobs.filter(job => job.selected);

        if (selectedVisibleJobs.length === 0) {
            this.selectAllState = false;
        } else this.selectAllState = selectedVisibleJobs.length === visibleJobs.length;
    }

    getVisibleJobs(): IDispatchJob[] {
        let visibleJobs: IDispatchJob[] = [];
        this.filteredJobs?.forEach(job => {
            visibleJobs.push(job);
            if (job._isExpanded && job._groupChildren) {
                visibleJobs = visibleJobs.concat(job._groupChildren);
            }
        });
        return visibleJobs;
    }

    canBulkAssign(): boolean {
        return this.selectedJobs.length > 0 && this.allowDispatch;
    }

    canBulkRestoreStatus(): boolean {
        return this.selectedJobs.length > 0;
    }

    canBulkRedispatch(): boolean {
        return this.selectedJobs.length > 0 && this.selectedJobs.every(job => job.assignedCourier?.id);
    }

    async bulkAssignCourier($event: MouseEvent): Promise<void> {
        try {
            if (!this.canBulkAssign()) return;

            const selectedCourier = await this.autoCompleteDialogService.showAutocompleteDialog($event,
                this.COURIER_URL,
                "Search couriers...",
                "Courier",
                "Bulk Assign Courier",
                null,
                false,
                "moped_package",
                1);

            for (const job of this.selectedJobs) {
                if (this.onJobDispatch) {
                    await this.onJobDispatch({job, courierId: selectedCourier.id});
                }
            }

            this.toastrService.showSuccessToast(`${this.selectedJobs.length} jobs dispatched successfully`);
        } catch (error) {
            if (!error) return;
            console.error('Error in bulk assign:', error);
            this.toastrService.showErrorToast('Error occured while assigning courier');
        }
    }

    async bulkRestoreJobs(): Promise<void> {
        try {
            if (!this.canBulkRestoreStatus()) return;

            const selectedJobIds = this.selectedJobs.map(job => job.id);

            const confirm = this.$mdDialog.confirm()
                .title('Bulk Restore')
                .textContent(`Are you sure you want to restore ${this.selectedJobs.length} jobs?`)
                .ok('Restore Jobs')
                .cancel('Cancel');

            await this.$mdDialog.show(confirm);

            // Update
            await this.DispatchData.restoreJobs(selectedJobIds)

            if (this.onRefresh) {
                await this.onRefresh();
            }

            this.toastrService.showSuccessToast(`${selectedJobIds.length} jobs restored successfully`);
        } catch (error) {
            if (!error) return;
            console.error("Error in bulk restore:", error);
            this.toastrService.showErrorToast('Error occured while restoring jobs');
        }
    }

    async bulkRedispatch(): Promise<void> {
        try {
            if (!this.canBulkRedispatch()) {
                this.toastrService.showWarningToast('Not all jobs selected have a courier assigned for re-dispatch. Unable to re-dispatch.');
                return;
            }

            const selectedJobIds = this.selectedJobs.map(job => job.id);

            const confirm = this.$mdDialog.confirm()
                .title('Bulk Re-Dispatch')
                .textContent(`Are you sure you want to redispatch all ${this.selectedJobs.length} jobs?`)
                .ok('Re-Dispatch Jobs')
                .cancel('Cancel');

            await this.$mdDialog.show(confirm);

            // Group jobs by courier ID, filtering out jobs without assigned couriers
            const jobsByCourier = this.selectedJobs.reduce((acc, job) => {
                const courierId = job.assignedCourier?.id;
                if (courierId !== undefined) {
                    if (!acc[courierId]) {
                        acc[courierId] = [];
                    }
                    acc[courierId].push(job.id);
                }
                return acc;
            }, {} as { [courierId: number]: number[] });

            // Loop through each courier and reallocate their jobs
            for (const courierId in jobsByCourier) {
                const jobIds = jobsByCourier[courierId];
                await this.DispatchData.reAllocateJobs(Number(courierId), jobIds);
            }

            if (this.onRefresh) {
                await this.onRefresh();
            }

            this.toastrService.showSuccessToast(`${selectedJobIds.length} jobs redispatched successfully`);
        } catch (error) {
            if (!error) return;
            console.error("Error in bulk redispatch:", error);
            this.toastrService.showErrorToast('Error occurred while redispatching jobs');
        }
    }

    async bulkMarkAsRead(): Promise<void> {
        try {
            if (this.selectedJobs.length === 0) return;

            // Determine the action based on the selection
            const readJobs = this.selectedJobs.filter(job => job.hasBeenRead);
            const unreadJobs = this.selectedJobs.filter(job => !job.hasBeenRead);

            // Gmail logic: if all are read, mark as unread; otherwise mark as read
            const shouldMarkAsRead = unreadJobs.length > 0;
            const actionText = shouldMarkAsRead ? 'read' : 'unread';
            const jobsToUpdate = shouldMarkAsRead ? unreadJobs : readJobs;

            if (jobsToUpdate.length === 0) return;

            const confirm = this.$mdDialog.confirm()
                .title(`Mark as ${actionText}`)
                .textContent(`Mark ${this.selectedJobs.length} job${this.selectedJobs.length > 1 ? 's' : ''} as ${actionText}?`)
                .ok(`Mark as ${actionText}`)
                .cancel('Cancel');

            await this.$mdDialog.show(confirm);

            // Get IDs of jobs that actually need updating
            const jobIdsToUpdate = jobsToUpdate.map(job => job.id);
            await this.DispatchData.bulkUpdateReadStatus(jobIdsToUpdate, shouldMarkAsRead);

            // Update the local state for all selected jobs
            this.selectedJobs.forEach(job => {
                job.hasBeenRead = shouldMarkAsRead;
            });

            // Show a success message
            const message = `${this.selectedJobs.length} job${this.selectedJobs.length > 1 ? 's' : ''} marked as ${actionText}`;
            this.toastrService.showSuccessToast(message);

            if (this.onRefresh) {
                await this.onRefresh();
            }

            this.clearSelection();
        } catch (error) {
            if (!error) return;
            console.error("Error in bulk toggle read status:", error);
            this.toastrService.showErrorToast(`Error occurred while updating jobs read status`);
        }
    }

    async selectJobRange(startJob: IDispatchJob, endJob: IDispatchJob): Promise<void> {
        const visibleJobs = this.getVisibleJobs();
        const startIndex = visibleJobs.indexOf(startJob);
        const endIndex = visibleJobs.indexOf(endJob);

        if (startIndex === -1 || endIndex === -1) return;

        const minIndex = Math.min(startIndex, endIndex);
        const maxIndex = Math.max(startIndex, endIndex);

        // Collect unread jobs for batch update
        const unreadJobIds: number[] = [];

        // Select all jobs in the range
        for (let i = minIndex; i <= maxIndex; i++) {
            const job = visibleJobs[i];
            if (!job.selected) {
                job.selected = true;
                this.selectedJobs.push(job);
            }
            // Mark job as read
            if (!job.hasBeenRead) {
                job.hasBeenRead = true;
                unreadJobIds.push(job.id);
            }
        }

        // Update backend for all unread jobs in range
        if (unreadJobIds.length > 0) {
            this.DispatchData.bulkUpdateReadStatus(unreadJobIds, true).catch(error => {
                console.error('Error updating read status for range:', error);
                // Revert on error
                for (let i = minIndex; i <= maxIndex; i++) {
                    const job = visibleJobs[i];
                    if (unreadJobIds.includes(job.id)) {
                        job.hasBeenRead = false;
                    }
                }
            });
        }

        // Set the end job as the primary selection
        this.selectedJob = endJob;
        this.jobHighlightService.updateHighlightedRelatedJobs(endJob);

        this.updateSelectAllState();

        // Trigger the selection callback
        if (this.onJobSelect) {
            await this.onJobSelect({job: endJob});
        }
    }

    isJobSearchPage(): boolean {
        return this.jobListType === JobListType.JobSearchBulkList || this.jobListType === JobListType.JobSearchMainList;
    }

    private setupScrollListener(): void {
        // Use a single timeout to set up the listener after the initial render
        this.registerTimeout(() => {
            const selector = this.getScrollContainerSelector();
            const scrollContainer = angular.element(selector);
            console.log(`Setting up scroll listener for: ${selector}`, scrollContainer.length);

            if (scrollContainer.length) {
                scrollContainer.on('scroll', () => {
                    this.handleScroll(scrollContainer[0]);
                });
            } else {
                console.warn(`Scroll container not found: ${selector}. Will retry once.`);
                // Single retry if the container isn't ready yet
                this.registerTimeout(() => {
                    const retryContainer = angular.element(selector);
                    if (retryContainer.length) {
                        retryContainer.on('scroll', () => {
                            this.handleScroll(retryContainer[0]);
                        });
                        console.log(`Successfully set up scroll listener on retry`);
                    }
                }, 200);
            }
        }, 100);
    }

    private handleScroll(element: HTMLElement): void {
        if (!this.enableVirtualScrolling || this.isLoadingMore || this.allJobsLoaded) return;

        const scrollTop = element.scrollTop;
        const scrollHeight = element.scrollHeight;
        const clientHeight = element.clientHeight;

        if (scrollTop + clientHeight >= scrollHeight - 200) {
            this.loadMoreJobsFromBackend();
        }
    }

    private loadMoreJobsFromBackend(): void {
        if (!this.onLoadMoreJobs || this.isLoadingMore || this.allJobsLoaded) {
            return;
        }

        this.isLoadingMore = true;
        this.currentPage++;

        this.onLoadMoreJobs({
            page: this.currentPage,
            pageSize: this.DEFAULT_PAGE_SIZE
        }).then((result) => {
            if (result && result.jobs && result.jobs.length > 0) {
                // Append new jobs to the existing jobs array
                this.jobs = [...(this.jobs || []), ...result.jobs];

                this.totalJobsCount = result.totalCount;
                this.allJobsLoaded = !result.hasMore;

                this.calculateStats();
                this.applyFilters();
            } else {
                this.allJobsLoaded = true;
            }
        }).catch((error) => {
            console.error('Error loading more jobs:', error);
            this.toastrService?.showErrorToast('Failed to load more jobs');
        }).finally(() => {
            this.isLoadingMore = false;
            this.applyScope();
        });
    }

    isLoadingMoreJobs(): boolean {
        return this.isLoadingMore;
    }

    private getScrollContainerSelector(): string {
        return `.jobs-scroll-container-${this.jobListType}`;
    }
}

const JobsListComponent: angular.IComponentOptions = {
    template: require('./job-list.template.html'),
    controller: JobsListController,
    controllerAs: 'ctrl',
    bindings: {
        jobs: '<',
        selectedJob: '<',
        onJobSelect: '&',
        onJobDispatch: '&',
        onJobAction: '&',
        getContextMenuOptions: '&',
        onRefresh: '&',
        onLoadMoreJobs: '&',
        refreshInterval: '<?',
        jobListType: '<?',
        enableVirtualScrolling: '<?',
        totalJobsCount: '<?',
        onSearchChange: '&?',
        onCategoryChange: '&?',
        setBackendFilter: '&?',
        defaultCategory: '<?'
    }
};

export default JobsListComponent;