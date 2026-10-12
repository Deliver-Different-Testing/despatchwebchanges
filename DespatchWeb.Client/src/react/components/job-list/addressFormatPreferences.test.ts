import {loadEffectiveAddressFormat} from './addressFormatPreferences';
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

describe('loadEffectiveAddressFormat', () => {
    beforeEach(() => {
        jest.spyOn(console, 'error').mockImplementation(() => undefined);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('prefers the user override over the tenant default, per side', async () => {
        mockedGetPreference.mockResolvedValue(
            '{"pickup":{"line1":["streetName"],"line2":[]},"delivery":{"line1":["postcode"],"line2":[]}}',
        );
        mockedGetTenantDefault.mockResolvedValue(
            '{"pickup":{"line1":["country"],"line2":[]},"delivery":{"line1":["country"],"line2":[]}}',
        );

        expect(await loadEffectiveAddressFormat()).toEqual({
            pickup: {line1: ['streetName'], line2: []},
            delivery: {line1: ['postcode'], line2: []},
        });
    });

    it('falls back to the tenant default, per side, when there is no user override on that side', async () => {
        mockedGetPreference.mockResolvedValue('{"pickup":{"line1":["streetName"],"line2":[]},"delivery":null}');
        mockedGetTenantDefault.mockResolvedValue('{"pickup":null,"delivery":{"line1":["postcode"],"line2":[]}}');

        expect(await loadEffectiveAddressFormat()).toEqual({
            pickup: {line1: ['streetName'], line2: []},
            delivery: {line1: ['postcode'], line2: []},
        });
    });

    it('resolves both sides to undefined when neither is configured', async () => {
        mockedGetPreference.mockResolvedValue(null);
        mockedGetTenantDefault.mockResolvedValue(null);

        expect(await loadEffectiveAddressFormat()).toEqual({pickup: undefined, delivery: undefined});
    });

    it('does not let a failing tenant-default fetch discard a working user override', async () => {
        mockedGetPreference.mockResolvedValue('{"pickup":{"line1":["streetName"],"line2":[]},"delivery":null}');
        mockedGetTenantDefault.mockRejectedValue(new Error('500'));

        expect(await loadEffectiveAddressFormat()).toEqual({
            pickup: {line1: ['streetName'], line2: []},
            delivery: undefined,
        });
    });

    it('does not let a failing user-preference fetch discard a working tenant default', async () => {
        mockedGetPreference.mockRejectedValue(new Error('500'));
        mockedGetTenantDefault.mockResolvedValue('{"pickup":{"line1":["postcode"],"line2":[]},"delivery":null}');

        expect(await loadEffectiveAddressFormat()).toEqual({
            pickup: {line1: ['postcode'], line2: []},
            delivery: undefined,
        });
    });
});
