/**
 * Dispatch React Module
 *
 * Page-level entry point for the React-based Dispatch page (V2). Exposes
 * `window.ReactDispatch.mount/unmount` so AngularJS can mount this page into a
 * single container during the AngularJS → React migration of the home/dispatch
 * page.
 *
 * Pattern matches `wwwroot/app/react/pages/job-search/job-search-react.module.tsx`.
 */

import React from 'react';
import {islandTree} from '../../theme/DfrntMantineProvider';
import {ErrorBoundary} from '../../components/common/error-boundary';
import {DispatchPage, DispatchPageProps, DispatchLayoutBridge} from './DispatchPage';
import type {DispatchFilters, DispatchRefreshIntervals} from './lib/dispatchFilters';
import type {DfrntPageViewModel} from '../../../interfaces/dfrnt-page-view-model.interface';
import type {ImportLayoutsResult} from '../../components/common/box-shell/layoutPersistence';
import {createPageHost} from '../../utils/reactPageHost';
import {toastService} from '../../services/toastService';
import type {ShowToastFn} from '../../services/toastTypes';
import {
    promptDeleteLayout as promptDeleteLayoutOnBridge,
    promptRenameLayout as promptRenameLayoutOnBridge,
    promptSaveLayout as promptSaveLayoutOnBridge,
    reloadLayoutsFromStorage as reloadLayoutsFromStorageOnBridge,
    setCurrentLayoutName as setCurrentLayoutNameOnBridge,
} from "../../utils/layoutUtils";

export interface MountDispatchPageConfig extends DispatchPageProps {}

let layoutBridge: DispatchLayoutBridge | null = null;
// Filters pushed by the AngularJS toolbar before the React bridge is ready
// (e.g. the route controller resolves page views right after mount). Held here
// and flushed once the bridge registers, so the initial selection isn't lost.
let pendingFilters: Partial<DispatchFilters> | null = null;
// The host toolbar registers its Views-menu listener as soon as its controller
// runs, which can be before the React bridge exists. Held here and attached on
// bridge-ready, mirroring `pendingFilters`.
let pendingViewsListener: ((views: DfrntPageViewModel[]) => void) | null = null;
let unregisterViewsListener: (() => void) | null = null;

// ErrorBoundary is a shared MUI leaf still used by unmigrated islands.
/**
 * Page toasts render through the same Mantine notification surface the dialogs
 * already use. The AngularJS host used to inject a `showToast` backed by
 * `$mdToast`, which meant two toast systems on screen at once; that prop is
 * ignored now and disappears with the host in Phase 5.
 */
const showMantineToast: ShowToastFn = (message, type, action) =>
    toastService.showToast(message, type, action);

const host = createPageHost<MountDispatchPageConfig>({
    logName: 'DispatchReact',
    render: (config) => islandTree(
        <ErrorBoundary>
            <DispatchPage
                {...config}
                showToast={showMantineToast}
                onLayoutBridgeReady={bridge => {
                    layoutBridge = bridge;
                    if (pendingFilters) {
                        bridge.updateFilters(pendingFilters);
                        pendingFilters = null;
                    }
                    if (pendingViewsListener) {
                        unregisterViewsListener = bridge.registerViewsListener(pendingViewsListener);
                    }
                    config.onLayoutBridgeReady?.(bridge);
                }}
            />
        </ErrorBoundary>
    ),
});

export function mountDispatchPage(
    containerId: string,
    config: MountDispatchPageConfig,
): void {
    host.mount(containerId, config);
}

export function unmountDispatchPage(): void {
    host.unmount();
    layoutBridge = null;
    pendingFilters = null;
    pendingViewsListener = null;
    unregisterViewsListener = null;
}

export function updateFilters(filters: Partial<DispatchFilters>): void {
    if (layoutBridge) {
        layoutBridge.updateFilters(filters);
    } else {
        // Bridge not mounted yet — remember the latest and flush on ready.
        pendingFilters = {...pendingFilters, ...filters};
    }
}

