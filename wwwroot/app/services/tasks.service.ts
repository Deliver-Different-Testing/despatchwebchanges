import {
    ExtendedTask,
    TaskTableFiltersRequest,
    TaskViewModel
} from "../components/task-dashboard/task-dashboard.interfaces";
import {ISuggestion} from "../interfaces/job.interface";
import {StatusFilter} from "../components/task-dashboard/enums/status-filter";
import {AppPages} from "../enums/app-pages.enum";
import {ContactID} from "../contants";
import DispatchCoreService from "./dispatch-core.service";
import {
    ITaskAssignStaffRequest,
    ITaskCloseRequest,
    ITaskDateRequest,
    ITaskTimeRequest
} from "../interfaces/task-request.interfaces";

interface PageFilterNames {
    staff: string;
    eventType: string;
}

class TasksService implements angular.IServiceProvider {
    static $inject = [
        "$http",
        "$log",
        'DispatchData'
    ];

    private readonly PAGE_FILTER_MAPPING: Record<AppPages, PageFilterNames> = {
        [AppPages.Dispatch]: {
            staff: `selectedSupportTypeDispatchFilter-${ContactID}`,
            eventType: `selectedSupportTypeDispatchFilter-${ContactID}`
        },
        [AppPages.Domestic]: {
            staff: `selectedSupportTypeNWFilter-${ContactID}`,
            eventType: `selectedSupportTypeNWFilter-${ContactID}`
        },
        [AppPages.Tasks]: {
            staff: `selectedSupportTypeTasksFilter-${ContactID}`,
            eventType: `selectedSupportTypeTasksFilter-${ContactID}`
        },
        [AppPages.JobSearch]: {
            staff: `selectedSupportTypeJobSearchFilter-${ContactID}`,
            eventType: `selectedSupportTypeJobSearchFilter-${ContactID}`
        },
        [AppPages.Recurring]: {
            staff: `selectedSupportTypeRecurringFilter-${ContactID}`,
            eventType: `selectedSupportTypeRecurringFilter-${ContactID}`
        },
        [AppPages.Overview]: {
            staff: `selectedSupportTypeOverviewFilter-${ContactID}`,
            eventType: `selectedSupportTypeOverviewFilter-${ContactID}`
        },
        [AppPages.MegaMap]: {
            staff: `selectedSupportTypeMegaMapFilter-${ContactID}`,
            eventType: `selectedSupportTypeMegaMapFilter-${ContactID}`
        }
    };

    private staffListCache?: ISuggestion[];
    private eventTypesListCache?: ISuggestion[];
    private staffListPromise?: Promise<ISuggestion[]>;
    private eventTypesPromise?: Promise<ISuggestion[]>;

    private loadTasksDebounced?: ReturnType<typeof setTimeout>;
    private backgroundLoadingStates: Record<AppPages, boolean> = {} as Record<AppPages, boolean>;

    private jobTaskLoadingStates: Record<string, boolean> = {};

    constructor(
        private $http: angular.IHttpService,
        private $log: angular.ILogService,
        private DispatchData: DispatchCoreService
    ) {
        this.$log.debug("Tasks service initialized");

        // Initialize background loading states for all pages
        Object.values(AppPages).forEach(page => {
            if (typeof page === 'number') {
                this.backgroundLoadingStates[page as AppPages] = false;
            }
        });
    }

    $get(): this {
        return this;
    }

    async markTaskAsClosed(eventId: number, closed: boolean): Promise<void> {
        const data: ITaskCloseRequest = {
            eventId,
            closed
        };
        
        await this.$http.post("task/MarkTaskAsClosed", data);
    }

    async updateTaskDate(eventId: number, date: string): Promise<void> {
        const data: ITaskDateRequest = {
            eventId,
            date
        };
        
        await this.$http.post("task/UpdateTaskDate", data);
    }

    async updateTaskTime(eventId: number, time: string): Promise<void> {
        const data: ITaskTimeRequest = {
            eventId,
            time
        };
        
        await this.$http.post("task/UpdateTaskTime", data);
    }

    async reassignTaskToStaff(eventId: number, staffId: number): Promise<void> {
        const data: ITaskAssignStaffRequest = {
            eventId,
            staffId
        }
        
        await this.$http.post("task/ReassignTask", data);
    }

    async getStaffList(): Promise<ISuggestion[] | undefined> {
        if (this.staffListCache) {
            return this.staffListCache;
        }

        if (this.staffListPromise) {
            return this.staffListPromise;
        }

        this.staffListPromise = this.DispatchData.getActiveStaff()
            .then((staff: ISuggestion[]) => {
                this.staffListCache = staff;
                return staff;
            })
            .catch((error: any) => {
                this.$log.error('Error loading staff list:', error);
                this.staffListPromise = undefined;
                return [];
            });

        return this.staffListPromise;
    }

