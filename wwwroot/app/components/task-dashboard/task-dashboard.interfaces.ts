import {Suggestion} from "../../interfaces/job.interface";

export interface TaskViewModel {
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
    jobNumber: string;
}

export interface TaskTableFiltersRequest {
    courierId?: number;
    eventTypeId?: number;
    searchText?: string;
    date?: string;
    orderBy?: string;
    orderDirection?: string;
    staffId?: number;
}

export interface ExtendedTask extends TaskViewModel {
    dueTimeStr?: string;
    _supportData?: any;
}
