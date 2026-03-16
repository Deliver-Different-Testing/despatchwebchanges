/**
 * Overview React Module
 *
 * Entry point for the React-based Overview page.
 * Provides mount/unmount/refresh for AngularJS integration.
 */

import React from 'react';
import {createRoot, Root} from 'react-dom/client';
import {ThemeProvider} from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import {OverviewPage} from './OverviewPage';
import {getTheme} from '../../theme/muiTheme';
import {MountOverviewConfig} from './OverviewPage.interfaces';
import {ReactQueryProvider} from '../../query';

let overviewRoot: Root | null = null;
let overviewContainer: HTMLElement | null = null;
let refreshCallback: (() => void) | null = null;

/**
 * Mounts the overview page component into a container element
 */
export function mountOverviewPage(
    containerId: string,
    config: MountOverviewConfig,
): void {
    console.log('[OverviewReact] Mounting to container:', containerId);

    // If there's an existing root for a different container, unmount it first
    if (overviewRoot && overviewContainer && overviewContainer.id !== containerId) {
        console.log('[OverviewReact] Unmounting previous page from:', overviewContainer.id);
        overviewRoot.unmount();
        overviewRoot = null;
        overviewContainer = null;
    }

    // Find the container
    let container = document.getElementById(containerId);
    if (!container) {
        console.error('[OverviewReact] Container not found:', containerId);
        container = document.createElement('div');
        container.id = containerId;
        document.body.appendChild(container);
        console.log('[OverviewReact] Created fallback container');
    }

    overviewContainer = container;

    // Create new root if needed
    if (!overviewRoot) {
        console.log('[OverviewReact] Creating new React root');
        overviewRoot = createRoot(container);
    }

    const currentTheme = getTheme();

    overviewRoot.render(
        <ReactQueryProvider>
            <ThemeProvider theme={currentTheme}>
                <CssBaseline />
                <OverviewPage
                    showToast={config.showToast}
                    isUsCustomer={config.isUsCustomer}
                    onOpenJobDetail={config.onOpenJobDetail}
                    setRefreshCallback={(cb) => {
                        refreshCallback = cb;
                    }}
                />
            </ThemeProvider>
        </ReactQueryProvider>,
    );

    console.log('[OverviewReact] Overview page rendered');
}

/**
 * Triggers a data refresh in the React component
 */
export function refreshOverview(): void {
    if (refreshCallback) {
        refreshCallback();
    }
}

/**
 * Unmounts the overview page
 */
export function unmountOverviewPage(): void {
    console.log('[OverviewReact] Unmounting overview page');

    if (overviewRoot) {
        overviewRoot.unmount();
        overviewRoot = null;
    }

    overviewContainer = null;
    refreshCallback = null;
}

// Expose globally for AngularJS access (typed via global.d.ts)
window.ReactOverview = {
    mount: mountOverviewPage,
    unmount: unmountOverviewPage,
    refresh: refreshOverview,
};

// Register as AngularJS module (for ocLazyLoad compatibility)
const overviewReactModule = (window as any).angular.module(
    'uDispatch.overviewReact',
    [],
);

console.log('[OverviewReact] Module registered');

export default overviewReactModule;
