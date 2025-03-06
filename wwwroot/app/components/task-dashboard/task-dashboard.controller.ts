import {Task, TaskTableFiltersRequest} from "./task-dashboard.interfaces";
import "./task-dashboard.styles.less";
import app from "../../app";
import GreetingService from "../../services/greeting.service";
import TasksDashboardService from "./tasks-dashboard.service";
import DispatchService from "../../services/dispatch.service";
import {ActiveCourier} from "../../interfaces/courier.interface";
import {Suggestion} from "../../interfaces/job.interface";
import editDateTimeDialogTemplate from "../dialogs/edit-date-time-dialog/edit-date-time-dialog.html";

interface ExtendedTask extends Task {
    dueTimeStr?: string;
}

class TaskDashboardController implements angular.IController {
    static $inject = ["greetingService", "$mdSidenav", "$filter", "$mdDialog", "tasksDashboardsService", "DispatchData"];

    greeting: string;
    tasksLoading: boolean = true;

    // View state
    viewMode: string = 'list';
    calendarViewMode: boolean = false;

    // Default filter states
    searchQuery: string = '';
    courierFilter: string = 'all';
    eventTypeFilter: string = 'all';
    statusFilter: string = 'all';

    // Calendar data
    weekDates: Date[] = [];
    today: Date = new Date();

    // Tasks data
    tasks: ExtendedTask[] = [];
    filteredTasks: ExtendedTask[] = [];

    // Time options for the dropdown
    timeOptions: string[] = [];

    courierList?: ActiveCourier[];
    eventTypesList?: Suggestion[];

    constructor(
        greetingService: GreetingService,
        private $mdSidenav: angular.material.ISidenavService,
        private $filter: angular.IFilterService,
        private $mdDialog: angular.material.IDialogService,
        private tasksDashboardsService: TasksDashboardService,
        private DispatchService: DispatchService
    ) {
        this.greeting = greetingService.greetUser(FirstName);
        this.generateTimeOptions();
        console.log('$onInit: Initializing component');
        this.loadLists();
        
        this.initializeDates();
        this.calendarViewMode = this.viewMode === 'calendar';
        console.log('$onInit: Initialized with viewMode:', this.viewMode, 'calendarViewMode:', this.calendarViewMode);

        this.getTasks();
    }
       
    
    loadLists() {
        console.log('loadLists: Starting to load courier and job type lists');
        this.DispatchService.getAllCouriers()
            .then(couriers => {
                console.log('loadLists: Received couriers data, count:', couriers.length);
                this.courierList = couriers;
                return this.DispatchService.getEventTypes();
            })
            .then(eventTypes => {
                console.log('loadLists: Received job types data, count:', eventTypes.length);
                this.eventTypesList = eventTypes;
                console.log('loadLists: Successfully loaded all lists');
            })
            .catch(error => {
                console.error('Error loading lists:', error);
            });
    }

    toggleSidenav(): void {
        this.$mdSidenav("right").toggle();
    }

    toggleViewMode(): void {
        this.viewMode = this.calendarViewMode ? 'calendar' : 'list';
    }

    // Generate time options in 30 minute intervals
    generateTimeOptions(): void {
        this.timeOptions = [];
        for (let hour = 0; hour < 24; hour++) {
            const formattedHour = hour < 10 ? `0${hour}` : `${hour}`;
            this.timeOptions.push(`${formattedHour}:00`);
            this.timeOptions.push(`${formattedHour}:30`);
        }
    }

    // Initialize dates for calendar view
    initializeDates(): void {
        const dayOfWeek = this.today.getDay();

        // Generate dates for the current week (Sunday to Saturday)
        const startDate = new Date(this.today);
        startDate.setDate(this.today.getDate() - dayOfWeek); // Start from Sunday

        this.weekDates = Array.from({length: 7}, (_, i) => {
            const date = new Date(startDate);
            date.setDate(startDate.getDate() + i);
            return date;
        });
    }

