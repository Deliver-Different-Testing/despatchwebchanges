import {useCallback, useEffect, useSyncExternalStore} from 'react';
import {
    loadNavStyleSettings,
    readCachedNavStyle,
    resolveNavStyle,
    saveNavStyleOverride,
    writeCachedNavStyle,
    type NavStyleSettings,
} from '../services/navStylePreference';
import {toastService} from '../services/toastService';
import {DEFAULT_NAV_STYLE, type NavStyle} from '../types/navStyle';

interface NavStyleState {
    settings: NavStyleSettings | null;
    cached: NavStyle | null;
}

const listeners = new Set<() => void>();
let state: NavStyleState = {settings: null, cached: readCachedNavStyle()};
let loading = false;

function setState(next: NavStyleState): void {
    state = next;
    listeners.forEach((notify) => notify());
}

function subscribe(onChange: () => void): () => void {
    listeners.add(onChange);
    return () => { listeners.delete(onChange); };
}

function ensureLoaded(): void {
    if (state.settings || loading) return;
    loading = true;
    void loadNavStyleSettings().then((settings) => {
        const resolved = resolveNavStyle(settings, state.cached);
        writeCachedNavStyle(resolved);
        setState({settings, cached: resolved});
    }).finally(() => { loading = false; });
}

/** Test seam: forgets the loaded settings so the next mount reloads. */
export function resetNavStyleStore(): void {
    loading = false;
    state = {settings: null, cached: readCachedNavStyle()};
    listeners.forEach((notify) => notify());
}

/**
 * The effective navigation style plus its two layers. Shared across every consumer on the page
 * (shell and Settings), loaded once; until then the last cached style is used. `saveOverride`
 * persists first and only then switches, so a failed save keeps the current style and toasts.
 */
export function useNavStyle() {
    const current = useSyncExternalStore(subscribe, () => state);

    useEffect(ensureLoaded, []);

    const style = current.settings
        ? resolveNavStyle(current.settings, current.cached)
        : current.cached ?? DEFAULT_NAV_STYLE;

    const saveOverride = useCallback(async (userOverride: NavStyle | null) => {
        try {
            await saveNavStyleOverride(userOverride);
        } catch (err) {
            console.error('Failed to save navigation style preference:', err);
            toastService.showErrorToast("Couldn't save navigation style. Check your connection and try again.");
            return;
        }
        const base: NavStyleSettings = state.settings ?? {
            userOverride: null, tenantDefault: null, userFailed: false, tenantFailed: false,
        };
        const settings = {...base, userOverride, userFailed: false};
        const resolved = resolveNavStyle(settings, state.cached);
        writeCachedNavStyle(resolved);
        setState({settings, cached: resolved});
    }, []);

    return {
        style,
        userOverride: current.settings?.userOverride ?? null,
        tenantDefault: current.settings?.tenantDefault ?? null,
        saveOverride,
    };
}
