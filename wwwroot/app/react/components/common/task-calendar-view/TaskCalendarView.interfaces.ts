/**
 * Task Calendar View Interfaces
 *
 * TypeScript interfaces for the React TaskCalendarView component.
 */

import {Dayjs} from 'dayjs';
import {Task} from '../task-item/TaskItem.interfaces';

export type ViewMode = 'month' | 'week' | 'day';

export interface CalendarDay {
    date: Dayjs;
    isToday: boolean;
    isCurrentMonth: boolean;
    dayNumber: number;
    monthName: string;
    tasks: Task[];
}

export interface CalendarWeek {
    weekNumber: number;
    days: CalendarDay[];
}

export interface TaskCalendarViewProps {
    tasks: Task[];
    onTaskUpdate?: () => void;
    onTaskClick?: (task: Task) => void;
    onTaskStatusChange?: (task: Task) => void;
    onViewChange?: (startDate: Date, endDate: Date) => void;
    tasksService: TasksServiceInterface;
    showSuccessToast?: (message: string) => void;
    showErrorToast?: (message: string) => void;
}

export interface TasksServiceInterface {
    markTaskAsClosed(taskId: number, closed: boolean): Promise<void>;
}

export interface TaskCalendarViewState {
    currentDate: Dayjs;
    viewMode: ViewMode;
    calendarWeeks: CalendarWeek[];
    weekDays: Dayjs[];
    selectedDate: Dayjs;
    timeSlots: string[];
}
