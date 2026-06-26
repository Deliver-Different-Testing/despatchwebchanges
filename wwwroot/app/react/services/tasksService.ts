/**
 * Tasks Service
 *
 * Utility functions for task management including filter building,
 * localStorage persistence, and task counting.
 * Migrated from AngularJS tasks.service.ts.
 */

import {TaskFiltersRequest, Task, StaffSuggestion, EventTypeSuggestion} from '../interfaces';

/**
 * App page types for filter storage
 */
export enum AppPage {
    Dispatch = 1,
    Domestic = 2,
    JobSearch = 3,
    Recurring = 4,
    Overview = 5,
    Tasks = 6,
    MegaMap = 7,
    DriverManagement = 8,
}

/**
 * Status filter values for tasks
 */
export const StatusFilterValue = {
    All: 'all',
    Overdue: 'overdue',
    Todo: 'todo',
    Done: 'done',
} as const;

/**
 * Task filter type options
 */
export type TaskFilterType = 'mine' | 'unassigned' | 'newest' | 'oldest' | 'all';

/**
 * Get the current contact ID from window
 */
function getContactId(): number {
    return window.ContactID || 0;
}

/**
 * The current logged-in user's staff id, as used by the "Mine" task filter.
 * Same value the assignee chip compares against (task.assignee.id === this).
 */
export function getCurrentUserId(): number {
    return getContactId();
}

/**
 * Check if localStorage is available
 */
function isLocalStorageAvailable(): boolean {
    try {
        const test = '__localStorage_test__';
        localStorage.setItem(test, test);
        localStorage.removeItem(test);
        return true;
    } catch {
        return false;
    }
}

/**
 * Filter storage key names for each page
 */
interface PageFilterNames {
    staff: string;
    eventType: string;
}

/**
 * Get filter storage key names for a specific app page
 */
function getPageFilterNames(appPage: AppPage): PageFilterNames {
    const contactId = getContactId();

    const mapping: Record<AppPage, PageFilterNames> = {
        [AppPage.Dispatch]: {
            staff: `selectedSupportTypeDispatchFilter-${contactId}`,
            eventType: `selectedSupportTypeDispatchFilter-${contactId}`,
        },
        [AppPage.Domestic]: {
            staff: `selectedSupportTypeNWFilter-${contactId}`,
            eventType: `selectedSupportTypeNWFilter-${contactId}`,
        },
        [AppPage.Tasks]: {
            staff: `selectedSupportTypeTasksFilter-${contactId}`,
            eventType: `selectedSupportTypeTasksFilter-${contactId}`,
        },
        [AppPage.JobSearch]: {
            staff: `selectedSupportTypeJobSearchFilter-${contactId}`,
            eventType: `selectedSupportTypeJobSearchFilter-${contactId}`,
        },
        [AppPage.Recurring]: {
            staff: `selectedSupportTypeRecurringFilter-${contactId}`,
            eventType: `selectedSupportTypeRecurringFilter-${contactId}`,
        },
        [AppPage.Overview]: {
            staff: `selectedSupportTypeOverviewFilter-${contactId}`,
            eventType: `selectedSupportTypeOverviewFilter-${contactId}`,
        },
        [AppPage.MegaMap]: {
            staff: `selectedSupportTypeMegaMapFilter-${contactId}`,
            eventType: `selectedSupportTypeMegaMapFilter-${contactId}`,
        },
        [AppPage.DriverManagement]: {
            staff: `selectedSupportType-${AppPage.DriverManagement}-Filter-${contactId}`,
            eventType: `selectedSupportType-${AppPage.DriverManagement}-Filter-${contactId}`,
        },
    };

    return mapping[appPage];
}

/**
 * Build a filter request based on filter type and optional filters
 *
 * @param filterType - The type of filter ('mine', 'unassigned', 'newest', 'oldest')
 * @param options - Additional filter options
 * @returns TaskFiltersRequest object ready for API call
 */
