import "./job-list.styles.less";
import {
    AddressViewModel,
    AssignedFlight, IBulkUpdateRequest,
    IDispatchJob,
    Suggestion
} from "../../../interfaces/job.interface";
import BaseController from "../../base-controller";
import dayjs from "dayjs";
import JobCategory from "./enums/jobCategory";
import {JobStatus} from "../../../enums/job-status.enum";
import {ContactID, TimeZone} from "../../../contants";
import {AppConfig} from "../../../interfaces/app-config.interface";
import DispatchCoreService from "../../../services/dispatch-core.service";
import JobListType from "./enums/jobListType";
import JobHighlightService from "./job-highlight.service";
import DensityMode from "../../../enums/densityMode";
import AutoCompleteDialogService from "../../dialogs/auto-complete-dialog/auto-complete-dialog.service";
import {
    FeatureInDevelopmentDialogService
} from "../../dialogs/feature-in-development-dialog/feature-in-development-dialog.service";

class JobsListController extends BaseController {
    static $inject = [
        'DispatchData',
        'jobHighlightService',
        'autoCompleteDialogService',
        'featureInDevelopmentDialogService',
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

    private unsubscribeFromHighlights?: () => void;

    // Parent-provided data
    jobs?: IDispatchJob[];
    selectedJob?: IDispatchJob;
    onJobSelect?: (data: { job: IDispatchJob }) => Promise<void>;
    onJobDispatch?: (data: { job: IDispatchJob, courierId: number }) => Promise<void>;
    onJobAction?: (data: { action: string, job: IDispatchJob, params?: any }) => Promise<void>;
    getContextMenuOptions?: (data: { job: IDispatchJob }) => any[];
    queryParams?: any;
    isUsCustomer?: boolean;
    timeZone: string = TimeZone;
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
        priority: 80,
        time: 120,
        jobNo: 100,
        pickup: 250,
        delivery: 250,
        courier: 150,
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

    constructor(
        private DispatchData: DispatchCoreService,
        private jobHighlightService: JobHighlightService,
        private autoCompleteDialogService: AutoCompleteDialogService,
        private featureInDevelopmentDialogService: FeatureInDevelopmentDialogService,
        private $document: angular.IDocumentService,
        private $mdDialog: angular.material.IDialogService,
        appConfig: AppConfig,
        $timeout: angular.ITimeoutService,
        $interval: angular.IIntervalService,
        $scope: angular.IScope
    ) {
        super();
        this.initServices($timeout, $interval, $scope);
        this.isUsCustomer = appConfig.US_Customer;
    }

    $onInit() {
        this.setupJobListVariables();
        this.loadColumnWidths();
        this.loadSortState();

        // Group jobs by parent if not nationwide
        if (!this.isNationwideList()) this.groupJobs();

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
    }

    $onDestroy() {
        super.$onDestroy();

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
        // Default all too dense
        this.densityMode = DensityMode.Dense;

        switch (this.jobListType) {
            case JobListType.DispatchJobList:
                this.allowDispatch = true;
                this.allowSearch = true;
                break;
            case JobListType.CurrentWorkList:
                this.allowDispatch = false;
                this.allowSearch = false;
                break;
            case JobListType.NationwideJobList:
            case JobListType.NationwidePodJobList:
            case JobListType.NationwideRepriceJobList:
            case JobListType.JobSearchMainList:
            case JobListType.JobSearchBulkList:
                this.allowDispatch = false;
                this.allowSearch = true;
                break;
        }

        // Use saved dense mode variable if exists
        if (Modernizr.localstorage) {
            const savedDenseMode = localStorage.getItem(`${this.DENSE_MODE_SAVE_KEY}_${this.jobListType}`);
            if (savedDenseMode) this.densityMode = savedDenseMode as DensityMode;
        }
    }

    $onChanges(changes: angular.IOnChangesObject) {
        if (changes['jobs'] && changes['jobs'].currentValue) {
            // Group jobs by parent if not nationwide
            if (!this.isNationwideList()) this.groupJobs();

            this.calculateStats();
            this.applyFilters();
            this.ensureHeaderSticky();
        }

        if (changes['selectedJob'] && changes['selectedJob'].currentValue) {
            this.selectedJob = changes['selectedJob'].currentValue;
        }
    }

    isNationwideList(): boolean {
        return this.jobListType.toLowerCase().includes('Nationwide'.toLowerCase())
    }

    private groupJobs() {
        if (!this.jobs) {
            console.log('No jobs to group');
            return;
        }

        // Group jobs by RootParentId
        const grouped: IDispatchJob[] = [];
        const childJobs: { [parentId: number]: IDispatchJob[] } = {};

        // First pass: separate parents and children
        for (let job of this.jobs) {
            if (job.isParentOrSingle) {
                // This is a parent or standalone job
                job._isExpanded = job._isExpanded || false;
                job._groupChildren = [];
                grouped.push(job);
            } else if (job.parentId) {
                // This is a child's job
                if (!childJobs[job.parentId]) {
                    childJobs[job.parentId] = [];
                }
                childJobs[job.parentId].push(job);
            }
        }

        // Second pass: attach children to parents
        for (const parentJob of grouped) {
            if (childJobs[parentJob.id]) {
                parentJob._groupChildren = childJobs[parentJob.id].sort((a, b) =>
                    (a.jobNo || '').localeCompare(b.jobNo || '')
                );
            }
        }

        // Only show parent jobs in the main list when grouped
        this.jobs = grouped;
    }

    toggleJobGroup(job: IDispatchJob) {
        if (!this.isMultiPartJob(job)) return;

        console.log('Before toggle:', {
            jobNo: job.jobNo,
            isExpanded: job._isExpanded,
            childCount: job._groupChildren?.length
        });

        job._isExpanded = !job._isExpanded;
        this.applyScope();

        console.log('After toggle:', {
            jobNo: job.jobNo,
            isExpanded: job._isExpanded,
            childCount: job._groupChildren?.length
        });
    }

    private calculateStats() {
        if (!this.jobs) return;

        this.stats = {
            total: this.jobs.length,
            urgent: this.jobs.filter(job => this.isUrgent(job)).length,
            active: this.jobs.filter(job => this.isActive(job)).length,
            transit: this.jobs.filter(job => this.isInTransit(job)).length,
            done: this.jobs.filter(job => this.isDelivered(job)).length,
            issues: this.jobs.filter(job => this.hasIssues(job)).length
        };
    }

    filterByCategory(category: JobCategory): void {
        this.selectedCategory = category;
        this.applyFilters();
        this.updateSelectAllState();
    }

    searchJobs(query: string): void {
        this.searchQuery = query.toLowerCase();
        this.applyFilters();
        this.updateSelectAllState();
    }

    setDensityMode(mode: DensityMode) {
        this.densityMode = mode;

        // Save to local storage
        if (Modernizr.localstorage) {
            localStorage.setItem(`${this.DENSE_MODE_SAVE_KEY}_${this.jobListType}`, mode);
        }

        // Apply CSS class to component root
        this.registerTimeout(() => {
            const componentElement = angular.element('.job-list-component');
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

    formatDeliveryDate(job: IDispatchJob): string {
        if (!job.booked) return '';

        if (this.isUsCustomer) return dayjs(job.booked).format('MM/DD');
        return dayjs(job.booked).format('DD/MM');
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
        return fromLines.slice(1).join(', ');
    }

    getPickupCityState(job: IDispatchJob): string {
        // In dense and ultra-dense modes, show secondary address info
        if (this.densityMode === DensityMode.Dense || this.densityMode === DensityMode.UltraDense) {
            if (job.pickupAddress) {
                const addr = job.pickupAddress;
                const parts = [addr.addressLine2, addr.our_suburb, addr.addressLine3].filter(Boolean);
                return parts.join(', ');
            }

            const fromLines = (job.from || '').split(',').map(line => line.trim());
            return fromLines.slice(1).join(', ');
        }

        // In normal mode, show the primary address line
        if (job.pickupAddress?.addressLine1) {
            return job.pickupAddress.addressLine1;
        }

        const fromLines = (job.from || '').split(',');
        return fromLines[0]?.trim() || '';
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
                addr.addressLine6,
                addr.addressLine7,
                addr.addressLine8
            ].filter(line => line && line.trim());

            return addressParts.join(', ');
        }

        // For non-structured addresses, parse the 'toAddress' field and start from line 2
        const toLines = (job.toAddress || '').split(',').map(line => line.trim());
        return toLines.slice(1).join(', ');
    }

    getDeliveryCityState(job: IDispatchJob): string {
        // In dense and ultra-dense modes, show secondary address info
        if (this.densityMode === DensityMode.Dense || this.densityMode === DensityMode.UltraDense) {
            if (job.deliveryAddress) {
                const addr = job.deliveryAddress;
                const parts = [addr.addressLine2, addr.our_suburb, addr.addressLine3].filter(Boolean);
                return parts.join(', ');
            }

            const toLines = (job.toAddress || '').split(',').map(line => line.trim());
            return toLines.slice(1).join(', ');
        }

        // In normal mode, show the primary address line
        if (job.deliveryAddress?.addressLine1) {
            return job.deliveryAddress.addressLine1;
        }

        const toLines = (job.toAddress || '').split(',');
        return toLines[0]?.trim() || '';
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
            case JobCategory.Urgent:
                return this.isUrgent(job);
            case JobCategory.NeedsDispatch:
                return this.needsDispatch(job);
            case JobCategory.InProgress:
                return this.isActive(job);
            case JobCategory.Issues:
                return this.hasIssues(job);
            case JobCategory.Delivered:
                return this.isDelivered(job);
            default:
                return true;
        }
    }

    private static matchesSearch(job: IDispatchJob, query: string): boolean {
        if (!query || query.trim() === '') return true;

        query = query.toLowerCase().trim();

        // Helper function to safely check if a value includes the query
        const safeIncludes = (value: any): boolean => {
            if (value === null || value === undefined) return false;
            return String(value).toLowerCase().includes(query);
        };

        // Helper function to search in address objects
        const searchAddress = (address?: AddressViewModel): boolean => {
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
                safeIncludes(address.fullAddress) ||
                safeIncludes(address.address) ||
                safeIncludes(address.our_suburb)
            );
        };

        // Helper function to search in flight information
        const searchFlight = (flight?: AssignedFlight): boolean => {
            if (!flight) return false;
            return (
                safeIncludes(flight.flightNumber) ||
                safeIncludes(flight.notes) ||
                safeIncludes(flight.departureTimeZone) ||
                safeIncludes(flight.arrivalTimeZone) ||
                flight.flightSegments?.some(segment =>
                    safeIncludes(segment.carrierFsCode) ||
                    safeIncludes(segment.flightNumber) ||
                    safeIncludes(segment.departureAirportFsCode) ||
                    safeIncludes(segment.arrivalAirportFsCode) ||
                    safeIncludes(segment.departureTerminal) ||
                    safeIncludes(segment.arrivalTerminal) ||
                    safeIncludes(segment.departureAirportName) ||
                    safeIncludes(segment.departureAirportCity) ||
                    safeIncludes(segment.departureAirportCountry) ||
                    safeIncludes(segment.arrivalAirportName) ||
                    safeIncludes(segment.arrivalAirportCity) ||
                    safeIncludes(segment.arrivalAirportCountry) ||
                    safeIncludes(segment.aircraftName) ||
                    safeIncludes(segment.aircraftType) ||
                    safeIncludes(segment.airlineName)
                ) || false
            );
        };

        return (
            // Core job information
            safeIncludes(job.jobNo) ||
            safeIncludes(job.client) ||
            safeIncludes(job.status) ||
            safeIncludes(job.statusName) ||

            // Courier information
            safeIncludes(job.courier) ||
            safeIncludes(job.assignedCourier?.text) ||
            safeIncludes(job.courierData?.courierName) ||
            safeIncludes(job.courierData?.courier) ||

            // Basic addresses
            safeIncludes(job.from) ||
            safeIncludes(job.toAddress) ||
            safeIncludes(job.pickupContact) ||
            safeIncludes(job.deliveryContact) ||

            // Detailed address objects
            searchAddress(job.pickupAddress) ||
            searchAddress(job.deliveryAddress) ||

            // Job properties
            safeIncludes(job.speed) ||
            safeIncludes(job.notify) ||
            safeIncludes(job.vehicle?.text) ||
            safeIncludes(job.size?.text) ||
            safeIncludes(job.childNotes) ||
            safeIncludes(job.conNote) ||

            // Search text and related jobs
            safeIncludes(job.searchText) ||
            job.relatedJobs?.some(relatedJob => safeIncludes(relatedJob.text)) ||

            // Agent information
            safeIncludes(job.assignedAgent?.agentName) ||

            // Flight information
            searchFlight(job.assignedFlight)
        );
    }

