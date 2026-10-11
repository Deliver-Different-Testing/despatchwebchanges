import {act, renderHook} from '@testing-library/react';
import type {IBox} from '../../interfaces/layout.interfaces';
import {useCustomizePanelsDialog} from './useCustomizePanelsDialog';
import {boxVisibilityKey, loadBoxVisibility} from '../components/common/box-shell/layoutPersistence';

jest.mock('../services/toastService', () => ({
    toastService: {showSuccessToast: jest.fn(), showErrorToast: jest.fn(), showInfoToast: jest.fn()},
}));

const storageKeys = {layoutsKey: 'l', lastActiveLayoutKey: 'a', boxVisibilityKeyBase: 'boxVisCustomize-1'};
const createBoxes = (): Record<string, IBox> => ({jobList: {name: 'jobList', title: 'Jobs', visible: true} as unknown as IBox});

function setup(layoutName: string | undefined, result: Record<string, IBox> | null) {
    const open = jest.fn().mockResolvedValue(result);
    const onVisibilityChanged = jest.fn();
    const hook = renderHook(() => useCustomizePanelsDialog({
        storageKeys, createBoxes, currentLayoutName: layoutName, onVisibilityChanged,
        openDialog: () => ({open}) as never,
    }));
    return {open, onVisibilityChanged, hook};
}

describe('useCustomizePanelsDialog', () => {
    beforeEach(() => localStorage.clear());

    it('persists visibility for an editable layout and notifies the page', async () => {
        const edited = {jobList: {...createBoxes().jobList, visible: false}};
        const {open, onVisibilityChanged, hook} = setup('Mine', edited);

        await act(() => hook.result.current.openCustomizePanels());

        expect(open).toHaveBeenCalledWith(expect.any(Object), 'Mine', true);
        expect(localStorage.getItem(boxVisibilityKey(storageKeys, 'Mine'))).not.toBeNull();
        expect(loadBoxVisibility(storageKeys, 'Mine')).toBeTruthy();
        expect(onVisibilityChanged).toHaveBeenCalledTimes(1);
    });

    it('treats Default (or no name) as read-only and never writes', async () => {
        const {open, onVisibilityChanged, hook} = setup(undefined, createBoxes());

        await act(() => hook.result.current.openCustomizePanels());

        expect(open).toHaveBeenCalledWith(expect.any(Object), 'Default', false);
        expect(localStorage.getItem(boxVisibilityKey(storageKeys, 'Default'))).toBeNull();
        expect(onVisibilityChanged).not.toHaveBeenCalled();
    });

    it('does nothing when the dialog is cancelled', async () => {
        const {onVisibilityChanged, hook} = setup('Mine', null);
        await act(() => hook.result.current.openCustomizePanels());
        expect(onVisibilityChanged).not.toHaveBeenCalled();
    });
});