export function buildFilterRequest(
    filterType: TaskFilterType,
    options?: {
        jobId?: number;
        staffFilter?: string;
        eventTypeFilter?: string;
        showCompleted?: boolean;
    }
): TaskFiltersRequest {
    const contactId = getContactId();
    const filters: TaskFiltersRequest = {
        jobId: options?.jobId,
        showCompleted: options?.showCompleted ?? false,
    };

    // Apply staff filter if not 'all'
    if (options?.staffFilter && options.staffFilter !== StatusFilterValue.All) {
        const staffId = parseInt(options.staffFilter, 10);
        if (!isNaN(staffId)) {
            filters.staffId = staffId;
        }
    }

    // Apply event type filter if not 'all'
    if (options?.eventTypeFilter && options.eventTypeFilter !== StatusFilterValue.All) {
        const eventTypeId = parseInt(options.eventTypeFilter, 10);
        if (!isNaN(eventTypeId)) {
            filters.eventTypeId = eventTypeId;
        }
    }

    // Apply filter type-specific settings
    switch (filterType) {
        case 'mine':
            filters.staffId = contactId;
            filters.orderBy = 'assignedTo';
            filters.orderDirection = 'desc';
            break;
        case 'unassigned':
            filters.staffId = -1;
            filters.orderBy = 'assignedTo';
            filters.orderDirection = 'desc';
            break;
        case 'newest':
            filters.orderBy = 'created';
            filters.orderDirection = 'desc';
            break;
        case 'oldest':
            filters.orderBy = 'created';
            filters.orderDirection = 'asc';
            break;
        default:
            filters.orderBy = 'created';
            filters.orderDirection = 'desc';
            break;
    }

    return filters;
}

/**
 * Get the count of tasks matching a specific status type
 *
 * @param tasks - Array of tasks to count
 * @param statusType - The status type to count ('mine', 'unassigned', 'newest', 'oldest')
 * @returns Number of tasks matching the status type
 */
export function getTasksStatusCount(tasks: Task[], statusType: TaskFilterType): number {
    if (!tasks || !Array.isArray(tasks)) return 0;

    const contactId = getContactId();

    switch (statusType) {
        case 'mine':
            return tasks.filter((task) => task.assignee?.id === contactId).length;
        case 'unassigned':
            return tasks.filter((task) => !task.assignee?.id).length;
        case 'newest':
        case 'oldest':
        case 'all':
            return tasks.length;
        default:
            return tasks.length;
    }
}

/**
 * Get the saved staff filter from localStorage for a specific page
 *
 * @param appPage - The app page to get the filter for
 * @returns The saved filter value or 'all' if not found
 */
export function getSavedStaffFilter(appPage: AppPage): string {
    if (!isLocalStorageAvailable()) return StatusFilterValue.All;

    const filterNames = getPageFilterNames(appPage);
    return localStorage.getItem(filterNames.staff) ?? StatusFilterValue.All;
}

/**
 * Get the saved event type filter from localStorage for a specific page
 *
 * @param appPage - The app page to get the filter for
 * @returns The saved filter value or 'all' if not found
 */
export function getSavedEventTypeFilter(appPage: AppPage): string {
    if (!isLocalStorageAvailable()) return StatusFilterValue.All;

    const filterNames = getPageFilterNames(appPage);
    return localStorage.getItem(filterNames.eventType) ?? StatusFilterValue.All;
}

/**
 * Save the staff filter to localStorage for a specific page
 *
 * @param filter - The filter value to save
 * @param appPage - The app page to save the filter for
 */
export function saveStaffFilter(filter: string, appPage: AppPage): void {
    if (!isLocalStorageAvailable()) return;

    const filterNames = getPageFilterNames(appPage);
    localStorage.setItem(filterNames.staff, filter);
}

/**
 * Save the event type filter to localStorage for a specific page
 *
 * @param filter - The filter value to save
 * @param appPage - The app page to save the filter for
 */
export function saveEventTypeFilter(filter: string, appPage: AppPage): void {
    if (!isLocalStorageAvailable()) return;

    const filterNames = getPageFilterNames(appPage);
    localStorage.setItem(filterNames.eventType, filter);
}

/**
 * Initialize page filters from localStorage
 *
 * @param appPage - The app page to initialize filters for
 * @returns Object containing the saved staff and event type filters
 */
