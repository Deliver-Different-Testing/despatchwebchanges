/**
 * Task Dashboard Interfaces
 *
 * Type definitions for task-related operations in AngularJS components.
 */

import {Dayjs} from 'dayjs';

export interface ITaskAssignee {
    id: number;
    text: string;
}

export interface ITask {
    id: number;
    title: string;
    description: string;
    dueDate: Dayjs;
    closed: boolean;
    assignee: ITaskAssignee;
    jobId: number;
    eventType: string;
    jobNumber: string;
    priority?: 'high' | 'medium' | 'low';
    _dueDateString?: string;
    _dueTimeString?: string;
}

export interface ITaskDto {
    id: number;
    title: string;
    description: string;
    dueDate: string;
    closed: boolean;
    assignee: ITaskAssignee;
    jobId: number;
    eventType: string;
    jobNumber: string;
    priority?: 'high' | 'medium' | 'low';
}

export interface ExtendedTask extends ITask {
    dueTimeStr?: string;
}

export interface TaskTableFiltersRequest {
    searchText?: string;
    staffId?: number;
    eventTypeId?: number;
    orderBy?: string;
    orderDirection?: string;
    date?: string;
    startDate?: string;
    endDate?: string;
    showCompleted?: boolean;
    courierId?: number;
    jobId?: number;
}

// Backward compatibility aliases
export type Task = ITask;
export type TaskDto = ITaskDto;
export type TaskFiltersRequest = TaskTableFiltersRequest;
