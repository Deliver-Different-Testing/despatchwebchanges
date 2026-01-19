/**
 * TaskDashboard Page Interfaces
 */

import {Dayjs} from 'dayjs';
import {Task} from '../../interfaces';

// Re-export Task for convenience
export type {Task};

export enum StatusFilter {
    All = 'all',
    Overdue = 'overdue',
    Todo = 'todo',
    Done = 'done'
}

export enum ViewMode {
    List = 'list',
    Calendar = 'calendar'
}

export interface DateFilterData {
    startDate: Dayjs;
    endDate: Dayjs;
    useTime?: boolean;
}

export interface StatusCounts {
    active: number;
    overdue: number;
    todo: number;
    done: number;
}

export interface ExtendedTask extends Task {
    dueTimeStr?: string;
}

export interface MountTaskDashboardConfig {
    showToast: (message: string, type: 'success' | 'warning' | 'error' | 'info') => void;
    isUsCustomer: boolean;
    onTaskSelect: (task: ExtendedTask | null) => void;
}

export interface TaskDashboardPageProps {
    showToast: (message: string, type: 'success' | 'warning' | 'error' | 'info') => void;
    isUsCustomer: boolean;
    onTaskSelect: (task: ExtendedTask | null) => void;
    setRefreshCallback?: (callback: () => void) => void;
}
