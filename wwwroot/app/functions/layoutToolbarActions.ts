import type {ILayout} from '../interfaces/layout.interfaces';
import {
    ImportLayoutsResult,
    LayoutStorageKeys,
    loadLastActiveLayoutName,
    loadLayouts,
    renameLayoutInStorage,
    saveLastActiveLayoutName,
    saveLayouts,
} from '../react/components/common/box-shell/layoutPersistence';

const DEFAULT_LAYOUT_NAME = 'Default';

/**
 * The slice of a React page's `window` bridge (`ReactDispatch`, `ReactJobSearch`, …)
 * that the AngularJS layout toolbar drives. Read lazily on every call — the page
 * bundle assigns the bridge after the controller is constructed.
 */
export interface LayoutToolbarBridge {
    setCurrentLayoutName: (name: string) => void;
    reloadLayoutsFromStorage: () => void;
    promptSaveLayout: () => Promise<string | null>;
    promptDeleteLayout: (layoutName: string) => Promise<boolean>;
    promptRenameLayout: (layoutName: string) => Promise<string | null>;
    importLegacyLayouts: () => ImportLayoutsResult;
}

/** The controller fields the toolbar template binds to. Mutated in place. */
export interface LayoutToolbarHost {
    layouts: ILayout[];
    currentLayoutName: string | undefined;
}

export interface LayoutToolbarToasts {
    showSuccessToast: (message: string) => void;
    showErrorToast: (message: string) => void;
    showInfoToast: (message: string) => void;
}

export interface LayoutToolbarActions {
    /** Seed the host from localStorage on mount. */
    initialize: () => void;
    saveLayout: () => Promise<void>;
    loadLayout: (index: number) => void;
    deleteLayout: (index: number) => Promise<void>;
    importLayouts: () => void;
    renameLayout: (index: number) => Promise<void>;
}

export interface LayoutToolbarDeps {
    getBridge: () => LayoutToolbarBridge | undefined;
    host: LayoutToolbarHost;
    storageKeys: LayoutStorageKeys;
    defaultLayout: ILayout;
    toastr: LayoutToolbarToasts;
}

/**
 * The layout dropdown's save / load / delete / rename / import behaviour, shared
 * by every AngularJS-hosted React page that owns a box layout. Storage is read
 * through the canonical `loadLayouts`, so the toolbar's list is identical to
 * what React renders — Default is always present at index 0, even when
 * localStorage is empty, and is never renamed or deleted.
 */
export function createLayoutToolbarActions({
    getBridge,
    host,
    storageKeys,
    defaultLayout,
    toastr,
}: LayoutToolbarDeps): LayoutToolbarActions {
    const readLayouts = (): ILayout[] => loadLayouts(storageKeys, defaultLayout);

    const selectLayout = (name: string): void => {
        saveLastActiveLayoutName(storageKeys, name);
        host.currentLayoutName = name;
        getBridge()?.setCurrentLayoutName(name);
    };

    return {
        initialize: () => {
            host.layouts = readLayouts();
            host.currentLayoutName = loadLastActiveLayoutName(storageKeys) ?? DEFAULT_LAYOUT_NAME;
        },

        saveLayout: async () => {
            const name = await getBridge()?.promptSaveLayout();
            if (!name) return;
            const layouts = readLayouts();
            const sourceLayout = layouts.find(l => l.name === host.currentLayoutName);
            const payload = sourceLayout?.layout ?? defaultLayout.layout;
            const next: ILayout = {name, layout: JSON.parse(JSON.stringify(payload))};
            // `layouts` already carries Default at index 0, so the persisted
            // array stays aligned with React's loadLayouts.
            saveLayouts(storageKeys, [...layouts, next]);
            host.layouts = readLayouts();
            selectLayout(name);
            getBridge()?.reloadLayoutsFromStorage();
            toastr.showSuccessToast('Layout saved successfully');
        },

        loadLayout: (index: number) => {
            const target = readLayouts()[index];
            if (!target) return;
            selectLayout(target.name);
        },

        deleteLayout: async (index: number) => {
            const layouts = readLayouts();
            const target = layouts[index];
            if (!target) return;
            if (target.name === DEFAULT_LAYOUT_NAME) return;
            const confirmed = await getBridge()?.promptDeleteLayout(target.name);
            if (!confirmed) return;
            saveLayouts(storageKeys, layouts.filter((_, i) => i !== index));
            host.layouts = readLayouts();
            selectLayout(DEFAULT_LAYOUT_NAME);
            getBridge()?.reloadLayoutsFromStorage();
            toastr.showSuccessToast('Layout deleted successfully');
        },

        importLayouts: () => {
            const result = getBridge()?.importLegacyLayouts();
            const imported = result?.imported.length ?? 0;
            host.layouts = readLayouts();
            if (imported > 0) {
                toastr.showSuccessToast(`Imported ${imported} V1 layout${imported === 1 ? '' : 's'}`);
            } else {
                toastr.showInfoToast('No V1 layouts to import');
            }
        },

        renameLayout: async (index: number) => {
            const target = readLayouts()[index];
            if (!target || target.name === DEFAULT_LAYOUT_NAME) return;
            const newName = await getBridge()?.promptRenameLayout(target.name);
            if (!newName || newName === target.name) return;
            if (!renameLayoutInStorage(storageKeys, target.name, newName, defaultLayout)) {
                toastr.showErrorToast('Could not rename layout');
                return;
            }
            host.layouts = readLayouts();
            host.currentLayoutName = loadLastActiveLayoutName(storageKeys) ?? DEFAULT_LAYOUT_NAME;
            getBridge()?.setCurrentLayoutName(host.currentLayoutName);
            getBridge()?.reloadLayoutsFromStorage();
            toastr.showSuccessToast('Layout renamed successfully');
        },
    };
}
