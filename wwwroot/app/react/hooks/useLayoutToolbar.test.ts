import {act, renderHook} from '@testing-library/react';
import type {ILayout} from '../../interfaces/layout.interfaces';
import {useLayoutToolbar} from './useLayoutToolbar';
import {toastService} from '../services/toastService';

jest.mock('../services/toastService', () => ({
    toastService: {showSuccessToast: jest.fn(), showErrorToast: jest.fn(), showInfoToast: jest.fn()},
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
        setCurrentLayoutName: jest.fn(),
        reloadLayoutsFromStorage: jest.fn(),
        promptSaveLayout: jest.fn().mockResolvedValue('Mine'),
        promptDeleteLayout: jest.fn().mockResolvedValue(true),
        promptRenameLayout: jest.fn().mockResolvedValue('Renamed'),
        importLegacyLayouts: jest.fn().mockReturnValue({imported: [], skipped: []}),
    };
}

describe('useLayoutToolbar', () => {
    beforeEach(() => {
        localStorage.clear();
        jest.clearAllMocks();
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

    it('toasts on import via the injected toast service', () => {
        const bridge = makeBridge();
        const {result} = renderHook(() => useLayoutToolbar({getBridge: () => bridge, storageKeys, defaultLayout}));

        act(() => result.current.importLayouts());
        expect(toastService.showInfoToast).toHaveBeenCalledWith('No V1 layouts to import');
    });
});
