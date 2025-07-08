import "./job-list.styles.less";
import {AddressViewModel, AssignedFlight, IDispatchJob, Suggestion} from "../../../interfaces/job.interface";
import BaseController from "../../base-controller";
import dayjs from "dayjs";
import JobCategory from "./enums/jobCategory";
import DensityMode from "./enums/densityMode";
import {JobStatus} from "../../../enums/job-status.enum";
import {ContactID, TimeZone} from "../../../contants";
import {AppConfig} from "../../../interfaces/app-config.interface";
import DispatchCoreService from "../../../services/dispatch-core.service";
import JobListType from "./enums/jobListType";
import JobHighlightService from "./job-highlight.service";

class JobsListController extends BaseController {
    private readonly DENSE_MODE_SAVE_KEY: string = `jobListComponentDenseViewMode_${ContactID}`;

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

    static $inject = [
        'DispatchData',
        'jobHighlightService',
        'APP_CONFIG',
        '$timeout',
        '$interval',
        '$scope',
    ];

    private unsubscribeFromHighlights?: () => void;

    constructor(
        private DispatchData: DispatchCoreService,
        private jobHighlightService: JobHighlightService,
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
    }
    
    $onDestroy() {
        super.$onDestroy();

        if (this.unsubscribeFromHighlights) {
            this.unsubscribeFromHighlights();
        }
    }

