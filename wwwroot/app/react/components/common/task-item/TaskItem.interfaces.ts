/**
 * Task Item Interfaces
 *
 * Type definitions for the React TaskItem component. The task shapes themselves are the
 * API ones — re-exported here so the component keeps its own import path.
 */

import {Dayjs} from 'dayjs';
import type Task from '../../../interfaces/tasks';

export type {TaskAssignee} from '../../../interfaces/tasks';
export type {default as Task} from '../../../interfaces/tasks';

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
    unassignTask(eventId: number): Promise<void>;
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
