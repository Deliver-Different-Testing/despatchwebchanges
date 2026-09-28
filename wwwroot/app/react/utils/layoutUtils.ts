/**
 * Shared layout-menu actions (switch layout, reload from storage, and the
 * Save/Delete/Rename prompts) for the three page-level layout bridges —
 * Dispatch, Job Search and Nationwide each used to define identical wrappers
 * around their own bridge. The bridge is passed in explicitly rather than
 * read from a module-level variable, since each page owns its own bridge
 * instance and type; `LayoutNameBridge` is the slice of each page's own
 * bridge interface these actions actually need.
 */

export interface LayoutNameBridge {
    setCurrentLayoutName: (name: string) => void;
    reloadFromStorage: () => void;
    /** Resolves with the entered name, or null if cancelled. */
    promptSaveLayout: () => Promise<string | null>;
    /** Resolves true if the user confirmed the delete. */
    promptDeleteLayout: (layoutName: string) => Promise<boolean>;
    /** Resolves with the new name, or null if cancelled. */
    promptRenameLayout: (layoutName: string) => Promise<string | null>;
}

export function setCurrentLayoutName(layoutBridge: LayoutNameBridge | null, name: string): void {
    layoutBridge?.setCurrentLayoutName(name);
}

export function reloadLayoutsFromStorage(layoutBridge: LayoutNameBridge | null): void {
    layoutBridge?.reloadFromStorage();
}

export function promptSaveLayout(layoutBridge: LayoutNameBridge | null): Promise<string | null> {
    return layoutBridge?.promptSaveLayout() ?? Promise.resolve(null);
}

export function promptDeleteLayout(layoutBridge: LayoutNameBridge | null, layoutName: string): Promise<boolean> {
    return layoutBridge?.promptDeleteLayout(layoutName) ?? Promise.resolve(false);
}

export function promptRenameLayout(layoutBridge: LayoutNameBridge | null, layoutName: string): Promise<string | null> {
    return layoutBridge?.promptRenameLayout(layoutName) ?? Promise.resolve(null);
}