    async getEventTypesList(): Promise<ISuggestion[] | undefined> {
        if (this.eventTypesListCache) {
            return this.eventTypesListCache;
        }

        if (this.eventTypesPromise) {
            return this.eventTypesPromise;
        }

        this.eventTypesPromise = this.DispatchData.getEventTypes()
            .then((eventTypes: ISuggestion[]) => {
                this.eventTypesListCache = eventTypes;
                return eventTypes;
            })
            .catch((error: any) => {
                this.$log.error('Error loading event types list:', error);
                this.eventTypesPromise = undefined;
                return [];
            });

        return this.eventTypesPromise;
    }

    async loadLists(): Promise<{ staffList: ISuggestion[] | undefined, eventTypesList: ISuggestion[] | undefined }> {
        try {
            const [staffList, eventTypesList] = await Promise.all([
                this.getStaffList(),
                this.getEventTypesList()
            ]);

            return {staffList, eventTypesList};
        } catch (error) {
            this.$log.error('Error loading lists:', error);
            return {staffList: [], eventTypesList: []};
        }
    }
    
    buildFilterRequest(
        filterType: string,
        currentJobId?: number,
        staffFilter?: string,
        eventTypeFilter?: string,
        appPage?: AppPages
    ): TaskTableFiltersRequest {
        let filters: TaskTableFiltersRequest = {};
        filters.jobId = currentJobId;
        filters.showCompleted = false;

        if (staffFilter && staffFilter !== StatusFilter.All) {
            filters.staffId = parseInt(staffFilter, 10);
        }

        if (eventTypeFilter && eventTypeFilter !== StatusFilter.All) {
            filters.eventTypeId = parseInt(eventTypeFilter, 10);
        }

        // Add page context for potential future use
        if (appPage) {
            // This could be used for page-specific filtering logic if needed
            this.$log.debug(`Building filter request for page: ${AppPages[appPage]}`);
        }

        switch (filterType) {
            case 'mine':
                filters.staffId = ContactID;
                filters.orderBy = 'assignedTo';
                filters.orderDirection = 'desc';
                break;
            case 'unassigned':
                filters.staffId = -1;
                filters.orderBy = 'assignedTo';
                filters.orderDirection = 'desc';
                break;
            case 'newest':
                filters.orderBy = 'created';
                filters.orderDirection = 'desc';
                break;
            case 'oldest':
                filters.orderBy = 'created';
                filters.orderDirection = 'asc';
                break;
            default:
                filters.orderBy = 'created';
                filters.orderDirection = 'desc';
                break;
        }

        return filters;
    }

    async loadTasks(
        filterRequest: TaskTableFiltersRequest,
        onProgress?: (loading: boolean) => void,
        onError?: (error: any) => void
    ): Promise<ExtendedTask[]> {
        try {
            if (onProgress) onProgress(true);

            const tasks = await this.DispatchData.getAllTasks(filterRequest);

            if (onProgress) onProgress(false);
            return tasks || [];
        } catch (error) {
            this.$log.error("Error loading tasks:", error);
            if (onError) onError(error);
            if (onProgress) onProgress(false);
            return [];
        }
    }

    loadTasksInBackground(
        filterRequest: TaskTableFiltersRequest,
        callback: (tasks: ExtendedTask[], error?: any) => void,
        appPage: AppPages = AppPages.Dispatch,
        jobId?: number 
    ): void {
        const loadingKey = `${appPage}-${jobId || 'all'}`;

        // Cancel previous loading for this job if still in progress
        if (this.jobTaskLoadingStates[loadingKey]) {
            this.$log.debug(`Cancelling previous task loading for job ${jobId} on ${AppPages[appPage]}`);
            return; // Skip this request
        }

        this.jobTaskLoadingStates[loadingKey] = true;

        setTimeout(async () => {
            try {
                // Check if this loading is still relevant
                if (!this.jobTaskLoadingStates[loadingKey]) {
                    this.$log.debug(`Task loading cancelled for job ${jobId}`);
                    return;
                }

                const tasks = await this.DispatchData.getAllTasks(filterRequest);

                // Only callback if still relevant
                if (this.jobTaskLoadingStates[loadingKey]) {
                    callback(tasks || []);
                }
            } catch (error) {
                if (this.jobTaskLoadingStates[loadingKey]) {
                    this.$log.error(`Error loading tasks for job ${jobId}:`, error);
                    callback([], error);
                }
            } finally {
                delete this.jobTaskLoadingStates[loadingKey];
            }
        }, 0);
    }

