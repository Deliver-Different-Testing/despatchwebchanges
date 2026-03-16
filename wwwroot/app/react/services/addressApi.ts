/**
 * Address API Service
 *
 * API client for address autocomplete and lookup operations.
 * Used by the React Edit Address Dialog.
 */

import {apiClient, RequestOptions} from './apiClient';
import {
    HereMapsLocationResult,
    HereMapsLookupResponse,
} from '../interfaces';

export const addressApi = {
    /**
     * Search for addresses using HERE Maps autocomplete
     * @param text - Search text (minimum 3 characters recommended)
     * @param options - Request options (signal, timeout)
     * @returns Array of location results
     */
    autocompleteSearch: (text: string, options?: RequestOptions): Promise<HereMapsLocationResult[]> =>
        apiClient.get<HereMapsLocationResult[]>('addressAutocomplete/AutocompleteAddressSearch', {text}, options),

    /**
     * Get detailed location information by address ID
     * @param addressId - HERE Maps location ID
     * @param options - Request options (signal, timeout)
     * @returns Detailed location response with street info
     */
    getLocationDetailsById: (addressId: string, options?: RequestOptions): Promise<HereMapsLookupResponse> =>
        apiClient.get<HereMapsLookupResponse>('addressAutocomplete/GetLocationDetailsById', {addressId}, options),

    /**
     * Reverse geocode coordinates to get nearest address
     * @param latitude - Latitude coordinate
     * @param longitude - Longitude coordinate
     * @param options - Request options (signal, timeout)
     * @returns Array of nearby location results
     */
    fetchNearestAddress: (latitude: number, longitude: number, options?: RequestOptions): Promise<HereMapsLocationResult[]> =>
        apiClient.get<HereMapsLocationResult[]>('addressAutocomplete/FetchNearestAddress', {latitude, longitude}, options),

    /**
     * Get HERE Maps API key from config service
     * @param options - Request options (signal, timeout)
     * @returns HERE Maps API key string
     */
    getHereMapsKey: async (options?: RequestOptions): Promise<string> => {
        const response = await apiClient.get<{apiKey: string}>('config/GetHereMapsKey', undefined, options);
        return response.apiKey;
    },
};

export default addressApi;
