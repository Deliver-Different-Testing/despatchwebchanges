import {IBox, ILayout} from '../../../../interfaces/layout.interfaces';

export interface LayoutStorageKeys {
    layoutsKey: string;
    lastActiveLayoutKey: string;
    boxVisibilityKeyBase: string;
}

export interface BoxVisibilityRecord {
    visible: boolean;
    collapsed: boolean;
}

/**
 * Consolidated layout state for a single page. This is the shape persisted to
 * the database (one row per staff + page) and the unit of cross-device sync.
 * It mirrors the three localStorage keys: the layouts array, the last-active
 * layout name, and per-layout box visibility/collapse state.
 */
export interface LayoutSnapshot {
    layouts: ILayout[];
    lastActiveLayout: string | null;
    boxVisibility: Record<string, Record<string, BoxVisibilityRecord>>;
}

export function boxVisibilityKey(keys: LayoutStorageKeys, layoutName: string): string {
    return `${keys.boxVisibilityKeyBase}-${layoutName}`;
}

export function loadLayouts(keys: LayoutStorageKeys, defaultLayout: ILayout): ILayout[] {
    if (!isLocalStorageAvailable()) return [defaultLayout];
    try {
        const raw = localStorage.getItem(keys.layoutsKey);
        const stored = raw ? JSON.parse(raw) as ILayout[] : [];
        const layouts = stored.length > 0 ? stored : [defaultLayout];
        layouts[0] = defaultLayout;
        return layouts;
    } catch (error) {
        console.error('Error loading stored layouts:', error);
        return [defaultLayout];
    }
}

export function saveLayouts(keys: LayoutStorageKeys, layouts: ILayout[]): void {
    if (!isLocalStorageAvailable()) return;
    try {
        localStorage.setItem(keys.layoutsKey, JSON.stringify(layouts));
    } catch (error) {
        console.error('Error saving layouts:', error);
    }
}

export function loadLastActiveLayoutName(keys: LayoutStorageKeys): string | null {
    if (!isLocalStorageAvailable()) return null;
    return localStorage.getItem(keys.lastActiveLayoutKey);
}

export function saveLastActiveLayoutName(keys: LayoutStorageKeys, name: string): void {
    if (!isLocalStorageAvailable()) return;
    localStorage.setItem(keys.lastActiveLayoutKey, name);
}

export function loadBoxVisibility(
    keys: LayoutStorageKeys,
    layoutName: string,
): Record<string, BoxVisibilityRecord> | null {
    if (!isLocalStorageAvailable()) return null;
    try {
        const saved = localStorage.getItem(boxVisibilityKey(keys, layoutName));
        if (!saved) return null;
        const raw = JSON.parse(saved) as Record<string, BoxVisibilityRecord | boolean>;
        const result: Record<string, BoxVisibilityRecord> = {};
        for (const [boxName, value] of Object.entries(raw)) {
            if (typeof value === 'boolean') {
                result[boxName] = {visible: value, collapsed: false};
            } else {
                result[boxName] = {
                    visible: value?.visible ?? true,
                    collapsed: value?.collapsed ?? false,
                };
            }
        }
        return result;
    } catch (error) {
        console.error('Error loading box visibility from storage:', error);
        return null;
    }
}

export function saveBoxVisibility(
    keys: LayoutStorageKeys,
    layoutName: string,
    boxes: Record<string, IBox>,
): void {
    if (!isLocalStorageAvailable()) return;
    try {
        const boxState: Record<string, BoxVisibilityRecord> = {};
        for (const [boxName, box] of Object.entries(boxes)) {
            boxState[boxName] = {
                visible: box.visible ?? true,
                collapsed: box.collapsed ?? false,
            };
        }
        localStorage.setItem(boxVisibilityKey(keys, layoutName), JSON.stringify(boxState));
    } catch (error) {
        console.error('Error saving box visibility to storage:', error);
    }
}

/**
 * Merge persisted visibility/collapsed state onto a fresh set of box
 * definitions. Boxes with no saved entry keep their definition defaults.
 * Shared by the React layout hook and the AngularJS toolbar's settings dialog
 * so both render the same box list.
 */
export function mergeBoxVisibility(
    boxes: Record<string, IBox>,
    saved: Record<string, BoxVisibilityRecord> | null,
): Record<string, IBox> {
    if (!saved) return boxes;
    const next: Record<string, IBox> = {...boxes};
    for (const [name, state] of Object.entries(saved)) {
        if (next[name]) {
            next[name] = {...next[name], visible: state.visible, collapsed: state.collapsed};
        }
    }
    return next;
}

/**
 * Assemble the full layout snapshot from the three localStorage keys, ready to
 * send to the server. Box visibility is gathered per layout name.
 */