    async openDateTimeDialog($event: MouseEvent, task: ExtendedTask, showDate: boolean = true, showTime: boolean = true): Promise<void> {
        $event.preventDefault();
        $event.stopPropagation();
    
        try {
            const result = await this.$mdDialog.show({
                controller: 'EditDateTimeDialogController',
                controllerAs: 'ctrl',
                template: editDateTimeDialogTemplate,
                parent: document.body,
                targetEvent: $event,
                clickOutsideToClose: true,
                locals: {
                    job: { id: task.id },
                    title: showDate && showTime ? 'Due Date & Time' : (showDate ? 'Due Date' : 'Due Time'),
                    fieldName: 'dueDate',
                    dateTime: task.dueDate,
                    id: 'task-date-time-dialog',
                    showDate: showDate,
                    showTime: showTime
                }
            });
    
            if (result) {
                // Update the task with the new date/time
                if (showDate && !showTime) {
                    this.updateTaskDate(task, result);
                } else if (!showDate && showTime) {
                    this.updateTaskTime(task, this.formatTimeForUpdate(result));
                } else {
                    // Both date and time were updated - need to make a combined update
                    const newDateTime = new Date(result);
                    
                    // First update the date
                    this.tasksDashboardsService.updateTaskDate(task.id, newDateTime)
                        .then(() => {
                            // Then update the time
                            return this.tasksDashboardsService.updateTaskTime(task.id, newDateTime);
                        })
                        .then(() => {
                            console.log(`Successfully updated date and time for task "${task.title}"`);
                            
                            // Update local object after successful API calls
                            task.dueDate = newDateTime;
                            const hours = newDateTime.getHours();
                            const minutes = newDateTime.getMinutes();
                            task.dueTimeStr = `${hours < 10 ? '0' + hours : hours}:${minutes < 10 ? '0' + minutes : minutes}`;
                            
                            // Reload tasks to reflect changes
                            this.getTasks();
                        })
                        .catch(error => {
                            console.error(`Error updating task date and time:`, error);
                        });
                }
            }
        } catch (error) {
            console.error('Error in openDateTimeDialog:', error);
            throw error;
        }
    }

    // Format time from Date object to string (HH:MM)
    private formatTimeForUpdate(dateObj: Date): string {
        const hours = dateObj.getHours();
        const minutes = dateObj.getMinutes();
        return `${hours < 10 ? '0' + hours : hours}:${minutes < 10 ? '0' + minutes : minutes}`;
    }

    // Convenience methods for specific dialog types
    async openDateDialog($event: MouseEvent, task: ExtendedTask) {
        await this.openDateTimeDialog($event, task, true, false);
    }

    async openTimeDialog($event: MouseEvent, task: ExtendedTask) {
        await this.openDateTimeDialog($event, task, false, true);
    }

    // Initialize time strings for tasks
    initializeTaskTimeStrings(): void {
        this.tasks.forEach(task => {
            // Extract time as a string for the time picker (HH:MM format)
            const hours = task.dueDate.getHours();
            const minutes = task.dueDate.getMinutes();
            // Round to nearest 30 min (0 or 30)
            const roundedMinutes = minutes < 30 ? 0 : 30;
            const formattedHours = hours < 10 ? `0${hours}` : `${hours}`;
            task.dueTimeStr = `${formattedHours}:${roundedMinutes === 0 ? '00' : roundedMinutes}`;
        });
    }

    onFilterChange(): void {
        this.getTasks();
    }

    // Toggle status filter
    setStatusFilter(status: string): void {
        this.statusFilter = status;
        this.applyFilters();
    }

    // Apply status filters after tasks are loaded
    applyFilters(): void {
        console.log('applyFilters: Applying status filter:', this.statusFilter);
        
        // Apply status filter to the loaded tasks
        if (this.statusFilter === 'all') {
            this.filteredTasks = this.tasks;
        } else if (this.statusFilter === 'overdue') {
            this.filteredTasks = this.tasks.filter(task => this.isTaskOverdue(task));
        } else if (this.statusFilter === 'todo') {
            this.filteredTasks = this.tasks.filter(task => !task.closed && !this.isTaskOverdue(task));
        } else if (this.statusFilter === 'done') {
            this.filteredTasks = this.tasks.filter(task => task.closed);
        }
        
        console.log('applyFilters: Filtered tasks count:', this.filteredTasks.length);
    }

