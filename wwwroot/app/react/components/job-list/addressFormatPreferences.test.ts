import {loadEffectiveAddressFieldOrder} from './addressFormatPreferences';
import {getPreference} from '../../services/preferencesApi';
import {getTenantAddressFormatDefault} from '../../services/tenantSettingsApi';

jest.mock('../../services/preferencesApi', () => ({
    getPreference: jest.fn(),
}));
jest.mock('../../services/tenantSettingsApi', () => ({
    getTenantAddressFormatDefault: jest.fn(),
}));

const mockedGetPreference = getPreference as jest.Mock;
const mockedGetTenantDefault = getTenantAddressFormatDefault as jest.Mock;

describe('loadEffectiveAddressFieldOrder', () => {
    it('prefers the user override over the tenant default', async () => {
        mockedGetPreference.mockResolvedValue('{"fields":["streetName"]}');
        mockedGetTenantDefault.mockResolvedValue('{"fields":["postcode"]}');

        expect(await loadEffectiveAddressFieldOrder()).toEqual(['streetName']);
    });

    it('falls back to the tenant default when there is no user override', async () => {
        mockedGetPreference.mockResolvedValue(null);
        mockedGetTenantDefault.mockResolvedValue('{"fields":["postcode"]}');

        expect(await loadEffectiveAddressFieldOrder()).toEqual(['postcode']);
    });

    it('resolves to undefined when neither is configured', async () => {
        mockedGetPreference.mockResolvedValue(null);
        mockedGetTenantDefault.mockResolvedValue(null);

        expect(await loadEffectiveAddressFieldOrder()).toBeUndefined();
    });

    it('treats an empty saved field list as unconfigured, falling through to the tenant default', async () => {
        mockedGetPreference.mockResolvedValue('{"fields":[]}');
        mockedGetTenantDefault.mockResolvedValue('{"fields":["postcode"]}');

        expect(await loadEffectiveAddressFieldOrder()).toEqual(['postcode']);
    });
});
