import {
    lastDeliveryChoiceOptions,
    loadLastDeliverySettings,
    resolveLastDeliveryMode,
    saveLastDeliveryOverride,
} from './courierFlagLastDeliveryPreference';
import {deletePreference, getPreference, savePreference} from '../api/preferencesApi';
import {getTenantCourierFlagLastDeliveryDefault} from '../api/tenantSettingsApi';
import {StaffPreferenceKey} from '../types/enums/staff-preference-key.enum';

jest.mock('../api/preferencesApi', () => ({
    getPreference: jest.fn(),
    savePreference: jest.fn(),
    deletePreference: jest.fn(),
}));
jest.mock('../api/tenantSettingsApi', () => ({
    getTenantCourierFlagLastDeliveryDefault: jest.fn(),
}));

const mockGet = getPreference as jest.Mock;
const mockSave = savePreference as jest.Mock;
const mockDelete = deletePreference as jest.Mock;
const mockTenant = getTenantCourierFlagLastDeliveryDefault as jest.Mock;

describe('courier flag last delivery preference', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => jest.restoreAllMocks());

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
