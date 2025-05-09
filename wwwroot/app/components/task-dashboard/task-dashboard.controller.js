"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TaskDashboardController = void 0;
require("./task-dashboard.styles.less");
const status_filter_1 = require("./enums/status-filter");
const view_mode_1 = require("./enums/view-mode");
const bindAllMethods_1 = require("../../bindAllMethods");
class TaskDashboardController {
    constructor(greetingService, $mdSidenav, $filter, tasksDashboardsService, DispatchService, $timeout, selectDialogService, toastrService, editDateTimeDialogService) {
        this.$mdSidenav = $mdSidenav;
        this.$filter = $filter;
        this.tasksDashboardsService = tasksDashboardsService;
        this.DispatchService = DispatchService;
        this.$timeout = $timeout;
        this.selectDialogService = selectDialogService;
        this.toastrService = toastrService;
        this.editDateTimeDialogService = editDateTimeDialogService;
        this.tasksLoading = true;
        this.isFirstLoad = true;
        this.selectedDate = new Date();
        // View state
        this.viewMode = view_mode_1.ViewMode.List;
        this.calendarViewMode = false;
        // Filter states
        this.searchQuery = '';
        this.courierFilter = status_filter_1.StatusFilter.All;
        this.eventTypeFilter = status_filter_1.StatusFilter.All;
        this.statusFilter = status_filter_1.StatusFilter.All;
        // Calendar data
        this.weekDates = [];
        this.today = new Date();
        // Tasks data
        this.tasks = [];
        this.filteredTasks = [];
        this.timeOptions = [];
        this.greeting = greetingService.greetUser(FirstName);
        bindAllMethods_1.bindAllMethods(this);
        this.initialize();
    }
    initialize() {
        this.generateTimeOptions();
        this.selectedDate = new Date();
        this.initializeDates();
        this.calendarViewMode = this.viewMode === view_mode_1.ViewMode.Calendar;
        this.loadListsSequentially()
            .then(() => this.getTasks())
            .catch(error => {
            console.error('Initialization error:', error);
        });
    }
    loadListsSequentially() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                this.courierList = yield this.DispatchService.getAllCouriers();
                this.eventTypesList = yield this.DispatchService.getEventTypes();
            }
            catch (error) {
                console.error('Error loading lists:', error);
                throw error;
            }
        });
    }
    // UI Controls
    toggleSidenav() {
        this.$mdSidenav("right").toggle();
    }
    toggleViewMode() {
        this.viewMode = this.calendarViewMode ? view_mode_1.ViewMode.Calendar : view_mode_1.ViewMode.List;
    }
    generateTimeOptions() {
        this.timeOptions = [];
        for (let hour = 0; hour < 24; hour++) {
            const formattedHour = hour < 10 ? `0${hour}` : `${hour}`;
            this.timeOptions.push(`${formattedHour}:00`);
            this.timeOptions.push(`${formattedHour}:30`);
        }
    }
    initializeDates() {
        const dayOfWeek = this.selectedDate.getDay();
        const startDate = new Date(this.selectedDate);
        startDate.setDate(this.selectedDate.getDate() - dayOfWeek);
        this.weekDates = Array.from({ length: 7 }, (_, i) => {
            const date = new Date(startDate);
            date.setDate(startDate.getDate() + i);
            return date;
        });
    }
    getTasks() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.isFirstLoad) {
                this.tasksLoading = true;
            }
            const filters = this.buildTaskFilters();
            try {
                const tasks = yield this.tasksDashboardsService.getAllTasks(filters);
                this.tasks = tasks;
                this.initializeTaskTimeStrings();
                this.applyFilters();
                this.$timeout(() => {
                    this.tasksLoading = false;
                    this.isFirstLoad = false;
                });
            }
            catch (error) {
                console.error('Error loading tasks:', error);
                this.tasksLoading = false;
                this.isFirstLoad = false;
                throw error;
            }
        });
    }
    buildTaskFilters() {
        const filters = {};
        if (this.courierFilter && this.courierFilter !== status_filter_1.StatusFilter.All) {
            filters.courierId = parseInt(this.courierFilter, 10);
        }
        if (this.eventTypeFilter && this.eventTypeFilter !== status_filter_1.StatusFilter.All) {
            filters.eventTypeId = parseInt(this.eventTypeFilter, 10);
        }
        if (this.searchQuery) {
            filters.searchText = this.searchQuery;
        }
        filters.date = this.selectedDate.toISOString().split('T')[0];
        return filters;
    }
    initializeTaskTimeStrings() {
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
            }
            catch (error) {
                console.error(`Error processing dueDate for task:`, task, error);
                task.dueTimeStr = "00:00";
            }
        });
    }
    onFilterChange() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.getTasks();
        });
    }
    setStatusFilter(status) {
        this.statusFilter = status;
        this.applyFilters();
    }
    applyFilters() {
        if (this.statusFilter === status_filter_1.StatusFilter.All || this.isFirstLoad) {
            this.filteredTasks = this.tasks;
        }
        else if (this.statusFilter === status_filter_1.StatusFilter.Overdue) {
            this.filteredTasks = this.tasks.filter(task => this.isTaskOverdue(task));
        }
        else if (this.statusFilter === status_filter_1.StatusFilter.Todo) {
            this.filteredTasks = this.tasks.filter(task => !task.closed && !this.isTaskOverdue(task));
        }
        else if (this.statusFilter === status_filter_1.StatusFilter.Done) {
            this.filteredTasks = this.tasks.filter(task => task.closed);
        }
    }
    openDateTimeDialog($event, task, isDateDialog = true) {
        return __awaiter(this, void 0, void 0, function* () {
            $event.preventDefault();
            $event.stopPropagation();
            try {
                const dialogParams = isDateDialog
                    ? { title: "Due Date", field: "dueDate", type: "date" }
                    : { title: "Due Time", field: "dueDate", type: "time" };
                const result = isDateDialog
                    ? yield this.editDateTimeDialogService.showEditDateDialog($event, dialogParams.title, dialogParams.field, new Date(task.dueDate))
                    : yield this.editDateTimeDialogService.showEditTimeDialog($event, dialogParams.title, dialogParams.field, new Date(task.dueDate));
                // Update task in the service
                const updateMethod = isDateDialog
                    ? this.tasksDashboardsService.updateTaskDate.bind(this.tasksDashboardsService)
                    : this.tasksDashboardsService.updateTaskTime.bind(this.tasksDashboardsService);
                yield updateMethod(task.id, result.formattedDateTime);
                // Update local task object
                task.dueDate = result.formattedDateTime;
                // Refresh tasks
                yield this.getTasks();
            }
            catch (error) {
                console.error(`Error updating task ${isDateDialog ? 'date' : 'time'}:`, error);
            }
        });
    }
    openDateDialog($event, task) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.openDateTimeDialog($event, task, true);
        });
    }
    openTimeDialog($event, task) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.openDateTimeDialog($event, task, false);
        });
    }
    handleTaskCompletion(task) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.tasksDashboardsService.markTaskAsClosed(task.id, task.closed);
                yield this.getTasks();
            }
            catch (error) {
                console.error(`Error updating task status:`, error);
                task.closed = !task.closed;
            }
        });
    }
    isTaskOverdue(task) {
        if (task.closed)
            return false;
        return new Date(task.dueDate) < this.selectedDate;
    }
    formatDate(date) {
        return this.$filter('date')(date, 'EEEE (d/MM/yy)');
    }
    formatTime(dateString) {
        const date = new Date(dateString);
        return this.$filter('date')(date, 'h:mm a').toLowerCase();
    }
    getTasksByDate(date) {
        const dateStr = date.toISOString().split('T')[0];
        return this.filteredTasks.filter(task => {
            const taskDate = new Date(task.dueDate);
            return taskDate.toISOString().split('T')[0] === dateStr;
        });
    }
    getOverdueTasks() {
        return this.filteredTasks.filter(task => {
            if (task.closed)
                return false;
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
    changeDate(days) {
        return __awaiter(this, void 0, void 0, function* () {
            const newDate = new Date(this.selectedDate);
            newDate.setDate(newDate.getDate() + days);
            this.selectedDate = newDate;
            yield this.refreshDashboard();
        });
    }
    goToToday() {
        return __awaiter(this, void 0, void 0, function* () {
            this.selectedDate = new Date();
            yield this.refreshDashboard();
        });
    }
    refreshDashboard() {
        return __awaiter(this, void 0, void 0, function* () {
            this.initializeDates();
            yield this.getTasks();
        });
    }
    reassignTask($event, task) {
        return __awaiter(this, void 0, void 0, function* () {
            $event.stopPropagation();
            try {
                const users = yield this.DispatchService.getActiveStaff();
                const result = yield this.selectDialogService.showSelectDialog($event, users, "assignTask", "Reassign Task", task.assignee.id);
                yield this.tasksDashboardsService.reassignTask(task.id, result.value);
                yield this.getTasks();
                this.toastrService.showSuccessToast("Task reassigned successfully");
            }
            catch (error) {
                if (error === undefined) {
                    return; // Dialog closed
                }
                console.error('Error in reassignTask:', error);
                this.toastrService.showErrorToast("Error reassigning task");
            }
        });
    }
}
exports.TaskDashboardController = TaskDashboardController;
TaskDashboardController.$inject = [
    "greetingService",
    "$mdSidenav",
    "$filter",
    "tasksDashboardsService",
    "DispatchData",
    "$timeout",
    "selectDialogService",
    "toastrService",
    "editDateTimeDialogService"
];
