import type {Mock} from 'vitest';
import {
    lastDeliveryChoiceOptions,
    loadLastDeliverySettings,
    resolveLastDeliveryMode,
    saveLastDeliveryOverride,
} from './courierFlagLastDeliveryPreference';
import {deletePreference, getPreference, savePreference} from '../api/preferencesApi';
import {getTenantCourierFlagLastDeliveryDefault} from '../api/tenantSettingsApi';
import {StaffPreferenceKey} from '../types/enums/staff-preference-key.enum';

vi.mock('../api/preferencesApi', () => ({
    getPreference: vi.fn(),
    savePreference: vi.fn(),
    deletePreference: vi.fn(),
}));
vi.mock('../api/tenantSettingsApi', () => ({
    getTenantCourierFlagLastDeliveryDefault: vi.fn(),
}));

const mockGet = getPreference as Mock;
const mockSave = savePreference as Mock;
const mockDelete = deletePreference as Mock;
const mockTenant = getTenantCourierFlagLastDeliveryDefault as Mock;

describe('courier flag last delivery preference', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => vi.restoreAllMocks());

    it('resolves the user override first, then the tenant default, then the country default', () => {
        expect(resolveLastDeliveryMode({userOverride: 'time', tenantDefault: 'region'}, true)).toBe('time');
        expect(resolveLastDeliveryMode({userOverride: null, tenantDefault: 'region'}, true)).toBe('region');
        expect(resolveLastDeliveryMode({userOverride: null, tenantDefault: null}, true)).toBe('locality');
        expect(resolveLastDeliveryMode({userOverride: null, tenantDefault: null}, false)).toBe('region');
    });

    it('loads both layers, dropping values it does not recognise', async () => {
        mockGet.mockResolvedValue(JSON.stringify('localityRegion'));
        mockTenant.mockResolvedValue('township');

        await expect(loadLastDeliverySettings()).resolves.toEqual({
            userOverride: 'localityRegion',
            tenantDefault: null,
        });
        expect(mockGet).toHaveBeenCalledWith(StaffPreferenceKey.CourierFlagLastDelivery);
    });

    it('keeps the user override when the tenant default fails to load', async () => {
        mockGet.mockResolvedValue(JSON.stringify('time'));
        mockTenant.mockRejectedValue(new Error('Invalid column name'));

        await expect(loadLastDeliverySettings()).resolves.toEqual({userOverride: 'time', tenantDefault: null});
    });

    it('saves an override, and deletes the preference to fall back to the company default', async () => {
        await saveLastDeliveryOverride('off');
        expect(mockSave).toHaveBeenCalledWith(StaffPreferenceKey.CourierFlagLastDelivery, JSON.stringify('off'));

        await saveLastDeliveryOverride(null);
        expect(mockDelete).toHaveBeenCalledWith(StaffPreferenceKey.CourierFlagLastDelivery);
    });

    it('labels the company default choice with what it currently resolves to', () => {
        expect(lastDeliveryChoiceOptions(true, null)[0])
            .toEqual({value: 'default', label: 'Company default (Township or city)'});
        expect(lastDeliveryChoiceOptions(false, 'time')[0])
            .toEqual({value: 'default', label: 'Company default (Time since delivery only)'});
        expect(lastDeliveryChoiceOptions(false, null).map(o => o.label)).toEqual([
            'Company default (City)', 'Suburb', 'City', 'Suburb and city', 'Time since delivery only', "Don't show",
        ]);
    });
});
