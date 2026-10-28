/**
 * Tenant Settings API
 *
 * Read-only tenant-wide settings for the current tenant (one row per tenant
 * database). Written elsewhere — e.g. a tenant admin's Dispatch settings page
 * in the Configurator, which shares the same database.
 */

import {apiClient} from './client';

/** Returns the tenant's default dispatch-address-format JSON, or null when unconfigured. */
export async function getTenantAddressFormatDefault(): Promise<string | null> {
    const json = await apiClient.get<string | null>('TenantSettings/GetDispatchAddressFormatDefault');
    return json ?? null;
}

/** Returns the tenant's default courier-flag last-delivery mode (unvalidated), or null when unconfigured. */
export async function getTenantCourierFlagLastDeliveryDefault(): Promise<string | null> {
    const mode = await apiClient.get<string | null>('TenantSettings/GetCourierFlagLastDeliveryDefault');
    return mode ?? null;
}

/** Returns the tenant's default appearance-settings JSON (unvalidated), or null when unconfigured. */
export async function getTenantAppearanceDefault(): Promise<string | null> {
    const json = await apiClient.get<string | null>('TenantSettings/GetAppearanceDefault');
    return json ?? null;
}
