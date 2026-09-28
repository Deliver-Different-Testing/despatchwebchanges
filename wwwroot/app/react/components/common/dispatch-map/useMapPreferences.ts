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

/**
 * Get a preference from localStorage
 */
function getPreference(key: string, defaultValue: boolean): boolean {
    const contactId = typeof ContactID !== 'undefined' ? ContactID : undefined;
    if (!contactId || typeof window === 'undefined' || !window.localStorage) {
        return defaultValue;
    }

    try {
        const saved = window.localStorage.getItem(`${key}-${contactId}`);
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
 * Save a preference to localStorage
 */
function savePreference(key: string, value: boolean): void {
    const contactId = typeof ContactID !== 'undefined' ? ContactID : undefined;
    if (!contactId || typeof window === 'undefined' || !window.localStorage) {
        return;
    }

    try {
        window.localStorage.setItem(`${key}-${contactId}`, JSON.stringify({ display: value }));
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

export function useMapPreferences(): UseMapPreferencesReturn {
    const [controlState, setControlState] = useState<MapControlState>(() => ({
        autoZoomEnabled: getPreference(PREFERENCE_KEYS.AUTO_ZOOM, true),
        couriersOnlyEnabled: getPreference(PREFERENCE_KEYS.COURIERS_ONLY, false),
        urgentArmyOnlyEnabled: getPreference(PREFERENCE_KEYS.URGENT_ARMY_ONLY, false),
        couriersLargeViewEnabled: getPreference(PREFERENCE_KEYS.COURIERS_LARGE_VIEW, false),
    }));

    const setAutoZoom = useCallback((enabled: boolean) => {
        setControlState((prev) => ({ ...prev, autoZoomEnabled: enabled }));
        savePreference(PREFERENCE_KEYS.AUTO_ZOOM, enabled);
    }, []);

    const setCouriersOnly = useCallback((enabled: boolean) => {
        setControlState((prev) => ({ ...prev, couriersOnlyEnabled: enabled }));
        savePreference(PREFERENCE_KEYS.COURIERS_ONLY, enabled);
    }, []);

    const setUrgentArmyOnly = useCallback((enabled: boolean) => {
        setControlState((prev) => ({ ...prev, urgentArmyOnlyEnabled: enabled }));
        savePreference(PREFERENCE_KEYS.URGENT_ARMY_ONLY, enabled);
    }, []);

    const setCouriersLargeView = useCallback((enabled: boolean) => {
        setControlState((prev) => ({ ...prev, couriersLargeViewEnabled: enabled }));
        savePreference(PREFERENCE_KEYS.COURIERS_LARGE_VIEW, enabled);
    }, []);

    const toggleAutoZoom = useCallback(() => {
        setControlState((prev) => {
            const newValue = !prev.autoZoomEnabled;
            savePreference(PREFERENCE_KEYS.AUTO_ZOOM, newValue);
            return { ...prev, autoZoomEnabled: newValue };
        });
    }, []);

    const toggleCouriersOnly = useCallback(() => {
        setControlState((prev) => {
            // Don't allow toggle when large view is enabled
            if (prev.couriersLargeViewEnabled) return prev;

            const newValue = !prev.couriersOnlyEnabled;
            savePreference(PREFERENCE_KEYS.COURIERS_ONLY, newValue);
            return { ...prev, couriersOnlyEnabled: newValue };
        });
    }, []);

    const toggleUrgentArmyOnly = useCallback(() => {
        setControlState((prev) => {
            // Don't allow toggle when large view is enabled
            if (prev.couriersLargeViewEnabled) return prev;

            const newValue = !prev.urgentArmyOnlyEnabled;
            savePreference(PREFERENCE_KEYS.URGENT_ARMY_ONLY, newValue);
            return { ...prev, urgentArmyOnlyEnabled: newValue };
        });
    }, []);

    const toggleCouriersLargeView = useCallback(() => {
        setControlState((prev) => {
            const newValue = !prev.couriersLargeViewEnabled;
            savePreference(PREFERENCE_KEYS.COURIERS_LARGE_VIEW, newValue);

            // When enabling large view, disable other modes
            if (newValue) {
                savePreference(PREFERENCE_KEYS.COURIERS_ONLY, false);
                savePreference(PREFERENCE_KEYS.URGENT_ARMY_ONLY, false);
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
