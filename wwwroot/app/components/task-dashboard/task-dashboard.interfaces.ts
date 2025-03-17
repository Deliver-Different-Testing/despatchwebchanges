import {Suggestion} from "../../interfaces/job.interface";

export interface Task {
    id: number;
    title: string;
    description: string;
    dueDate: string;
    closed: boolean;
    priority: string;
    assignee: Suggestion;
    eventType: string;
    jobId: number;
    icon: string;
    isOverdue: boolean;
}

export interface TaskTableFiltersRequest {
    courierId?: number;
    eventTypeId?: number;
    searchText?: string;
    date?: string;
}

export interface ExtendedTask extends Task {
    dueTimeStr?: string;
}
