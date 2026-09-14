/**
 * Per-user preference storage. The server resolves the staff member from the
 * session, so nothing here carries a user id — a caller cannot read or write
 * someone else's preferences.
 */

import {apiClient} from './apiClient';
import {RequestOptions} from './requestOptions';

/** Keep in step with `PreferenceKeys` on the server; it rejects anything else. */
export const PREFERENCE_KEYS = {
    autoMate: 'AutoMate',
} as const;

export interface PreferenceResponse {
    key: string;
    /** Null when this user has never saved this preference. */
    preferenceJson: string | null;
}

export function getPreference(key: string, options?: RequestOptions): Promise<PreferenceResponse> {
    return apiClient.get<PreferenceResponse>('/UserPreference/Get', {key}, options);
}

export function savePreference(
    key: string,
    preferenceJson: string,
    options?: RequestOptions,
): Promise<void> {
    return apiClient.post<void>('/UserPreference/Save', {key, preferenceJson}, options);
}
