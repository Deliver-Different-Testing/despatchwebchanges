/**
 * Courier API Service
 *
 * React-native API service for courier-related operations.
 */

import {apiClient} from './apiClient';
import {CourierSuggestion, TimeZoneOption} from '../interfaces';

/**
 * Search for active couriers
 */
export async function searchActiveCouriers(searchText: string): Promise<CourierSuggestion[]> {
    return apiClient.get<CourierSuggestion[]>('courier/AllActiveSearch', {
        searchText,
    });
}

/**
 * Get timezone options
 */
export async function getTimeZoneOptions(): Promise<TimeZoneOption[]> {
    return apiClient.get<TimeZoneOption[]>('job/GetTimeZoneOptions');
}

export const courierApi = {
    searchActiveCouriers,
    getTimeZoneOptions,
};

export default courierApi;
