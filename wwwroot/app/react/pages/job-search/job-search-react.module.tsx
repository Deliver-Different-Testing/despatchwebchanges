/**
 * Job Search React Module
 *
 * Page-level entry point for the React-based Job Search page.
 * Exposes `window.ReactJobSearch.mount/unmount` so AngularJS can mount
 * this page into a single container during Phase 3 of the migration.
 *
 * Pattern matches `wwwroot/app/react/pages/recurring-jobs/recurring-jobs-react.module.tsx`.
 */

import React from 'react';
import {islandTree} from '../../theme/DfrntMantineProvider';
import {ErrorBoundary} from '../../components/common/error-boundary';
import {JobSearchPage} from './JobSearchPage';
import type {ImportLayoutsResult} from '../../components/common/box-shell/layoutPersistence';
import {JobSearchPageProps} from "./JobSearchPageProps";
import {JobSearchLayoutBridge} from "./JobSearchLayoutBridge";
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

export interface MountJobSearchPageConfig extends JobSearchPageProps {}

let layoutBridge: JobSearchLayoutBridge | null = null;

// The page itself is still MUI; Mantine wraps it so the already-migrated
// JobListPanel it renders finds a provider.
/**
 * Page toasts render through the same Mantine notification surface the dialogs
 * already use. The AngularJS host used to inject a `showToast` backed by
 * `$mdToast`, which meant two toast systems on screen at once; that prop is
 * ignored now and disappears with the host in Phase 5.
 */
const showMantineToast: ShowToastFn = (message, type, action) =>
    toastService.showToast(message, type, action);

const host = createPageHost<MountJobSearchPageConfig>({
    logName: 'JobSearchReact',
    render: (config) => islandTree(
        <ErrorBoundary>
            <JobSearchPage
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

export function mountJobSearchPage(
    containerId: string,
    config: MountJobSearchPageConfig,
): void {
    host.mount(containerId, config);
}

export function unmountJobSearchPage(): void {
    host.unmount();
    layoutBridge = null;
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

/**
 * Open the Inter-Courier Charge dialog from the AngularJS toolbar. The dialog
 * component is statically imported by JobSearchPage, so it's already in this
 * bundle — no separate lazy-load needed. No-op if React is not mounted.
 */
export function openInterCourierCharge(): Promise<void> {
    return layoutBridge?.openInterCourierCharge() ?? Promise.resolve();
}

/** Restore the current layout to the shipped arrangement (toolbar → Layouts → Reset layout). */
export function resetCurrentLayout(): void {
    layoutBridge?.resetCurrentLayout();
}

/** Show or hide the "Edit Layout" bar (toolbar → Layouts → Edit Layout). */
export function setColumnEditMode(enabled: boolean): void {
    layoutBridge?.setColumnEditMode(enabled);
}

/** Open a job that was just created from the toolbar. No-op if React is not mounted. */
export function jobCreated(jobId: number): void {
    layoutBridge?.jobCreated(jobId);
}

/** Copy the user's V1 layouts into the V2 store from the AngularJS toolbar. */
export function importLegacyLayouts(): ImportLayoutsResult {
    return layoutBridge?.importLegacyLayouts() ?? {imported: [], skipped: []};
}

// Expose globally for AngularJS access (typed via global.d.ts)
declare global {
    interface Window {
        ReactJobSearch?: {
            mount: typeof mountJobSearchPage;
            unmount: typeof unmountJobSearchPage;
            setCurrentLayoutName: typeof setCurrentLayoutName;
            reloadLayoutsFromStorage: typeof reloadLayoutsFromStorage;
            promptSaveLayout: typeof promptSaveLayout;
            promptDeleteLayout: typeof promptDeleteLayout;
            promptRenameLayout: typeof promptRenameLayout;
            openInterCourierCharge: typeof openInterCourierCharge;
            resetCurrentLayout: typeof resetCurrentLayout;
            setColumnEditMode: typeof setColumnEditMode;
            jobCreated: typeof jobCreated;
            importLegacyLayouts: typeof importLegacyLayouts;
        };
    }
}

window.ReactJobSearch = {
    mount: mountJobSearchPage,
    unmount: unmountJobSearchPage,
    setCurrentLayoutName,
    reloadLayoutsFromStorage,
    promptSaveLayout,
    promptDeleteLayout,
    promptRenameLayout,
    openInterCourierCharge,
    resetCurrentLayout,
    setColumnEditMode,
    jobCreated,
    importLegacyLayouts,
};

// Register as AngularJS module (for ocLazyLoad compatibility)
const jobSearchReactModule = window.angular!.module(
    'uDispatch.jobSearchReact',
    [],
);

console.log('[JobSearchReact] Module registered');

export default jobSearchReactModule;
