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

        // Group jobs by parent if not nationwide
        if (!this.isNationwideList()) this.groupJobs();

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

    getAbbreviatedCourierName(job: IDispatchJob): string {
        const fullName = this.getCourierName(job);
        if (!fullName) return '';

        if (this.densityMode === DensityMode.UltraDense) {
            // Show only initials in ultra-dense
            return this.getCourierInitials(job.assignedCourier?.text);
        } else if (this.densityMode === DensityMode.Dense) {
            // Show first name only in dense
            return fullName.split(' ')[0];
        }

        return fullName;
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

    getCourierName(job: IDispatchJob): string {
        return job.courierData?.courierName || job.assignedCourier?.text || '';
    }

    getCourierCode(job: IDispatchJob): string {
        return job.courierData?.courier || '';
    }

    getJobStatus(job: IDispatchJob): string {
        return job.status || job.statusName || '';
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

    getCourierInitials(textToEdit?: string): string {
        if (!textToEdit) return '?';
        return textToEdit.split(' ').map(n => n[0]).join('').toUpperCase();
    }

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
        return (this.isNationwideList() && job.relatedJobs && job.relatedJobs.length > 0) ?? false;
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
            // For non-US customers, parse the 'from' field and skip first line
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
            // For non-US customers, parse the 'toAddress' field and skip first line
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