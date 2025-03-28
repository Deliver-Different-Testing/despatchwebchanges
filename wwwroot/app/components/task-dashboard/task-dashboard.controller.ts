import {ExtendedTask, TaskViewModel, TaskTableFiltersRequest} from "./task-dashboard.interfaces";
import "./task-dashboard.styles.less";
import GreetingService from "../../services/greeting.service";
import DispatchCoreService from "../../services/dispatch-core.service";
import {ActiveCourierViewModel} from "../../interfaces/courier.interface";
import {Suggestion} from "../../interfaces/job.interface";
import {StatusFilter} from "./enums/status-filter";
import {ViewMode} from "./enums/view-mode";
import BaseController from "../base-controller";
import { ITaskListItemConfig } from "../common/task-item-component/task-item.interfaces";

class TaskDashboardController extends BaseController {
    static $inject = [
        "greetingService",
        "$mdSidenav",
        "$filter",
        "DispatchData",
        "$timeout"
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
    searchQuery: string = '';
    courierFilter: string = StatusFilter.All;
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
    courierList?: ActiveCourierViewModel[];
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
        showOverdueWarning: true
    };

    calendarTaskConfig: ITaskListItemConfig = {
        showJobId: true,
        showAssignee: false,
        showJobType: false,
        showDateTime: false,
        customClass: 'calendar-task-item',
        allowCompletion: true,
        showStatusIndicators: false,
        showOverdueWarning: false
    };

    constructor(
        greetingService: GreetingService,
        private $mdSidenav: angular.material.ISidenavService,
        private $filter: angular.IFilterService,
        private DispatchService: DispatchCoreService,
        private $timeout: angular.ITimeoutService
    ) {
        super();
        this.greeting = greetingService.greetUser(FirstName);
        this.initialize();
    }

    private initialize() {
        this.generateTimeOptions();
        this.selectedDate = new Date();
        this.initializeDates();
        this.calendarViewMode = this.viewMode === ViewMode.Calendar;

        this.loadListsSequentially()
            .then(() => this.getTasks())
            .catch(error => {
                console.error('Initialization error:', error);
            });
    }

    private async loadListsSequentially() {
        try {
            this.courierList = await this.DispatchService.getAllCouriers();
            this.eventTypesList = await this.DispatchService.getEventTypes();
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
            this.tasks = tasks as ExtendedTask[];
            this.initializeTaskTimeStrings();
            this.applyFilters();

            this.$timeout(() => {
                this.tasksLoading = false;
                this.isFirstLoad = false;
            });
        } catch (error) {
            console.error('Error loading tasks:', error);
            this.tasksLoading = false;
            this.isFirstLoad = false;
            throw error;
        }
    }

    private buildTaskFilters(): TaskTableFiltersRequest {
        const filters: TaskTableFiltersRequest = { staffId: -1};

        if (this.courierFilter && this.courierFilter !== StatusFilter.All) {
            filters.courierId = parseInt(this.courierFilter, 10);
        }

        if (this.eventTypeFilter && this.eventTypeFilter !== StatusFilter.All) {
            filters.eventTypeId = parseInt(this.eventTypeFilter, 10);
        }

        if (this.searchQuery) {
            filters.searchText = this.searchQuery;
        }

        filters.date = this.selectedDate.toISOString().split('T')[0];

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
                task.dueDate = dueDate.toISOString();
            } catch (error) {
                console.error(`Error processing dueDate for task:`, task, error);
                task.dueTimeStr = "00:00";
            }
        });
    }

    async onFilterChange() {
        await this.getTasks();
    }

    setStatusFilter(status: string): void {
        this.statusFilter = status;
        this.applyFilters();
    }

    private applyFilters(): void {
        if (this.statusFilter === StatusFilter.All || this.isFirstLoad) {
            this.filteredTasks = this.tasks;
        } else if (this.statusFilter === StatusFilter.Overdue) {
            this.filteredTasks = this.tasks.filter(task => this.isTaskOverdue(task));
        } else if (this.statusFilter === StatusFilter.Todo) {
            this.filteredTasks = this.tasks.filter(task => !task.closed && !this.isTaskOverdue(task));
        } else if (this.statusFilter === StatusFilter.Done) {
            this.filteredTasks = this.tasks.filter(task => task.closed);
        }
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
        const dateStr = date.toISOString().split('T')[0];
        return this.filteredTasks.filter(task => {
            const taskDate = new Date(task.dueDate);
            return taskDate.toISOString().split('T')[0] === dateStr;
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

    getStatusCounts() {
        return {
            overdue: this.tasks.filter(task => this.isTaskOverdue(task)).length,
            todo: this.tasks.filter(task => !task.closed && !this.isTaskOverdue(task)).length,
            done: this.tasks.filter(task => task.closed).length
        };
    }

    async changeDate(days: number) {
        const newDate = new Date(this.selectedDate);
        newDate.setDate(newDate.getDate() + days);
        this.selectedDate = newDate;
        await this.refreshDashboard();
    }

    async goToToday() {
        this.selectedDate = new Date();
        await this.refreshDashboard();
    }

    async refreshDashboard() {
        this.initializeDates();
        await this.getTasks();
    }
}

const TaskDashboardComponent: angular.IComponentOptions = {
    template: require("./task-dashboard.template.html"),
    controller: TaskDashboardController,
    controllerAs: "ctrl"
}
export default TaskDashboardComponent;
