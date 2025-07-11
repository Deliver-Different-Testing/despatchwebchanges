import "./task-calendar-view.styles.less";
import dayjs from "dayjs";
import isoWeek from "dayjs/plugin/isoWeek";
import weekday from "dayjs/plugin/weekday";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import {ExtendedTask, TaskViewModel} from "../task-dashboard.interfaces";
import {ITaskListItemConfig} from "../../common/task-item-component/task-item.interfaces";
import {CalendarDay, CalendarWeek} from "./task-calendar-view.interfaces";
import BaseController from "../../base-controller";
import TasksService from "../../../services/tasks.service";

dayjs.extend(isoWeek);
dayjs.extend(weekday);
dayjs.extend(utc);
dayjs.extend(timezone);

class TaskCalendarViewController extends BaseController {
    static $inject = [
        "tasksService",
        "$scope",
        "$timeout",
        "$interval",
    ];

    tasks?: ExtendedTask[];
    onTaskUpdate?: () => void;
    onTaskClick?: (params: {task: ExtendedTask}) => void;
    onTaskStatusChange?: (params: {task: ExtendedTask}) => void;
    onViewChange?: (viewInfo: { startDate: Date, endDate: Date }) => void;
    timezone: string;

    currentDate: dayjs.Dayjs;
    viewMode: 'month' | 'week' | 'day' = 'month';
    calendarWeeks: CalendarWeek[] = [];
    weekDays: dayjs.Dayjs[] = [];
    selectedDate: dayjs.Dayjs;

    calendarTaskConfig: ITaskListItemConfig = {
        showJobId: false,
        showAssignee: false,
        showJobType: false,
        showDateTime: false,
        customClass: '',
        allowCompletion: true,
        showStatusIndicators: false,
        showOverdueWarning: false,
        onTaskClick: false,
    };

    timeSlots: string[] = [];

    constructor(
        private tasksService: TasksService,
        $scope: angular.IScope,
        $timeout: angular.ITimeoutService,
        $interval: angular.IIntervalService,
    ) {
        super();
        this.initServices($timeout, $interval, $scope);

        this.timezone = TimeZone;

        this.currentDate = dayjs();
        this.selectedDate = dayjs();
        this.generateTimeSlots();
    }

    $onInit() {
        this.initializeCalendar();
        this.emitViewChange();

        this.applyScope();
    }

    $onChanges(changes: angular.IOnChangesObject) {
        if (changes.tasks && !changes.tasks.isFirstChange()) {
            this.initializeCalendar();
            this.applyScope();
        }
    }

    private generateTimeSlots(): void {
        this.timeSlots = [];
        for (let hour = 0; hour < 24; hour++) {
            this.timeSlots.push(dayjs().hour(hour).minute(0).format('HH:mm'));
        }
    }

    private initializeCalendar(): void {
        switch (this.viewMode) {
            case 'month':
                this.buildMonthView();
                break;
            case 'week':
                this.buildWeekView();
                break;
            case 'day':
                this.buildDayView();
                break;
        }
    }

    private buildMonthView(): void {
        const startOfMonth = this.currentDate.startOf('month');
        const endOfMonth = this.currentDate.endOf('month');
        const startDate = startOfMonth.startOf('week');
        const endDate = endOfMonth.endOf('week');

        this.calendarWeeks = [];
        let currentWeek = startDate;

        while (currentWeek.isBefore(endDate) || currentWeek.isSame(endDate, 'day')) {
            const week: CalendarWeek = {
                weekNumber: currentWeek.isoWeek(),
                days: []
            };

            for (let i = 0; i < 7; i++) {
                const dayDate = currentWeek.add(i, 'day');
                week.days.push(this.createCalendarDay(dayDate));
            }

            this.calendarWeeks.push(week);
            currentWeek = currentWeek.add(1, 'week');
        }
    }

    private buildWeekView(): void {
        const startOfWeek = this.currentDate.startOf('week');
        this.weekDays = [];

        for (let i = 0; i < 7; i++) {
            this.weekDays.push(startOfWeek.add(i, 'day'));
        }
    }

    private buildDayView(): void {
        this.selectedDate = this.currentDate;
    }

    private createCalendarDay(date: dayjs.Dayjs): CalendarDay {
        return {
            date: date,
            isToday: date.isSame(dayjs(), 'day'),
            isCurrentMonth: date.isSame(this.currentDate, 'month'),
            dayNumber: date.date(),
            monthName: date.format('MMM'),
            tasks: this.getTasksForDate(date)
        };
    }

    private getTasksForDate(date: dayjs.Dayjs): ExtendedTask[] {
        if (!this.tasks) return [];

        return this.tasks.filter(task => {
            const taskDate = dayjs(task.dueDate);
            return taskDate.isSame(date, 'day');
        });
    }

    getTasksForTimeSlot(date: dayjs.Dayjs, timeSlot: string): ExtendedTask[] {
        if (!this.tasks || !date) return [];

        const [hours, minutes] = timeSlot.split(':').map(Number);
        const slotStart = date.hour(hours).minute(minutes);
        const slotEnd = slotStart.add(30, 'minute');

        return this.tasks.filter(task => {
            const taskDate = dayjs(task.dueDate);
            return taskDate.isSame(date, 'day') &&
                (taskDate.isSame(slotStart) || taskDate.isAfter(slotStart)) &&
                taskDate.isBefore(slotEnd);
        });
    }

