import "./task-calendar-view.styles.less";
import dayjs from "dayjs";
import isoWeek from "dayjs/plugin/isoWeek";
import weekday from "dayjs/plugin/weekday";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import {ExtendedTask, TaskViewModel} from "../task-dashboard.interfaces";
import {ITaskListItemConfig} from "../../common/task-item-component/task-item.interfaces";
import {CalendarDay, CalendarWeek} from "./task-calendar-view.interfaces";

dayjs.extend(isoWeek);
dayjs.extend(weekday);
dayjs.extend(utc);
dayjs.extend(timezone);

class TaskCalendarViewController {
    static $inject = [
        "$scope",
        "$timeout",
        "$mdDialog"
    ];

    tasks?: ExtendedTask[];
    onTaskUpdate?: () => void;
    onTaskClick?: (task: ExtendedTask) => void;
    onTaskStatusChange?: (task: ExtendedTask) => void;
    timezone: string;

    currentDate: dayjs.Dayjs;
    viewMode: 'month' | 'week' | 'day' = 'month';
    calendarWeeks: CalendarWeek[] = [];
    weekDays: dayjs.Dayjs[] = [];
    selectedDate: dayjs.Dayjs;

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

    timeSlots: string[] = [];

    constructor() {
        this.timezone = TimeZone;

        this.currentDate = dayjs();
        this.selectedDate = dayjs();
        this.generateTimeSlots();
        this.initializeCalendar();
    }

    $onChanges(changes: angular.IOnChangesObject) {
        if (changes.tasks && !changes.tasks.isFirstChange()) {
            this.initializeCalendar();
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
        if (!this.tasks) return [];

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
    }

    goToToday(): void {
        this.currentDate = dayjs();
        this.selectedDate = dayjs();
        this.initializeCalendar();
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
    }

    handleTaskClick(task: ExtendedTask): void {
        if (this.onTaskClick) {
            this.onTaskClick(task);
        }
    }

    handleTaskStatusChange(task: ExtendedTask): void {
        if (this.onTaskStatusChange) {
            this.onTaskStatusChange(task);
        }
    }

    handleTaskUpdate(): void {
        if (this.onTaskUpdate) {
            this.onTaskUpdate();
        }
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
}

const TaskCalendarViewComponent: angular.IComponentOptions = {
    template: require("./task-calendar-view.template.html"),
    controller: TaskCalendarViewController,
    controllerAs: "cal",
    bindings: {
        tasks: '<',
        onTaskUpdate: '&',
        onTaskClick: '&',
        onTaskStatusChange: '&',
        timezone: '@'
    }
}

export default TaskCalendarViewComponent;
