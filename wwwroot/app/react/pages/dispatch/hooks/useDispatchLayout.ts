/**
 * useDispatchLayout Hook
 *
 * Manages dashboard layout state: grid positions, box visibility/collapse,
 * layout CRUD, and localStorage persistence.
 * Reads the same localStorage keys as the AngularJS HomeController for compatibility.
 */

import {useCallback, useMemo, useState} from 'react';
import type {Layout, LayoutItem} from 'react-grid-layout';
import {
    BOX_CONFIGS,
    DispatchBox,
    type BoxState,
    type IBox,
    type IColumn,
    type ILayout,
} from '../DispatchPage.interfaces';

const contactId = () => window.ContactID || 0;

// localStorage keys — must match HomeController keys exactly
const getLayoutKey = () => `layout-${contactId()}`;
const getLastActiveLayoutKey = () => `lastActiveLayout-${contactId()}`;
const getBoxVisibilityKey = (layoutName: string) =>
    `boxVisibility-Dispatch-${contactId()}-${layoutName}`;
const getRglLayoutKey = (layoutName: string) =>
    `rglLayout-Dispatch-${contactId()}-${layoutName}`;

/** Default 3-column layout matching HomeController.initializeLayout */
const DEFAULT_LAYOUT: ILayout = {
    name: 'Default',
    layout: {
        columns: [
            {
                id: 'col1',
                width: '50%',
                boxes: [
                    {name: DispatchBox.JobsList, height: '50%'},
                    {name: DispatchBox.JobDetail, height: '50%'},
                ],
            },
            {
                id: 'col2',
                width: '25%',
                boxes: [
                    {name: DispatchBox.CurrentWork, height: '50%'},
                    {name: DispatchBox.Supports, height: '50%'},
                ],
            },
            {
                id: 'col3',
                width: '25%',
                boxes: [
                    {name: DispatchBox.DriverLocations, height: '50%'},
                    {name: DispatchBox.Map, height: '50%'},
                ],
            },
        ],
    },
};

/** Convert the column-based ILayout format to RGL Layout (readonly LayoutItem[]) */
function columnsToRglLayout(columns: IColumn[]): Layout {
    const items: LayoutItem[] = [];
    const totalWidthParts = 12; // RGL uses 12-column grid

    columns.forEach((col, colIdx) => {
        // Parse column width percentage to grid units
        const widthPercent = parseFloat(col.width) || (100 / columns.length);
        const w = Math.round((widthPercent / 100) * totalWidthParts);
        const x = columns.slice(0, colIdx).reduce((sum, c) => {
            const wp = parseFloat(c.width) || (100 / columns.length);
            return sum + Math.round((wp / 100) * totalWidthParts);
        }, 0);

        col.boxes.forEach((box: IBox, boxIdx: number) => {
            items.push({
                i: box.name,
                x,
                y: boxIdx * 6, // Stack vertically within column
                w,
                h: 6, // Each box gets 6 height units
                minW: 2,
                minH: 3,
            });
        });
    });

    return items;
}

/** Load saved RGL layout from localStorage, or null if not found */
function loadRglLayout(layoutName: string): Layout | null {
    try {
        const stored = localStorage.getItem(getRglLayoutKey(layoutName));
        if (stored) return JSON.parse(stored) as Layout;
    } catch {
        // Fall through
    }
    return null;
}

/** Save RGL layout to localStorage */
function saveRglLayout(layoutName: string, layout: Layout): void {
    try {
        localStorage.setItem(getRglLayoutKey(layoutName), JSON.stringify(layout));
    } catch {
        // Ignore storage errors
    }
}

/** Load box visibility state from localStorage */
function loadBoxStates(layoutName: string): Record<string, BoxState> {
    const defaults: Record<string, BoxState> = {};
    for (const key of Object.values(DispatchBox)) {
        defaults[key] = {visible: true};
    }

    try {
        const key = getBoxVisibilityKey(layoutName);
        const stored = localStorage.getItem(key);
        if (stored) {
            const parsed = JSON.parse(stored) as Record<string, {visible: boolean}>;
            for (const boxName of Object.keys(parsed)) {
                if (defaults[boxName]) {
                    defaults[boxName] = {
                        visible: parsed[boxName].visible ?? true,
                    };
                }
            }
        }
    } catch {
        // Use defaults
    }

    return defaults;
}

/** Save box visibility/collapsed state to localStorage */
function saveBoxStates(layoutName: string, states: Record<string, BoxState>): void {
    try {
        const key = getBoxVisibilityKey(layoutName);
        localStorage.setItem(key, JSON.stringify(states));
    } catch {
        // Ignore storage errors
    }
}

export interface UseDispatchLayoutReturn {
    /** RGL layout items */
    rglLayout: Layout;
    /** Update RGL layout (called on drag/resize end) */
    onLayoutChange: (layout: Layout) => void;
    /** Box visibility states */
    boxStates: Record<string, BoxState>;
    /** All saved layouts */
    layouts: ILayout[];
    /** Current layout name */
    currentLayoutName: string;
    /** Whether current layout is the default (non-editable) */
    isDefaultLayout: boolean;
    /** Load a layout by index */
    loadLayout: (index: number) => void;
    /** Save current layout with a new name */
    saveLayoutAs: (name: string) => void;
    /** Delete a layout by index */
    deleteLayout: (index: number) => void;
    /** Update box visibility from settings dialog result */
    updateBoxStates: (boxes: Record<string, { visible?: boolean }>) => void;
    /** Number of grid columns */
    cols: number;
    /** Row height in pixels */
    rowHeight: number;
    /** Visible box IDs in layout order */
    visibleBoxIds: DispatchBox[];
}

