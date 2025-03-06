export interface Task {
    id: number;
    title: string;
    description: string;
    dueDate: Date;
    closed: boolean;
    priority: string;
    assignee: string;
    eventType: string;
    jobId: number;
    icon: string;
    isOverdue: boolean;
}

export interface TaskTableFiltersRequest {
    courierId?: number;
    eventTypeId?: number;
    searchText?: string;
}
