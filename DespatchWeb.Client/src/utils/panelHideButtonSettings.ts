import {getContactId} from '../api/session';
import {getPreference, savePreference} from '../api/preferencesApi';
import {StaffPreferenceKey} from '../types/enums/staff-preference-key.enum';

const storageKey = () => `showPanelHideButton_${getContactId()}`;

/**
 * Whether the per-panel "Hide panel" button shows on custom dashboard
 * layouts. Defaults to true: existing users keep today's always-visible
 * behaviour until they opt out via Settings.
 */
export function isPanelHideButtonEnabled(): boolean {
    const stored = localStorage.getItem(storageKey());
    return stored === null ? true : stored === 'true';
}

/** StaffPreference: source of truth is the server, localStorage is a synchronous read-through cache. */
function persistToServer(): void {
    void savePreference(StaffPreferenceKey.ShowPanelHideButton, String(isPanelHideButtonEnabled())).catch(error =>
        console.error('Failed to sync panel hide button setting to server:', error),
    );
}

export function setPanelHideButtonEnabled(enabled: boolean): void {
    localStorage.setItem(storageKey(), String(enabled));
    persistToServer();
}

/**
 * Pulls the setting from the server into localStorage so the existing
 * synchronous isPanelHideButtonEnabled() read sees it, the same read-through
 * pattern Auto-mate settings use. If the server has nothing yet, seeds it only
 * from a choice made in this browser, so opening a page never saves the default.
 */
export async function loadPanelHideButtonSettingFromServer(): Promise<void> {
    const value = await getPreference(StaffPreferenceKey.ShowPanelHideButton);
    if (value === null) {
        if (localStorage.getItem(storageKey()) !== null) persistToServer();
        return;
    }
    localStorage.setItem(storageKey(), value === 'true' ? 'true' : 'false');
}
