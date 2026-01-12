/**
 * Address API Service
 *
 * API client for address autocomplete and lookup operations.
 * Used by the React Edit Address Dialog.
 */

import {apiClient} from './apiClient';
import {
    HereMapsLocationResult,
    HereMapsLookupResponse,
} from '../interfaces';

export const addressApi = {
    /**
     * Search for addresses using HERE Maps autocomplete
     * @param text - Search text (minimum 3 characters recommended)
     * @returns Array of location results
     */
    autocompleteSearch: (text: string): Promise<HereMapsLocationResult[]> =>
        apiClient.get<HereMapsLocationResult[]>('addressAutocomplete/AutocompleteAddressSearch', {text}),

    /**
     * Get detailed location information by address ID
     * @param addressId - HERE Maps location ID
     * @returns Detailed location response with street info
     */
    getLocationDetailsById: (addressId: string): Promise<HereMapsLookupResponse> =>
        apiClient.get<HereMapsLookupResponse>('addressAutocomplete/GetLocationDetailsById', {addressId}),

    /**
     * Reverse geocode coordinates to get nearest address
     * @param latitude - Latitude coordinate
     * @param longitude - Longitude coordinate
     * @returns Array of nearby location results
     */
    fetchNearestAddress: (latitude: number, longitude: number): Promise<HereMapsLocationResult[]> =>
        apiClient.get<HereMapsLocationResult[]>('addressAutocomplete/FetchNearestAddress', {latitude, longitude}),

    /**
     * Get HERE Maps API key from config service
     * @returns HERE Maps API key string
     */
    getHereMapsKey: async (): Promise<string> => {
        const response = await apiClient.get<{apiKey: string}>('config/GetHereMapsKey');
        return response.apiKey;
    },
};

export default addressApi;
