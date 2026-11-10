import type {Mock} from 'vitest';
import {act, renderHook, waitFor} from '@testing-library/react';
import {
    getAppearanceState,
    saveUserAppearance,
    syncAppearanceFromServerOnce,
    useAppearance,
} from './useAppearance';
import {deletePreference, getPreference, savePreference} from '../api/preferencesApi';
import {getTenantAppearanceDefault} from '../api/tenantSettingsApi';
import {StaffPreferenceKey} from '../types/enums/staff-preference-key.enum';

vi.mock('../api/preferencesApi', () => ({
    getPreference: vi.fn(),
    savePreference: vi.fn(),
    deletePreference: vi.fn(),
}));
vi.mock('../api/tenantSettingsApi', () => ({getTenantAppearanceDefault: vi.fn()}));

const mockGet = getPreference as Mock;
const mockSave = savePreference as Mock;
const mockDelete = deletePreference as Mock;
const mockTenant = getTenantAppearanceDefault as Mock;
const win = window as unknown as {ContactID?: number; __ddAppearanceServerSynced?: boolean};

let prefersMoreContrast = false;
const contrastListeners = new Set<() => void>();

function setSystemContrast(more: boolean): void {
    prefersMoreContrast = more;
    contrastListeners.forEach(listener => listener());
}

describe('appearance preference', () => {
    beforeEach(() => {
        localStorage.clear();
        vi.clearAllMocks();
        mockGet.mockResolvedValue(null);
        mockTenant.mockResolvedValue(null);
        mockSave.mockResolvedValue(undefined);
        mockDelete.mockResolvedValue(undefined);
        win.ContactID = 7;
        delete win.__ddAppearanceServerSynced;
        prefersMoreContrast = false;
        contrastListeners.clear();
        window.matchMedia = vi.fn().mockImplementation((query: string) => ({
            get matches() {
                return query === '(prefers-contrast: more)' && prefersMoreContrast;
            },
            media: query,
            addEventListener: (_: string, listener: () => void) => contrastListeners.add(listener),
            removeEventListener: (_: string, listener: () => void) => contrastListeners.delete(listener),
        }));
    });

    it('defaults to no settings and follows the OS contrast preference', () => {
        win.__ddAppearanceServerSynced = true;
        const {result} = renderHook(() => useAppearance());
        expect(result.current.resolved).toEqual({});
        expect(result.current.highContrast).toBe(false);
        act(() => setSystemContrast(true));
        expect(result.current.highContrast).toBe(true);
    });

    it('does not let a slower page-load sync overwrite a choice saved meanwhile', async () => {
        let resolveGet: (value: string) => void = () => {};
        mockGet.mockReturnValue(new Promise(resolve => {
            resolveGet = resolve;
        }));
        const sync = syncAppearanceFromServerOnce();
        await saveUserAppearance({contrast: 'high'});
        resolveGet(JSON.stringify({contrast: 'standard'}));
        await sync;
        expect(getAppearanceState().user).toEqual({contrast: 'high'});
    });

    it('saves the user override, live-updates mounted hooks, and resetting deletes the preference', async () => {
        win.__ddAppearanceServerSynced = true;
        const {result} = renderHook(() => useAppearance());
        await act(() => saveUserAppearance({contrast: 'high', primary: '#2a4eff'}));
        expect(result.current.highContrast).toBe(true);
        expect(result.current.resolved.primary).toBe('#2a4eff');
        expect(mockSave).toHaveBeenCalledWith(
            StaffPreferenceKey.ThemeCustomisation,
            JSON.stringify({contrast: 'high', primary: '#2a4eff'}),
        );

        await act(() => saveUserAppearance(null));
        expect(result.current.user).toBeNull();
        expect(mockDelete).toHaveBeenCalledWith(StaffPreferenceKey.ThemeCustomisation);
    });

    it('layers the user override over the tenant default from the server, field by field', async () => {
        mockGet.mockResolvedValue(JSON.stringify({primary: '#333333'}));
        mockTenant.mockResolvedValue(JSON.stringify({contrast: 'high', primary: '#111111'}));
        const {result} = renderHook(() => useAppearance());
        await waitFor(() => expect(result.current.tenant).not.toBeNull());
        expect(result.current.resolved).toEqual({contrast: 'high', primary: '#333333'});
        expect(result.current.highContrast).toBe(true);
    });

    it('keeps the cached tenant default and the user override when either fetch fails', async () => {
        localStorage.setItem('dd-appearance', JSON.stringify({user: {primary: '#333333'}, tenant: {contrast: 'high'}}));
        mockGet.mockResolvedValue(JSON.stringify({primary: '#444444'}));
        mockTenant.mockRejectedValue(new Error('column missing'));
        vi.spyOn(console, 'error').mockImplementation(() => {});
        await syncAppearanceFromServerOnce();
        expect(getAppearanceState()).toEqual({user: {primary: '#444444'}, tenant: {contrast: 'high'}});
    });

    it('syncs once per page and skips the server when no staff member is signed in', async () => {
        renderHook(() => useAppearance());
        renderHook(() => useAppearance());
        await waitFor(() => expect(localStorage.getItem('dd-appearance')).not.toBeNull());
        expect(mockGet).toHaveBeenCalledTimes(1);

        delete win.__ddAppearanceServerSynced;
        mockGet.mockClear();
        win.ContactID = 0;
        await syncAppearanceFromServerOnce();
        expect(mockGet).not.toHaveBeenCalled();
    });
});