    getCourierName(job: IDispatchJob): string {
        return job.courierData?.courierName || job.assignedCourier?.text || '';
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

    isUrgent(job: IDispatchJob): boolean {
        const now = dayjs();
        const deliveryTime = dayjs(job.time);
        const minutesUntilDelivery = deliveryTime.diff(now, 'minutes');
        return minutesUntilDelivery <= 30 && minutesUntilDelivery > 0;
    }

    isActive(job: IDispatchJob): boolean {
        return [
            JobStatus.Dispatched,
            JobStatus.Accepted,
            JobStatus.PickedUp,
            JobStatus.InTransit
        ].includes(job.statusId || JobStatus.New);
    }

    isInTransit(job: IDispatchJob): boolean {
        return job.statusId === JobStatus.InTransit;
    }

    isDelivered(job: IDispatchJob): boolean {
        return job.statusId === JobStatus.Completed;
    }

    needsDispatch(job: IDispatchJob): boolean {
        return job.statusId === JobStatus.New && !job.assignedCourier;
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
        if (this.isNationwideList() && this.hasRelatedJobs(job)) return 'related-job';
        if (job.parentId) return 'parent-job';
        if (job.parentId && job.id !== job.parentId) return 'child-job';
        return 'normal';
    }

    formatDeliveryTime(job: IDispatchJob): string {
        return dayjs(job.booked).format('HH:mm');
    }

    formatDate(dateTime: Date | undefined): string {
        if (dateTime === undefined) return '';

        const date = dayjs(dateTime);
        const now = dayjs();

        if (date.isSame(now, 'day')) {
            return 'Today ' + date.format('HH:mm');
        } else if (date.isSame(now.subtract(1, 'day'), 'day')) {
            return 'Yesterday ' + date.format('HH:mm');
        } else {
            return date.format('MM/DD/YYYY HH:mm');
        }
    }

    selectJob(job: IDispatchJob, event?: MouseEvent): void {
        // If holding Ctrl/Cmd, toggle selection instead of single select
        if (event && (event.ctrlKey || event.metaKey)) {
            job.selected = !job.selected;
            this.toggleJobSelection(job);
            return;
        }

        // If holding Shift, select range
        if (event && event.shiftKey && this.selectedJob) {
            this.selectJobRange(this.selectedJob, job);
            return;
        }

        // Normal single selection - clear multi-selection first
        this.clearSelection();

        // Set the selected job
        this.selectedJob = job;

        // Update highlights through the shared service
        this.jobHighlightService.updateHighlightedRelatedJobs(job);

        if (this.onJobSelect) {
            this.onJobSelect({job});
        }
    }

    showCourierAssignment(job: IDispatchJob) {
        if (!this.allowDispatch) return;
        job.showCourierSearch = true;
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
            if (job.searchText) {
                try {
                    const results = await this.performCourierSearch(job.searchText);
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

    async handleDispatchSelection(selectedCourier: Suggestion, job: IDispatchJob) {
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
    async restoreJob(job: IDispatchJob) {
        if (this.onJobAction) {
            await this.onJobAction({action: 'restore', job, params: {}});
        }
    }

    async reAllocateJob(job: IDispatchJob) {
        if (this.onJobAction) {
            await this.onJobAction({action: 'reallocate', job, params: {}});
        }
    }

    async splitJob($event: MouseEvent, job: IDispatchJob) {
        if (this.onJobAction) {
            await this.onJobAction({action: 'split', job, params: {$event}});
        }
    }

    async latePickup(minsAway: number, job: IDispatchJob, obj: any) {
        if (this.onJobAction) {
            await this.onJobAction({action: 'latePickup', job, params: {minsAway, obj}});
        }
    }

    async lateDelivery(minsAway: number, job: IDispatchJob, obj: any) {
        if (this.onJobAction) {
            await this.onJobAction({action: 'lateDelivery', job, params: {minsAway, obj}});
        }
    }

    getDisplayedJobsText(): string {
        const filtered = this.filteredJobs?.length || 0;

        const multiPart = this.filteredJobs?.filter(j => this.isMultiPartJob(j)).length || 0;
        return `Showing ${filtered} jobs (${multiPart} child jobs)`;
    }

    getLastUpdatedText(): string {
        return `Last updated: ${dayjs().format('h:mm A')}`;
    }

    async performCourierSearch(searchText: string): Promise<Suggestion[]> {
        if (!searchText || searchText.length < 2) return [];

        try {
            const url = this.COURIER_URL;
            return this.DispatchData.autocompleteSearch(searchText, url);
        } catch (error: any) {
            console.error("Error in courier search:", error.message);
            return [];
        }
    }

    hasRelatedJobs(job: IDispatchJob): boolean {
        if (!this.isNationwideList()) {
            return false;
        }

        return this.jobHighlightService.isJobHighlighted(job.id);
    }

    getRelatedJobsCount(job: IDispatchJob): number {
        return job.relatedJobs ? job.relatedJobs.length : 0;
    }

    getRelatedJobsText(job: IDispatchJob): string {
        if (!job.relatedJobs || job.relatedJobs.length === 0) return '';

        if (job.relatedJobs.length === 1) {
            return job.relatedJobs[0].text;
        } else {
            return `${job.relatedJobs.length} related jobs`;
        }
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
        return (this.isMultiPartJob(job) && !!job.isParentOrSingle) ||
            (!!job.fromAirportId || !!job.toAirportId);
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
        return `${this.columnWidths.priority}px ${this.columnWidths.time}px ${this.columnWidths.jobNo}px ${this.columnWidths.pickup}px ${this.columnWidths.delivery}px ${this.columnWidths.courier}px ${this.columnWidths.status}px`;
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
        // Minimum width of 50 px
        this.columnWidths[this.resizingColumn as keyof typeof this.columnWidths] = Math.max(50, this.startWidth + deltaX);
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
        this.applyScope();
    }

    sortBy(column: string): void {
        if (this.sortState.column === column) {
            // Toggle direction: asc -> desc -> none -> asc
            if (this.sortState.direction === 'asc') {
                this.sortState.direction = 'desc';
            } else if (this.sortState.direction === 'desc') {
                this.sortState.column = null;
                this.sortState.direction = null;
            }
        } else {
            // New column, start with ascending
            this.sortState.column = column;
            this.sortState.direction = 'asc';
        }

        this.saveSortState();
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
            case 'time':
                return job.time ? dayjs(job.time).valueOf() : (job.booked ? dayjs(job.booked).valueOf() : 0);
            case 'jobNo':
                return job.jobNo || '';
            case 'pickup':
                return this.getPickupAddress(job) || '';
            case 'delivery':
                return this.getDeliveryAddress(job) || '';
            case 'courier':
                return this.getCourierName(job) || '';
            case 'status':
                return job.status || job.statusName || '';
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
                // Force recalculation of sticky positioning
                headerElement.css('position', 'relative');
                headerElement.css('position', 'sticky');
                headerElement.css('z-index', '49');
                headerElement.css('background', 'white');

                // Force grid template columns to be applied
                headerElement.css('grid-template-columns', this.getGridTemplateColumns());
            }
        }, 100);
    }

    // Select all functions
    getGridTemplateColumnsWithSelect(): string {
        const selectColumnWidth = '50px';
        const existingColumns = this.getGridTemplateColumns();
        return `${selectColumnWidth} ${existingColumns}`;
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

    toggleSelectAll(): void {
        if (this.selectAllState) {
            // Select all visible jobs
            this.filteredJobs?.forEach(job => {
                job.selected = true;
                if (this.selectedJobs.indexOf(job) === -1) {
                    this.selectedJobs.push(job);
                }

                // Also select child jobs if expanded
                if (job._isExpanded && job._groupChildren) {
                    job._groupChildren.forEach(childJob => {
                        childJob.selected = true;
                        if (this.selectedJobs.indexOf(childJob) === -1) {
                            this.selectedJobs.push(childJob);
                        }
                    });
                }
            });
        } else {
            // Deselect all jobs
            this.clearSelection();
        }
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
        } else if (selectedVisibleJobs.length === visibleJobs.length) {
            this.selectAllState = true;
        } else {
            this.selectAllState = false;
        }
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

    isIndeterminate(): boolean {
        const visibleJobs = this.getVisibleJobs();
        const selectedCount = visibleJobs.filter(job => job.selected).length;

        return selectedCount > 0 && selectedCount < visibleJobs.length;
    }

    canBulkAssign(): boolean {
        return this.selectedJobs.length > 0 && this.allowDispatch;
    }

    canBulkRestoreStatus(): boolean {
        return this.selectedJobs.length > 0;
    }

    canBulkMarkAsRead(): boolean {
        return this.selectedJobs.some(job => !job.hasBeenRead);
    }

    async bulkAssignCourier($event: MouseEvent): Promise<void> {
        try {
            if (!this.canBulkAssign()) return;

            const selectedCourier = await this.autoCompleteDialogService.showAutocompleteDialog($event,
                this.COURIER_URL,
                "Search couriers...",
                "Courier",
                "Bulk Assign Courier",
                null, false);

            for (const job of this.selectedJobs) {
                if (this.onJobDispatch) {
                    await this.onJobDispatch({job, courierId: selectedCourier.id});
                }
            }
        } catch (error) {
            if(!error) return;
            console.error('Error in bulk assign:', error);
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
            
        } catch (error) {
            if(!error) return;
            console.error("Error in bulk restore:", error);
        }
    }

    async bulkMarkAsRead(): Promise<void> {
        try {
            if (!this.canBulkMarkAsRead()) return;

            const jobsToMarkAsRead = this.selectedJobs.filter(job => !job.hasBeenRead);
            const selectedJobIds = jobsToMarkAsRead.map(job => job.id);

            const confirm = this.$mdDialog.confirm()
                .title('Bulk Read/Unread')
                .textContent(`Are you sure you want to mark ${this.selectedJobs.length} jobs as read or unread?`)
                .ok('Mark As Read/Unread')
                .cancel('Cancel');

            await this.$mdDialog.show(confirm);
            
            // Update
            await this.DispatchData.bulkUpdateReadStatus(selectedJobIds);

            // Update local state
            jobsToMarkAsRead.forEach(job => {
                job.hasBeenRead = true;
            });

            this.clearSelection();
        } catch (error) {
            if(!error) return;
            console.error("Error in bulk mark as read:", error);
        }
    }

    selectJobRange(startJob: IDispatchJob, endJob: IDispatchJob): void {
        const visibleJobs = this.getVisibleJobs();
        const startIndex = visibleJobs.indexOf(startJob);
        const endIndex = visibleJobs.indexOf(endJob);

        if (startIndex === -1 || endIndex === -1) return;

        const minIndex = Math.min(startIndex, endIndex);
        const maxIndex = Math.max(startIndex, endIndex);

        for (let i = minIndex; i <= maxIndex; i++) {
            const job = visibleJobs[i];
            if (!job.selected) {
                job.selected = true;
                this.selectedJobs.push(job);
            }
        }

        this.updateSelectAllState();
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
        dispatchState: '<',
        queryParams: '<',
        refreshInterval: '<?',
        jobListType: '<?',
    }
};

export default JobsListComponent;