    getOverdueTasks(): ExtendedTask[] {
        if (!this.tasks) return [];

        const now = dayjs();
        return this.tasks.filter(task => {
            if (task.closed) return false;
            return dayjs(task.dueDate).isBefore(now);
        });
    }

    previousPeriod(): void {
        switch (this.viewMode) {
            case 'month':
                this.currentDate = this.currentDate.subtract(1, 'month');
                break;
            case 'week':
                this.currentDate = this.currentDate.subtract(1, 'week');
                break;
            case 'day':
                this.currentDate = this.currentDate.subtract(1, 'day');
                break;
        }

        this.initializeCalendar();
        this.emitViewChange();
    }

    nextPeriod(): void {
        switch (this.viewMode) {
            case 'month':
                this.currentDate = this.currentDate.add(1, 'month');
                break;
            case 'week':
                this.currentDate = this.currentDate.add(1, 'week');
                break;
            case 'day':
                this.currentDate = this.currentDate.add(1, 'day');
                break;
        }

        this.initializeCalendar();
        this.emitViewChange();
    }

    goToToday(): void {
        this.currentDate = dayjs();
        this.selectedDate = dayjs();

        this.initializeCalendar();
        this.emitViewChange();
    }

    selectDate(date: dayjs.Dayjs): void {
        this.selectedDate = date;
        if (this.viewMode === 'month') {
            this.currentDate = date;
            this.setViewMode('day');
        }
    }

    setViewMode(mode: 'month' | 'week' | 'day'): void {
        this.viewMode = mode;
        this.initializeCalendar();
        this.emitViewChange();
    }

    handleTaskClick(task: ExtendedTask): void {
        if (this.onTaskClick) {
            this.onTaskClick({task: task});
        }
    }

    handleTaskStatusChange(task: ExtendedTask): void {
        console.log('Task status changed:', task.id, 'closed:', task.closed);
        if (this.onTaskStatusChange) {
            this.onTaskStatusChange({task: task});
        }
    }

    handleTaskUpdate(): void {
        if (this.onTaskUpdate) {
            this.onTaskUpdate();
        }
    }

    async handleTaskCheckboxChange(task: ExtendedTask): Promise<void> {
        task.closed = !task.closed;
        await this.tasksService.markTaskAsClosed(task.id, task.closed);

        this.handleTaskStatusChange(task);

        this.initializeCalendar();
        this.applyScope();
    }

    formatPeriodTitle(): string {
        switch (this.viewMode) {
            case 'month':
                return this.currentDate.format('MMMM YYYY');
            case 'week':
                const weekStart = this.currentDate.startOf('week');
                const weekEnd = this.currentDate.endOf('week');
                if (weekStart.month() === weekEnd.month()) {
                    return `${weekStart.format('MMM D')} - ${weekEnd.format('D, YYYY')}`;
                } else if (weekStart.year() === weekEnd.year()) {
                    return `${weekStart.format('MMM D')} - ${weekEnd.format('MMM D, YYYY')}`;
                } else {
                    return `${weekStart.format('MMM D, YYYY')} - ${weekEnd.format('MMM D, YYYY')}`;
                }
            case 'day':
                return this.currentDate.format('dddd, MMMM D, YYYY');
        }
    }

    formatDayHeader(date: dayjs.Dayjs): string {
        return date.format('ddd');
    }

    formatWeekDayHeader(date: dayjs.Dayjs): string {
        const format = date.isSame(dayjs(), 'day') ? '[Today], MMM D' : 'ddd, MMM D';
        return date.format(format);
    }

    formatTimeSlot(time: string): string {
        const [hours] = time.split(':').map(Number);
        return dayjs().hour(hours).minute(0).format('h A');
    }

    isToday(date: dayjs.Dayjs): boolean {
        return date.isSame(dayjs(), 'day');
    }

    isSelected(date: dayjs.Dayjs): boolean {
        return date.isSame(this.selectedDate, 'day');
    }

    isPastDate(date: dayjs.Dayjs): boolean {
        return date.isBefore(dayjs(), 'day');
    }

    getTaskPriorityClass(task: TaskViewModel): string {
        if (this.isTaskOverdue(task)) return 'high';
        return 'medium';
    }

    isTaskOverdue(task: TaskViewModel): boolean {
        if (task.closed) return false;
        return dayjs(task.dueDate).isBefore(dayjs());
    }

    private emitViewChange(): void {
        if (this.onViewChange) {
            let startDate: dayjs.Dayjs;
            let endDate: dayjs.Dayjs;

            switch (this.viewMode) {
                case 'month':
                    startDate = this.currentDate.startOf('month').startOf('week');
                    endDate = this.currentDate.endOf('month').endOf('week');
                    break;
                case 'week':
                    startDate = this.currentDate.startOf('week');
                    endDate = this.currentDate.endOf('week');
                    break;
                case 'day':
                    startDate = this.currentDate.startOf('day');
                    endDate = this.currentDate.endOf('day');
                    break;
            }

            this.onViewChange({
                startDate: startDate.toDate(),
                endDate: endDate.toDate()
            });
        }
    }
}

const TaskCalendarViewComponent: angular.IComponentOptions = {
    template: require("./task-calendar-view.template.html"),
    controller: TaskCalendarViewController,
    controllerAs: "ctrl",
    bindings: {
        tasks: '<',
        onTaskUpdate: '&',
        onTaskClick: '&',
        onTaskStatusChange: '&',
        onViewChange: '&',
    }
}

export default TaskCalendarViewComponent;
