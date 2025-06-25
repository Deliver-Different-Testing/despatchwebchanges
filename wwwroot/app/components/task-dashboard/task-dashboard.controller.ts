import "./task-dashboard.styles.less";
import {ExtendedTask, TaskTableFiltersRequest, TaskViewModel} from "./task-dashboard.interfaces";
import {IDispatchJob, Suggestion} from "../../interfaces/job.interface";
import {ViewMode} from "./enums/view-mode";
import BaseController from "../base-controller";
import {ITaskListItemConfig} from "../common/task-item-component/task-item.interfaces";
import {StatusFilter} from "./enums/status-filter";
import greetUser from "../../functions/greetUser";
import dayjs from "dayjs";
import {ContactID} from "../../contants";
import DispatchCoreService from "../../services/dispatch-core.service";
import MessagingDialogService from "../dialogs/messaging-dialog/messaging-dialog.service";
import timezone from 'dayjs/plugin/timezone';

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

    // Properties
    greeting: string;
    tasksLoading: boolean = true;
    isFirstLoad: boolean = true;
    selectedDate = dayjs().toDate();

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

    currentJobId?: number;
    currentSelection?: string;

    timeZone: string;
    browserTimeZone: string;
    dateSearchRange: number = 1;
    startDate = dayjs(0).toDate();
    endDate = dayjs().add(24, 'hours').toDate();

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

        this.showFullCalendar = false;
        this.loadViewPreference();

        this.greeting = greetUser(FirstName);
        this.browserTimeZone = dayjs.tz.guess();
        this.timeZone = TimeZone;

        this.generateTimeOptions();
        this.selectedDate = dayjs().toDate();

        this.loadLists()
            .then(() => this.getTasks())
            .catch(error => {
                console.error('Initialization error:', error);
            });

        this.watchEvent('jobChanged', (_, newJob: IDispatchJob) => {
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

    toggleSidenav(): void {
        this.$mdSidenav("right").toggle();
    }

    private generateTimeOptions(): void {
        this.timeOptions = [];
        for (let hour = 0; hour < 24; hour++) {
            const formattedHour = hour < 10 ? `0${hour}` : `${hour}`;
            this.timeOptions.push(`${formattedHour}:00`);
            this.timeOptions.push(`${formattedHour}:30`);
        }
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

        if (this.dateSearchRange == 1) {
            filters.date = dayjs(this.selectedDate).format();
        } else if (this.dateSearchRange == 2) {
            filters.startDate = dayjs(this.startDate).format();
            filters.endDate = dayjs(this.endDate).format();
        }

        return filters;
    }

    private initializeTaskTimeStrings(): void {
        this.tasks.forEach(task => {
            try {
                const dueDate = dayjs(task.dueDate);

                if (!dueDate.isValid()) {
                    console.warn(`Invalid date for task "${task.title}":`, task.dueDate);
                    task.dueTimeStr = "00:00";
                    return;
                }

                const hours = dueDate.hour();
                const minutes = dueDate.minute();
                const roundedMinutes = minutes < 30 ? 0 : 30;
                const formattedHours = hours < 10 ? `0${hours}` : `${hours}`;

                task.dueTimeStr = `${formattedHours}:${roundedMinutes === 0 ? '00' : roundedMinutes}`;
                task.dueDate = dueDate.format();
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
            filteredTasks = [...this.tasks];
        }

        if (filteredTasks) {
            this.filteredTasks = filteredTasks;
        }
    }

    getStatusCounts() {
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

    refreshTasks() {
        return this.getTasks();
    }

    isTaskOverdue(task: TaskViewModel): boolean {
        if (task.closed) return false;
        return dayjs(task.dueDate).isBefore(dayjs(this.selectedDate));
    }

    formatDate(date: Date | string): string {
        return this.$filter('date')(dayjs(date).toDate(), 'EEEE (d/MM/yy)');
    }

    formatTime(dateString: string): string {
        return this.$filter('date')(dayjs(dateString).toDate(), 'h:mm a').toLowerCase();
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
        this.selectedDate = dayjs(this.selectedDate).add(days, 'day').toDate();

        if (this.dateSearchRange == 2) {
            if (dayjs(this.selectedDate).isBefore(dayjs(this.startDate))) {
                this.startDate = dayjs(this.selectedDate).startOf('day').toDate();
            } else if (dayjs(this.selectedDate).isAfter(dayjs(this.endDate))) {
                this.endDate = dayjs(this.selectedDate).endOf('day').toDate();
            }
        }

        await this.refreshDashboard();
    }

    async goToToday() {
        this.selectedDate = dayjs().toDate();

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
        await this.getTasks();
    }

    selectTaskJobDetail(task: ExtendedTask) {
        this.currentJobId = task.jobId;
        this.currentSelection = "for Job " + task.jobNumber;
    }

    async onSearchRangeChange(optionSelected: number) {
        console.debug(`Search range changed to: ${optionSelected}`);

        this.dateSearchRange = optionSelected;

        if (optionSelected === 1) {
            this.startDate = dayjs(0).toDate();
            this.endDate = dayjs().add(24, 'hours').toDate();
            this.selectedDate = dayjs().toDate();

            console.debug('24 Hours mode: Reset dates to defaults', {
                startDate: dayjs(this.startDate).format('YYYY-MM-DD HH:mm:ss'),
                endDate: dayjs(this.endDate).format('YYYY-MM-DD HH:mm:ss'),
                selectedDate: dayjs(this.selectedDate).format('YYYY-MM-DD HH:mm:ss')
            });
        } else {
            if (!this.startDate) {
                this.startDate = dayjs().subtract(7, 'days').toDate();
            }

            if (!this.endDate) {
                this.endDate = dayjs().add(1, 'days').toDate();
            }

            console.debug('Custom mode: Set custom date range', {
                startDate: dayjs(this.startDate).format('YYYY-MM-DD HH:mm:ss'),
                endDate: dayjs(this.endDate).format('YYYY-MM-DD HH:mm:ss')
            });
        }

        await this.refreshDashboard();
    }

    handleCalendarTaskClick(task: ExtendedTask): void {
        console.debug('Calendar task clicked:', task);
        this.selectTaskJobDetail(task);
    }

    async handleCalendarTaskUpdate(): Promise<void> {
        await this.refreshTasks();
    }

    handleCalendarTaskStatusChange(task: ExtendedTask): void {
        console.debug('Calendar task status changed:', task);

        const taskIndex = this.tasks.findIndex(t => t.id === task.id);
        if (taskIndex !== -1) {
            this.tasks[taskIndex].closed = task.closed;
        }

        this.handleTaskCompletion(task);
    }

    async saveViewPreference(): Promise<void> {
        const viewMode = this.showFullCalendar ? ViewMode.Calendar : ViewMode.List;

        // If switching to list view, reset to 24 hours
        if (!this.showFullCalendar && this.dateSearchRange === 2) {
            this.dateSearchRange = 1;
            this.selectedDate = dayjs().toDate();
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
        this.dateSearchRange = 2; // Set to a custom range
        this.startDate = startDate;
        this.endDate = endDate;
        await this.refreshDashboard();
    }

    async handleCalendarViewChange(startDate: Date, endDate: Date): Promise<void> {
        await this.updateDateRangeFromCalendar(startDate, endDate);
    }

    async openMessagingDialog($event: MouseEvent) {
        await this.messagingDialogService.openMessagingDialog($event);
    }
}

const TaskDashboardComponent: angular.IComponentOptions = {
    template: require("./task-dashboard.template.html"),
    controller: TaskDashboardController,
    controllerAs: "ctrl"
}

export default TaskDashboardComponent;
