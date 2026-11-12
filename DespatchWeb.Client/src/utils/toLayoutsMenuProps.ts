import type {ToolbarActionsConfig} from '../components/common/app-shell/ToolbarActionsView';
import type {UseLayoutToolbarResult} from '../hooks/useLayoutToolbar';

type LayoutsMenuProps = NonNullable<ToolbarActionsConfig['layouts']>;

export interface LayoutsMenuExtras {
    openCustomizePanels: () => unknown;
    resetLayout: LayoutsMenuProps['onResetLayout'];
    columnEditMode?: LayoutsMenuProps['columnEditMode'];
    onToggleColumnEditMode?: LayoutsMenuProps['onToggleColumnEditMode'];
}

export function toLayoutsMenuProps(
    layoutToolbar: UseLayoutToolbarResult,
    {openCustomizePanels, resetLayout, columnEditMode, onToggleColumnEditMode}: LayoutsMenuExtras,
): LayoutsMenuProps {
    return {
        items: layoutToolbar.layouts,
        currentLayoutName: layoutToolbar.currentLayoutName,
        onSaveLayout: () => void layoutToolbar.saveLayout(),
        onLoadLayout: layoutToolbar.loadLayout,
        onDeleteLayout: (index) => void layoutToolbar.deleteLayout(index),
        onRenameLayout: (index) => void layoutToolbar.renameLayout(index),
        onCustomizePanels: () => void openCustomizePanels(),
        onResetLayout: resetLayout,
        columnEditMode,
        onToggleColumnEditMode,
    };
}
