/**
 * Config API Service
 *
 * React-native API service for configuration-related operations.
 */

import {apiClient} from './apiClient';
import {ApiKeyResponse} from "../interfaces";

/**
 * Get HERE Maps API key
 */
export async function getHereMapsKey(): Promise<string> {
    const response = await apiClient.get<ApiKeyResponse>('config/GetHereMapsKey');
    return response.apiKey;
}

export const configApi = {
    getHereMapsKey,
};

export default configApi;
