import {act, renderHook, waitFor} from '@testing-library/react';
import {
    isLiquidGlassEnabled,
    setLiquidGlassEnabled,
    syncLiquidGlassFromServerOnce,
    useLiquidGlassEnabled,
} from './useLiquidGlassPreference';
import {isLiquidGlassSupported} from './glassSupport';
import {getPreference, savePreference} from '../api/preferencesApi';
import {StaffPreferenceKey} from '../types/enums/staff-preference-key.enum';

jest.mock('./glassSupport', () => ({isLiquidGlassSupported: jest.fn()}));
jest.mock('../api/preferencesApi', () => ({
    getPreference: jest.fn(),
    savePreference: jest.fn(),
}));

const mockSupported = isLiquidGlassSupported as jest.Mock;
const mockGet = getPreference as jest.Mock;
const mockSave = savePreference as jest.Mock;
const win = window as unknown as {ContactID?: number; __ddLiquidGlassServerSynced?: boolean};

describe('liquid glass preference', () => {
    beforeEach(() => {
        localStorage.clear();
        jest.clearAllMocks();
        mockSupported.mockReturnValue(true);
        mockSave.mockResolvedValue(undefined);
        mockGet.mockResolvedValue(null);
        win.ContactID = 7;
        delete win.__ddLiquidGlassServerSynced;
    });

    it('is off by default and treats any value other than "on" as off', () => {
        expect(isLiquidGlassEnabled()).toBe(false);
        localStorage.setItem('dd-liquid-glass', 'true');
        expect(isLiquidGlassEnabled()).toBe(false);
    });

    it('turns on and off, live-updates mounted hooks and saves each change as the LiquidGlass staff preference', () => {
        const {result} = renderHook(() => useLiquidGlassEnabled());
        act(() => setLiquidGlassEnabled(true));
        expect(result.current).toBe(true);
        expect(localStorage.getItem('dd-liquid-glass')).toBe('on');
        expect(mockSave).toHaveBeenLastCalledWith(StaffPreferenceKey.LiquidGlass, 'on');
        act(() => setLiquidGlassEnabled(false));
        expect(result.current).toBe(false);
        expect(mockSave).toHaveBeenLastCalledWith(StaffPreferenceKey.LiquidGlass, 'off');
    });

    describe('unsupported browser', () => {
        beforeEach(() => mockSupported.mockReturnValue(false));

        it('reports off even when a stored "on" is present', () => {
            localStorage.setItem('dd-liquid-glass', 'on');
            expect(isLiquidGlassEnabled()).toBe(false);
        });

        it('refuses to turn on: nothing stored, nothing saved', () => {
            setLiquidGlassEnabled(true);
            expect(localStorage.getItem('dd-liquid-glass')).toBeNull();
            expect(mockSave).not.toHaveBeenCalled();
        });

        it('keeps a server "on" for other devices but never enables or overwrites it here', async () => {
            mockGet.mockResolvedValue('on');
            await syncLiquidGlassFromServerOnce();
            expect(isLiquidGlassEnabled()).toBe(false);
            expect(mockSave).not.toHaveBeenCalled();
        });

        it('does not seed the server from this browser when nothing is saved', async () => {
            localStorage.setItem('dd-liquid-glass', 'on');
            await syncLiquidGlassFromServerOnce();
            expect(mockSave).not.toHaveBeenCalled();
        });
    });

    describe('server sync', () => {
        it('adopts a saved server value on a fresh session and broadcasts it', async () => {
            mockGet.mockResolvedValue('on');
            const {result} = renderHook(() => useLiquidGlassEnabled());
            await waitFor(() => expect(result.current).toBe(true));
            expect(mockGet).toHaveBeenCalledWith(StaffPreferenceKey.LiquidGlass);
            expect(localStorage.getItem('dd-liquid-glass')).toBe('on');
        });

        it('lets a server "off" override a local "on"', async () => {
            localStorage.setItem('dd-liquid-glass', 'on');
            mockGet.mockResolvedValue('off');
            await syncLiquidGlassFromServerOnce();
            expect(isLiquidGlassEnabled()).toBe(false);
        });

        it('seeds the server from the local value when nothing is saved', async () => {
            localStorage.setItem('dd-liquid-glass', 'on');
            await syncLiquidGlassFromServerOnce();
            expect(mockSave).toHaveBeenCalledWith(StaffPreferenceKey.LiquidGlass, 'on');
        });

        it('syncs once per page across hook instances', async () => {
            renderHook(() => useLiquidGlassEnabled());
            renderHook(() => useLiquidGlassEnabled());
            await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(1));
        });

        it('skips the server when no staff member is signed in', async () => {
            win.ContactID = 0;
            await syncLiquidGlassFromServerOnce();
            expect(mockGet).not.toHaveBeenCalled();
        });
    });
});
