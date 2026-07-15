/**
 * TaskDashboard Page Interfaces
 */

import {Dayjs} from 'dayjs';
import {Task} from '../../interfaces';
import type {ShowToastFn} from '../../services/toastService';

// Re-export Task for convenience
export type {Task};

// Time-to-action buckets — the stat cards and the queue's date-group headers
// share this single taxonomy. `All` is the default (all active work) and is not
// a card; the four cards below are Overdue / DueToday / Upcoming / Done.
export enum StatusFilter {
    All = 'all',
    Overdue = 'overdue',
    DueToday = 'dueToday',
    Upcoming = 'upcoming',
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
    overdue: number;
    dueToday: number;
    upcoming: number;
    done: number;
}

export interface ExtendedTask extends Task {
    dueTimeStr?: string;
}

export interface MountTaskDashboardConfig {
    showToast: ShowToastFn;
    isUsCustomer: boolean;
}

export interface TaskDashboardPageProps {
    showToast: ShowToastFn;
    isUsCustomer: boolean;
    setRefreshCallback?: (callback: () => void) => void;
}
