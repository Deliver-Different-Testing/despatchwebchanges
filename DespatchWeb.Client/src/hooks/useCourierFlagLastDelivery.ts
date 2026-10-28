import {useCallback, useEffect, useState} from 'react';
import {
    loadLastDeliverySettings,
    resolveLastDeliveryMode,
    saveLastDeliveryOverride,
    type LastDeliverySettings,
} from '../services/courierFlagLastDeliveryPreference';
import type {LastDeliveryLabelMode} from '../types/courierFlagLastDelivery';

/**
 * The map courier flags' effective last-delivery mode plus its two layers, loaded once on mount.
 * `applyOverride` only updates the page (for a change something else already saved, like the
 * dashboard settings dialog); `saveOverride` also persists it. Null drops back to the company default.
 */
export function useCourierFlagLastDelivery(isUsCustomer: boolean) {
    const [settings, setSettings] = useState<LastDeliverySettings>({userOverride: null, tenantDefault: null});

    useEffect(() => {
        let cancelled = false;
        void loadLastDeliverySettings().then((loaded) => {
            if (cancelled || (loaded.userOverride === null && loaded.tenantDefault === null)) return;
            setSettings(loaded);
        });
        return () => { cancelled = true; };
    }, []);

    const applyOverride = useCallback((userOverride: LastDeliveryLabelMode | null) => {
        setSettings((prev) => ({...prev, userOverride}));
    }, []);

    const saveOverride = useCallback(async (userOverride: LastDeliveryLabelMode | null) => {
        applyOverride(userOverride);
        try {
            await saveLastDeliveryOverride(userOverride);
        } catch (err) {
            console.error('Failed to save courier flag last delivery preference:', err);
        }
    }, [applyOverride]);

    return {
        mode: resolveLastDeliveryMode(settings, isUsCustomer),
        userOverride: settings.userOverride,
        tenantDefault: settings.tenantDefault,
        applyOverride,
        saveOverride,
    };
}
