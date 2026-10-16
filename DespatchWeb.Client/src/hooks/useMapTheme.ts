/**
 * Map-only light/dark preference, independent of the app's colour mode.
 *
 * 'auto' follows the app; 'light' / 'dark' pin every map to that mode. It is a per-viewer
 * convenience kept in localStorage and shared live between maps in the same document (custom
 * event) and other tabs (storage event) — it is not synced to the server.
 */
import {useCallback, useEffect, useState} from 'react';
import type {Md3Mode} from '../theme/md3';
import {useColorMode} from './useColorMode';

export const MAP_THEME_STORAGE_KEY = 'dd-map-theme';
const CHANGE_EVENT = 'dd-map-theme-change';

export type MapThemePreference = 'auto' | Md3Mode;

function isPreference(value: unknown): value is MapThemePreference {
    return value === 'auto' || value === 'light' || value === 'dark';
}

function readStored(): MapThemePreference {
    try {
        const stored = window.localStorage.getItem(MAP_THEME_STORAGE_KEY);
        if (isPreference(stored)) return stored;
    } catch {
        /* localStorage unavailable — follow the app */
    }
    return 'auto';
}

export function useMapTheme(): {
    preference: MapThemePreference;
    /** The mode the map should actually render in. */
    mode: Md3Mode;
    setPreference: (preference: MapThemePreference) => void;
} {
    const {mode: appMode} = useColorMode();
    const [preference, setPreferenceState] = useState<MapThemePreference>(readStored);

    useEffect(() => {
        const onChange = (e: Event) => {
            const next = (e as CustomEvent<unknown>).detail;
            if (isPreference(next)) setPreferenceState(next);
        };
        const onStorage = (e: StorageEvent) => {
            if (e.key === MAP_THEME_STORAGE_KEY && isPreference(e.newValue)) setPreferenceState(e.newValue);
        };
        window.addEventListener(CHANGE_EVENT, onChange);
        window.addEventListener('storage', onStorage);
        return () => {
            window.removeEventListener(CHANGE_EVENT, onChange);
            window.removeEventListener('storage', onStorage);
        };
    }, []);

    const setPreference = useCallback((next: MapThemePreference) => {
        setPreferenceState(next);
        try {
            window.localStorage.setItem(MAP_THEME_STORAGE_KEY, next);
        } catch {
            /* ignore */
        }
        window.dispatchEvent(new CustomEvent<MapThemePreference>(CHANGE_EVENT, {detail: next}));
    }, []);

    return {preference, mode: preference === 'auto' ? appMode : preference, setPreference};
}