export function initializePageFilters(appPage: AppPage): {
    staffFilter: string;
    eventTypeFilter: string;
} {
    return {
        staffFilter: getSavedStaffFilter(appPage),
        eventTypeFilter: getSavedEventTypeFilter(appPage),
    };
}

/**
 * Get display names for active filters
 *
 * @param staffFilter - Current staff filter value
 * @param eventTypeFilter - Current event type filter value
 * @param staffList - List of staff options
 * @param eventTypesList - List of event type options
 * @returns Formatted string describing active filters
 */
export function getActiveFilterNames(
    staffFilter: string,
    eventTypeFilter: string,
    staffList?: StaffSuggestion[],
    eventTypesList?: EventTypeSuggestion[]
): string {
    if (staffFilter === StatusFilterValue.All && eventTypeFilter === StatusFilterValue.All) {
        return ' - (All Tasks)';
    }

    const staffText = staffList?.find((s) => s.id?.toString() === staffFilter)?.text ?? '';
    const eventTypeText =
        eventTypesList?.find((et) => et.id?.toString() === eventTypeFilter)?.text ?? '';

    const filters = [staffText, eventTypeText].filter(Boolean).join(', ');

    return `- (${filters})`;
}

/**
 * Find a task's job in multiple job lists
 *
 * @param taskJobId - The job ID to find
 * @param jobLists - Array of job lists to search
 * @returns The found job or undefined
 */
export function findTaskJobInLists<T extends {id: number}>(
    taskJobId: number,
    jobLists: {list: T[]; name: string}[]
): T | undefined {
    for (const {list} of jobLists) {
        if (list) {
            const job = list.find((job) => job.id === taskJobId);
            if (job) return job;
        }
    }
    return undefined;
}

/**
 * Validate that a task has a job ID
 *
 * @param task - The task to validate
 * @param onWarning - Callback for warning messages
 * @returns True if the task has a valid job ID
 */
export function validateTaskJobId(
    task: Pick<Task, 'id' | 'jobId'>,
    onWarning: (message: string) => void
): boolean {
    const hasJobId = !!task.jobId;
    if (!hasJobId) {
        const message = 'This task has no job attached';
        onWarning(message);
        console.warn('[TaskService] No jobId provided for task:', task.id);
    }
    return hasJobId;
}

/**
 * Get localStorage key for task view preference
 *
 * @returns The localStorage key for view preference
 */
export function getViewPreferenceKey(): string {
    const contactId = getContactId();
    return `taskDashboardViewPreference-${contactId}`;
}

/**
 * Get localStorage key for date filter
 *
 * @param prefix - Optional prefix for the key
 * @returns The localStorage key for date filter
 */
export function getDateFilterKey(prefix: string = 'task-dashboard'): string {
    const contactId = getContactId();
    return `dateFilter-${prefix}-${contactId}`;
}

/**
 * Save a value to localStorage
 *
 * @param key - The localStorage key
 * @param value - The value to save
 */
export function saveToLocalStorage(key: string, value: string): void {
    if (!isLocalStorageAvailable()) return;
    localStorage.setItem(key, value);
}

/**
 * Get a value from localStorage
 *
 * @param key - The localStorage key
 * @param defaultValue - Default value if not found
 * @returns The stored value or default
 */
export function getFromLocalStorage(key: string, defaultValue: string = ''): string {
    if (!isLocalStorageAvailable()) return defaultValue;
    return localStorage.getItem(key) ?? defaultValue;
}

// Export all functions as a service object for convenience
export const tasksService = {
    buildFilterRequest,
    getTasksStatusCount,
    getSavedStaffFilter,
    getSavedEventTypeFilter,
    saveStaffFilter,
    saveEventTypeFilter,
    initializePageFilters,
    getActiveFilterNames,
    findTaskJobInLists,
    validateTaskJobId,
    getViewPreferenceKey,
    getDateFilterKey,
    saveToLocalStorage,
    getFromLocalStorage,
    StatusFilterValue,
    AppPage,
};

export default tasksService;
