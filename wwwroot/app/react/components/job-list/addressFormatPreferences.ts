/**
 * Effective address format for job list display.
 *
 * Two layers, resolved independently per side (pickup/delivery): the current
 * user's own StaffPreference override, and the tenant-wide default a tenant
 * admin sets in the Configurator. The user override wins when present;
 * otherwise the tenant default applies; when neither is configured that side
 * resolves to `undefined`, meaning "use the legacy hardcoded NZ/US format".
 *
 * The two fetches are resolved with `Promise.allSettled`, not `Promise.all` —
 * a failure fetching the tenant default (e.g. the column not existing on a
 * given tenant DB yet) must not also discard an already-working user override.
 */

import {StaffPreferenceKey} from '../../../enums/staff-preference-key.enum';
import {getPreference} from '../../services/preferencesApi';
import {getTenantAddressFormatDefault} from '../../services/tenantSettingsApi';
import type {AddressLineFormat} from '../../interfaces/address';
import {parseAddressFormatJson} from './jobAddressFormat';

export interface EffectiveAddressFormat {
    pickup?: AddressLineFormat;
    delivery?: AddressLineFormat;
}

export async function loadEffectiveAddressFormat(): Promise<EffectiveAddressFormat> {
    const [userResult, tenantResult] = await Promise.allSettled([
        getPreference(StaffPreferenceKey.DispatchAddressFormat),
        getTenantAddressFormatDefault(),
    ]);

    if (userResult.status === 'rejected') {
        console.error('Failed to load address format preference:', userResult.reason);
    }
    if (tenantResult.status === 'rejected') {
        console.error('Failed to load tenant address format default:', tenantResult.reason);
    }

    const userSides = userResult.status === 'fulfilled'
        ? parseAddressFormatJson(userResult.value)
        : {pickup: null, delivery: null};
    const tenantSides = tenantResult.status === 'fulfilled'
        ? parseAddressFormatJson(tenantResult.value)
        : {pickup: null, delivery: null};

    return {
        pickup: userSides.pickup ?? tenantSides.pickup ?? undefined,
        delivery: userSides.delivery ?? tenantSides.delivery ?? undefined,
    };
}
