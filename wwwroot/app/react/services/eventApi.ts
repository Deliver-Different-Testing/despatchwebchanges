/**
 * Event API Service
 *
 * React-native API service for event/task-related operations.
 * Used by the add-event-dialog for managing job events.
 */

import {apiClient} from './apiClient';
import {EventType, JobEventData} from '../interfaces';

/**
 * Event API Service Class
 * Handles all event/task-related API operations.
 */
export class EventApiService {
    /**
     * Get list of available event types
     */
    async getEventTypes(): Promise<EventType[]> {
        return apiClient.get<EventType[]>('job/EventTypeList');
    }

    /**
     * Add an event/task to a job
     */
    async addEvent(eventData: JobEventData): Promise<void> {
        await apiClient.post('job/addEvent', eventData);
    }

    /**
     * Log Exsalerate activity for compliment/complaint events
     * Uses query parameters to match the backend endpoint
     */
    async exsalerateActivity(
        eventName: string,
        notes: string,
        clientId: number,
        jobNumber: string
    ): Promise<void> {
        await apiClient.post<void>('job/ExsalerateActivity', null, {
            params: {eventName, notes, clientId, jobNumber},
        });
    }

    /**
     * Get dispatch job detail for follow-up operations
     */
    async getDispatchJobDetail(jobId: number): Promise<unknown> {
        return apiClient.get<unknown>('job/DispatchJobDetail', {
            jobId,
        });
    }
}

export const eventApi = new EventApiService();

export default eventApi;
