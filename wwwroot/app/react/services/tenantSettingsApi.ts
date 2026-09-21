/**
 * Tenant Settings API
 *
 * Read-only tenant-wide settings for the current tenant (one row per tenant
 * database). Written elsewhere — e.g. a tenant admin's Dispatch settings page
 * in the Configurator, which shares the same database.
 */

import {apiClient} from './apiClient';

/** Returns the tenant's default dispatch-address-format JSON, or null when unconfigured. */
export async function getTenantAddressFormatDefault(): Promise<string | null> {
    const json = await apiClient.get<string | null>('TenantSettings/GetDispatchAddressFormatDefault');
    return json ?? null;
}
