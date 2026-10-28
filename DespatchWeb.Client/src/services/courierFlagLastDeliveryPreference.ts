/**
 * Effective "last delivery" mode for the map courier flags.
 *
 * Same layering as the job-list address format: the current user's own StaffPreference override
 * wins, otherwise the tenant-wide default a tenant admin sets in the Configurator's Dispatch
 * Settings, otherwise the country default. The two fetches are settled independently so a tenant
 * default that fails to load (e.g. the column not yet migrated on a tenant DB) can't also discard a
 * working user override.
 */

import {deletePreference, getPreference, savePreference} from '../api/preferencesApi';
import {getTenantCourierFlagLastDeliveryDefault} from '../api/tenantSettingsApi';
import {StaffPreferenceKey} from '../types/enums/staff-preference-key.enum';
import {
    defaultLastDeliveryLabelMode,
    isLastDeliveryLabelMode,
    lastDeliveryLabelOptions,
    type LastDeliveryLabelMode,
} from '../types/courierFlagLastDelivery';

export interface LastDeliverySettings {
    userOverride: LastDeliveryLabelMode | null;
    tenantDefault: LastDeliveryLabelMode | null;
}

/** A settings-UI choice: one of the modes, or 'default' to drop the user override. */
export type LastDeliveryChoice = LastDeliveryLabelMode | 'default';

export function resolveLastDeliveryMode(settings: LastDeliverySettings, isUsCustomer: boolean): LastDeliveryLabelMode {
    return settings.userOverride ?? settings.tenantDefault ?? defaultLastDeliveryLabelMode(isUsCustomer);
}

export async function loadLastDeliverySettings(): Promise<LastDeliverySettings> {
    const [userResult, tenantResult] = await Promise.allSettled([
        getPreference(StaffPreferenceKey.CourierFlagLastDelivery),
        getTenantCourierFlagLastDeliveryDefault(),
    ]);

    if (userResult.status === 'rejected') {
        console.error('Failed to load courier flag last delivery preference:', userResult.reason);
    }
    if (tenantResult.status === 'rejected') {
        console.error('Failed to load tenant courier flag last delivery default:', tenantResult.reason);
    }

    return {
        userOverride: userResult.status === 'fulfilled' ? parseStoredMode(userResult.value) : null,
        tenantDefault: tenantResult.status === 'fulfilled' && isLastDeliveryLabelMode(tenantResult.value)
            ? tenantResult.value
            : null,
    };
}

/** Saves the user's override, or deletes it (null) so the company default applies again. */
export async function saveLastDeliveryOverride(mode: LastDeliveryLabelMode | null): Promise<void> {
    if (mode === null) {
        await deletePreference(StaffPreferenceKey.CourierFlagLastDelivery);
    } else {
        await savePreference(StaffPreferenceKey.CourierFlagLastDelivery, JSON.stringify(mode));
    }
}

/** The per-user choices, led by "Company default" labelled with what that currently resolves to. */
export function lastDeliveryChoiceOptions(
    isUsCustomer: boolean,
    tenantDefault: LastDeliveryLabelMode | null,
): {value: LastDeliveryChoice; label: string}[] {
    const options = lastDeliveryLabelOptions(isUsCustomer);
    const companyMode = tenantDefault ?? defaultLastDeliveryLabelMode(isUsCustomer);
    const companyLabel = options.find(o => o.value === companyMode)?.label;
    return [{value: 'default', label: `Company default (${companyLabel})`}, ...options];
}

function parseStoredMode(raw: string | null): LastDeliveryLabelMode | null {
    if (!raw) return null;
    try {
        const parsed: unknown = JSON.parse(raw);
        return isLastDeliveryLabelMode(parsed) ? parsed : null;
    } catch {
        return null;
    }
}