    private setupJobListVariables() {
        switch (this.jobListType) {
            case JobListType.DispatchJobList:
                this.allowDispatch = true;
                this.allowSearch = true;
                this.densityMode = DensityMode.Normal;
                break;
            case JobListType.CurrentWorkList:
                this.allowDispatch = false;
                this.allowSearch = false;
                this.densityMode = DensityMode.Dense;
                break;
            case JobListType.NationwideJobList:
            case JobListType.NationwidePodJobList:
            case JobListType.NationwideRepriceJobList:
                this.allowDispatch = false;
                this.allowSearch = true;
                this.densityMode = DensityMode.Dense;
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

    filterByCategory(category: JobCategory) {
        this.selectedCategory = category;
        this.applyFilters();
    }

    searchJobs(query: string) {
        this.searchQuery = query.toLowerCase();
        this.applyFilters();
    }

    setDensityMode(mode: DensityMode) {
        this.densityMode = mode;

        // Save to local storage
        if (Modernizr.localstorage) {
            localStorage.setItem(`${this.DENSE_MODE_SAVE_KEY}_${this.jobListType}`, mode);
        }

        // Apply CSS class to component root
        this.registerTimeout(() => {
            const componentElement = document.querySelector('.job-list-component');
            if (componentElement) {
                // Remove existing density classes
                componentElement.classList.remove('normal', 'dense', 'ultra-dense');

                // Add a new density class
                switch (mode) {
                    case DensityMode.Dense:
                        componentElement.classList.add('dense');
                        break;
                    case DensityMode.UltraDense:
                        componentElement.classList.add('ultra-dense');
                        break;
                    default:
                        componentElement.classList.add('normal');
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

    getRowHeight(): number {
        switch (this.densityMode) {
            case DensityMode.Dense:
                return 32;
            case DensityMode.UltraDense:
                return 24;
            default:
                return 48;
        }
    }

    getFontSize(): string {
        switch (this.densityMode) {
            case DensityMode.Dense:
                return '11px';
            case DensityMode.UltraDense:
                return '10px';
            default:
                return '12px';
        }
    }

    shouldShowFullDetails(): boolean {
        return this.densityMode === DensityMode.Normal;
    }

    shouldShowAbbreviatedDetails(): boolean {
        return this.densityMode === DensityMode.Dense;
    }

    shouldShowMinimalDetails(): boolean {
        return this.densityMode === DensityMode.UltraDense;
    }

    getAbbreviatedAddress(address: string): string {
        if (!address) return '';

        // Truncate long addresses based on density mode
        const maxLength = this.densityMode === DensityMode.UltraDense ? 15 : 25;

        if (address.length <= maxLength) {
            return address;
        }

        return address.substring(0, maxLength - 3) + '...';
    }

    getAbbreviatedJobNumber(jobNo: string): string {
        if (!jobNo || this.densityMode !== DensityMode.UltraDense) {
            return jobNo;
        }

        // Show only the last 6 characters for ultra-dense
        return jobNo.length > 6 ? '...' + jobNo.slice(-6) : jobNo;
    }
    
    formatDeliveryDate(job: IDispatchJob): string {
        if (!job.time && !job.booked) return '';

        const date = dayjs(job.time || job.booked);
        const now = dayjs();

        if (date.isSame(now, 'day')) {
            return date.format('MM/DD');
        } else if (date.isSame(now.subtract(1, 'day'), 'day')) {
            return date.format('MM/DD');
        } else {
            return date.format('MM/DD');
        }
    }

    isOverdue(job: IDispatchJob): boolean {
        const now = dayjs();
        const deliveryTime = dayjs(job.time || job.booked);
        return deliveryTime.isBefore(now);
    }

    getPickupAddress(job: IDispatchJob): string {
        if (this.densityMode === DensityMode.Dense || this.densityMode === DensityMode.UltraDense) {
            if (job.pickupAddress?.addressLine5) {
                return job.pickupAddress.addressLine5 + ', ' + job.pickupAddress.addressLine6;
            }

            const fromLines = (job.from || '').split(',');
            return fromLines[0]?.trim() || '';
        }

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
        // In dense and ultra-dense modes, show only city/state
        if (this.densityMode === DensityMode.Dense || this.densityMode === DensityMode.UltraDense) {
            if (job.deliveryAddress?.addressLine5) {
                return job.deliveryAddress.addressLine5 + ', ' + job.deliveryAddress.addressLine6;
            }

            const toLines = (job.toAddress || '').split(',');
            return toLines[0]?.trim() || '';
        }

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

        // Sort by delivery time (urgent first)
        filtered.sort((a, b) => {
            const aUrgent = this.isUrgent(a);
            const bUrgent = this.isUrgent(b);

            if (aUrgent && !bUrgent) return -1;
            if (!aUrgent && bUrgent) return 1;

            const aTime = a.time ? dayjs(a.time).valueOf() : 0;
            const bTime = b.time ? dayjs(b.time).valueOf() : 0;

            return aTime - bTime;
        });

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

    getJobStatus(job: IDispatchJob): string {
        return job.status || job.statusName || '';
    }
    hasAssignedCourier(job: IDispatchJob): boolean {
        return !!(job.assignedCourier || job.courier);
    }

    isMultiPartJob(job: IDispatchJob): boolean {
        return (job.isParentOrSingle && job._groupChildren && job._groupChildren.length > 0) ?? false;
    }

    isChildJob(job: IDispatchJob): boolean {
        return !job.isParentOrSingle;
    }

    getChildCount(job: IDispatchJob): number {
        return job._groupChildren ? job._groupChildren.length : 0;
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
        const showFullDate = this.densityMode == DensityMode.Normal;

        if (showFullDate) {
            return this.isUsCustomer
                ? dayjs(job.booked).format('MM/DD HH:mm')
                : dayjs(job.booked).format('DD/MM HH:mm');
        } else {
            return dayjs(job.booked).format('HH:mm');
        }
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

    selectJob(job: IDispatchJob) {
        // Set the selected job
        this.selectedJob = job;

        // Update highlights through the shared service
        this.jobHighlightService.updateHighlightedRelatedJobs(job);

        if (this.onJobSelect) {
            this.onJobSelect({ job });
        }
    }

    private updateHighlightedRelatedJobs(selectedJob: IDispatchJob) {
        this.highlightedRelatedJobIds = [];

        if (!selectedJob.relatedJobs || selectedJob.relatedJobs.length === 0) {
            return;
        }

        this.highlightedRelatedJobIds = selectedJob.relatedJobs.map(relatedJob => relatedJob.id);
    }
    
    showCourierAssignment(job: IDispatchJob) {
        if (!this.allowDispatch) return;

        job.showCourierSearch = true;

        this.registerTimeout(() => {
            const inputField = document.getElementById(`input_${job.id}`) as HTMLInputElement;
            if (inputField) {
                inputField.focus();
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

    async handleDispatchSelection(selectedCourier: any, _model: any, _label: string, $event: MouseEvent, job: IDispatchJob) {
        if ($event === undefined) return;
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
        } catch (error: any) {
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
            const url = "/courier/AllActiveSearch";
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

    getPickupAddressLine2(job: IDispatchJob): string {
        let address = '';

        if (this.isUsCustomer) {
            // For US customers, get address line 2 and beyond
            const pickupAddr = job.pickupAddress;
            if (pickupAddr) {
                address = [
                    pickupAddr.addressLine2,
                    pickupAddr.addressLine3,
                    pickupAddr.addressLine4,
                    pickupAddr.addressLine5,
                    pickupAddr.addressLine6,
                    pickupAddr.addressLine7,
                    pickupAddr.addressLine8,
                    pickupAddr.our_suburb
                ].filter(line => line && line.trim()).join(', ');
            }
        } else {
            // For non-US customers, parse the 'from' field and skip the first line
            const fromLines = (job.from || '').split(',').map(line => line.trim());
            if (fromLines.length > 1) {
                address = fromLines.slice(1).join(', ');
            }
        }

        return this.densityMode === DensityMode.UltraDense ?
            this.getAbbreviatedAddress(address) : address;
    }

    getDeliveryAddressLine2(job: IDispatchJob): string {
        let address = '';

        if (this.isUsCustomer) {
            // For US customers, get address line 2 and beyond
            const deliveryAddr = job.deliveryAddress;
            if (deliveryAddr) {
                address = [
                    deliveryAddr.addressLine2,
                    deliveryAddr.addressLine3,
                    deliveryAddr.addressLine4,
                    deliveryAddr.addressLine5,
                    deliveryAddr.addressLine6,
                    deliveryAddr.addressLine7,
                    deliveryAddr.addressLine8,
                    deliveryAddr.our_suburb
                ].filter(line => line && line.trim()).join(', ');
            }
        } else {
            // For non-US customers, parse the 'toAddress' field and skip the first line
            const toLines = (job.toAddress || '').split(',').map(line => line.trim());
            if (toLines.length > 1) {
                address = toLines.slice(1).join(', ');
            }
        }

        return this.densityMode === DensityMode.UltraDense ?
            this.getAbbreviatedAddress(address) : address;
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