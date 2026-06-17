import {useCallback, useEffect, useMemo, useState} from 'react';
import {IBox, ILayout} from '../../../../interfaces/layout.interfaces';
import {
    LayoutStorageKeys,
    loadBoxVisibility,
    loadLastActiveLayoutName,
    loadLayouts,
    saveBoxVisibility,
    saveLastActiveLayoutName,
    saveLayouts,
} from '../lib/layoutPersistence';
import {createDefaultJobSearchLayout, createJobSearchBoxes} from '../lib/boxDefinitions';

const DEFAULT_LAYOUT_NAME = 'Default';

export interface UseBoxLayoutOptions {
    storageKeys: LayoutStorageKeys;
}

export interface UseBoxLayoutResult {
    layouts: ILayout[];
    currentLayoutName: string;
    layout: ILayout;
    /** Increments on any structural change (size/order/load); used as a remount key. */
    layoutVersion: number;
    boxes: Record<string, IBox>;
    isDefaultLayout: boolean;
    loadLayoutByIndex: (index: number) => void;
    setCurrentLayoutName: (name: string) => void;
    reloadFromStorage: () => void;
    addLayout: (name: string) => void;
    deleteLayoutByIndex: (index: number) => void;
    toggleBoxCollapse: (boxName: string) => void;
    setBoxVisibility: (boxName: string, visible: boolean) => void;
    replaceBoxes: (next: Record<string, IBox>) => void;
    /** Persist column widths from a horizontal PanelGroup onLayout callback. */
    setColumnSizes: (sizes: number[]) => void;
    /** Persist per-box heights from a vertical PanelGroup onLayout callback. */
    setBoxHeights: (columnId: string, heights: number[], visibleBoxNames: string[]) => void;
    /** Move a box within or between columns. Source/target are array indices into the layout's columns[].boxes. */
    moveBox: (sourceColumnId: string, sourceIndex: number, targetColumnId: string, targetIndex: number) => void;
}

