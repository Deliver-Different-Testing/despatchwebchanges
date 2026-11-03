/**
 * Effective navigation style: the user's own StaffPreference override, else the tenant default set in
 * the Configurator's Dispatch settings, else `dispatch`. The two reads settle independently so a failed
 * tenant read (e.g. the column not yet migrated) can't discard a working user override. The resolved
 * value is cached in localStorage so first paint uses the last known style rather than flashing.
 */

import {deletePreference, getPreference, savePreference} from '../api/preferencesApi';
import {getTenantNavStyleDefault} from '../api/tenantSettingsApi';
import {StaffPreferenceKey} from '../types/enums/staff-preference-key.enum';
import {DEFAULT_NAV_STYLE, isNavStyle, type NavStyle} from '../types/navStyle';

export const NAV_STYLE_STORAGE_KEY = 'dd-nav-style';

export interface NavStyleSettings {
    userOverride: NavStyle | null;
    tenantDefault: NavStyle | null;
    userFailed: boolean;
    tenantFailed: boolean;
}

/** A settings-UI choice: one of the styles, or 'default' to drop the user override. */
export type NavStyleChoice = NavStyle | 'default';

export const NAV_STYLE_CHOICES: {value: NavStyleChoice; label: string}[] = [
    {value: 'default', label: 'Company default'},
    {value: 'dispatch', label: 'Dispatch'},
    {value: 'dfrnt', label: 'DFRNT sidebar'},
];

export function resolveNavStyle(settings: NavStyleSettings, cached: NavStyle | null): NavStyle {
    if (settings.userOverride) return settings.userOverride;
    const unknown = settings.userFailed || (settings.tenantFailed && settings.tenantDefault === null);
    if (unknown) return cached ?? settings.tenantDefault ?? DEFAULT_NAV_STYLE;
    return settings.tenantDefault ?? DEFAULT_NAV_STYLE;
}

export async function loadNavStyleSettings(): Promise<NavStyleSettings> {
    const [userResult, tenantResult] = await Promise.allSettled([
        getPreference(StaffPreferenceKey.NavStyle),
        getTenantNavStyleDefault(),
    ]);

    if (userResult.status === 'rejected') {
        console.error('Failed to load navigation style preference:', userResult.reason);
    }
    if (tenantResult.status === 'rejected') {
        console.error('Failed to load tenant navigation style default:', tenantResult.reason);
    }

    return {
        userOverride: userResult.status === 'fulfilled' ? parseStoredStyle(userResult.value) : null,
        tenantDefault: tenantResult.status === 'fulfilled' && isNavStyle(tenantResult.value) ? tenantResult.value : null,
        userFailed: userResult.status === 'rejected',
        tenantFailed: tenantResult.status === 'rejected',
    };
}

/** Saves the user's override, or deletes it (null) so the company default applies again. */
export async function saveNavStyleOverride(style: NavStyle | null): Promise<void> {
    if (style === null) {
        await deletePreference(StaffPreferenceKey.NavStyle);
    } else {
        await savePreference(StaffPreferenceKey.NavStyle, JSON.stringify(style));
    }
}

export function readCachedNavStyle(): NavStyle | null {
    try {
        const stored = localStorage.getItem(NAV_STYLE_STORAGE_KEY);
        return isNavStyle(stored) ? stored : null;
    } catch {
        return null;
    }
}

export function writeCachedNavStyle(style: NavStyle): void {
    try {
        localStorage.setItem(NAV_STYLE_STORAGE_KEY, style);
    } catch {
        // localStorage may be unavailable (private browsing); first paint just won't be pre-seeded.
    }
}

function parseStoredStyle(raw: string | null): NavStyle | null {
    if (!raw) return null;
    try {
        const parsed: unknown = JSON.parse(raw);
        return isNavStyle(parsed) ? parsed : null;
    } catch {
        return null;
    }
}
