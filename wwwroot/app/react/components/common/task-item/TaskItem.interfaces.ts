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
    clientCode?: string;
    priority?: 'high' | 'medium' | 'low';
    _dueDateString?: string;
    _dueTimeString?: string;
}

export interface TaskItemConfig {
    showJobId?: boolean;
    showAssignee?: boolean;
    showJobType?: boolean;
    showCourierCode?: boolean;
    showClientCode?: boolean;
    showDateTime?: boolean;
    showDescription?: boolean;
    showStatusIndicators?: boolean;
    allowCompletion?: boolean;
    showOverdueWarning?: boolean;
    onTaskClick?: boolean;
    /** When true, clicking an unassigned, open task also claims it for the current user. */
    autoAssignOnClick?: boolean;
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
    /** Current user's staff id; required for `config.autoAssignOnClick` to take effect. */
    currentUserId?: number;
    tasksService: TasksServiceInterface;
    dispatchService: DispatchServiceInterface;
    showSuccessToast?: (message: string) => void;
    showErrorToast?: (message: string) => void;
}
