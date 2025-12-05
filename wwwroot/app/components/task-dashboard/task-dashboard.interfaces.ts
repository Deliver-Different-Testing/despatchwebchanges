import {ISuggestion} from "../../interfaces/job.interface";
import {Dayjs} from "dayjs";

export interface ITask {
    id: number;
    title: string;
    description: string;
    dueDate: Dayjs;
    closed: boolean;
    assignee: ISuggestion;
    jobId: number;
    eventType: string;
    jobNumber: string;
    
    // Private 
    _dueDateString?: string;
    _dueTimeString?: string;
}

export interface ITaskDto {
    id: number;
    title: string;
    description: string;
    dueDate: string;
    closed: boolean;
    assignee: ISuggestion;
    jobId: number;
    eventType: string;
    jobNumber: string;
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
