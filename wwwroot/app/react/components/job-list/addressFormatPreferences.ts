/**
 * Effective address field order for job list display.
 *
 * Two layers: the current user's own StaffPreference override, and the
 * tenant-wide default a tenant admin sets in the Configurator. The user
 * override wins when present; otherwise the tenant default applies; when
 * neither is configured this resolves to `undefined`, meaning "use the
 * legacy hardcoded NZ/US format".
 */

import {StaffPreferenceKey} from '../../../enums/staff-preference-key.enum';
import {getPreference} from '../../services/preferencesApi';
import {getTenantAddressFormatDefault} from '../../services/tenantSettingsApi';
import type {AddressFieldKey} from '../../interfaces/address';
import {parseAddressFormatJson} from './jobAddressFormat';

export async function loadEffectiveAddressFieldOrder(): Promise<AddressFieldKey[] | undefined> {
    const [userJson, tenantJson] = await Promise.all([
        getPreference(StaffPreferenceKey.DispatchAddressFormat),
        getTenantAddressFormatDefault(),
    ]);

    const userFields = parseAddressFormatJson(userJson);
    if (userFields.length) return userFields;

    const tenantFields = parseAddressFormatJson(tenantJson);
    return tenantFields.length ? tenantFields : undefined;
}
