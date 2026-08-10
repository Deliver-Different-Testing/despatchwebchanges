import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {IBox, ILayout} from '../../../../interfaces/layout.interfaces';
import {
    clearBoxVisibility,
    ImportLayoutsResult,
    importLayoutsFrom,
    LayoutStorageKeys,
    loadBoxVisibility,
    loadLastActiveLayoutName,
    loadLayouts,
    mergeBoxVisibility,
    saveBoxVisibility,
    saveLastActiveLayoutName,
    saveLayouts,
    setDefaultCustomised,
} from '../lib/layoutPersistence';
import {loadRemoteIntoLocal, queueRemotePush, readLocalRows} from '../lib/layoutSync';
import {createDefaultJobSearchLayout, createJobSearchBoxes} from '../lib/boxDefinitions';
import {
    addColumnToPayload,
    layoutPayloadEquals,
    MAX_COLUMNS,
    removeLastColumnFromPayload,
} from '../lib/columnLayout';

const DEFAULT_LAYOUT_NAME = 'Default';

export {MAX_COLUMNS};

export interface UseBoxLayoutOptions {
    storageKeys: LayoutStorageKeys;
    /**
     * Factory for the box metadata map. Defaults to the Job Search boxes so
     * existing callers are unaffected; the Dispatch page passes its own.
     */
    createBoxes?: () => Record<string, IBox>;
    /**
     * Factory for the read-only Default layout. Defaults to the Job Search
     * Default layout; the Dispatch page passes its own.
     */
    createDefaultLayout?: () => ILayout;
    /**
     * Page identifier used to sync layouts to the database (e.g. 'JobSearch',
     * 'Dispatch'). When provided, the layout is pulled from the server on mount
     * and local changes are pushed back (debounced). Omit to stay localStorage-only.
     */
    page?: string;
    /**
     * Storage keys for the legacy (V1) layouts, used as the source for
     * `importLegacyLayouts`. Omit when there is no V1 layout store to import from.
     */
    legacyStorageKeys?: LayoutStorageKeys;
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
    setBoxVisibility: (boxName: string, visible: boolean) => void;
    replaceBoxes: (next: Record<string, IBox>) => void;
    /** Persist column widths from a horizontal PanelGroup onLayout callback. */
    setColumnSizes: (sizes: number[]) => void;
    /** Persist per-box heights from a vertical PanelGroup onLayout callback. */
    setBoxHeights: (columnId: string, heights: number[], visibleBoxNames: string[]) => void;
    /** Move a box within or between columns. Source/target are array indices into the layout's columns[].boxes. */
    moveBox: (sourceColumnId: string, sourceIndex: number, targetColumnId: string, targetIndex: number) => void;
    /** Append an empty column to the current layout (no-op at MAX_COLUMNS). */
    addColumn: () => void;
    /** Remove the rightmost column, moving its boxes into the neighbour (no-op at 1 column). */
    removeColumn: () => void;
    /** Restore the current layout to the shipped arrangement and clear its panel visibility. */
    resetCurrentLayout: () => void;
    /** Copy custom layouts from the legacy (V1) store into this page's store. */
    importLegacyLayouts: () => ImportLayoutsResult;
}

