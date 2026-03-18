/**
 * Courier API Service
 *
 * React-native API service for courier-related operations.
 */

import {apiClient, RequestOptions} from './apiClient';
import {CourierSuggestion, TimeZoneOption} from '../interfaces';
import type {IAvailableCourierPosition} from '../../interfaces/courier.interface';
import type {ClearListEnvelopeData} from '../components/common/dispatch-map/DispatchMap.types';

/**
 * Search for active couriers
 */
export async function searchActiveCouriers(searchText: string, options?: RequestOptions): Promise<CourierSuggestion[]> {
    return apiClient.get<CourierSuggestion[]>('courier/AllActiveSearch', {
        searchText,
    }, options);
}

/**
 * Search for active couriers with extended filtering (dgOnly, loggedInOnly)
 */
export async function searchActiveCouriersExtended(
    searchText: string,
    options?: { dgOnly?: boolean; loggedInOnly?: boolean } & RequestOptions
): Promise<CourierSuggestion[]> {
    const params: Record<string, any> = { searchText };
    if (options?.dgOnly) params.dgOnly = true;
    if (options?.loggedInOnly) params.loggedInOnly = true;
    return apiClient.get<CourierSuggestion[]>('courier/AllActiveSearch', params, options);
}

/**
 * Get timezone options
 */
export async function getTimeZoneOptions(options?: RequestOptions): Promise<TimeZoneOption[]> {
    return apiClient.get<TimeZoneOption[]>('job/GetTimeZoneOptions', undefined, options);
}

/**
 * Get available courier locations within bounds
 */
export async function getAvailableCourierLocations(
    minLng: number,
    minLat: number,
    maxLng: number,
    maxLat: number,
    options?: RequestOptions
): Promise<IAvailableCourierPosition[]> {
    return apiClient.get<IAvailableCourierPosition[]>('courier/AvailableCourierLocation', {
        minLng,
        minLat,
        maxLng,
        maxLat,
    }, options);
}

/**
 * Get envelope (bounding box) for a clear list area
 */
export async function getClearListEnvelope(clearListId: number, options?: RequestOptions): Promise<ClearListEnvelopeData> {
    return apiClient.get<ClearListEnvelopeData>('courier/ClearListEnvelope', {
        clearListId,
    }, options);
}

export const courierApi = {
    searchActiveCouriers,
    searchActiveCouriersExtended,
    getTimeZoneOptions,
    getAvailableCourierLocations,
    getClearListEnvelope,
};

export default courierApi;
