import {useEffect, useMemo, useSyncExternalStore} from 'react';
import {getSession} from '../api/session';
import {deletePreference, getPreference, savePreference} from '../api/preferencesApi';
import {getTenantAppearanceDefault} from '../api/tenantSettingsApi';
import {StaffPreferenceKey} from '../types/enums/staff-preference-key.enum';
import {
    mergeAppearance,
    parseAppearanceSettings,
    resolveHighContrast,
    type AppearanceSettings,
} from '../theme/appearance';

/**
 * The user's `ThemeCustomisation` StaffPreference and the tenant's appearance default, cached
 * together in localStorage so the first paint is already themed, then reconciled with the server
 * once per page. Every island has its own React root, so changes are broadcast on `window` (same
 * document) and via the `storage` event (other tabs).
 */
export const APPEARANCE_STORAGE_KEY = 'dd-appearance';
const CHANGE_EVENT = 'dd-appearance-change';
const SERVER_SYNC_FLAG = '__ddAppearanceServerSynced';
const MORE_CONTRAST_QUERY = '(prefers-contrast: more)';

export interface AppearanceState {
    user: AppearanceSettings | null;
    tenant: AppearanceSettings | null;
}

const EMPTY_STATE: AppearanceState = {user: null, tenant: null};

let cachedRaw: string | null = null;
// Bumped by every local save so an in-flight server sync can't overwrite a newer choice.
let userSaveCount = 0;
let cachedState: AppearanceState = EMPTY_STATE;

function readRaw(): string | null {
    try {
        return localStorage.getItem(APPEARANCE_STORAGE_KEY);
    } catch {
        return null;
    }
}

/** Stable per stored value, as useSyncExternalStore requires. */
export function getAppearanceState(): AppearanceState {
    const raw = readRaw();
    if (raw === cachedRaw) return cachedState;
    cachedRaw = raw;
    try {
        const parsed = raw ? JSON.parse(raw) as Partial<Record<keyof AppearanceState, unknown>> : null;
        cachedState = parsed
            ? {user: parseAppearanceSettings(parsed.user), tenant: parseAppearanceSettings(parsed.tenant)}
            : EMPTY_STATE;
    } catch {
        cachedState = EMPTY_STATE;
    }
    return cachedState;
}

function writeState(state: AppearanceState): void {
    try {
        localStorage.setItem(APPEARANCE_STORAGE_KEY, JSON.stringify(state));
    } catch {
        // localStorage may be unavailable (private browsing); the choice just won't survive a reload.
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
}

/** Saves the user's override, or deletes it (null) so the company default applies again. */
export async function saveUserAppearance(settings: AppearanceSettings | null): Promise<void> {
    const user = parseAppearanceSettings(settings);
    userSaveCount++;
    writeState({...getAppearanceState(), user});
    if (user) {
        await savePreference(StaffPreferenceKey.ThemeCustomisation, JSON.stringify(user));
    } else {
        await deletePreference(StaffPreferenceKey.ThemeCustomisation);
    }
}

/** Only a signed-in staff member (Razor sets ContactID) has a server preference to sync. */
function canSyncWithServer(): boolean {
    return Number(getSession().contactId) > 0;
}

/**
 * Reconciles with the server once per page. The two reads settle independently so a tenant default
 * that fails to load (e.g. the column not yet migrated on a tenant DB) keeps its cached value
 * instead of discarding a working user override, and vice versa.
 */
export async function syncAppearanceFromServerOnce(): Promise<void> {
    if (!canSyncWithServer()) return;
    const flagged = window as unknown as Record<string, boolean>;
    if (flagged[SERVER_SYNC_FLAG]) return;
    flagged[SERVER_SYNC_FLAG] = true;

    const savesBefore = userSaveCount;
    const [userResult, tenantResult] = await Promise.allSettled([
        getPreference(StaffPreferenceKey.ThemeCustomisation),
        getTenantAppearanceDefault(),
    ]);
    if (userResult.status === 'rejected') {
        console.error('Failed to load appearance preference:', userResult.reason);
    }
    if (tenantResult.status === 'rejected') {
        console.error('Failed to load tenant appearance default:', tenantResult.reason);
    }

    const current = getAppearanceState();
    writeState({
        user: userResult.status === 'fulfilled' && userSaveCount === savesBefore
            ? parseAppearanceSettings(userResult.value) : current.user,
        tenant: tenantResult.status === 'fulfilled' ? parseAppearanceSettings(tenantResult.value) : current.tenant,
    });
}

function subscribe(onChange: () => void): () => void {
    const onStorage = (e: StorageEvent) => {
        if (e.key === null || e.key === APPEARANCE_STORAGE_KEY) onChange();
    };
    window.addEventListener(CHANGE_EVENT, onChange);
    window.addEventListener('storage', onStorage);
    return () => {
        window.removeEventListener(CHANGE_EVENT, onChange);
        window.removeEventListener('storage', onStorage);
    };
}

function moreContrastQuery(): MediaQueryList | null {
    try {
        return window.matchMedia?.(MORE_CONTRAST_QUERY) ?? null;
    } catch {
        return null;
    }
}

function systemPrefersMoreContrast(): boolean {
    return moreContrastQuery()?.matches ?? false;
}

function subscribeToSystemContrast(onChange: () => void): () => void {
    const query = moreContrastQuery();
    query?.addEventListener?.('change', onChange);
    return () => query?.removeEventListener?.('change', onChange);
}

export interface AppearanceValue extends AppearanceState {
    /** Tenant default with the user's override layered on top. */
    resolved: AppearanceSettings;
    systemPrefersMoreContrast: boolean;
    highContrast: boolean;
}

export function useAppearance(): AppearanceValue {
    useEffect(() => {
        void syncAppearanceFromServerOnce();
    }, []);
    const state = useSyncExternalStore(subscribe, getAppearanceState, () => EMPTY_STATE);
    const prefersMore = useSyncExternalStore(subscribeToSystemContrast, systemPrefersMoreContrast, () => false);
    return useMemo(() => {
        const resolved = mergeAppearance(state.tenant, state.user);
        return {
            ...state,
            resolved,
            systemPrefersMoreContrast: prefersMore,
            highContrast: resolveHighContrast(resolved.contrast, prefersMore),
        };
    }, [state, prefersMore]);
}
