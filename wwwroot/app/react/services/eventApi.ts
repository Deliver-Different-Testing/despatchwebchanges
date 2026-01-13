/**
 * Event API Service
 *
 * React-native API service for event/task-related operations.
 * Used by the add-event-dialog for managing job events.
 */

import {apiClient} from './apiClient';
import {EventType, JobEventData} from '../interfaces/event';

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
        const params = new URLSearchParams({
            eventName,
            notes,
            clientId: String(clientId),
            jobNumber,
        });

        const response = await fetch(`job/ExsalerateActivity?${params.toString()}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
            },
            credentials: 'same-origin',
        });

        if (!response.ok) {
            throw new Error(`Failed to log exsalerate activity: ${response.statusText}`);
        }
    }

    /**
     * Get dispatch job detail for follow-up operations
     */
    async getDispatchJobDetail(jobId: number): Promise<any> {
        return apiClient.get<any>('job/DispatchJobDetail', {
            jobId,
        });
    }
}

export const eventApi = new EventApiService();

export default eventApi;