export function useBoxLayout({storageKeys}: UseBoxLayoutOptions): UseBoxLayoutResult {
    const defaultLayout = useMemo(() => createDefaultJobSearchLayout(), []);

    const [layouts, setLayouts] = useState<ILayout[]>(() => loadLayouts(storageKeys, defaultLayout));
    const [currentLayoutName, setCurrentLayoutName] = useState<string>(() => {
        const stored = loadLastActiveLayoutName(storageKeys);
        return stored && layoutsContain(loadLayouts(storageKeys, defaultLayout), stored)
            ? stored
            : DEFAULT_LAYOUT_NAME;
    });
    const [boxes, setBoxes] = useState<Record<string, IBox>>(() => {
        const initial = createJobSearchBoxes();
        const saved = loadBoxVisibility(storageKeys, currentLayoutName);
        return applySavedVisibility(initial, saved);
    });
    const [layoutVersion, setLayoutVersion] = useState(0);

    const currentLayout = useMemo<ILayout>(
        () => layouts.find(l => l.name === currentLayoutName) ?? defaultLayout,
        [layouts, currentLayoutName, defaultLayout],
    );

    useEffect(() => {
        saveLastActiveLayoutName(storageKeys, currentLayoutName);
    }, [storageKeys, currentLayoutName]);

    const bumpVersion = useCallback(() => {
        setLayoutVersion(v => v + 1);
    }, []);

    const loadLayoutByIndex = useCallback((index: number) => {
        setLayouts(prev => {
            const layout = prev[index] ?? prev[0];
            if (!layout) return prev;
            setCurrentLayoutName(layout.name);
            setBoxes(applySavedVisibility(
                createJobSearchBoxes(),
                loadBoxVisibility(storageKeys, layout.name),
            ));
            return prev;
        });
        bumpVersion();
    }, [storageKeys, bumpVersion]);

    const setCurrentLayoutByName = useCallback((name: string) => {
        setLayouts(prev => {
            const exists = prev.some(l => l.name === name);
            const targetName = exists ? name : DEFAULT_LAYOUT_NAME;
            setCurrentLayoutName(targetName);
            setBoxes(applySavedVisibility(
                createJobSearchBoxes(),
                loadBoxVisibility(storageKeys, targetName),
            ));
            return prev;
        });
        bumpVersion();
    }, [storageKeys, bumpVersion]);

    const reloadFromStorage = useCallback(() => {
        const fresh = loadLayouts(storageKeys, defaultLayout);
        setLayouts(fresh);
        const storedName = loadLastActiveLayoutName(storageKeys);
        const targetName = storedName && fresh.some(l => l.name === storedName)
            ? storedName
            : DEFAULT_LAYOUT_NAME;
        setCurrentLayoutName(targetName);
        setBoxes(applySavedVisibility(
            createJobSearchBoxes(),
            loadBoxVisibility(storageKeys, targetName),
        ));
        bumpVersion();
    }, [storageKeys, defaultLayout, bumpVersion]);

    const addLayout = useCallback((name: string) => {
        if (!name) return;
        setLayouts(prev => {
            const source = prev.find(l => l.name === currentLayoutName)?.layout ?? defaultLayout.layout;
            const next: ILayout = {name, layout: cloneLayoutPayload(source)};
            const updated = [...prev, next];
            saveLayouts(storageKeys, updated);
            return updated;
        });
        setCurrentLayoutName(name);
        bumpVersion();
    }, [storageKeys, currentLayoutName, defaultLayout, bumpVersion]);

    const deleteLayoutByIndex = useCallback((index: number) => {
        if (index === 0) return; // Never delete default
        setLayouts(prev => {
            const updated = prev.filter((_, i) => i !== index);
            saveLayouts(storageKeys, updated);
            return updated;
        });
        setCurrentLayoutName(DEFAULT_LAYOUT_NAME);
        bumpVersion();
    }, [storageKeys, bumpVersion]);

    const toggleBoxCollapse = useCallback((boxName: string) => {
        if (currentLayoutName === DEFAULT_LAYOUT_NAME) return;
        setBoxes(prev => {
            const target = prev[boxName];
            if (!target) return prev;
            const next = {...prev, [boxName]: {...target, collapsed: !target.collapsed}};
            saveBoxVisibility(storageKeys, currentLayoutName, next);
            return next;
        });
    }, [storageKeys, currentLayoutName]);

    const setBoxVisibility = useCallback((boxName: string, visible: boolean) => {
        setBoxes(prev => {
            const target = prev[boxName];
            if (!target) return prev;
            const next = {...prev, [boxName]: {...target, visible}};
            saveBoxVisibility(storageKeys, currentLayoutName, next);
            return next;
        });
    }, [storageKeys, currentLayoutName]);

    const replaceBoxes = useCallback((next: Record<string, IBox>) => {
        setBoxes(next);
        saveBoxVisibility(storageKeys, currentLayoutName, next);
    }, [storageKeys, currentLayoutName]);

    // ── Resize + reorder (custom layouts only) ────────────────────────
    //
    // All three of these write into the current layout's payload and
    // re-persist via `saveLayouts`. They no-op on the Default layout
    // because `loadLayouts` always resets index 0 to a canonical default
    // on next read — see `lib/layoutPersistence.ts`.

    const writeCurrentLayout = useCallback((
        producer: (current: ILayout['layout']) => ILayout['layout'],
    ): void => {
        if (currentLayoutName === DEFAULT_LAYOUT_NAME) return;
        setLayouts(prev => {
            const index = prev.findIndex(l => l.name === currentLayoutName);
            if (index === -1) return prev;
            const nextLayout = producer(prev[index].layout);
            const updated = prev.map((l, i) => i === index ? {...l, layout: nextLayout} : l);
            saveLayouts(storageKeys, updated);
            return updated;
        });
    }, [currentLayoutName, storageKeys]);

    const setColumnSizes = useCallback((sizes: number[]) => {
        writeCurrentLayout(payload => ({
            ...payload,
            columns: payload.columns.map((col, i) => ({
                ...col,
                width: sizes[i] != null ? `${sizes[i].toFixed(2)}%` : col.width,
            })),
        }));
    }, [writeCurrentLayout]);

    const setBoxHeights = useCallback((columnId: string, heights: number[], visibleBoxNames: string[]) => {
        writeCurrentLayout(payload => ({
            ...payload,
            columns: payload.columns.map(col => {
                if (col.id !== columnId) return col;
                // Map by name — react-resizable-panels emits sizes in the
                // visible-box order, but we want to preserve hidden boxes
                // (and their stored heights) in column.boxes untouched.
                const heightByName = new Map<string, number>();
                visibleBoxNames.forEach((name, i) => {
                    if (heights[i] != null) heightByName.set(name, heights[i]);
                });
                return {
                    ...col,
                    boxes: col.boxes.map(b => {
                        const h = b.name ? heightByName.get(b.name) : undefined;
                        return h != null ? {...b, height: `${h.toFixed(2)}%`} : b;
                    }),
                };
            }),
        }));
    }, [writeCurrentLayout]);

    const moveBox = useCallback((
        sourceColumnId: string,
        sourceIndex: number,
        targetColumnId: string,
        targetIndex: number,
    ) => {
        writeCurrentLayout(payload => {
            const sourceCol = payload.columns.find(c => c.id === sourceColumnId);
            if (!sourceCol || sourceIndex < 0 || sourceIndex >= sourceCol.boxes.length) return payload;
            const moved = sourceCol.boxes[sourceIndex];

            return {
                ...payload,
                columns: payload.columns.map(col => {
                    // Removing source
                    if (col.id === sourceColumnId && col.id === targetColumnId) {
                        // Same-column move: remove, then insert at adjusted index
                        const without = col.boxes.filter((_, i) => i !== sourceIndex);
                        const adjusted = targetIndex > sourceIndex ? targetIndex - 1 : targetIndex;
                        const clamped = Math.max(0, Math.min(adjusted, without.length));
                        return {
                            ...col,
                            boxes: [...without.slice(0, clamped), moved, ...without.slice(clamped)],
                        };
                    }
                    if (col.id === sourceColumnId) {
                        return {...col, boxes: col.boxes.filter((_, i) => i !== sourceIndex)};
                    }
                    if (col.id === targetColumnId) {
                        const clamped = Math.max(0, Math.min(targetIndex, col.boxes.length));
                        return {
                            ...col,
                            boxes: [...col.boxes.slice(0, clamped), moved, ...col.boxes.slice(clamped)],
                        };
                    }
                    return col;
                }),
            };
        });
        bumpVersion();
    }, [writeCurrentLayout, bumpVersion]);

    return {
        layouts,
        currentLayoutName,
        layout: currentLayout,
        layoutVersion,
        boxes,
        isDefaultLayout: currentLayoutName === DEFAULT_LAYOUT_NAME,
        loadLayoutByIndex,
        setCurrentLayoutName: setCurrentLayoutByName,
        reloadFromStorage,
        addLayout,
        deleteLayoutByIndex,
        toggleBoxCollapse,
        setBoxVisibility,
        replaceBoxes,
        setColumnSizes,
        setBoxHeights,
        moveBox,
    };
}

function layoutsContain(layouts: ILayout[], name: string): boolean {
    return layouts.some(l => l.name === name);
}

function applySavedVisibility(
    boxes: Record<string, IBox>,
    saved: ReturnType<typeof loadBoxVisibility>,
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

function cloneLayoutPayload(layout: ILayout['layout']): ILayout['layout'] {
    return JSON.parse(JSON.stringify(layout));
}
