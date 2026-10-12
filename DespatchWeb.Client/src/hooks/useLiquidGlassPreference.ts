import {getSession} from '../api/session';
import {useEffect, useSyncExternalStore} from 'react';
import {StaffPreferenceKey} from '../types/enums/staff-preference-key.enum';
import {getPreference, savePreference} from '../api/preferencesApi';
import {isLiquidGlassSupported} from './glassSupport';

/**
 * Opt-in for the Liquid Glass material (dialogs, Menu/Popover dropdowns), saved as the
 * `LiquidGlass` StaffPreference so it follows the user across devices; localStorage stays the
 * synchronous cache. **Default OFF** — only a stored `'on'` enables it, and never in a browser that
 * can't render it (the stored choice is kept for the user's other devices). Every island has its
 * own React root, so a change is broadcast on `window` (same document) and via the `storage`
 * event (other tabs).
 */
export const LIQUID_GLASS_STORAGE_KEY = 'dd-liquid-glass';
const CHANGE_EVENT = 'dd-liquid-glass-change';
const SERVER_SYNC_FLAG = '__ddLiquidGlassServerSynced';

type StoredValue = 'on' | 'off';

function readStored(): StoredValue | null {
    try {
        const stored = localStorage.getItem(LIQUID_GLASS_STORAGE_KEY);
        return stored === 'on' || stored === 'off' ? stored : null;
    } catch {
        return null;
    }
}

function writeStored(value: StoredValue): void {
    try {
        localStorage.setItem(LIQUID_GLASS_STORAGE_KEY, value);
    } catch {
        // localStorage may be unavailable (private browsing); the toggle just won't persist locally.
    }
}

export function isLiquidGlassEnabled(): boolean {
    return readStored() === 'on' && isLiquidGlassSupported();
}

export function setLiquidGlassEnabled(enabled: boolean): void {
    if (enabled && !isLiquidGlassSupported()) return;
    const value: StoredValue = enabled ? 'on' : 'off';
    writeStored(value);
    window.dispatchEvent(new Event(CHANGE_EVENT));
    void savePreference(StaffPreferenceKey.LiquidGlass, value).catch(error =>
        console.error('Failed to sync Liquid Glass preference to server:', error),
    );
}

/** Only a signed-in staff member (Razor sets ContactID) has a server preference to sync. */
function canSyncWithServer(): boolean {
    return Number(getSession().contactId) > 0;
}

/**
 * Reconciles with the server once per page (islands share one window): a saved server value wins
 * and is broadcast; with none saved, the local choice seeds it — except from an unsupported
 * browser, which must not write a choice it can't have made.
 */
export async function syncLiquidGlassFromServerOnce(): Promise<void> {
    if (!canSyncWithServer()) return;
    const flagged = window as unknown as Record<string, boolean>;
    if (flagged[SERVER_SYNC_FLAG]) return;
    flagged[SERVER_SYNC_FLAG] = true;
    try {
        const value = await getPreference(StaffPreferenceKey.LiquidGlass);
        if (value === 'on' || value === 'off') {
            writeStored(value);
            window.dispatchEvent(new Event(CHANGE_EVENT));
        } else if (isLiquidGlassSupported()) {
            const local = readStored();
            if (local) {
                await savePreference(StaffPreferenceKey.LiquidGlass, local);
            }
        }
    } catch (error) {
        console.error('Failed to load Liquid Glass preference from server:', error);
    }
}

function subscribe(onChange: () => void): () => void {
    const onStorage = (e: StorageEvent) => {
        if (e.key === null || e.key === LIQUID_GLASS_STORAGE_KEY) onChange();
    };
    window.addEventListener(CHANGE_EVENT, onChange);
    window.addEventListener('storage', onStorage);
    return () => {
        window.removeEventListener(CHANGE_EVENT, onChange);
        window.removeEventListener('storage', onStorage);
    };
}

export function useLiquidGlassEnabled(): boolean {
    useEffect(() => {
        void syncLiquidGlassFromServerOnce();
    }, []);
    return useSyncExternalStore(subscribe, isLiquidGlassEnabled, () => false);
}