/**
 * Subscribe the host toolbar's Views menu to the page's view list + selection.
 * Only one listener is supported (there is a single toolbar).
 */
export function registerViewsListener(listener: (views: DfrntPageViewModel[]) => void): () => void {
    if (layoutBridge) {
        unregisterViewsListener = layoutBridge.registerViewsListener(listener);
    } else {
        pendingViewsListener = listener;
    }
    return () => {
        if (pendingViewsListener === listener) pendingViewsListener = null;
        unregisterViewsListener?.();
        unregisterViewsListener = null;
    };
}

export function setViewSelection(viewIds: number[]): void {
    layoutBridge?.setViewSelection(viewIds);
}

export function setCurrentLayoutName(name: string): void {
    setCurrentLayoutNameOnBridge(layoutBridge, name);
}

export function reloadLayoutsFromStorage(): void {
    reloadLayoutsFromStorageOnBridge(layoutBridge);
}

export function promptSaveLayout(): Promise<string | null> {
    return promptSaveLayoutOnBridge(layoutBridge);
}

export function promptDeleteLayout(layoutName: string): Promise<boolean> {
    return promptDeleteLayoutOnBridge(layoutBridge, layoutName);
}

export function promptRenameLayout(layoutName: string): Promise<string | null> {
    return promptRenameLayoutOnBridge(layoutBridge, layoutName);
}

export function updateRefreshIntervals(intervals: Partial<DispatchRefreshIntervals>): void {
    layoutBridge?.updateRefreshIntervals(intervals);
}

/** Restore the current layout to the shipped arrangement (toolbar → Layouts → Reset layout). */
export function resetCurrentLayout(): void {
    layoutBridge?.resetCurrentLayout();
}

/** Show or hide the "Edit columns" bar (toolbar → Layouts → Edit columns). */
export function setColumnEditMode(enabled: boolean): void {
    layoutBridge?.setColumnEditMode(enabled);
}

export function openInterCourierCharge(): void {
    layoutBridge?.openInterCourierCharge();
}

export function jobCreated(jobId: number): void {
    layoutBridge?.jobCreated(jobId);
}

export function importLegacyLayouts(): ImportLayoutsResult {
    return layoutBridge?.importLegacyLayouts() ?? {imported: [], skipped: []};
}

// Expose globally for AngularJS access (typed via global.d.ts)
declare global {
    interface Window {
        ReactDispatch?: {
            mount: typeof mountDispatchPage;
            unmount: typeof unmountDispatchPage;
            setCurrentLayoutName: typeof setCurrentLayoutName;
            reloadLayoutsFromStorage: typeof reloadLayoutsFromStorage;
            promptSaveLayout: typeof promptSaveLayout;
            promptDeleteLayout: typeof promptDeleteLayout;
            promptRenameLayout: typeof promptRenameLayout;
            updateFilters: typeof updateFilters;
            registerViewsListener: typeof registerViewsListener;
            setViewSelection: typeof setViewSelection;
            updateRefreshIntervals: typeof updateRefreshIntervals;
            resetCurrentLayout: typeof resetCurrentLayout;
            setColumnEditMode: typeof setColumnEditMode;
            openInterCourierCharge: typeof openInterCourierCharge;
            jobCreated: typeof jobCreated;
            importLegacyLayouts: typeof importLegacyLayouts;
        };
    }
}

window.ReactDispatch = {
    mount: mountDispatchPage,
    unmount: unmountDispatchPage,
    setCurrentLayoutName,
    reloadLayoutsFromStorage,
    promptSaveLayout,
    promptDeleteLayout,
    promptRenameLayout,
    updateFilters,
    registerViewsListener,
    setViewSelection,
    updateRefreshIntervals,
    resetCurrentLayout,
    setColumnEditMode,
    openInterCourierCharge,
    jobCreated,
    importLegacyLayouts,
};

// Register as AngularJS module (for ocLazyLoad compatibility)
const dispatchReactModule = window.angular!.module(
    'uDispatch.dispatchReact',
    [],
);

console.log('[DispatchReact] Module registered');

export default dispatchReactModule;
