import "./task-dashboard.styles.less";
import {ExtendedTask, TaskTableFiltersRequest, TaskViewModel} from "./task-dashboard.interfaces";
import DispatchCoreService from "../../services/dispatch-core.service";
import {IDispatchJob, Suggestion} from "../../interfaces/job.interface";
import {ViewMode} from "./enums/view-mode";
import BaseController from "../base-controller";
import {ITaskListItemConfig} from "../common/task-item-component/task-item.interfaces";
import {StatusFilter} from "./enums/status-filter";
import greetUser from "../../functions/greetUser";
import dayjs from "dayjs";

class TaskDashboardController extends BaseController {
    static $inject = [
        "$mdSidenav",
        "$filter",
        "DispatchData",
        "$timeout",
        "$interval",
        "$scope",
    ];

    // Properties
    greeting: string;
    tasksLoading: boolean = true;
    isFirstLoad: boolean = true;
    selectedDate: Date = new Date();

    // View state
    viewMode: string = ViewMode.List;
    calendarViewMode: boolean = false;

    // Filter states
    searchQuery?: string;
    staffFilter: string = StatusFilter.All;
    eventTypeFilter: string = StatusFilter.All;
    statusFilter: string = StatusFilter.All;

    // Calendar data
    weekDates: Date[] = [];
    today: Date = new Date();

    // Tasks data
    tasks: ExtendedTask[] = [];
    filteredTasks: ExtendedTask[] = [];
    timeOptions: string[] = [];

    // Lists
    staffList?: Suggestion[];
    eventTypesList?: Suggestion[];

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

    calendarTaskConfig: ITaskListItemConfig = {
        showJobId: true,
        showAssignee: false,
        showJobType: false,
        showDateTime: false,
        customClass: 'calendar-task-item',
        allowCompletion: true,
        showStatusIndicators: false,
        showOverdueWarning: false,
        onTaskClick: true
    };

    currentJobId?: number;
    currentSelection?: string;

    timeZone: string;
    browserTimeZone: string;
    dateSearchRange: number = 1;
    startDate: Date = dayjs(new Date(0)).toDate();
    endDate: Date = dayjs().add(24, 'hours').toDate();

    constructor(
        private $mdSidenav: angular.material.ISidenavService,
        private $filter: angular.IFilterService,
        private DispatchService: DispatchCoreService,
        $timeout: angular.ITimeoutService,
        $interval: angular.IIntervalService,
        $scope: angular.IScope,
    ) {
        super();

        this.initServices($timeout, $interval);

        this.greeting = greetUser(FirstName);
        this.browserTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        this.timeZone = TimeZone;

        this.generateTimeOptions();
        this.selectedDate = new Date();
        this.initializeDates();
        this.calendarViewMode = this.viewMode === ViewMode.Calendar;

        this.loadLists()
            .then(() => this.getTasks())
            .catch(error => {
                console.error('Initialization error:', error);
            });

        this.registerEvent($scope, 'jobChanged', (_, newJob: IDispatchJob) => {
            this.currentSelection = ` for Job ${newJob.jobNo}`;
        });
    }

