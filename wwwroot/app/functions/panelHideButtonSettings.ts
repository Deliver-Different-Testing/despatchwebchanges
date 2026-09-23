import {ContactID} from '../contants';
import {getPreference, savePreference} from '../react/services/preferencesApi';
import {StaffPreferenceKey} from '../enums/staff-preference-key.enum';

const STORAGE_KEY = `showPanelHideButton_${ContactID}`;

/**
 * Whether the per-panel "Hide panel" button shows on custom dashboard
 * layouts. Defaults to true: existing users keep today's always-visible
 * behaviour until they opt out via Settings.
 */
export function isPanelHideButtonEnabled(): boolean {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === null ? true : stored === 'true';
}

/** StaffPreference: source of truth is the server, localStorage is a synchronous read-through cache. */
function persistToServer(): void {
    void savePreference(StaffPreferenceKey.ShowPanelHideButton, String(isPanelHideButtonEnabled())).catch(error =>
        console.error('Failed to sync panel hide button setting to server:', error),
    );
}

export function setPanelHideButtonEnabled(enabled: boolean): void {
    localStorage.setItem(STORAGE_KEY, String(enabled));
    persistToServer();
}

/**
 * Pulls the setting from the server into localStorage so the existing
 * synchronous isPanelHideButtonEnabled() read sees it, the same read-through
 * pattern Auto-mate settings use. If the server has nothing yet, seeds it
 * from the current (default) local value so the setting follows the user to
 * their next device.
 */
export async function loadPanelHideButtonSettingFromServer(): Promise<void> {
    const value = await getPreference(StaffPreferenceKey.ShowPanelHideButton);
    if (value === null) {
        persistToServer();
        return;
    }
    localStorage.setItem(STORAGE_KEY, value === 'true' ? 'true' : 'false');
}
