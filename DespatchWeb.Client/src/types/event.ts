/**
 * Event-related interfaces for React components
 */

export interface EventType {
    id: number;
    text: string;
}

export interface JobEventData {
    jobId: number;
    notes: string;
    eventTypeId: number;
    eventDueDate: string;
}

export interface AddEventJob {
    id: number;
    jobNo: string;
    client: string;
    clientId?: number;
}