    cancelJobTaskLoading(appPage: AppPages, jobId?: number): void {
        const loadingKey = `${appPage}-${jobId || 'all'}`;
        if (this.jobTaskLoadingStates[loadingKey]) {
            this.$log.debug(`Manually cancelling task loading for job ${jobId}`);
            this.jobTaskLoadingStates[loadingKey] = false;
        }
    }

    getTasksStatusCount(tasks: ExtendedTask[], statusType: string): number {
        if (!tasks || !Array.isArray(tasks)) return 0;

        switch (statusType) {
            case 'mine':
                return tasks.filter(task => task.assignee?.id === ContactID).length;
            case 'unassigned':
                return tasks.filter(task => !task.assignee?.id).length;
            case 'newest':
            case 'oldest':
                return tasks.length;
            default:
                return tasks.length;
        }
    }

    getSavedStaffFilter(appPage: AppPages): string {
        if (!Modernizr.localstorage) return StatusFilter.All;

        const filterName = this.PAGE_FILTER_MAPPING[appPage]?.staff;
        if (!filterName) {
            console.warn(`No staff filter mapping found for page: ${AppPages[appPage]}`);
            return StatusFilter.All;
        }

        return localStorage.getItem(filterName) ?? StatusFilter.All;
    }

    getSavedEventTypeFilter(appPage: AppPages): string {
        if (!Modernizr.localstorage) return StatusFilter.All;

        const filterName = this.PAGE_FILTER_MAPPING[appPage]?.eventType;
        if (!filterName) {
            console.warn(`No event type filter mapping found for page: ${AppPages[appPage]}`);
            return StatusFilter.All;
        }

        return localStorage.getItem(filterName) ?? StatusFilter.All;
    }

    saveStaffFilter(filter: string, appPage: AppPages): void {
        if (!Modernizr.localstorage) return;

        const filterName = this.PAGE_FILTER_MAPPING[appPage]?.staff;
        if (!filterName) {
            console.warn(`No staff filter mapping found for page: ${AppPages[appPage]}`);
            return;
        }

        localStorage.setItem(filterName, filter);
    }

    saveEventTypeFilter(filter: string, appPage: AppPages): void {
        if (!Modernizr.localstorage) return;

        const filterName = this.PAGE_FILTER_MAPPING[appPage]?.eventType;
        if (!filterName) {
            console.warn(`No event type filter mapping found for page: ${AppPages[appPage]}`);
            return;
        }

        localStorage.setItem(filterName, filter);
    }

    initializePageFilters(appPage: AppPages): { staffFilter: string, eventTypeFilter: string } {
        return {
            staffFilter: this.getSavedStaffFilter(appPage),
            eventTypeFilter: this.getSavedEventTypeFilter(appPage)
        };
    }

    getActiveFilterNames(
        staffFilter: string,
        eventTypeFilter: string,
        staffList?: ISuggestion[],
        eventTypesList?: ISuggestion[]
    ): string {
        if (staffFilter === StatusFilter.All && eventTypeFilter === StatusFilter.All) {
            return ' - (All Tasks)';
        }

        const staffText = staffList?.find(s => s.id?.toString() === staffFilter)?.text ?? '';
        const eventTypeText = eventTypesList?.find(et => et.id?.toString() === eventTypeFilter)?.text ?? '';

        const filters = [staffText, eventTypeText].filter(Boolean).join(', ');

        return `- (${filters})`;
    }

    findTaskJobInLists(
        taskJobId: number,
        jobLists: { list: any[], name: string }[]
    ): any | undefined {
        for (const {list} of jobLists) {
            if (list) {
                const job = list.find(job => job.id === taskJobId);
                if (job) return job;
            }
        }
        return undefined;
    }
    
    validateTaskJobId(task: TaskViewModel, onWarning: (message: string) => void): boolean {
        const hasJobId = !!task.jobId;
        if (!hasJobId) {
            const message = "This task has no job attached";
            onWarning(message);
            console.warn('[TaskService] No jobId provided for task:', task.id);
        }
        return hasJobId;
    }

    loadTasksWithDebounce(
        filterRequest: TaskTableFiltersRequest,
        callback: (tasks: ExtendedTask[], error?: any) => void,
        delay: number = 300
    ): void {
        if (this.loadTasksDebounced) {
            clearTimeout(this.loadTasksDebounced);
        }

        this.loadTasksDebounced = setTimeout(async () => {
            try {
                const tasks = await this.DispatchData.getAllTasks(filterRequest);
                callback(tasks || []);
            } catch (error) {
                this.$log.error("Error loading tasks with debounce:", error);
                callback([], error);
            }
        }, delay);
    }
}

export default TasksService;