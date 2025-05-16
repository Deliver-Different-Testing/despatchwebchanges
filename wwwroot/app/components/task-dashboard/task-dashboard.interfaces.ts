import {Suggestion} from "../../interfaces/job.interface";

export interface TaskViewModel {
    id: number;
    title: string;
    description: string;
    dueDate: string;
    closed: boolean;
    assignee: Suggestion;
    jobId: number;
    eventType: string;
    jobNumber: string;
}

export interface ExtendedTask extends TaskViewModel {
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