    getTasks(): void {
        console.log('getTasks: Starting task retrieval');
        this.tasksLoading = true;
        
        // Create filters request object
        const filters: TaskTableFiltersRequest = {};
        console.log('getTasks: Initializing empty filter object');
    

        // Add courier filter
        if (this.courierFilter && this.courierFilter !== 'all') {
            filters.courierId = parseInt(this.courierFilter, 10);
            console.log('getTasks: Applied courier filter, courierId:', filters.courierId);
        }
    
        // Add event type filter
        if (this.eventTypeFilter && this.eventTypeFilter !== 'all') {
            filters.eventTypeId = parseInt(this.eventTypeFilter, 10);
            console.log('getTasks: Applied job type filter, eventTypeId:', filters.eventTypeId);
        }

        // Add search query
        if (this.searchQuery) {
            filters.searchText = this.searchQuery;
            console.log('getTasks: Applied search filter:', filters.searchText);
        }
    
        console.log('getTasks: Sending request with filters:', filters);
    
        // Call the service with filters
        this.tasksDashboardsService.getAllTasks(filters)
            .then((tasks: Task[]) => {
                console.log('getTasks: Received tasks, count:', tasks.length);
                this.tasks = tasks as ExtendedTask[];
                console.log('getTasks: Converting to ExtendedTask objects');
                this.initializeTaskTimeStrings();
                console.log('getTasks: Task time strings initialized');
                
                // Apply status filter after loading tasks
                this.applyFilters();
                
                this.tasksLoading = false;
                console.log('getTasks: Task loading complete');
            })
            .catch((error) => {
                console.error('getTasks: Error loading tasks:', error);
                this.tasksLoading = false;
                console.log('getTasks: Task loading failed');
            });
    }

    // Check if task is overdue
    isTaskOverdue(task: Task): boolean {
        if (task.closed) return false;
        return new Date(task.dueDate) < new Date();
    }

    // Format date for display
    formatDate(date: Date): string {
        return this.$filter('date')(date, 'EEEE (d/MM/yy)');
    }

    // Format time for display
    formatTime(dateString: string): string {
        const date = new Date(dateString);
        return this.$filter('date')(date, 'h:mm a').toLowerCase();
    }

    // Get tasks for a specific date (for calendar view)
    getTasksByDate(date: Date): ExtendedTask[] {
        const dateStr = date.toISOString().split('T')[0];
        return this.filteredTasks.filter(task => {
            const taskDate = new Date(task.dueDate);
            return taskDate.toISOString().split('T')[0] === dateStr;
        });
    }

    // Get overdue tasks
    getOverdueTasks(): ExtendedTask[] {
        return this.filteredTasks.filter(task => {
            if (task.closed) return false;

            const taskDate = new Date(task.dueDate);
            const todayStart = new Date(this.today);
            todayStart.setHours(0, 0, 0, 0);

            return taskDate < todayStart;
        });
    }

    handleTaskCompletion(task: Task): void {
        console.log(`Task "${task.title}" is now ${task.closed ? 'closed' : 'open'}`);
        
        // Call the service to update the task status in the backend
        this.tasksDashboardsService.markTaskAsClosed(task.id, task.closed)
            .then(() => {
                console.log(`Successfully updated task "${task.title}" status in the backend`);
                // Reload tasks to reflect status change
                this.getTasks();
            })
            .catch(error => {
                console.error(`Error updating task status:`, error);
                // Revert the checkbox state in case of failure
                task.closed = !task.closed;
            });
    }

    updateTaskDate(task: ExtendedTask, dateObj: Date): void {
        if (!dateObj) return;
    
        const newDate = new Date(task.dueDate);
        // Only update date components, preserve time
        newDate.setFullYear(dateObj.getFullYear());
        newDate.setMonth(dateObj.getMonth());
        newDate.setDate(dateObj.getDate());
        
        // Call the service to update the date in the backend
        this.tasksDashboardsService.updateTaskDate(task.id, newDate)
            .then(() => {
                console.log(`Successfully updated date for task "${task.title}"`);
                
                // Update local object after successful API call
                task.dueDate = newDate;
                
                // Reload tasks to reflect changes
                this.getTasks();
            })
            .catch(error => {
                console.error(`Error updating task date:`, error);
            });
    }

   updateTaskTime(task: ExtendedTask, timeString: string): void {
    if (!timeString) return;

    const [hours, minutes] = timeString.split(':');
    const newDate = new Date(task.dueDate);
    newDate.setHours(parseInt(hours, 10));
    newDate.setMinutes(parseInt(minutes, 10));
    
    // Call the service to update the time in the backend
    this.tasksDashboardsService.updateTaskTime(task.id, newDate)
        .then(() => {
            console.log(`Successfully updated time for task "${task.title}"`);
            
            // Update local object after successful API call
            task.dueDate = newDate;
            task.dueTimeStr = timeString;
            
            // Reload tasks to reflect changes
            this.getTasks();
        })
        .catch(error => {
            console.error(`Error updating task time:`, error);
        });
}

    // Get status counts for display in header
    getStatusCounts() {
        return {
            overdue: this.tasks.filter(task => this.isTaskOverdue(task)).length,
            todo: this.tasks.filter(task => !task.closed && !this.isTaskOverdue(task)).length,
            done: this.tasks.filter(task => task.closed).length
        };
    }
}

app.controller("taskDashboardController", TaskDashboardController);