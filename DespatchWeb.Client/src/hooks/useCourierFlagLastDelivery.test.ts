import {act, renderHook, waitFor} from '@testing-library/react';
import {useCourierFlagLastDelivery} from './useCourierFlagLastDelivery';
import {loadLastDeliverySettings, saveLastDeliveryOverride} from '../services/courierFlagLastDeliveryPreference';

jest.mock('../services/courierFlagLastDeliveryPreference', () => ({
    ...jest.requireActual('../services/courierFlagLastDeliveryPreference'),
    loadLastDeliverySettings: jest.fn(),
    saveLastDeliveryOverride: jest.fn(),
}));

const mockLoad = loadLastDeliverySettings as jest.Mock;
const mockSave = saveLastDeliveryOverride as jest.Mock;

describe('useCourierFlagLastDelivery', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockSave.mockResolvedValue(undefined);
    });

    it('starts on the country default, then applies the loaded tenant default', async () => {
        mockLoad.mockResolvedValue({userOverride: null, tenantDefault: 'time'});

        const {result} = renderHook(() => useCourierFlagLastDelivery(true));
        expect(result.current.mode).toBe('locality');

        await waitFor(() => expect(result.current.mode).toBe('time'));
        expect(result.current.tenantDefault).toBe('time');
        expect(result.current.userOverride).toBeNull();
    });

    it('applies an override without saving, and saves when asked to', async () => {
        mockLoad.mockResolvedValue({userOverride: null, tenantDefault: 'region'});
        const {result} = renderHook(() => useCourierFlagLastDelivery(true));
        await waitFor(() => expect(result.current.mode).toBe('region'));

        act(() => result.current.applyOverride('off'));
        expect(result.current.mode).toBe('off');
        expect(mockSave).not.toHaveBeenCalled();

        await act(() => result.current.saveOverride(null));
        expect(result.current.mode).toBe('region');
        expect(mockSave).toHaveBeenCalledWith(null);
    });
});
