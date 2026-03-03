/**
 * Task Interfaces
 *
 * Type definitions for task-related API operations.
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
    priority?: 'high' | 'medium' | 'low';
    _dueDateString?: string;
    _dueTimeString?: string;
}

export interface TaskFiltersRequest {
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

export interface StaffSuggestion {
    id: number;
    text: string;
}

export interface EventTypeSuggestion {
    id: number;
    text: string;
}

export interface TaskCloseRequest {
    eventId: number;
    closed: boolean;
}

export interface TaskDateRequest {
    eventId: number;
    date: string;
}

export interface TaskTimeRequest {
    eventId: number;
    time: string;
}

export interface TaskAssignStaffRequest {
    eventId: number;
    staffId: number;
}

export interface TaskApiResponse {
    id: number;
    title: string;
    description: string;
    dueDate: string;
    closed: boolean;
    assignee: TaskAssignee;
    jobId: number;
    eventType: string;
    jobNumber: string;
    priority?: 'high' | 'medium' | 'low';
}
