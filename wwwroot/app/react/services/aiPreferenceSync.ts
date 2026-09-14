/**
 * Connects the Auto-mate preference store to the server.
 *
 * Kept apart from the store itself so the store stays free of the API layer and
 * testable without a network stub. Mirrors `box-shell/layoutSync.ts`: localStorage
 * is the offline cache, the server is authoritative once it answers, and writes
 * are debounced.
 *
 * Called once per page load from the app-shell island, which is mounted on every
 * route — including the three legacy AngularJS pages.
 */

import {
    AiPreferences,
    applyServerPreferences,
    configureAiPreferencePush,
} from './aiPreferenceStore';
import {PREFERENCE_KEYS, getPreference, savePreference} from './userPreferenceApi';

let started = false;

export async function startAiPreferenceSync(): Promise<void> {
    // The shell can remount on a route change; the pull should still happen once.
    if (started) return;
    started = true;

    configureAiPreferencePush(pushPreferences);

    try {
        const response = await getPreference(PREFERENCE_KEYS.autoMate);
        const stored = response?.preferenceJson ? JSON.parse(response.preferenceJson) : null;

        // Null means this user has never saved their preferences, so whatever the
        // legacy migration decided becomes the answer — and gets written up, so it
        // survives to their next machine.
        applyServerPreferences(stored);
    } catch {
        // Offline or the endpoint is down: the cached preferences already loaded
        // synchronously, so the app is usable and the next change will push.
    }
}

async function pushPreferences(preferences: AiPreferences): Promise<void> {
    await savePreference(PREFERENCE_KEYS.autoMate, JSON.stringify(preferences));
}

/** Test seam: lets a test drive the once-per-load guard more than once. */
export function resetAiPreferenceSyncForTest(): void {
    started = false;
    configureAiPreferencePush(null);
}
