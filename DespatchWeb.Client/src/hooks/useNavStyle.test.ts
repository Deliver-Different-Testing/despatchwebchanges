import type {Mock} from 'vitest';
import {act, renderHook, waitFor} from '@testing-library/react';
import {resetNavStyleStore, useNavStyle} from './useNavStyle';
import {loadNavStyleSettings, NAV_STYLE_STORAGE_KEY, saveNavStyleOverride} from '../services/navStylePreference';
import {toastService} from '../services/toastService';

vi.mock('../services/navStylePreference', async () => ({
    ...(await vi.importActual<typeof import('../services/navStylePreference')>('../services/navStylePreference')),
    loadNavStyleSettings: vi.fn(),
    saveNavStyleOverride: vi.fn(),
}));
vi.mock('../services/toastService', () => ({
    toastService: {showErrorToast: vi.fn(), showSuccessToast: vi.fn()},
}));

const mockLoad = loadNavStyleSettings as Mock;
const mockSave = saveNavStyleOverride as Mock;
const mockToast = toastService.showErrorToast as Mock;

const loaded = (over: object = {}) => ({
    userOverride: null, tenantDefault: null, userFailed: false, tenantFailed: false, ...over,
});

describe('useNavStyle', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
        resetNavStyleStore();
        mockSave.mockResolvedValue(undefined);
        vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => vi.restoreAllMocks());

    it('starts on the cached style, then applies the loaded one and refreshes the cache', async () => {
        localStorage.setItem(NAV_STYLE_STORAGE_KEY, 'dfrnt');
        resetNavStyleStore();
        mockLoad.mockResolvedValue(loaded({tenantDefault: 'dispatch'}));

        const {result} = renderHook(() => useNavStyle());
        expect(result.current.style).toBe('dfrnt');

        await waitFor(() => expect(result.current.style).toBe('dispatch'));
        expect(result.current.tenantDefault).toBe('dispatch');
        expect(localStorage.getItem(NAV_STYLE_STORAGE_KEY)).toBe('dispatch');
    });

    it('defaults to dispatch with no cache and nothing loadable', async () => {
        mockLoad.mockResolvedValue(loaded({userFailed: true, tenantFailed: true}));

        const {result} = renderHook(() => useNavStyle());
        expect(result.current.style).toBe('dispatch');
        await waitFor(() => expect(mockLoad).toHaveBeenCalled());
        expect(result.current.style).toBe('dispatch');
    });

    it('saves an override, switches every consumer, and clears it with null', async () => {
        mockLoad.mockResolvedValue(loaded({tenantDefault: 'dispatch'}));
        const first = renderHook(() => useNavStyle());
        const second = renderHook(() => useNavStyle());
        await waitFor(() => expect(first.result.current.tenantDefault).toBe('dispatch'));

        await act(() => first.result.current.saveOverride('dfrnt'));
        expect(mockSave).toHaveBeenCalledWith('dfrnt');
        expect(second.result.current.style).toBe('dfrnt');
        expect(second.result.current.userOverride).toBe('dfrnt');

        await act(() => first.result.current.saveOverride(null));
        expect(mockSave).toHaveBeenCalledWith(null);
        expect(second.result.current.style).toBe('dispatch');
        expect(mockLoad).toHaveBeenCalledTimes(1);
    });

    it('keeps the current style and shows an error toast when the save fails', async () => {
        mockLoad.mockResolvedValue(loaded({userOverride: 'dispatch'}));
        mockSave.mockRejectedValue(new Error('offline'));
        const {result} = renderHook(() => useNavStyle());
        await waitFor(() => expect(result.current.userOverride).toBe('dispatch'));

        await act(() => result.current.saveOverride('dfrnt'));

        expect(result.current.style).toBe('dispatch');
        expect(mockToast).toHaveBeenCalledTimes(1);
    });
});
