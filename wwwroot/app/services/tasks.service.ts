import {
    ExtendedTask,
    TaskTableFiltersRequest,
    ITask
} from "../components/task-dashboard/task-dashboard.interfaces";
import {ISuggestion} from "../interfaces/job.interface";
import {StatusFilter} from "../components/task-dashboard/enums/status-filter";
import {AppPage} from "../enums/app-pages.enum";
import {ContactID} from "../contants";
import DispatchCoreService from "./dispatch-core.service";
import {
    ITaskAssignStaffRequest,
    ITaskCloseRequest,
    ITaskDateRequest,
    ITaskTimeRequest
} from "../interfaces/task-request.interfaces";
import {Dayjs} from "dayjs";
import {formatDateForApiWithTzs} from "../functions/formatDates";
import angular from 'angular';

interface PageFilterNames {
    staff: string;
    eventType: string;
}

class TasksService implements angular.IServiceProvider {
    static $inject = [
        "$http",
        'DispatchData'
    ];

    private readonly PAGE_FILTER_MAPPING: Record<AppPage, PageFilterNames> = {
        [AppPage.Dispatch]: {
            staff: `selectedSupportTypeDispatchFilter-${ContactID}`,
            eventType: `selectedSupportTypeDispatchFilter-${ContactID}`
        },
        [AppPage.Domestic]: {
            staff: `selectedSupportTypeNWFilter-${ContactID}`,
            eventType: `selectedSupportTypeNWFilter-${ContactID}`
        },
        [AppPage.Tasks]: {
            staff: `selectedSupportTypeTasksFilter-${ContactID}`,
            eventType: `selectedSupportTypeTasksFilter-${ContactID}`
        },
        [AppPage.JobSearch]: {
            staff: `selectedSupportTypeJobSearchFilter-${ContactID}`,
            eventType: `selectedSupportTypeJobSearchFilter-${ContactID}`
        },
        [AppPage.Recurring]: {
            staff: `selectedSupportTypeRecurringFilter-${ContactID}`,
            eventType: `selectedSupportTypeRecurringFilter-${ContactID}`
        },
        [AppPage.Overview]: {
            staff: `selectedSupportTypeOverviewFilter-${ContactID}`,
            eventType: `selectedSupportTypeOverviewFilter-${ContactID}`
        },
        [AppPage.MegaMap]: {
            staff: `selectedSupportTypeMegaMapFilter-${ContactID}`,
            eventType: `selectedSupportTypeMegaMapFilter-${ContactID}`
        } ,
        [AppPage.DriverManagement]: {
            staff: `selectedSupportType-${AppPage.DriverManagement}-Filter-${ContactID}`,
            eventType: `selectedSupportType-${AppPage.DriverManagement}-Filter-${ContactID}`
        }
    };

    private staffListCache?: ISuggestion[];
    private eventTypesListCache?: ISuggestion[];
    private staffListPromise?: Promise<ISuggestion[]>;
    private eventTypesPromise?: Promise<ISuggestion[]>;
    private backgroundLoadingStates: Record<AppPage, boolean> = {} as Record<AppPage, boolean>;
    private jobTaskLoadingStates: Record<string, boolean> = {};

