import {useCallback, useMemo, useRef, useState} from 'react';
import type {ILayout} from '../types/interfaces/layout.interfaces';
import type {LayoutStorageKeys} from '../components/common/box-shell/layoutPersistence';
import {
    createLayoutToolbarActions,
    type LayoutToolbarBridge,
    type LayoutToolbarHost,
} from '../utils/layoutToolbarActions';
import {toastService} from '../services/toastService';

export interface UseLayoutToolbarParams {
    getBridge: () => LayoutToolbarBridge | undefined;
    storageKeys: LayoutStorageKeys;
    defaultLayout: ILayout;
}

export interface UseLayoutToolbarResult {
    layouts: ILayout[];
    currentLayoutName: string;
    saveLayout: () => Promise<void>;
    loadLayout: (index: number) => void;
    deleteLayout: (index: number) => Promise<void>;
    renameLayout: (index: number) => Promise<void>;
    importLayouts: () => void;
}

/** React-state wrapper over {@link createLayoutToolbarActions}. */
export function useLayoutToolbar(params: UseLayoutToolbarParams): UseLayoutToolbarResult {
    const latest = useRef(params);
    latest.current = params;

    const {layoutsKey, lastActiveLayoutKey, boxVisibilityKeyBase} = params.storageKeys;

    // Re-created only when a storage key changes; callers rebuild the keys object each render.
    const {host, actions} = useMemo(() => {
        const h: LayoutToolbarHost = {layouts: [], currentLayoutName: undefined};
        const a = createLayoutToolbarActions({
            getBridge: () => latest.current.getBridge(),
            host: h,
            storageKeys: latest.current.storageKeys,
            defaultLayout: latest.current.defaultLayout,
            toastr: toastService,
        });
        a.initialize();
        return {host: h, actions: a};
    }, [layoutsKey, lastActiveLayoutKey, boxVisibilityKeyBase]);

    const [snapshot, setSnapshot] = useState(() => ({
        layouts: host.layouts,
        currentLayoutName: host.currentLayoutName ?? 'Default',
    }));

    const sync = useCallback(() => {
        setSnapshot({layouts: host.layouts, currentLayoutName: host.currentLayoutName ?? 'Default'});
    }, [host]);

    return useMemo(() => {
        const wrapAsync = (fn: (index: number) => Promise<void>) => async (index: number) => {
            try {
                await fn(index);
            } finally {
                sync();
            }
        };
        return {
            layouts: snapshot.layouts,
            currentLayoutName: snapshot.currentLayoutName,
            saveLayout: async () => {
                try {
                    await actions.saveLayout();
                } finally {
                    sync();
                }
            },
            loadLayout: (index: number) => {
                actions.loadLayout(index);
                sync();
            },
            deleteLayout: wrapAsync(actions.deleteLayout),
            renameLayout: wrapAsync(actions.renameLayout),
            importLayouts: () => {
                actions.importLayouts();
                sync();
            },
        };
    }, [snapshot, actions, sync]);
}
