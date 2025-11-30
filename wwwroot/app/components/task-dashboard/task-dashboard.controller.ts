import "./task-dashboard.styles.less";
import {ExtendedTask, TaskTableFiltersRequest, ITask} from "./task-dashboard.interfaces";
import {IDispatchJob, ISuggestion} from "../../interfaces/job.interface";
import {ViewMode} from "./enums/view-mode";
import BaseController from "../base-controller";
import {ITaskListItemConfig} from "../common/task-item-component/task-item.interfaces";
import {StatusFilter} from "./enums/status-filter";
import greetUser from "../../functions/greetUser";
import dayjs, {Dayjs} from "dayjs";
import {ContactID} from "../../contants";
import DispatchCoreService from "../../services/dispatch-core.service";
import MessagingDialogService from "../dialogs/messaging-dialog/messaging-dialog.service";
import timezone from 'dayjs/plugin/timezone';
import {IDeliveryHistoryConfig} from "../common/task-history/task-history.interfaces";
import DensityMode from "../../enums/densityMode";
import {AppPage} from "../../enums/app-pages.enum";
import IDateFilterData from "../common/date-filter-menu/IDateFilterData";
import setDateFilterDefaults from "../../functions/setDateFilterDefaults";
import {formatDateForApiWithTzs} from "../../functions/formatDates";

class TaskDashboardController extends BaseController {
    static $inject = [
        "$mdSidenav",
        "$filter",
        "DispatchData",
        "messagingDialogService",
        "$timeout",
        "$interval",
        "$scope",
    ];

    private readonly DateFilterKey: string = `dateFilter-${AppPage.Tasks}-${ContactID}`;

    // Properties
    greeting: string;
    tasksLoading: boolean = true;
    isFirstLoad: boolean = true;
    dateFilterData: IDateFilterData;
    today: Dayjs;

    // View state
    showFullCalendar: boolean;

    // Filter states
    searchQuery?: string;
    staffFilter: string = StatusFilter.All;
    eventTypeFilter: string = StatusFilter.All;
    statusFilter: string = StatusFilter.All;

    // Tasks data
    tasks: ExtendedTask[] = [];
    filteredTasks: ExtendedTask[] = [];
    timeOptions: string[] = [];

    // Lists
    staffList?: ISuggestion[];
    eventTypesList?: ISuggestion[];

    // Task item configurations
    taskItemConfig: ITaskListItemConfig = {
        showJobId: true,
        showAssignee: true,
        showJobType: true,
        showDateTime: true,
        customClass: '',
        allowCompletion: true,
        showStatusIndicators: true,
        showOverdueWarning: true,
        onTaskClick: true
    };

    currentJobId?: number;
    currentSelection?: string;

    timeZone: string;
    browserTimeZone: string;

    // Task history
    selectedTask?: ExtendedTask;
    taskHistoryConfig: IDeliveryHistoryConfig = {
        showSummaryStats: true,
        densityMode: DensityMode.Normal
    };

    constructor(
        private $mdSidenav: angular.material.ISidenavService,
        private $filter: angular.IFilterService,
        private DispatchService: DispatchCoreService,
        private messagingDialogService: MessagingDialogService,
        $timeout: angular.ITimeoutService,
        $interval: angular.IIntervalService,
        $scope: angular.IScope,
    ) {
        super();
        this.initServices($timeout, $interval, $scope);
        dayjs.extend(timezone);

        // Date filter
        this.today = dayjs();
        this.dateFilterData = setDateFilterDefaults();
        this.loadDateFilterFromStorage();


        this.showFullCalendar = false;
        this.loadViewPreference();

        this.greeting = greetUser(FirstName);
        this.browserTimeZone = dayjs.tz.guess();
        this.timeZone = TimeZone;

        this.generateTimeOptions();

        this.loadLists()
            .then(() => this.getTasks())
            .catch(error => {
                console.error('Initialization error:', error);
            });

        this.watchEvent('jobChanged', (_, newJob: IDispatchJob) => {
            this.currentSelection = ` for Job ${newJob.jobNo}`;
        });
    }