export function useBoxLayout({
    storageKeys,
    createBoxes = createJobSearchBoxes,
    createDefaultLayout = createDefaultJobSearchLayout,
    page,
    legacyStorageKeys,
}: UseBoxLayoutOptions): UseBoxLayoutResult {
    const defaultLayout = useMemo(() => createDefaultLayout(), [createDefaultLayout]);

    const [layouts, setLayouts] = useState<ILayout[]>(() => loadLayouts(storageKeys, defaultLayout));
    const [currentLayoutName, setCurrentLayoutName] = useState<string>(() => {
        const stored = loadLastActiveLayoutName(storageKeys);
        return stored && layoutsContain(loadLayouts(storageKeys, defaultLayout), stored)
            ? stored
            : DEFAULT_LAYOUT_NAME;
    });
    const [boxes, setBoxes] = useState<Record<string, IBox>>(() => {
        const initial = createBoxes();
        const saved = loadBoxVisibility(storageKeys, currentLayoutName);
        return mergeBoxVisibility(initial, saved);
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

    // ── Cross-device sync (DB-authoritative, localStorage as offline cache) ──
    //
    // On mount, pull the layout from the server into localStorage and rehydrate
    // from it. After that initial pull, mirror any local change back to the
    // server (debounced). The server holds the source of truth; localStorage
    // remains the synchronous working cache so the load paths above are unchanged.
    const remoteReadyRef = useRef(false);
    const lastSyncedRef = useRef<string | null>(null);

    useEffect(() => {
        if (!page) return undefined;
        let cancelled = false;
        // Snapshot what we already render from localStorage so we only force a
        // remount (reloadFromStorage bumps layoutVersion, which re-keys the
        // PanelGroup and re-initialises the HERE map) when the server actually
        // brought down different layouts. An identical remote sync is a no-op.
        const before = JSON.stringify(readLocalRows(storageKeys, defaultLayout));
        loadRemoteIntoLocal(storageKeys, page, defaultLayout)
            .then(() => {
                if (cancelled) return;
                const after = JSON.stringify(readLocalRows(storageKeys, defaultLayout));
                if (after !== before) reloadFromStorage();
            })
            .catch(error => {
                if (!cancelled) console.error('Failed to load dispatch layouts from server:', error);
            })
            .finally(() => {
                if (cancelled) return;
                lastSyncedRef.current = JSON.stringify(readLocalRows(storageKeys, defaultLayout));
                remoteReadyRef.current = true;
            });
        return () => {
            cancelled = true;
        };
        // reloadFromStorage is declared below; it is stable (useCallback) so the
        // ref is captured correctly without re-running this mount-only effect.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [page, storageKeys, defaultLayout]);

    useEffect(() => {
        if (!page || !remoteReadyRef.current) return;
        const rows = readLocalRows(storageKeys, defaultLayout);
        const rowsJson = JSON.stringify(rows);
        if (rowsJson === lastSyncedRef.current) return;
        lastSyncedRef.current = rowsJson;
        queueRemotePush(page, rows);
    }, [page, storageKeys, defaultLayout, layouts, boxes, currentLayoutName, layoutVersion]);

    const loadLayoutByIndex = useCallback((index: number) => {
        setLayouts(prev => {
            const layout = prev[index] ?? prev[0];
            if (!layout) return prev;
            setCurrentLayoutName(layout.name);
            setBoxes(mergeBoxVisibility(
                createBoxes(),
                loadBoxVisibility(storageKeys, layout.name),
            ));
            return prev;
        });
        bumpVersion();
    }, [storageKeys, bumpVersion, createBoxes]);

    const setCurrentLayoutByName = useCallback((name: string) => {
        setLayouts(prev => {
            const exists = prev.some(l => l.name === name);
            const targetName = exists ? name : DEFAULT_LAYOUT_NAME;
            setCurrentLayoutName(targetName);
            setBoxes(mergeBoxVisibility(
                createBoxes(),
                loadBoxVisibility(storageKeys, targetName),
            ));
            return prev;
        });
        bumpVersion();
    }, [storageKeys, bumpVersion, createBoxes]);

    const reloadFromStorage = useCallback(() => {
        const fresh = loadLayouts(storageKeys, defaultLayout);
        setLayouts(fresh);
        const storedName = loadLastActiveLayoutName(storageKeys);
        const targetName = storedName && fresh.some(l => l.name === storedName)
            ? storedName
            : DEFAULT_LAYOUT_NAME;
        setCurrentLayoutName(targetName);
        setBoxes(mergeBoxVisibility(
            createBoxes(),
            loadBoxVisibility(storageKeys, targetName),
        ));
        bumpVersion();
    }, [storageKeys, defaultLayout, bumpVersion, createBoxes]);

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

    // ── Resize + reorder ──────────────────────────────────────────────
    //
    // These write into the current layout's payload and re-persist via
    // `saveLayouts`. Every layout is editable, including Default; the first
    // write that actually changes Default flips the "customised" marker so
    // `loadLayouts` stops regenerating it from code (see lib/layoutPersistence).

    const writeCurrentLayout = useCallback((
        producer: (current: ILayout['layout']) => ILayout['layout'],
    ): void => {
        setLayouts(prev => {
            const index = prev.findIndex(l => l.name === currentLayoutName);
            if (index === -1) return prev;
            const nextLayout = producer(prev[index].layout);
            if (layoutPayloadEquals(nextLayout, prev[index].layout)) return prev;
            const updated = prev.map((l, i) => i === index ? {...l, layout: nextLayout} : l);
            saveLayouts(storageKeys, updated);
            if (currentLayoutName === DEFAULT_LAYOUT_NAME) setDefaultCustomised(storageKeys, true);
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

    const addColumn = useCallback(() => {
        writeCurrentLayout(addColumnToPayload);
        bumpVersion();
    }, [writeCurrentLayout, bumpVersion]);

    const removeColumn = useCallback(() => {
        writeCurrentLayout(removeLastColumnFromPayload);
        bumpVersion();
    }, [writeCurrentLayout, bumpVersion]);


    const resetCurrentLayout = useCallback(() => {
        const factory = createDefaultLayout();
        setLayouts(prev => {
            const index = prev.findIndex(l => l.name === currentLayoutName);
            if (index === -1) return prev;
            const updated = prev.map((l, i) => i === index ? {...l, layout: factory.layout} : l);
            saveLayouts(storageKeys, updated);
            return updated;
        });
        clearBoxVisibility(storageKeys, currentLayoutName);
        setBoxes(createBoxes());
        if (currentLayoutName === DEFAULT_LAYOUT_NAME) setDefaultCustomised(storageKeys, false);
        bumpVersion();
    }, [storageKeys, currentLayoutName, createDefaultLayout, createBoxes, bumpVersion]);

    const importLegacyLayouts = useCallback((): ImportLayoutsResult => {
        if (!legacyStorageKeys) return {imported: [], skipped: []};
        const result = importLayoutsFrom(legacyStorageKeys, storageKeys, defaultLayout);
        if (result.imported.length > 0) reloadFromStorage();
        return result;
    }, [legacyStorageKeys, storageKeys, defaultLayout, reloadFromStorage]);

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
        setBoxVisibility,
        replaceBoxes,
        setColumnSizes,
        setBoxHeights,
        moveBox,
        addColumn,
        removeColumn,
        resetCurrentLayout,
        importLegacyLayouts,
    };
}

function layoutsContain(layouts: ILayout[], name: string): boolean {
    return layouts.some(l => l.name === name);
}

function cloneLayoutPayload(layout: ILayout['layout']): ILayout['layout'] {
    return JSON.parse(JSON.stringify(layout));
}