    constructor(
        private $http: angular.IHttpService,
        private DispatchData: DispatchCoreService
    ) {
        console.log("Tasks service initialized");

        // Initialize background loading states for all pages
        Object.values(AppPage).forEach(page => {
            if (typeof page === 'number') {
                this.backgroundLoadingStates[page as AppPage] = false;
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

    async updateTaskDate(eventId: number, date: Dayjs): Promise<void> {
        const data: ITaskDateRequest = {
            eventId,
            date: formatDateForApiWithTzs(date)
        };
        
        await this.$http.post("task/UpdateTaskDate", data);
    }

    async updateTaskTime(eventId: number, time: Dayjs): Promise<void> {
        const data: ITaskTimeRequest = {
            eventId,
            time: formatDateForApiWithTzs(time)
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
                console.error('Error loading staff list:', error);
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
                console.error('Error loading event types list:', error);
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
            console.error('Error loading lists:', error);
            return {staffList: [], eventTypesList: []};
        }
    }
    
    buildFilterRequest(
        filterType: string,
        currentJobId?: number,
        staffFilter?: string,
        eventTypeFilter?: string,
        appPage?: AppPage
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
            console.log(`Building filter request for page: ${AppPage[appPage]}`);
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
            console.error("Error loading tasks:", error);
            if (onError) onError(error);
            if (onProgress) onProgress(false);
            return [];
        }
    }

    loadTasksInBackground(
        filterRequest: TaskTableFiltersRequest,
        callback: (tasks: ExtendedTask[], error?: any) => void,
        appPage: AppPage = AppPage.Dispatch,
        jobId?: number 
    ): void {
        const loadingKey = `${appPage}-${jobId || 'all'}`;

        // Cancel previous loading for this job if still in progress
        if (this.jobTaskLoadingStates[loadingKey]) {
            console.log(`Cancelling previous task loading for job ${jobId} on ${AppPage[appPage]}`);
            return; // Skip this request
        }

        this.jobTaskLoadingStates[loadingKey] = true;

        setTimeout(async () => {
            try {
                // Check if this loading is still relevant
                if (!this.jobTaskLoadingStates[loadingKey]) {
                    console.log(`Task loading cancelled for job ${jobId}`);
                    return;
                }

                const tasks = await this.DispatchData.getAllTasks(filterRequest);

                // Only callback if still relevant
                if (this.jobTaskLoadingStates[loadingKey]) {
                    callback(tasks || []);
                }
            } catch (error) {
                if (this.jobTaskLoadingStates[loadingKey]) {
                    console.error(`Error loading tasks for job ${jobId}:`, error);
                    callback([], error);
                }
            } finally {
                delete this.jobTaskLoadingStates[loadingKey];
            }
        }, 0);
    }

    cancelJobTaskLoading(appPage: AppPage, jobId?: number): void {
        const loadingKey = `${appPage}-${jobId || 'all'}`;
        if (this.jobTaskLoadingStates[loadingKey]) {
            console.log(`Manually cancelling task loading for job ${jobId}`);
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

    getSavedStaffFilter(appPage: AppPage): string {
        if (!Modernizr.localstorage) return StatusFilter.All;

        const filterName = this.PAGE_FILTER_MAPPING[appPage]?.staff;
        if (!filterName) {
            console.warn(`No staff filter mapping found for page: ${AppPage[appPage]}`);
            return StatusFilter.All;
        }

        return localStorage.getItem(filterName) ?? StatusFilter.All;
    }

    getSavedEventTypeFilter(appPage: AppPage): string {
        if (!Modernizr.localstorage) return StatusFilter.All;

        const filterName = this.PAGE_FILTER_MAPPING[appPage]?.eventType;
        if (!filterName) {
            console.warn(`No event type filter mapping found for page: ${AppPage[appPage]}`);
            return StatusFilter.All;
        }

        return localStorage.getItem(filterName) ?? StatusFilter.All;
    }

    saveStaffFilter(filter: string, appPage: AppPage): void {
        if (!Modernizr.localstorage) return;

        const filterName = this.PAGE_FILTER_MAPPING[appPage]?.staff;
        if (!filterName) {
            console.warn(`No staff filter mapping found for page: ${AppPage[appPage]}`);
            return;
        }

        localStorage.setItem(filterName, filter);
    }

    saveEventTypeFilter(filter: string, appPage: AppPage): void {
        if (!Modernizr.localstorage) return;

        const filterName = this.PAGE_FILTER_MAPPING[appPage]?.eventType;
        if (!filterName) {
            console.log(`No event type filter mapping found for page: ${AppPage[appPage]}`);
            return;
        }

        localStorage.setItem(filterName, filter);
    }

    initializePageFilters(appPage: AppPage): { staffFilter: string, eventTypeFilter: string } {
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
    
    validateTaskJobId(task: ITask, onWarning: (message: string) => void): boolean {
        const hasJobId = !!task.jobId;
        if (!hasJobId) {
            const message = "This task has no job attached";
            onWarning(message);
            console.warn('[TaskService] No jobId provided for task:', task.id);
        }
        return hasJobId;
    }
}

export default TasksService;