export function readLocalSnapshot(keys: LayoutStorageKeys, defaultLayout: ILayout): LayoutSnapshot {
    const layouts = loadLayouts(keys, defaultLayout);
    const boxVisibility: Record<string, Record<string, BoxVisibilityRecord>> = {};
    for (const {name} of layouts) {
        const saved = loadBoxVisibility(keys, name);
        if (saved) boxVisibility[name] = saved;
    }
    return {
        layouts,
        lastActiveLayout: loadLastActiveLayoutName(keys),
        boxVisibility,
    };
}

/**
 * Write a layout snapshot (typically fetched from the server) back into the
 * three localStorage keys so the existing synchronous load paths pick it up.
 */
export function writeLocalSnapshot(keys: LayoutStorageKeys, snapshot: LayoutSnapshot): void {
    if (!isLocalStorageAvailable()) return;
    try {
        localStorage.setItem(keys.layoutsKey, JSON.stringify(snapshot.layouts ?? []));
        if (snapshot.lastActiveLayout) {
            localStorage.setItem(keys.lastActiveLayoutKey, snapshot.lastActiveLayout);
        }
        for (const [name, record] of Object.entries(snapshot.boxVisibility ?? {})) {
            localStorage.setItem(boxVisibilityKey(keys, name), JSON.stringify(record));
        }
    } catch (error) {
        console.error('Error writing layout snapshot to storage:', error);
    }
}

export interface ImportLayoutsResult {
    imported: string[];
    skipped: string[];
}

/**
 * Copy custom layouts from one storage location (e.g. the V1 keys) into another
 * (the forked V2 keys). Additive and non-destructive: the Default layout is
 * never copied, and a source layout whose name already exists in the target is
 * left untouched (reported as `skipped`). Each imported layout's box-visibility
 * record is carried across as well.
 */
export function importLayoutsFrom(
    source: LayoutStorageKeys,
    target: LayoutStorageKeys,
    defaultLayout: ILayout,
): ImportLayoutsResult {
    const imported: string[] = [];
    const skipped: string[] = [];
    if (!isLocalStorageAvailable()) return {imported, skipped};

    const sourceLayouts = loadLayouts(source, defaultLayout);
    const targetLayouts = loadLayouts(target, defaultLayout);
    const seen = new Set(targetLayouts.map(l => l.name));

    const merged = [...targetLayouts];
    for (const layout of sourceLayouts) {
        if (layout.name === defaultLayout.name) continue;
        if (seen.has(layout.name)) {
            skipped.push(layout.name);
            continue;
        }
        merged.push(layout);
        seen.add(layout.name);
        imported.push(layout.name);

        const visibility = loadBoxVisibility(source, layout.name);
        if (visibility) {
            try {
                localStorage.setItem(boxVisibilityKey(target, layout.name), JSON.stringify(visibility));
            } catch (error) {
                console.error('Error copying box visibility during import:', error);
            }
        }
    }

    if (imported.length > 0) saveLayouts(target, merged);
    return {imported, skipped};
}

/**
 * Rename a custom layout in storage. Renames it in the layouts array, moves its
 * box-visibility record to the new key, and repoints the last-active pointer if
 * it referenced the old name. Returns false (no-op) when the rename is invalid:
 * the Default layout, an unknown name, an empty new name, or a name that
 * collides with another existing layout.
 */
export function renameLayoutInStorage(
    keys: LayoutStorageKeys,
    oldName: string,
    newName: string,
    defaultLayout: ILayout,
): boolean {
    const trimmed = newName.trim();
    if (!trimmed || oldName === defaultLayout.name || trimmed === defaultLayout.name) return false;
    if (!isLocalStorageAvailable()) return false;

    const layouts = loadLayouts(keys, defaultLayout);
    const index = layouts.findIndex(l => l.name === oldName);
    if (index <= 0) return false; // not found, or Default occupies slot 0
    if (layouts.some(l => l.name === trimmed)) return false; // name collision

    layouts[index] = {...layouts[index], name: trimmed};
    saveLayouts(keys, layouts);

    const visibility = loadBoxVisibility(keys, oldName);
    if (visibility) {
        try {
            localStorage.setItem(boxVisibilityKey(keys, trimmed), JSON.stringify(visibility));
            localStorage.removeItem(boxVisibilityKey(keys, oldName));
        } catch (error) {
            console.error('Error moving box visibility during rename:', error);
        }
    }

    if (loadLastActiveLayoutName(keys) === oldName) {
        saveLastActiveLayoutName(keys, trimmed);
    }
    return true;
}

function isLocalStorageAvailable(): boolean {
    if (typeof window === 'undefined') return false;
    const modernizr = (globalThis as {Modernizr?: {localstorage?: boolean}}).Modernizr;
    if (modernizr) return !!modernizr.localstorage;
    return typeof window.localStorage !== 'undefined';
}
