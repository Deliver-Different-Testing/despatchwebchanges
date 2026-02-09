/**
 * Courier API Service
 *
 * React-native API service for courier-related operations.
 */

import {apiClient} from './apiClient';
import {CourierSuggestion, TimeZoneOption} from '../interfaces';
import type {IAvailableCourierPosition} from '../../interfaces/courier.interface';
import type {ClearListEnvelopeData} from '../components/common/dispatch-map';

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

/**
 * Get available courier locations within bounds
 */
export async function getAvailableCourierLocations(
    minLng: number,
    minLat: number,
    maxLng: number,
    maxLat: number
): Promise<IAvailableCourierPosition[]> {
    return apiClient.get<IAvailableCourierPosition[]>('courier/AvailableCourierLocation', {
        minLng,
        minLat,
        maxLng,
        maxLat,
    });
}

/**
 * Get envelope (bounding box) for a clearlist area
 */
export async function getClearListEnvelope(clearListId: number): Promise<ClearListEnvelopeData> {
    return apiClient.get<ClearListEnvelopeData>('courier/ClearListEnvelope', {
        clearListId,
    });
}

export const courierApi = {
    searchActiveCouriers,
    getTimeZoneOptions,
    getAvailableCourierLocations,
    getClearListEnvelope,
};

export default courierApi;
