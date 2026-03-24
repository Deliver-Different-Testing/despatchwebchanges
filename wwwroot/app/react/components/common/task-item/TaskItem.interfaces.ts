/**
 * Task Item Interfaces
 *
 * Type definitions for the React TaskItem component.
 */

import {Dayjs} from 'dayjs';

export interface TaskAssignee {
    id: number;
    text: string;
}

export interface Task {
    id: number;
    title: string;
    description: string;
    dueDate: Dayjs;
    closed: boolean;
    assignee: TaskAssignee;
    jobId: number;
    eventType: string;
    jobNumber: string;
    courierCode?: string;
    courierName?: string;
    priority?: 'high' | 'medium' | 'low';
    _dueDateString?: string;
    _dueTimeString?: string;
}

export interface TaskItemConfig {
    showJobId?: boolean;
    showAssignee?: boolean;
    showCourier?: boolean;
    showJobType?: boolean;
    showDateTime?: boolean;
    showDescription?: boolean;
    showStatusIndicators?: boolean;
    allowCompletion?: boolean;
    showOverdueWarning?: boolean;
    onTaskClick?: boolean;
    compactView?: boolean;
    customClass?: string;
}

// Alias for backward compatibility with AngularJS controllers
export type ITaskListItemConfig = TaskItemConfig;

export interface TasksServiceInterface {
    markTaskAsClosed(eventId: number, closed: boolean): Promise<void>;
    updateTaskDate(eventId: number, date: Dayjs): Promise<void>;
    updateTaskTime(eventId: number, time: Dayjs): Promise<void>;
    reassignTaskToStaff(eventId: number, staffId: number): Promise<void>;
}

export interface DispatchServiceInterface {
    getActiveStaff(): Promise<Array<{id: number; text: string}>>;
}

export interface TaskItemProps {
    task: Task;
    config?: TaskItemConfig;
    onTaskUpdated?: () => void;
    onTaskClick?: (task: Task) => void;
    tasksService: TasksServiceInterface;
    dispatchService: DispatchServiceInterface;
    showSuccessToast?: (message: string) => void;
    showErrorToast?: (message: string) => void;
}
