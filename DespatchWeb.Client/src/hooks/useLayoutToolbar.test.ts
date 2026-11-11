import {act, renderHook} from '@testing-library/react';
import type {ILayout} from '../types/interfaces/layout.interfaces';
import {useLayoutToolbar} from './useLayoutToolbar';
import {toastService} from '../services/toastService';

vi.mock('../services/toastService', () => ({
    toastService: {showSuccessToast: vi.fn(), showErrorToast: vi.fn(), showInfoToast: vi.fn()},
}));

const storageKeys = {
    layoutsKey: 'layoutsHook-1',
    lastActiveLayoutKey: 'lastActiveHook-1',
    boxVisibilityKeyBase: 'boxVisHook-1',
};
const defaultLayout: ILayout = {
    name: 'Default',
    layout: {columns: [{id: 'c1', width: '100', boxes: [{name: 'jobList', height: '100'}]}]},
};

function makeBridge() {
    return {
        setCurrentLayoutName: vi.fn(),
        reloadLayoutsFromStorage: vi.fn(),
        promptSaveLayout: vi.fn().mockResolvedValue('Mine'),
        promptDeleteLayout: vi.fn().mockResolvedValue(true),
        promptRenameLayout: vi.fn().mockResolvedValue('Renamed'),
    };
}

describe('useLayoutToolbar', () => {
    beforeEach(() => {
        localStorage.clear();
        vi.clearAllMocks();
    });

    it('seeds from storage then re-renders through save, load, rename and delete', async () => {
        const bridge = makeBridge();
        const {result} = renderHook(() => useLayoutToolbar({getBridge: () => bridge, storageKeys, defaultLayout}));

        expect(result.current.layouts.map(l => l.name)).toEqual(['Default']);
        expect(result.current.currentLayoutName).toBe('Default');

        await act(() => result.current.saveLayout());
        expect(result.current.layouts.map(l => l.name)).toEqual(['Default', 'Mine']);
        expect(result.current.currentLayoutName).toBe('Mine');
        expect(localStorage.getItem(storageKeys.lastActiveLayoutKey)).toBe('Mine');
        expect(bridge.setCurrentLayoutName).toHaveBeenLastCalledWith('Mine');
        expect(toastService.showSuccessToast).toHaveBeenCalledWith('Layout saved successfully');

        act(() => result.current.loadLayout(0));
        expect(result.current.currentLayoutName).toBe('Default');

        act(() => result.current.loadLayout(1));
        await act(() => result.current.renameLayout(1));
        expect(result.current.layouts.map(l => l.name)).toEqual(['Default', 'Renamed']);
        expect(result.current.currentLayoutName).toBe('Renamed');

        await act(() => result.current.deleteLayout(1));
        expect(result.current.layouts.map(l => l.name)).toEqual(['Default']);
        expect(result.current.currentLayoutName).toBe('Default');
    });

});
