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
    onLayoutActionsChange?: (actions: LayoutActions) => void;
}

// Layout actions interface for app bar integration
export interface LayoutActions {
    layouts: { name: string }[];
    currentLayoutName: string;
    onSaveLayout: () => void;
    onLoadLayout: (index: number) => void;
    onDeleteLayout: (index: number) => void;
}

export interface TaskDashboardPageProps {
    showToast: (message: string, type: 'success' | 'warning' | 'error' | 'info') => void;
    isUsCustomer: boolean;
    onTaskSelect: (task: ExtendedTask | null) => void;
    setRefreshCallback?: (callback: () => void) => void;
    onLayoutActionsChange?: (actions: LayoutActions) => void;
}

// Grid layout types
export interface DashboardLayoutItem {
    i: string;
    x: number;
    y: number;
    w: number;
    h: number;
    minW?: number;
    minH?: number;
    maxW?: number;
    maxH?: number;
    static?: boolean;
}

export type DashboardLayouts = {
    [breakpoint: string]: DashboardLayoutItem[];
};

export enum DashboardWidget {
    Filters = 'filters',
    Tasks = 'tasks',
    Calendar = 'calendar',
    DeliveryJourney = 'deliveryJourney',
}

// Saved layout types
export interface SavedLayout {
    name: string;
    listLayouts: DashboardLayouts;
    calendarLayouts: DashboardLayouts;
    isDefault?: boolean;
}

export interface SavedLayoutsState {
    layouts: SavedLayout[];
    activeLayoutName: string;
}