    private async loadLists() {
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

    // UI Controls
    toggleSidenav(): void {
        this.$mdSidenav("right").toggle();
    }

    toggleViewMode(): void {
        this.viewMode = this.calendarViewMode ? ViewMode.Calendar : ViewMode.List;
    }

    private generateTimeOptions(): void {
        this.timeOptions = [];
        for (let hour = 0; hour < 24; hour++) {
            const formattedHour = hour < 10 ? `0${hour}` : `${hour}`;
            this.timeOptions.push(`${formattedHour}:00`);
            this.timeOptions.push(`${formattedHour}:30`);
        }
    }

    private initializeDates(): void {
        const dayOfWeek = this.selectedDate.getDay();
        const startDate = new Date(this.selectedDate);
        startDate.setDate(this.selectedDate.getDate() - dayOfWeek);

        this.weekDates = Array.from({length: 7}, (_, i) => {
            const date = new Date(startDate);
            date.setDate(startDate.getDate() + i);
            return date;
        });
    }

    private async getTasks() {
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

        // Add staff filter
        if (this.staffFilter && this.staffFilter !== StatusFilter.All) {
            filters.staffId = parseInt(this.staffFilter, 10);
        }

        // Add event type filter
        if (this.eventTypeFilter && this.eventTypeFilter !== StatusFilter.All) {
            filters.eventTypeId = parseInt(this.eventTypeFilter, 10);
        }

        filters.showCompleted = true;

        // Add a search filter
        if (this.searchQuery) {
            filters.searchText = this.searchQuery;
        }

        //// Set the date filter
        //filters.date = dayjs(this.selectedDate).format();

        // Set the date filter based on dateSearchRange
        if (this.dateSearchRange == 1) {
            // 24 Hours mode - use selectedDate
            filters.date = dayjs(this.selectedDate).format();
        } else if (this.dateSearchRange == 2) {
            // Custom range mode - use startDate and endDate
            filters.startDate = dayjs(this.startDate).format();
            filters.endDate = dayjs(this.endDate).format();
        }

        return filters;
    }

    private initializeTaskTimeStrings(): void {
        this.tasks.forEach(task => {
            try {
                const dueDate = new Date(task.dueDate);

                if (isNaN(dueDate.getTime())) {
                    console.warn(`Invalid date for task "${task.title}":`, task.dueDate);
                    task.dueTimeStr = "00:00";
                    return;
                }

                const hours = dueDate.getHours();
                const minutes = dueDate.getMinutes();
                const roundedMinutes = minutes < 30 ? 0 : 30;
                const formattedHours = hours < 10 ? `0${hours}` : `${hours}`;

                task.dueTimeStr = `${formattedHours}:${roundedMinutes === 0 ? '00' : roundedMinutes}`;
                task.dueDate = dayjs(dueDate).format();
            } catch (error) {
                console.error(`Error processing dueDate for task:`, task, error);
                task.dueTimeStr = "00:00";
            }
        });
    }

    async onFilterChange() {
        await this.getTasks();
    }

    setStatusFilter(status: string) {
        this.statusFilter = status;

        if (status === StatusFilter.Done) {
            return this.getTasks();
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
            filteredTasks = [...this.tasks]; // Default - show all tasks
        }

        if (filteredTasks) {
            this.filteredTasks = filteredTasks;
        }
    }

    getStatusCounts() {
        let active = 0, overdue = 0, todo = 0, done = 0;

        // Single pass through the tasks array
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

    refreshTasks() {
        return this.getTasks();
    }

    isTaskOverdue(task: TaskViewModel): boolean {
        if (task.closed) return false;
        return new Date(task.dueDate) < this.selectedDate;
    }

    formatDate(date: Date): string {
        return this.$filter('date')(date, 'EEEE (d/MM/yy)');
    }

    formatTime(dateString: string): string {
        const date = new Date(dateString);
        return this.$filter('date')(date, 'h:mm a').toLowerCase();
    }

    getTasksByDate(date: Date): ExtendedTask[] {
        const dateStr = dayjs(date).format();

        return this.filteredTasks.filter(task => {
            const taskDate = dayjs(task.dueDate).format();
            return taskDate === dateStr;
        });
    }

    getOverdueTasks(): ExtendedTask[] {
        return this.filteredTasks.filter(task => {
            if (task.closed) return false;

            const taskDate = new Date(task.dueDate);
            const selectedDateStart = new Date(this.selectedDate);
            selectedDateStart.setHours(0, 0, 0, 0);

            return taskDate < selectedDateStart;
        });
    }

    handleTaskCompletion(task: ExtendedTask) {
        this.refreshTasks().then(() => {
            if (this.statusFilter === StatusFilter.Done) {
                this.registerTimeout(() => {
                    this.applyFilters();
                });
            }
        });
    }

    async changeDate(days: number) {
        const newDate = new Date(this.selectedDate);
        newDate.setDate(newDate.getDate() + days);
        this.selectedDate = newDate;

        // If we're in custom date range mode, we should extend the range if needed
        if (this.dateSearchRange == 2) {
            if (this.selectedDate < this.startDate) {
                this.startDate = dayjs(this.selectedDate).startOf('day').toDate();
            } else if (this.selectedDate > this.endDate) {
                this.endDate = dayjs(this.selectedDate).endOf('day').toDate();
            }
        }

        await this.refreshDashboard();
    }

    async goToToday() {
        this.selectedDate = new Date();

        // If we're in custom date range mode, make sure today is in the range
        if (this.dateSearchRange == 2) {
            const today = dayjs().startOf('day');
            if (today.isBefore(dayjs(this.startDate)) || today.isAfter(dayjs(this.endDate))) {
                // Adjust the range to include today
                this.startDate = dayjs().subtract(3, 'days').startOf('day').toDate();
                this.endDate = dayjs().add(3, 'days').endOf('day').toDate();
            }
        }

        await this.refreshDashboard();
    }

    async refreshDashboard() {
        this.initializeDates();
        await this.getTasks();
    }

    selectTaskJobDetail(task: ExtendedTask) {
        this.currentJobId = task.jobId;
        this.currentSelection = "for Job " + task.jobNumber;
    }

    async onSearchRangeChange(optionSelected: number) {
        console.log(`Search range changed to: ${optionSelected}`);

        this.dateSearchRange = optionSelected;

        if (optionSelected === 1) {
            // 24 Hours mode - reset to defaults
            this.startDate = dayjs(new Date(0)).toDate(); // Unix epoch start date
            this.endDate = dayjs().add(24, 'hours').toDate(); // 24 hours from now

            // Use current date for selectedDate
            this.selectedDate = new Date();

            console.log('24 Hours mode: Reset dates to defaults', {
                startDate: dayjs(this.startDate).format('YYYY-MM-DD HH:mm:ss'),
                endDate: dayjs(this.endDate).format('YYYY-MM-DD HH:mm:ss'),
                selectedDate: dayjs(this.selectedDate).format('YYYY-MM-DD HH:mm:ss')
            });
        } else {
            // Custom mode - If dates aren't set, initialize them to reasonable defaults
            if (!this.startDate) {
                this.startDate = dayjs().subtract(7, 'days').toDate(); // 7 days ago
            }

            if (!this.endDate) {
                this.endDate = dayjs().add(1, 'days').toDate(); // tomorrow
            }

            console.log('Custom mode: Set custom date range', {
                startDate: dayjs(this.startDate).format('YYYY-MM-DD HH:mm:ss'),
                endDate: dayjs(this.endDate).format('YYYY-MM-DD HH:mm:ss')
            });
        }

        await this.refreshDashboard();
    }
}

const TaskDashboardComponent: angular.IComponentOptions = {
    template: require("./task-dashboard.template.html"),
    controller: TaskDashboardController,
    controllerAs: "ctrl"
}

export default TaskDashboardComponent;
