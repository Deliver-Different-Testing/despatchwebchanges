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

    // Expanded job IDs for accordion functionality
    expandedJobs: Set<number> = new Set();
    densityModeChanging: boolean = false;

    static $inject = [
        'DispatchData',
        'APP_CONFIG',
        '$timeout',
        '$interval',
        '$scope',
    ];

    constructor(
        private DispatchData: DispatchCoreService,
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
        this.groupJobs();
        this.calculateStats();
        this.applyFilters();
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
            this.groupJobs();
            this.calculateStats();
            this.applyFilters();
        }

        if (changes['selectedJob'] && changes['selectedJob'].currentValue) {
            this.selectedJob = changes['selectedJob'].currentValue;
        }
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
        this.densityModeChanging = true;
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

                // Add new density class
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

            // Hide loading indicator after DOM updates
            this.registerTimeout(() => {
                this.densityModeChanging = false;
            }, 100);
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

    // Determine if we should show full details based on density
    shouldShowFullDetails(): boolean {
        return this.densityMode === DensityMode.Normal;
    }

    // Determine if we should show abbreviated details
    shouldShowAbbreviatedDetails(): boolean {
        return this.densityMode === DensityMode.Dense;
    }

    // Determine if we should show minimal details
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

    getAbbreviatedCourierName(job: IDispatchJob): string {
        const fullName = this.getCourierName(job);
        if (!fullName) return '';

        if (this.densityMode === DensityMode.UltraDense) {
            // Show only initials in ultra-dense
            return this.getCourierInitials(job.assignedCourier);
        } else if (this.densityMode === DensityMode.Dense) {
            // Show first name only in dense
            return fullName.split(' ')[0];
        }

        return fullName;
    }

    getVisibleColumns(): string[] {
        switch (this.densityMode) {
            case DensityMode.UltraDense:
                return ['time', 'job', 'route', 'courier', 'status'];
            case DensityMode.Dense:
                return ['time', 'job', 'route', 'courier', 'status', 'actions'];
            default:
                return ['time', 'job', 'route', 'courier', 'status', 'actions'];
        }
    }

    isColumnVisible(column: string): boolean {
        return this.getVisibleColumns().includes(column);
    }

    getTableMaxHeight(): string {
        const baseHeight = 600;
        const rowHeight = this.getRowHeight();
        const estimatedRows = Math.floor(baseHeight / rowHeight);

        return `${estimatedRows * rowHeight}px`;
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

    // Helper methods for safe property access
    getPickupLocationName(job: IDispatchJob): string {
        const name = job.pickupContact ||
            job.pickupAddress?.addressLine1 ||
            'Pickup Location';

        return this.densityMode === DensityMode.UltraDense ?
            this.getAbbreviatedAddress(name) : name;
    }

    getDeliveryLocationName(job: IDispatchJob): string {
        const name = job.deliveryContact ||
            job.deliveryAddress?.addressLine1 ||
            'Delivery Location';

        return this.densityMode === DensityMode.UltraDense ?
            this.getAbbreviatedAddress(name) : name;
    }

    getPickupAddress(job: IDispatchJob): string {
        let address = '';
        if (this.isUsCustomer) {
            address = job.pickupAddress?.addressLine5 && job.pickupAddress?.addressLine6
                ? `${job.pickupAddress.addressLine5}, ${job.pickupAddress.addressLine6}`
                : '';
        } else {
            address = job.from || '';
        }

        return this.densityMode === DensityMode.UltraDense ?
            this.getAbbreviatedAddress(address) : address;
    }

    getDeliveryAddress(job: IDispatchJob): string {
        const address = this.isUsCustomer
            ? (job.deliveryAddress?.fullAddress || '')
            : (job.toAddress || '');

        return this.densityMode === DensityMode.UltraDense ?
            this.getAbbreviatedAddress(address) : address;
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

    getPartsCount(job: IDispatchJob): number {
        return this.getChildJobs(job.id).length;
    }

    getChildJobNotes(childJob: IDispatchJob): string {
        return childJob.childNotes || childJob.client || '';
    }

    hasAssignedCourier(job: IDispatchJob): boolean {
        return !!(job.assignedCourier || job.courier);
    }

    isMultiPartJob(job: IDispatchJob): boolean {
        return (job.isParentOrSingle && job._groupChildren && job._groupChildren.length > 0) ?? false;
    }

    getFlightIcon(jobNumber: string) {
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
                return '';
        }
    }

    isChildJob(job: IDispatchJob): boolean {
        return !job.isParentOrSingle;
    }

    getChildCount(job: IDispatchJob): number {
        return job._groupChildren ? job._groupChildren.length : 0;
    }

    hasConNote(job: IDispatchJob): boolean {
        return !!(job.conNote);
    }

    getConNote(job: IDispatchJob): string {
        return job.conNote || '';
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
        if (this.needsDispatch(job)) return 'warning';
        if (job.parentId) return 'parent-job';
        if (job.parentId && job.id !== job.parentId) return 'child-job';
        return 'normal';
    }

    getTimeRemaining(job: IDispatchJob): { text: string; class: string } {
        const now = dayjs();
        const deliveryTime = dayjs(job.time);
        const minutesUntilDelivery = deliveryTime.diff(now, 'minutes');

        if (minutesUntilDelivery <= 0) {
            return {text: 'Overdue', class: 'critical'};
        } else if (minutesUntilDelivery <= 30) {
            return {text: `${minutesUntilDelivery}min left`, class: 'critical'};
        } else if (minutesUntilDelivery <= 60) {
            return {text: `${minutesUntilDelivery}min left`, class: 'warning'};
        } else {
            const hours = Math.floor(minutesUntilDelivery / 60);
            const minutes = minutesUntilDelivery % 60;
            return {
                text: `${hours}hr${minutes > 0 ? ` ${minutes}min` : ''}`,
                class: 'good'
            };
        }
    }

    formatDeliveryTime(dateTime: Date | string): string {
        return dayjs(dateTime).format('HH:mm');
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

    getCourierInitials(courier?: Suggestion): string {
        if (!courier?.text) return '?';
        return courier.text.split(' ').map(n => n[0]).join('').toUpperCase();
    }

    getStatusChipClass(status: string): string {
        const statusLower = status?.toLowerCase() || '';
        return statusLower.replace(/\s+/g, '-');
    }

    // Accordion functionality for multipasrt jobs
    toggleJobAccordion(job: IDispatchJob) {
        if (!job.id) return;

        if (this.expandedJobs.has(job.id)) {
            this.expandedJobs.delete(job.id);
        } else {
            this.expandedJobs.add(job.id);
        }
    }

    isJobExpanded(job: IDispatchJob): boolean {
        return job.id ? this.expandedJobs.has(job.id) : false;
    }

    getChildJobs(parentJobId: number): IDispatchJob[] {
        return this.filteredJobs?.filter(job => job.parentId === parentJobId && job.id !== parentJobId) || [];
    }

    // Job selection and actions
    selectJob(job: IDispatchJob) {
        this.selectedJob = job;

        if (this.onJobSelect) {
            this.onJobSelect({job});
        }
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

    handleDispatchFieldClick(event: MouseEvent, job: IDispatchJob) {
        event.stopPropagation();

        if (job.courier || job.assignedCourier) return;

        this.registerTimeout(() => {
            const inputField = document.getElementById(`input_${job.id}`) as HTMLInputElement;
            if (inputField) {
                inputField.focus();
                inputField.select();
            }
        });
    }

    jobClass(job: IDispatchJob): string {
        let classList = ['job-row'];

        if (this.selectedJob && this.selectedJob.id === job.id) classList.push('selected');
        if (!job.hasBeenRead) classList.push('unread');
        classList.push(this.getJobPriorityClass(job));

        return classList.join(' ');
    }

    attention(job: IDispatchJob): string {
        const components = [];

        if (job.direct) components.push("DIRECT");
        if (job.size?.text) components.push(job.size.text.toUpperCase());
        if (job.return) components.push("RTN");
        if (job.childNotes && Array.isArray(job.childNotes) && job.childNotes.length > 0) components.push(job.childNotes);

        const pickupMap: { [key: number]: string } = {
            1: "R", 2: "D",
        };

        if (job.pickupFrom && job.pickupFrom in pickupMap) components.push(pickupMap[job.pickupFrom]);
        if (job.saturdayDelivery) components.push("Sat Del");

        return components.join(" ").trim();
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

    // Method for courier search callback
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

    formatCourierDisplay(model: any) {
        if (!model) return '';
        return model.text || model.label || model.name || '';
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