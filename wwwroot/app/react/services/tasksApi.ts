/**
 * Tasks API Service
 *
 * React-native API service for task-related operations.
 * Uses fetch with proper security headers instead of AngularJS $http.
 */

import {apiClient, RequestOptions} from './apiClient';
import {
    Task,
    TaskApiResponse,
    TaskFiltersRequest,
    TaskCloseRequest,
    TaskDateRequest,
    TaskTimeRequest,
    TaskAssignStaffRequest,
    StaffSuggestion,
    EventTypeSuggestion,
    EventGroupViewModel,
} from '../interfaces';
import {formatDateForApi, parseDateFromApi, formatRelativeDateTime} from '../utils/dateUtils';
import dayjs, {Dayjs} from 'dayjs';
import {DeliveryJourney, DeliveryJourneyDto} from '../components/common/task-history/TaskHistory.interfaces';

/**
 * Transform API response to Task with Dayjs date
 */
function transformTask(apiTask: TaskApiResponse): Task {
    return {
        ...apiTask,
        dueDate: dayjs(apiTask.dueDate),
    };
}

/**
 * Get all tasks with optional filters
 */
export async function getAllTasks(filters?: TaskFiltersRequest, options?: RequestOptions): Promise<Task[]> {
    const params: Record<string, string | number | boolean> = {};

    if (filters) {
        if (filters.searchText) params.searchText = filters.searchText;
        if (filters.staffId !== undefined) params.staffId = filters.staffId;
        if (filters.eventTypeId !== undefined) params.eventTypeId = filters.eventTypeId;
        if (filters.orderBy) params.orderBy = filters.orderBy;
        if (filters.orderDirection) params.orderDirection = filters.orderDirection;
        if (filters.date) params.date = filters.date;
        if (filters.startDate) params.startDate = filters.startDate;
        if (filters.endDate) params.endDate = filters.endDate;
        if (filters.showCompleted !== undefined) params.showCompleted = filters.showCompleted;
        if (filters.courierId !== undefined) params.courierId = filters.courierId;
        if (filters.jobId !== undefined) params.jobId = filters.jobId;
    }

    const response = await apiClient.get<TaskApiResponse[]>('task/GetAllTasks', params, options);
    return (response || []).map(transformTask);
}

/**
 * Mark a task as closed or reopened
 */
export async function markTaskAsClosed(eventId: number, closed: boolean): Promise<void> {
    const data: TaskCloseRequest = {eventId, closed};
    await apiClient.post('task/MarkTaskAsClosed', data);
}

/**
 * Update a task's due date
 */
export async function updateTaskDate(eventId: number, date: Dayjs, timezone?: string): Promise<void> {
    const data: TaskDateRequest = {
        eventId,
        date: formatDateForApi(date, timezone),
    };
    await apiClient.post('task/UpdateTaskDate', data);
}

/**
 * Update a task's due time
 */
export async function updateTaskTime(eventId: number, time: Dayjs, timezone?: string): Promise<void> {
    const data: TaskTimeRequest = {
        eventId,
        time: formatDateForApi(time, timezone),
    };

    await apiClient.post('task/UpdateTaskTime', data);
}

/**
 * Reassign a task to a different staff member
 */
export async function reassignTaskToStaff(eventId: number, staffId: number): Promise<void> {
    const data: TaskAssignStaffRequest = {eventId, staffId};
    await apiClient.post('task/ReassignTask', data);
}

/**
 * Get list of active staff members
 */
export async function getActiveStaff(options?: RequestOptions): Promise<StaffSuggestion[]> {
    return apiClient.get<StaffSuggestion[]>('task/GetStaff', undefined, options);
}

/**
 * Get list of event types
 */
export async function getEventTypes(options?: RequestOptions): Promise<EventTypeSuggestion[]> {
    return apiClient.get<EventTypeSuggestion[]>('job/EventTypeList', undefined, options);
}

/**
 * Transform delivery journey DTO to model with Dayjs date
 */
function transformDeliveryJourneyDTO(dto: DeliveryJourneyDto): DeliveryJourney {
    return {
        ...dto,
        date: parseDateFromApi(dto.date),
        status: dto.status as DeliveryJourney['status'],
        _dateStr: formatRelativeDateTime(dto.date),
    };
}

/**
 * Get delivery journey for a job
 */
export async function getDeliveryJourney(jobId: number, options?: RequestOptions): Promise<DeliveryJourney[]> {
    const response = await apiClient.get<DeliveryJourneyDto[]>('job/GetDeliveryJourney', {jobId}, options);
    return (response || []).map(transformDeliveryJourneyDTO);
}

/**
 * Get event type groups for a specific event group
 */
export async function getEventTypeGroups(eventGroupId: number, options?: RequestOptions): Promise<EventGroupViewModel[]> {
    return apiClient.get<EventGroupViewModel[]>('task/GetEventTypeGroups', {eventGroupId}, options);
}

/**
 * Add tasks to a job from event group selections
 */
export async function addTasks(jobId: number, eventGroupViewModels: EventGroupViewModel[]): Promise<void> {
    await apiClient.post('task/AddTasks', {jobId, eventGroupViewModels});
}

export const tasksApi = {
    getAllTasks,
    markTaskAsClosed,
    updateTaskDate,
    updateTaskTime,
    reassignTaskToStaff,
    getActiveStaff,
    getEventTypes,
    getDeliveryJourney,
    getEventTypeGroups,
    addTasks,
};

export default tasksApi;