    private async loadLists(): Promise<void> {
        try {
            const [staffList, eventTypesList] = await Promise.all([
                this.DispatchService.getActiveStaff(),
                this.DispatchService.getEventTypes()
            ]);

            this.staffList = staffList;
            this.eventTypesList = eventTypesList;
        } catch (error) {
            console.error('Error loading lists:', error);
            throw error;
        }
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

    private generateTimeOptions(): void {
        this.timeOptions = [];
        for (let hour = 0; hour < 24; hour++) {
            const formattedHour = hour < 10 ? `0${hour}` : `${hour}`;
            this.timeOptions.push(`${formattedHour}:00`);
            this.timeOptions.push(`${formattedHour}:30`);
        }
    }

    private async getTasks(): Promise<void> {
        if (this.isFirstLoad) {
            this.tasksLoading = true;
        }

        const filters = this.buildTaskFilters();

        try {
            const tasks = await this.DispatchService.getAllTasks(filters);

            this.registerTimeout(() => {
                this.tasks = tasks as ExtendedTask[];
                this.initializeTaskTimeStrings();
                this.applyFilters();

                this.tasksLoading = false;
                this.isFirstLoad = false;
            });
        } catch (error) {
            console.error('Error loading tasks:', error);

            this.registerTimeout(() => {
                this.tasksLoading = false;
                this.isFirstLoad = false;
            });

            throw error;
        }
    }

    private buildTaskFilters(): TaskTableFiltersRequest {
        const filters: TaskTableFiltersRequest = {};

        if (this.staffFilter && this.staffFilter !== StatusFilter.All) {
            filters.staffId = parseInt(this.staffFilter, 10);
        }

        if (this.eventTypeFilter && this.eventTypeFilter !== StatusFilter.All) {
            filters.eventTypeId = parseInt(this.eventTypeFilter, 10);
        }

        filters.showCompleted = true;

        if (this.searchQuery) {
            filters.searchText = this.searchQuery;
        }

        filters.startDate = formatDateForApiWithTzs(this.dateFilterData.startDate);
        filters.endDate = formatDateForApiWithTzs(this.dateFilterData.endDate);

        return filters;
    }

    private initializeTaskTimeStrings(): void {
        this.tasks.forEach(task => {
            try {
                if (!task.dueDate.isValid()) {
                    console.warn(`Invalid date for task "${task.title}":`, task.dueDate);
                    task.dueTimeStr = "00:00";
                    return;
                }

                const hours = task.dueDate.hour();
                const minutes = task.dueDate.minute();
                const roundedMinutes = minutes < 30 ? 0 : 30;
                const formattedHours = hours < 10 ? `0${hours}` : `${hours}`;

                task.dueTimeStr = `${formattedHours}:${roundedMinutes === 0 ? '00' : roundedMinutes}`;
            } catch (error) {
                console.error(`Error processing dueDate for task:`, task, error);
                task.dueTimeStr = "00:00";
            }
        });
    }

    async onFilterChange(): Promise<void> {
        await this.getTasks();
    }

    async setStatusFilter(status: string): Promise<void> {
        this.statusFilter = status;

        if (status === StatusFilter.Done) {
            await this.getTasks();
        } else {
            this.registerTimeout(() => {
                this.applyFilters();
            });
        }
    }

    private applyFilters(): void {
        let filteredTasks: ExtendedTask[];

        if (this.statusFilter === StatusFilter.All) {
            filteredTasks = this.tasks.filter(task => !task.closed);
        } else if (this.statusFilter === StatusFilter.Overdue) {
            filteredTasks = this.tasks.filter(task => this.isTaskOverdue(task));
        } else if (this.statusFilter === StatusFilter.Todo) {
            filteredTasks = this.tasks.filter(task => !task.closed && !this.isTaskOverdue(task));
        } else if (this.statusFilter === StatusFilter.Done) {
            filteredTasks = this.tasks.filter(task => task.closed);
        } else {
            filteredTasks = [...this.tasks];
        }

        if (filteredTasks) {
            this.filteredTasks = filteredTasks;
        }
    }

    getStatusCounts(): { active: number; overdue: number; todo: number; done: number } {
        let active = 0, overdue = 0, todo = 0, done = 0;

        for (const task of this.tasks) {
            if (task.closed) {
                done++;
            } else {
                active++;
                const isOverdue = this.isTaskOverdue(task);
                if (isOverdue) {
                    overdue++;
                } else {
                    todo++;
                }
            }
        }

        return {active, overdue, todo, done};
    }

    refreshTasks(): Promise<void> {
        return this.getTasks();
    }

    isTaskOverdue(task: ITask): boolean {
        if (task.closed) return false;
        return task.dueDate.isBefore(dayjs(this.today));
    }

    formatDate(date: Date | string): string {
        return this.$filter('date')(dayjs(date).toDate(), 'EEEE (d/MM/yy)');
    }
    
    handleTaskCompletion(task: ExtendedTask): void {
        this.refreshTasks().then(() => {
            if (this.statusFilter === StatusFilter.Done) {
                this.registerTimeout(() => {
                    this.applyFilters();
                });
            }
        });
    }

    async goToToday(): Promise<void> {
        const today = dayjs().startOf('day');
        if (today.isBefore(dayjs(this.dateFilterData.startDate)) || today.isAfter(dayjs(this.dateFilterData.endDate))) {
            // Adjust the range to include today
            this.dateFilterData.startDate = dayjs().subtract(3, 'days').startOf('day');
            this.dateFilterData.endDate = dayjs().add(3, 'days').endOf('day');
        }

        await this.refreshDashboard();
    }

    async refreshDashboard(): Promise<void> {
        await this.getTasks();
    }

    selectTaskJobDetail(task: ExtendedTask): void {
        this.selectTaskForHistory(task);
    }

    handleCalendarTaskClick(task: ExtendedTask): void {
        console.info('Calendar task clicked:', task);
        this.selectTaskJobDetail(task);
    }

    async handleCalendarTaskUpdate(): Promise<void> {
        await this.refreshTasks();
    }

    handleCalendarTaskStatusChange(task: ExtendedTask): void {
        console.info('Calendar task status changed:', task);

        const taskIndex = this.tasks.findIndex(t => t.id === task.id);
        if (taskIndex !== -1) {
            this.tasks[taskIndex].closed = task.closed;
        }

        this.handleTaskCompletion(task);
    }

    async saveViewPreference(): Promise<void> {
        const viewMode = this.showFullCalendar ? ViewMode.Calendar : ViewMode.List;

        // If switching to the list view, reset to 24 hours
        if (!this.showFullCalendar) {
            this.dateFilterData = setDateFilterDefaults();
            this.saveDateFilterToStorage();
            await this.refreshDashboard();
        }

        if (Modernizr.localstorage) {
            localStorage.setItem(`taskDashboardViewPreference-${ContactID}`, viewMode);
        }
    }

    private loadViewPreference(): void {
        if (Modernizr.localstorage) {
            const viewMode = localStorage.getItem(`taskDashboardViewPreference-${ContactID}`);
            if (viewMode) {
                this.showFullCalendar = viewMode === ViewMode.Calendar;
            }
        }
    }

    async updateDateRangeFromCalendar(startDate: Date, endDate: Date): Promise<void> {
        this.dateFilterData.startDate = dayjs(startDate);
        this.dateFilterData.endDate = dayjs(endDate);
        await this.refreshDashboard();
    }

    async handleCalendarViewChange(startDate: Date, endDate: Date): Promise<void> {
        await this.updateDateRangeFromCalendar(startDate, endDate);
    }

    async openMessagingDialog($event: MouseEvent): Promise<void> {
        await this.messagingDialogService.openMessagingDialog($event);
    }

    selectTaskForHistory(task: ExtendedTask): void {
        this.selectedTask = task;
        this.currentJobId = task.jobId;
        this.currentSelection = "for Job " + task.jobNumber;
    }
    
    async refreshDataTimeSpan(dateFilterData: IDateFilterData): Promise<void> {
        console.log('refreshDataTimeSpan called with data ', dateFilterData);
        this.dateFilterData = dateFilterData;

        this.saveDateFilterToStorage();
        await this.getTasks();
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

const TaskDashboardComponent: angular.IComponentOptions = {
    template: require("./task-dashboard.template.html"),
    controller: TaskDashboardController,
    controllerAs: "ctrl"
}

export default TaskDashboardComponent;
