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
import {createRoot, Root} from 'react-dom/client';
import {ThemeProvider} from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import {getTheme} from '../../theme/muiTheme';
import {ReactQueryProvider} from '../../query';
import {ErrorBoundary} from '../../components/common/error-boundary';
import {JobSearchPage, JobSearchPageProps, JobSearchLayoutBridge} from './JobSearchPage';
import type {ImportLayoutsResult} from './lib/layoutPersistence';

export interface MountJobSearchPageConfig extends JobSearchPageProps {}

let jobSearchRoot: Root | null = null;
let jobSearchContainer: HTMLElement | null = null;
let layoutBridge: JobSearchLayoutBridge | null = null;

export function mountJobSearchPage(
    containerId: string,
    config: MountJobSearchPageConfig,
): void {
    console.log('[JobSearchReact] Mounting to container:', containerId);

    if (jobSearchRoot && jobSearchContainer && jobSearchContainer.id !== containerId) {
        console.log('[JobSearchReact] Unmounting previous page from:', jobSearchContainer.id);
        jobSearchRoot.unmount();
        jobSearchRoot = null;
        jobSearchContainer = null;
    }

    let container = document.getElementById(containerId);
    if (!container) {
        console.error('[JobSearchReact] Container not found:', containerId);
        container = document.createElement('div');
        container.id = containerId;
        document.body.appendChild(container);
    }

    jobSearchContainer = container;

    if (!jobSearchRoot) {
        jobSearchRoot = createRoot(container);
    }

    const currentTheme = getTheme();

    jobSearchRoot.render(
        <ReactQueryProvider>
            <ThemeProvider theme={currentTheme}>
                <CssBaseline/>
                <ErrorBoundary>
                    <JobSearchPage
                        {...config}
                        onLayoutBridgeReady={bridge => {
                            layoutBridge = bridge;
                            config.onLayoutBridgeReady?.(bridge);
                        }}
                    />
                </ErrorBoundary>
            </ThemeProvider>
        </ReactQueryProvider>,
    );

    console.log('[JobSearchReact] Page rendered');
}

export function unmountJobSearchPage(): void {
    console.log('[JobSearchReact] Unmounting job-search page');
    if (jobSearchRoot) {
        jobSearchRoot.unmount();
        jobSearchRoot = null;
    }
    jobSearchContainer = null;
    layoutBridge = null;
}

/**
 * Tell the live React page to switch to a layout by name (e.g. after
 * AngularJS writes a new layout to localStorage from the AppShell menu).
 * No-op if React is not mounted.
 */
export function setCurrentLayoutName(name: string): void {
    layoutBridge?.setCurrentLayoutName(name);
}

/**
 * Tell the live React page to re-read its layouts list from localStorage
 * (after AngularJS adds/deletes a layout via the AppShell menu).
 */
export function reloadLayoutsFromStorage(): void {
    layoutBridge?.reloadFromStorage();
}

/**
 * Open the React MUI "Save Layout" dialog and resolve with the entered name
 * (or null if canceled / React not mounted). The AngularJS toolbar awaits
 * this in place of the old native `window.prompt`.
 */
export function promptSaveLayout(): Promise<string | null> {
    return layoutBridge?.promptSaveLayout() ?? Promise.resolve(null);
}

/**
 * Open the React MUI "Delete Layout" confirmation and resolve true if the user
 * confirms (false if cancelled / React not mounted). The AngularJS toolbar
 * awaits this in place of the old native `window.confirm`.
 */
export function promptDeleteLayout(layoutName: string): Promise<boolean> {
    return layoutBridge?.promptDeleteLayout(layoutName) ?? Promise.resolve(false);
}

/**
 * Open the React MUI "Rename Layout" dialog and resolve with the new name (or
 * null if cancelled / React not mounted). The AngularJS toolbar awaits this.
 */
export function promptRenameLayout(layoutName: string): Promise<string | null> {
    return layoutBridge?.promptRenameLayout(layoutName) ?? Promise.resolve(null);
}

/**
 * Open the Inter-Courier Charge dialog from the AngularJS toolbar. The dialog
 * component is statically imported by JobSearchPage, so it's already in this
 * bundle — no separate lazy-load needed. No-op if React is not mounted.
 */
export function openInterCourierCharge(): Promise<void> {
    return layoutBridge?.openInterCourierCharge() ?? Promise.resolve();
}

/** Set layout edit mode from the AngularJS toolbar's Layouts → Edit layout toggle. */
export function setEditMode(enabled: boolean): void {
    layoutBridge?.setEditMode(enabled);
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
            setEditMode: typeof setEditMode;
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
    setEditMode,
    importLegacyLayouts,
};

// Register as AngularJS module (for ocLazyLoad compatibility)
const jobSearchReactModule = window.angular!.module(
    'uDispatch.jobSearchReact',
    [],
);

console.log('[JobSearchReact] Module registered');

export default jobSearchReactModule;
