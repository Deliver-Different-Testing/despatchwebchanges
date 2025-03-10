import {ExtendedTask, Task, TaskTableFiltersRequest} from "./task-dashboard.interfaces";
import "./task-dashboard.styles.less";
import app from "../../app";
import GreetingService from "../../services/greeting.service";
import TasksDashboardService from "./tasks-dashboard.service";
import DispatchService from "../../services/dispatch.service";
import { ActiveCourier } from "../../interfaces/courier.interface";
import { Suggestion } from "../../interfaces/job.interface";
import {StatusFilter} from "./enums/status-filter";
import {ViewMode} from "./enums/view-mode";

class TaskDashboardController implements angular.IController {
    static $inject = [
        "greetingService",
        "$mdSidenav",
        "$filter",
        "$mdDialog",
        "tasksDashboardsService",
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
    courierList?: ActiveCourier[];
    eventTypesList?: Suggestion[];

    constructor(
        greetingService: GreetingService,
        private $mdSidenav: angular.material.ISidenavService,
        private $filter: angular.IFilterService,
        private $mdDialog: angular.material.IDialogService,
        private tasksDashboardsService: TasksDashboardService,
        private dispatchService: DispatchService,
        private $timeout: angular.ITimeoutService
    ) {
        this.greeting = greetingService.greetUser(FirstName);
        this.initialize();
    }

    private async initialize(): Promise<void> {
        this.generateTimeOptions();
        this.selectedDate = new Date();
        this.initializeDates();
        this.calendarViewMode = this.viewMode === ViewMode.Calendar;

        try {
            await this.loadListsSequentially();
            await this.getTasks();
        } catch (error) {
            console.error('Initialization error:', error);
        }
    }

    private async loadListsSequentially(): Promise<void> {
        try {
            this.courierList = await this.dispatchService.getAllCouriers();
            this.eventTypesList = await this.dispatchService.getEventTypes();
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

        this.weekDates = Array.from({ length: 7 }, (_, i) => {
            const date = new Date(startDate);
            date.setDate(startDate.getDate() + i);
            return date;
        });
    }

    private async getTasks(): Promise<void> {
        if (this.isFirstLoad) {
            this.tasksLoading = true;
        }

        const filters = this.buildTaskFilters();

        try {
            const tasks = await this.tasksDashboardsService.getAllTasks(filters);
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
        const filters: TaskTableFiltersRequest = {};

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

    async onFilterChange(): Promise<void> {
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

    async openDateTimeDialog(
        $event: MouseEvent,
        task: ExtendedTask,
        showDate: boolean = true,
        showTime: boolean = true
    ): Promise<void> {
        $event.preventDefault();
        $event.stopPropagation();

        try {
            const result = await this.$mdDialog.show({
                controller: 'EditDateTimeDialogController',
                controllerAs: 'ctrl',
                template: require("../dialogs/edit-date-time-dialog/edit-date-time-dialog.html"),
                parent: document.body,
                targetEvent: $event,
                clickOutsideToClose: true,
                locals: {
                    job: { id: task.id },
                    title: showDate && showTime ? 'Due Date & Time' : (showDate ? 'Due Date' : 'Due Time'),
                    fieldName: 'dueDate',
                    dateTime: task.dueDate,
                    id: 'task-date-time-dialog',
                    showDate,
                    showTime
                }
            });

            if (result) {
                await this.handleDateTimeUpdate(task, result, showDate, showTime);
            }
        } catch (error) {
            console.error('Error in openDateTimeDialog:', error);
            throw error;
        }
    }

    private async handleDateTimeUpdate(
        task: ExtendedTask,
        result: Date,
        showDate: boolean,
        showTime: boolean
    ): Promise<void> {
        if (showDate && !showTime) {
            await this.updateTaskDate(task, result);
        } else if (!showDate && showTime) {
            await this.updateTaskTime(task, this.formatTimeForUpdate(result));
        } else {
            const newDateTime = new Date(result);

            try {
                await this.tasksDashboardsService.updateTaskDate(task.id, newDateTime);
                await this.tasksDashboardsService.updateTaskTime(task.id, newDateTime);

                task.dueDate = newDateTime.toISOString();
                task.dueTimeStr = this.formatTimeForUpdate(newDateTime);

                await this.getTasks();
            } catch (error) {
                console.error(`Error updating task date and time:`, error);
            }
        }
    }

    async openDateDialog($event: MouseEvent, task: ExtendedTask): Promise<void> {
        await this.openDateTimeDialog($event, task, true, false);
    }

    async openTimeDialog($event: MouseEvent, task: ExtendedTask): Promise<void> {
        await this.openDateTimeDialog($event, task, false, true);
    }

    async handleTaskCompletion(task: Task): Promise<void> {
        try {
            await this.tasksDashboardsService.markTaskAsClosed(task.id, task.closed);
            await this.getTasks();
        } catch (error) {
            console.error(`Error updating task status:`, error);
            task.closed = !task.closed;
        }
    }

    async updateTaskDate(task: ExtendedTask, dateObj: Date): Promise<void> {
        if (!dateObj) return;

        const newDate = new Date(task.dueDate);
        newDate.setFullYear(dateObj.getFullYear());
        newDate.setMonth(dateObj.getMonth());
        newDate.setDate(dateObj.getDate());

        try {
            await this.tasksDashboardsService.updateTaskDate(task.id, newDate);
            task.dueDate = newDate.toISOString();
            await this.getTasks();
        } catch (error) {
            console.error(`Error updating task date:`, error);
        }
    }

    async updateTaskTime(task: ExtendedTask, timeString: string): Promise<void> {
        if (!timeString) return;

        const [hours, minutes] = timeString.split(':');
        const newDate = new Date(task.dueDate);
        newDate.setHours(parseInt(hours, 10));
        newDate.setMinutes(parseInt(minutes, 10));

        try {
            await this.tasksDashboardsService.updateTaskTime(task.id, newDate);
            task.dueDate = newDate.toISOString();
            task.dueTimeStr = timeString;
            await this.getTasks();
        } catch (error) {
            console.error(`Error updating task time:`, error);
        }
    }

    private formatTimeForUpdate(dateObj: Date): string {
        const hours = dateObj.getHours();
        const minutes = dateObj.getMinutes();
        return `${hours < 10 ? '0' + hours : hours}:${minutes < 10 ? '0' + minutes : minutes}`;
    }

    isTaskOverdue(task: Task): boolean {
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

    async refreshDashboard(): Promise<void> {
        this.initializeDates();
        await this.getTasks();
    }
}

app.controller("taskDashboardController", TaskDashboardController);
