/**
 * One-time migration for old AngularJS dispatch layouts.
 *
 * Old layouts stored via HomeController may have:
 * - Pixel-based widths/heights (e.g. "640px") instead of percentages
 * - Box visibility under old key format: boxVisibility-1-{ContactID}-{name}
 * - No RGL position data
 *
 * This migration normalizes dimensions to percentages, generates RGL layout
 * data, and copies visibility settings to the new key format.
 */

import type {IColumn, ILayout} from '../DispatchPage.interfaces';
import {columnsToRglLayout} from './useDispatchLayout';

const contactId = () => window.ContactID || 0;
const getMigrationFlag = () => `dispatchLayoutMigrated-${contactId()}`;
const getLayoutKey = () => `layout-${contactId()}`;
const getRglLayoutKey = (layoutName: string) =>
    `rglLayout-Dispatch-${contactId()}-${layoutName}`;
const getOldBoxVisibilityKey = (layoutName: string) =>
    `boxVisibility-1-${contactId()}-${layoutName}`;
const getNewBoxVisibilityKey = (layoutName: string) =>
    `boxVisibility-Dispatch-${contactId()}-${layoutName}`;

/** Convert pixel values to proportional percentages among siblings. */
function normalizeToPercent(values: string[]): string[] {
    const hasPx = values.some(v => v.includes('px'));
    if (!hasPx) return values;

    const nums = values.map(v => {
        const n = parseFloat(v);
        return isNaN(n) || n <= 0 ? 1 : n;
    });
    const total = nums.reduce((sum, n) => sum + n, 0);
    return nums.map(n => `${Math.round((n / total) * 100)}%`);
}

/** Normalize pixel-based dimensions in columns to percentages. */
function normalizeColumns(columns: IColumn[]): IColumn[] {
    const widths = normalizeToPercent(columns.map(c => c.width));

    return columns.map((col, i) => {
        const heights = normalizeToPercent(col.boxes.map(b => b.height ?? '50%'));
        return {
            ...col,
            width: widths[i],
            boxes: col.boxes.map((box, j) => ({
                ...box,
                height: heights[j],
            })),
        };
    });
}

/** Migrate box visibility from old key format to new. */
function migrateBoxVisibility(layoutName: string): void {
    const oldKey = getOldBoxVisibilityKey(layoutName);
    const newKey = getNewBoxVisibilityKey(layoutName);

    // Don't overwrite if new key already exists
    if (localStorage.getItem(newKey)) return;

    const stored = localStorage.getItem(oldKey);
    if (!stored) return;

    try {
        const parsed = JSON.parse(stored) as Record<string, unknown>;
        const migrated: Record<string, { visible: boolean }> = {};

        for (const [boxName, value] of Object.entries(parsed)) {
            if (typeof value === 'boolean') {
                // Old format: direct boolean
                migrated[boxName] = {visible: value};
            } else if (value && typeof value === 'object' && 'visible' in value) {
                // Object format with visible field
                migrated[boxName] = {visible: (value as { visible: boolean }).visible ?? true};
            }
        }

        localStorage.setItem(newKey, JSON.stringify(migrated));
    } catch {
        // Skip this layout's visibility migration
    }
}

export function migrateDispatchLayoutsIfNeeded(): void {
    try {
        const flagKey = getMigrationFlag();
        if (localStorage.getItem(flagKey)) return;

        const layoutKey = getLayoutKey();
        const raw = localStorage.getItem(layoutKey);
        if (!raw) {
            localStorage.setItem(flagKey, '1');
            return;
        }

        const layouts = JSON.parse(raw) as ILayout[];
        if (!Array.isArray(layouts) || layouts.length <= 1) {
            localStorage.setItem(flagKey, '1');
            return;
        }

        // Process custom layouts (index 1+), skip Default at index 0
        for (let i = 1; i < layouts.length; i++) {
            const layout = layouts[i];
            if (!layout.layout?.columns) continue;

            // Normalize pixel-based dimensions
            layout.layout.columns = normalizeColumns(layout.layout.columns);

            // Generate RGL layout if not already present
            const rglKey = getRglLayoutKey(layout.name);
            if (!localStorage.getItem(rglKey)) {
                const rgl = columnsToRglLayout(layout.layout.columns);
                localStorage.setItem(rglKey, JSON.stringify(rgl));
            }

            // Migrate box visibility
            migrateBoxVisibility(layout.name);
        }

        // Write back normalized layouts
        localStorage.setItem(layoutKey, JSON.stringify(layouts));
        localStorage.setItem(flagKey, '1');
    } catch {
        // Set flag even on error to prevent retry loops
        try {
            localStorage.setItem(getMigrationFlag(), '1');
        } catch {
            // Nothing we can do
        }
    }
}
