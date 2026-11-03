import {
    loadNavStyleSettings,
    NAV_STYLE_STORAGE_KEY,
    readCachedNavStyle,
    resolveNavStyle,
    saveNavStyleOverride,
    writeCachedNavStyle,
    type NavStyleSettings,
} from './navStylePreference';
import {deletePreference, getPreference, savePreference} from '../api/preferencesApi';
import {getTenantNavStyleDefault} from '../api/tenantSettingsApi';
import {StaffPreferenceKey} from '../types/enums/staff-preference-key.enum';

jest.mock('../api/preferencesApi', () => ({
    getPreference: jest.fn(),
    savePreference: jest.fn(),
    deletePreference: jest.fn(),
}));
jest.mock('../api/tenantSettingsApi', () => ({
    getTenantNavStyleDefault: jest.fn(),
}));

const mockGet = getPreference as jest.Mock;
const mockSave = savePreference as jest.Mock;
const mockDelete = deletePreference as jest.Mock;
const mockTenant = getTenantNavStyleDefault as jest.Mock;

const settings = (overrides: Partial<NavStyleSettings>): NavStyleSettings => ({
    userOverride: null, tenantDefault: null, userFailed: false, tenantFailed: false, ...overrides,
});

describe('nav style preference', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        localStorage.clear();
        jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => jest.restoreAllMocks());

    it('resolves the user override, then the tenant default, then dispatch', () => {
        expect(resolveNavStyle(settings({userOverride: 'dispatch', tenantDefault: 'dfrnt'}), null)).toBe('dispatch');
        expect(resolveNavStyle(settings({userOverride: 'dfrnt', tenantDefault: 'dispatch'}), null)).toBe('dfrnt');
        expect(resolveNavStyle(settings({tenantDefault: 'dfrnt'}), null)).toBe('dfrnt');
        expect(resolveNavStyle(settings({}), 'dfrnt')).toBe('dispatch');
    });

    it('falls back to the cached style when a read failed, then the tenant value, then dispatch', () => {
        expect(resolveNavStyle(settings({userFailed: true, tenantDefault: 'dispatch'}), 'dfrnt')).toBe('dfrnt');
        expect(resolveNavStyle(settings({userFailed: true, tenantDefault: 'dfrnt'}), null)).toBe('dfrnt');
        expect(resolveNavStyle(settings({userFailed: true}), null)).toBe('dispatch');
        expect(resolveNavStyle(settings({tenantFailed: true}), 'dfrnt')).toBe('dfrnt');
        expect(resolveNavStyle(settings({tenantFailed: true}), null)).toBe('dispatch');
    });

    it('loads both layers, dropping values it does not recognise', async () => {
        mockGet.mockResolvedValue(JSON.stringify('dfrnt'));
        mockTenant.mockResolvedValue('sidebar');

        await expect(loadNavStyleSettings()).resolves.toEqual(settings({userOverride: 'dfrnt'}));
        expect(mockGet).toHaveBeenCalledWith(StaffPreferenceKey.NavStyle);
    });

    it('treats junk or unparseable stored user values as not set', async () => {
        mockTenant.mockResolvedValue(null);
        mockGet.mockResolvedValue(JSON.stringify('sidebar'));
        await expect(loadNavStyleSettings()).resolves.toEqual(settings({}));

        mockGet.mockResolvedValue('not json');
        await expect(loadNavStyleSettings()).resolves.toEqual(settings({}));
    });

    it('keeps the user override when the tenant read fails, and vice versa', async () => {
        mockGet.mockResolvedValue(JSON.stringify('dfrnt'));
        mockTenant.mockRejectedValue(new Error('Invalid column name'));
        await expect(loadNavStyleSettings()).resolves.toEqual(settings({userOverride: 'dfrnt', tenantFailed: true}));

        mockGet.mockRejectedValue(new Error('boom'));
        mockTenant.mockResolvedValue('dfrnt');
        await expect(loadNavStyleSettings()).resolves.toEqual(settings({tenantDefault: 'dfrnt', userFailed: true}));
    });

    it('saves an override, and deletes the preference to fall back to the company default', async () => {
        await saveNavStyleOverride('dfrnt');
        expect(mockSave).toHaveBeenCalledWith(StaffPreferenceKey.NavStyle, JSON.stringify('dfrnt'));

        await saveNavStyleOverride(null);
        expect(mockDelete).toHaveBeenCalledWith(StaffPreferenceKey.NavStyle);
    });

    it('caches the resolved style, ignoring junk, and survives unavailable storage', () => {
        expect(readCachedNavStyle()).toBeNull();
        writeCachedNavStyle('dfrnt');
        expect(localStorage.getItem(NAV_STYLE_STORAGE_KEY)).toBe('dfrnt');
        expect(readCachedNavStyle()).toBe('dfrnt');

        localStorage.setItem(NAV_STYLE_STORAGE_KEY, 'sidebar');
        expect(readCachedNavStyle()).toBeNull();

        jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
        jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
        expect(readCachedNavStyle()).toBeNull();
        expect(() => writeCachedNavStyle('dfrnt')).not.toThrow();
    });
});
