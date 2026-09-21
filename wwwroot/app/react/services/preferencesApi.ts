/**
 * Staff Preference API
 *
 * A generic per-staff key/value preference store (StaffPreference: one JSON
 * blob per key, e.g. 'AutoMate'). The current staff member is resolved
 * server-side from the auth claims, so only the key and payload are sent.
 */

import {apiClient} from './apiClient';

/** Returns the stored JSON for the given key, or null when nothing is saved yet. */
export async function getPreference(key: string): Promise<string | null> {
    const preferenceJson = await apiClient.get<string | null>('StaffPreference/GetPreference', {key});
    return preferenceJson ?? null;
}

/** Upserts the JSON payload for the given key. */
export async function savePreference(key: string, preferenceJson: string): Promise<void> {
    await apiClient.post('StaffPreference/SavePreference', {preferenceKey: key, preferenceJson});
}
