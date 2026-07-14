/**
 * useMapPreferences Hook
 *
 * Manages user preferences for map controls (auto zoom, couriers only, etc.)
 * stored in localStorage.
 */

import {useCallback, useState} from 'react';
import type {MapControlState} from './DispatchMap.types';
import {PREFERENCE_KEYS} from './DispatchMap.types';
import {ContactID} from "../../../../contants";

type Scope = string | number | undefined;

/** Storage key for a preference, optionally scoped to a page (e.g. Dispatch). */
function prefKey(key: string, scope: Scope, contactId: string | number): string {
    return scope != null ? `${key}-${scope}-${contactId}` : `${key}-${contactId}`;
}

/**
 * Get a preference from localStorage. When a scope is given, reads the scoped
 * key and falls back to the legacy unscoped key (one-time migration) so a
 * previously-saved choice isn't lost when a page adopts scoping.
 */
function getPreference(key: string, defaultValue: boolean, scope?: Scope): boolean {
    const contactId = typeof ContactID !== 'undefined' ? ContactID : undefined;
    if (!contactId || typeof window === 'undefined' || !window.localStorage) {
        return defaultValue;
    }

    try {
        const saved = window.localStorage.getItem(prefKey(key, scope, contactId))
            ?? (scope != null ? window.localStorage.getItem(prefKey(key, undefined, contactId)) : null);
        if (saved) {
            const parsed = JSON.parse(saved);
            return parsed.display ?? defaultValue;
        }
    } catch (e) {
        console.error(`Error loading preference ${key}:`, e);
    }

    return defaultValue;
}

/**
 * Save a preference to localStorage (under the scoped key when a scope is given).
 */
function savePreference(key: string, value: boolean, scope?: Scope): void {
    const contactId = typeof ContactID !== 'undefined' ? ContactID : undefined;
    if (!contactId || typeof window === 'undefined' || !window.localStorage) {
        return;
    }

    try {
        window.localStorage.setItem(prefKey(key, scope, contactId), JSON.stringify({ display: value }));
    } catch (e) {
        console.error(`Error saving preference ${key}:`, e);
    }
}

interface UseMapPreferencesReturn {
    controlState: MapControlState;
    toggleAutoZoom: () => void;
    toggleCouriersOnly: () => void;
    toggleUrgentArmyOnly: () => void;
    toggleCouriersLargeView: () => void;
    setAutoZoom: (enabled: boolean) => void;
    setCouriersOnly: (enabled: boolean) => void;
    setUrgentArmyOnly: (enabled: boolean) => void;
    setCouriersLargeView: (enabled: boolean) => void;
}

export function useMapPreferences(scope?: Scope): UseMapPreferencesReturn {
    const [controlState, setControlState] = useState<MapControlState>(() => ({
        autoZoomEnabled: getPreference(PREFERENCE_KEYS.AUTO_ZOOM, true, scope),
        couriersOnlyEnabled: getPreference(PREFERENCE_KEYS.COURIERS_ONLY, false, scope),
        urgentArmyOnlyEnabled: getPreference(PREFERENCE_KEYS.URGENT_ARMY_ONLY, false, scope),
        couriersLargeViewEnabled: getPreference(PREFERENCE_KEYS.COURIERS_LARGE_VIEW, false, scope),
    }));

    const setAutoZoom = useCallback((enabled: boolean) => {
        setControlState((prev) => ({ ...prev, autoZoomEnabled: enabled }));
        savePreference(PREFERENCE_KEYS.AUTO_ZOOM, enabled, scope);
    }, [scope]);

    const setCouriersOnly = useCallback((enabled: boolean) => {
        setControlState((prev) => ({ ...prev, couriersOnlyEnabled: enabled }));
        savePreference(PREFERENCE_KEYS.COURIERS_ONLY, enabled, scope);
    }, [scope]);

    const setUrgentArmyOnly = useCallback((enabled: boolean) => {
        setControlState((prev) => ({ ...prev, urgentArmyOnlyEnabled: enabled }));
        savePreference(PREFERENCE_KEYS.URGENT_ARMY_ONLY, enabled, scope);
    }, [scope]);

    const setCouriersLargeView = useCallback((enabled: boolean) => {
        setControlState((prev) => ({ ...prev, couriersLargeViewEnabled: enabled }));
        savePreference(PREFERENCE_KEYS.COURIERS_LARGE_VIEW, enabled, scope);
    }, [scope]);

    const toggleAutoZoom = useCallback(() => {
        setControlState((prev) => {
            const newValue = !prev.autoZoomEnabled;
            savePreference(PREFERENCE_KEYS.AUTO_ZOOM, newValue, scope);
            return { ...prev, autoZoomEnabled: newValue };
        });
    }, [scope]);

    const toggleCouriersOnly = useCallback(() => {
        setControlState((prev) => {
            // Don't allow toggle when large view is enabled
            if (prev.couriersLargeViewEnabled) return prev;

            const newValue = !prev.couriersOnlyEnabled;
            savePreference(PREFERENCE_KEYS.COURIERS_ONLY, newValue, scope);
            return { ...prev, couriersOnlyEnabled: newValue };
        });
    }, [scope]);

    const toggleUrgentArmyOnly = useCallback(() => {
        setControlState((prev) => {
            // Don't allow toggle when large view is enabled
            if (prev.couriersLargeViewEnabled) return prev;

            const newValue = !prev.urgentArmyOnlyEnabled;
            savePreference(PREFERENCE_KEYS.URGENT_ARMY_ONLY, newValue, scope);
            return { ...prev, urgentArmyOnlyEnabled: newValue };
        });
    }, [scope]);

    const toggleCouriersLargeView = useCallback(() => {
        setControlState((prev) => {
            const newValue = !prev.couriersLargeViewEnabled;
            savePreference(PREFERENCE_KEYS.COURIERS_LARGE_VIEW, newValue, scope);

            // When enabling large view, disable other modes
            if (newValue) {
                savePreference(PREFERENCE_KEYS.COURIERS_ONLY, false, scope);
                savePreference(PREFERENCE_KEYS.URGENT_ARMY_ONLY, false, scope);
                return {
                    ...prev,
                    couriersLargeViewEnabled: newValue,
                    couriersOnlyEnabled: false,
                    urgentArmyOnlyEnabled: false,
                };
            }

            return { ...prev, couriersLargeViewEnabled: newValue };
        });
    }, []);

    return {
        controlState,
        toggleAutoZoom,
        toggleCouriersOnly,
        toggleUrgentArmyOnly,
        toggleCouriersLargeView,
        setAutoZoom,
        setCouriersOnly,
        setUrgentArmyOnly,
        setCouriersLargeView,
    };
}
