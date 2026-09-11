/**
 * Nationwide React Module
 *
 * Page-level entry point for the React Nationwide page (V2). Exposes
 * `window.ReactNationwide.mount/unmount` plus the layout bridge, so the
 * AngularJS host can mount this page into one container and drive the toolbar's
 * layout menu while both pages coexist.
 *
 * Pattern matches `pages/dispatch/dispatch-react.module.tsx`.
 */

import React from 'react';
import {islandTree} from '../../theme/DfrntMantineProvider';
import {ErrorBoundary} from '../../components/common/error-boundary';
import {createPageHost} from '../../utils/reactPageHost';
import {toastService} from '../../services/toastService';
import type {ShowToastFn} from '../../services/toastTypes';
import {NationwidePage} from './NationwidePage';
import type {NationwideLayoutBridge, NationwidePageProps} from './NationwidePageProps';

export interface MountNationwidePageConfig extends NationwidePageProps {}

let layoutBridge: NationwideLayoutBridge | null = null;

/**
 * Page toasts render through the same Mantine notification surface the dialogs
 * already use. The AngularJS host used to inject a `showToast` backed by
 * `$mdToast`, which meant two toast systems on screen at once; that prop is
 * ignored here and disappears with the host in Phase 5.
 */
const showMantineToast: ShowToastFn = (message, type, action) =>
    toastService.showToast(message, type, action);

const host = createPageHost<MountNationwidePageConfig>({
    logName: 'NationwideReact',
    render: (config) => islandTree(
        <ErrorBoundary>
            <NationwidePage
                {...config}
                showToast={showMantineToast}
                onLayoutBridgeReady={bridge => {
                    layoutBridge = bridge;
                    config.onLayoutBridgeReady?.(bridge);
                }}
            />
        </ErrorBoundary>
    ),
});

export function mountNationwidePage(
    containerId: string,
    config: MountNationwidePageConfig,
): void {
    host.mount(containerId, config);
}

export function unmountNationwidePage(): void {
    layoutBridge = null;
    host.unmount();
}

// ── Layout bridge, driven from the AngularJS toolbar ─────────────────
// Each call is a no-op until the page has mounted and registered its bridge,
// so a toolbar click during load cannot throw.

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

export function importLegacyLayouts(): unknown {
    return layoutBridge?.importLegacyLayouts();
}

declare global {
    interface Window {
        ReactNationwide?: {
            mount: typeof mountNationwidePage;
            unmount: typeof unmountNationwidePage;
            setCurrentLayoutName: typeof setCurrentLayoutName;
            reloadLayoutsFromStorage: typeof reloadLayoutsFromStorage;
            promptSaveLayout: typeof promptSaveLayout;
            promptDeleteLayout: typeof promptDeleteLayout;
            promptRenameLayout: typeof promptRenameLayout;
            importLegacyLayouts: typeof importLegacyLayouts;
        };
    }
}

window.ReactNationwide = {
    mount: mountNationwidePage,
    unmount: unmountNationwidePage,
    setCurrentLayoutName,
    reloadLayoutsFromStorage,
    promptSaveLayout,
    promptDeleteLayout,
    promptRenameLayout,
    importLegacyLayouts,
};

// Registered so $ocLazyLoad can dedupe and verify the load.
const nationwideReactModule = window.angular!.module(
    'uDispatch.nationwideReact',
    [],
);

export default nationwideReactModule;
