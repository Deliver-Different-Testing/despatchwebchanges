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

function isLocalStorageAvailable(): boolean {
    if (typeof window === 'undefined') return false;
    const modernizr = (globalThis as {Modernizr?: {localstorage?: boolean}}).Modernizr;
    if (modernizr) return !!modernizr.localstorage;
    return typeof window.localStorage !== 'undefined';
}
