/**
 * TaskDashboard Page Interfaces
 */

import {Dayjs} from 'dayjs';
import {Task} from '../../interfaces';
import type {ShowToastFn} from '../../services/toastService';

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
    showToast: ShowToastFn;
    isUsCustomer: boolean;
    onLayoutActionsChange?: (actions: LayoutActions) => void;
}

// Layout actions interface for app bar integration (kept for module bridge compatibility)
export interface LayoutActions {
    layouts: { name: string }[];
    currentLayoutName: string;
    onSaveLayout: () => void;
    onLoadLayout: (index: number) => void;
    onDeleteLayout: (index: number) => void;
}

export interface TaskDashboardPageProps {
    showToast: ShowToastFn;
    isUsCustomer: boolean;
    setRefreshCallback?: (callback: () => void) => void;
    onLayoutActionsChange?: (actions: LayoutActions) => void;
}