export function useDispatchLayout(): UseDispatchLayoutReturn {
    const cols = 12;
    const rowHeight = 80;

    // Load layouts from localStorage
    const [layouts, setLayouts] = useState<ILayout[]>(() => {
        try {
            const stored = JSON.parse(localStorage.getItem(getLayoutKey()) ?? '[]') as ILayout[];
            if (stored.length > 0) {
                stored[0] = DEFAULT_LAYOUT; // Always keep default up to date
                return stored;
            }
        } catch {
            // Fall through
        }
        return [DEFAULT_LAYOUT];
    });

    // Determine initial active layout
    const [currentLayoutName, setCurrentLayoutName] = useState<string>(() => {
        try {
            const last = localStorage.getItem(getLastActiveLayoutKey());
            if (last && layouts.some(l => l.name === last)) return last;
        } catch {
            // Fall through
        }
        return 'Default';
    });

    const currentLayout = useMemo(
        () => layouts.find(l => l.name === currentLayoutName) ?? layouts[0],
        [layouts, currentLayoutName]
    );

    const isDefaultLayout = currentLayoutName === 'Default';

    // RGL layout: load saved positions for custom layouts, otherwise derive from columns
    const [rglLayout, setRglLayout] = useState<Layout>(() => {
        if (currentLayoutName !== 'Default') {
            const saved = loadRglLayout(currentLayoutName);
            if (saved) return saved;
        }
        return columnsToRglLayout(currentLayout.layout.columns);
    });

    // Box states
    const [boxStates, setBoxStates] = useState<Record<string, BoxState>>(() =>
        loadBoxStates(currentLayoutName)
    );

    // Visible box IDs
    const visibleBoxIds = useMemo(() => {
        const ordered: DispatchBox[] = [];
        for (const item of rglLayout) {
            const boxId = item.i as DispatchBox;
            if (boxStates[boxId]?.visible !== false && BOX_CONFIGS[boxId]) {
                ordered.push(boxId);
            }
        }
        return ordered;
    }, [rglLayout, boxStates]);

    const onLayoutChange = useCallback((layout: Layout) => {
        setRglLayout(layout);
        // Auto-save RGL positions for custom layouts
        if (currentLayoutName !== 'Default') {
            saveRglLayout(currentLayoutName, layout);
        }
    }, [currentLayoutName]);

    const loadLayout = useCallback((index: number) => {
        const layout = layouts[index] ?? layouts[0];
        setCurrentLayoutName(layout.name);

        // Load saved RGL positions for custom layouts, otherwise derive from columns
        if (layout.name !== 'Default') {
            const saved = loadRglLayout(layout.name);
            if (saved) {
                setRglLayout(saved);
            } else {
                setRglLayout(columnsToRglLayout(layout.layout.columns));
            }
        } else {
            setRglLayout(columnsToRglLayout(layout.layout.columns));
        }

        setBoxStates(loadBoxStates(layout.name));
        try {
            localStorage.setItem(getLastActiveLayoutKey(), layout.name);
        } catch {
            // Ignore
        }
    }, [layouts]);

    const saveLayoutAs = useCallback((name: string) => {
        if (!name) return;

        // New layouts start with the default layout structure
        const newLayout: ILayout = {
            name,
            layout: {
                columns: DEFAULT_LAYOUT.layout.columns.map(col => ({
                    ...col,
                    boxes: col.boxes.map(box => ({...box})),
                })),
            },
        };

        // Seed the RGL positions from the default layout
        const defaultRgl = columnsToRglLayout(DEFAULT_LAYOUT.layout.columns);
        saveRglLayout(name, defaultRgl);

        const updated = [...layouts, newLayout];
        setLayouts(updated);
        setCurrentLayoutName(name);
        setRglLayout(defaultRgl);
        setBoxStates(loadBoxStates(name));

        try {
            localStorage.setItem(getLayoutKey(), JSON.stringify(updated));
            localStorage.setItem(getLastActiveLayoutKey(), name);
        } catch {
            // Ignore
        }
    }, [layouts]);

    const deleteLayout = useCallback((index: number) => {
        if (index === 0) return; // Can't delete default

        const updated = layouts.filter((_, i) => i !== index);
        setLayouts(updated);

        try {
            localStorage.setItem(getLayoutKey(), JSON.stringify(updated));
        } catch {
            // Ignore
        }

        // Switch back to default
        loadLayout(0);
    }, [layouts, loadLayout]);

    const updateBoxStates = useCallback((boxes: Record<string, { visible?: boolean }>) => {
        const updated = {...boxStates};
        for (const [key, box] of Object.entries(boxes)) {
            if (updated[key]) {
                updated[key] = {visible: box.visible ?? true};
            }
        }
        setBoxStates(updated);
        saveBoxStates(currentLayoutName, updated);
    }, [boxStates, currentLayoutName]);

    return {
        rglLayout,
        onLayoutChange,
        boxStates,
        layouts,
        currentLayoutName,
        isDefaultLayout,
        loadLayout,
        saveLayoutAs,
        deleteLayout,
        updateBoxStates,
        cols,
        rowHeight,
        visibleBoxIds,
    };
}
