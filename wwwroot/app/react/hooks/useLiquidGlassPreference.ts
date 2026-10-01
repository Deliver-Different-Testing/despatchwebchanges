import {useSyncExternalStore} from 'react';

/**
 * Per-device opt-in for the Liquid Glass material (dialogs, Menu/Popover dropdowns).
 * **Default OFF** — only a stored `'on'` enables it. Every island has its own React root, so a
 * change is broadcast on `window` (same document) and via the `storage` event (other tabs).
 */
export const LIQUID_GLASS_STORAGE_KEY = 'dd-liquid-glass';
const CHANGE_EVENT = 'dd-liquid-glass-change';

export function isLiquidGlassEnabled(): boolean {
    try {
        return localStorage.getItem(LIQUID_GLASS_STORAGE_KEY) === 'on';
    } catch {
        return false;
    }
}

export function setLiquidGlassEnabled(enabled: boolean): void {
    try {
        localStorage.setItem(LIQUID_GLASS_STORAGE_KEY, enabled ? 'on' : 'off');
    } catch {
        // localStorage may be unavailable (private browsing); the toggle just won't persist.
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
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
    return useSyncExternalStore(subscribe, isLiquidGlassEnabled, () => false);
}
