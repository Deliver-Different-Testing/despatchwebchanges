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
import {createRoot, Root} from 'react-dom/client';
import {ThemeProvider} from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import {getTheme} from '../../theme/muiTheme';
import {ReactQueryProvider} from '../../query';
import {ErrorBoundary} from '../../components/common/error-boundary';
import {DispatchPage, DispatchPageProps, DispatchLayoutBridge} from './DispatchPage';
import type {DispatchFilters, DispatchRefreshIntervals} from './lib/dispatchFilters';
import type {ImportLayoutsResult} from '../job-search/lib/layoutPersistence';

export interface MountDispatchPageConfig extends DispatchPageProps {}

let dispatchRoot: Root | null = null;
let dispatchContainer: HTMLElement | null = null;
let layoutBridge: DispatchLayoutBridge | null = null;
// Filters pushed by the AngularJS toolbar before the React bridge is ready
// (e.g. the route controller resolves page views right after mount). Held here
// and flushed once the bridge registers, so the initial selection isn't lost.
let pendingFilters: Partial<DispatchFilters> | null = null;

export function mountDispatchPage(
    containerId: string,
    config: MountDispatchPageConfig,
): void {
    console.log('[DispatchReact] Mounting to container:', containerId);

    if (dispatchRoot && dispatchContainer && dispatchContainer.id !== containerId) {
        console.log('[DispatchReact] Unmounting previous page from:', dispatchContainer.id);
        dispatchRoot.unmount();
        dispatchRoot = null;
        dispatchContainer = null;
    }

    let container = document.getElementById(containerId);
    if (!container) {
        console.error('[DispatchReact] Container not found:', containerId);
        container = document.createElement('div');
        container.id = containerId;
        document.body.appendChild(container);
    }

    dispatchContainer = container;

    if (!dispatchRoot) {
        dispatchRoot = createRoot(container);
    }

    const currentTheme = getTheme();

    dispatchRoot.render(
        <ReactQueryProvider>
            <ThemeProvider theme={currentTheme}>
                <CssBaseline/>
                <ErrorBoundary>
                    <DispatchPage
                        {...config}
                        onLayoutBridgeReady={bridge => {
                            layoutBridge = bridge;
                            if (pendingFilters) {
                                bridge.updateFilters(pendingFilters);
                                pendingFilters = null;
                            }
                            config.onLayoutBridgeReady?.(bridge);
                        }}
                    />
                </ErrorBoundary>
            </ThemeProvider>
        </ReactQueryProvider>,
    );

    console.log('[DispatchReact] Page rendered');
}

export function unmountDispatchPage(): void {
    console.log('[DispatchReact] Unmounting dispatch page');
    if (dispatchRoot) {
        dispatchRoot.unmount();
        dispatchRoot = null;
    }
    dispatchContainer = null;
    layoutBridge = null;
    pendingFilters = null;
}

export function setCurrentLayoutName(name: string): void {
    layoutBridge?.setCurrentLayoutName(name);
}

export function reloadLayoutsFromStorage(): void {
    layoutBridge?.reloadFromStorage();
}

export function promptSaveLayout(): Promise<string | null> {
    return layoutBridge?.promptSaveLayout() ?? Promise.resolve(null);
}

export function promptDeleteLayout(layoutName: string): Promise<boolean> {
    return layoutBridge?.promptDeleteLayout(layoutName) ?? Promise.resolve(false);
}

export function promptRenameLayout(layoutName: string): Promise<string | null> {
    return layoutBridge?.promptRenameLayout(layoutName) ?? Promise.resolve(null);
}

export function updateFilters(filters: Partial<DispatchFilters>): void {
    if (layoutBridge) {
        layoutBridge.updateFilters(filters);
    } else {
        // Bridge not mounted yet — remember the latest and flush on ready.
        pendingFilters = {...pendingFilters, ...filters};
    }
}

export function updateRefreshIntervals(intervals: Partial<DispatchRefreshIntervals>): void {
    layoutBridge?.updateRefreshIntervals(intervals);
}

export function setEditMode(enabled: boolean): void {
    layoutBridge?.setEditMode(enabled);
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
            updateRefreshIntervals: typeof updateRefreshIntervals;
            setEditMode: typeof setEditMode;
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
    updateRefreshIntervals,
    setEditMode,
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
