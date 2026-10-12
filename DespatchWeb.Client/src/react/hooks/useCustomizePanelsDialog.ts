import {useCallback} from 'react';
import type {IBox} from '../../interfaces/layout.interfaces';
import isDefaultLayout from '../../functions/isDefaultLayout';
import {
    loadBoxVisibility,
    mergeBoxVisibility,
    saveBoxVisibility,
    type LayoutStorageKeys,
} from '../components/common/box-shell/layoutPersistence';
import {loadDialog, requireDialog, type DialogLoader} from '../dialogs/dialogRegistry';

export interface UseCustomizePanelsDialogOptions {
    storageKeys: LayoutStorageKeys;
    createBoxes: () => Record<string, IBox>;
    currentLayoutName: string | undefined;
    /** Called after visibility is persisted, e.g. the page bridge's reloadLayoutsFromStorage. */
    onVisibilityChanged: () => void;
    openDialog?: DialogLoader;
}

export function useCustomizePanelsDialog(
    {storageKeys, createBoxes, currentLayoutName, onVisibilityChanged, openDialog = loadDialog}: UseCustomizePanelsDialogOptions,
): {openCustomizePanels: () => Promise<void>} {
    const openCustomizePanels = useCallback(async () => {
        const dialog = await requireDialog('CustomizePanels', openDialog);
        if (!dialog) return;
        try {
            const layoutName = currentLayoutName ?? 'Default';
            const boxes = mergeBoxVisibility(createBoxes(), loadBoxVisibility(storageKeys, layoutName));
            const editable = !isDefaultLayout(layoutName);
            const result = await dialog.open(boxes, layoutName, editable);
            // Default is read-only: never write its visibility, even if a stale bundle returns a result.
            if (!result || !editable) return;

            saveBoxVisibility(storageKeys, layoutName, result);
            onVisibilityChanged();
        } catch (err) {
            console.error('[customize-panels] dialog error', err);
        }
    }, [storageKeys, createBoxes, currentLayoutName, onVisibilityChanged, openDialog]);

    return {openCustomizePanels};
}
