/**
 * Dispatch React Module
 *
 * Entry point for the React-based Dispatch Dashboard page.
 * Provides functions to mount/unmount the page in an AngularJS context.
 * Follows the task-dashboard-react.module.tsx pattern.
 */

import React from 'react';
import {createRoot, Root} from 'react-dom/client';
import {ThemeProvider} from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import {DispatchPage} from './DispatchPage';
import {getTheme} from '../../theme/muiTheme';
import type {MountDispatchConfig} from './DispatchPage.interfaces';
import {ReactQueryProvider} from '../../query';
import {ErrorBoundary} from '../../components/common/error-boundary';

let dispatchRoot: Root | null = null;
let dispatchContainer: HTMLElement | null = null;
let refreshCallback: (() => void) | null = null;

/**
 * Mounts the dispatch dashboard page into a container element
 */
export function mountDispatchPage(
    containerId: string,
    config: MountDispatchConfig
): void {
    console.log('[DispatchReact] Mounting to container:', containerId);

    // If there's an existing root for a different container, unmount it first
    if (dispatchRoot && dispatchContainer && dispatchContainer.id !== containerId) {
        console.log('[DispatchReact] Unmounting previous page from:', dispatchContainer.id);
        dispatchRoot.unmount();
        dispatchRoot = null;
        dispatchContainer = null;
    }

    // Find the container
    let container = document.getElementById(containerId);
    if (!container) {
        console.error('[DispatchReact] Container not found:', containerId);
        container = document.createElement('div');
        container.id = containerId;
        document.body.appendChild(container);
        console.log('[DispatchReact] Created fallback container');
    }

    dispatchContainer = container;

    // Create new root if needed
    if (!dispatchRoot) {
        console.log('[DispatchReact] Creating new React root');
        dispatchRoot = createRoot(container);
    }

    const currentTheme = getTheme();

    dispatchRoot.render(
        <ReactQueryProvider>
            <ThemeProvider theme={currentTheme}>
                <CssBaseline />
                <ErrorBoundary>
                    <DispatchPage
                        showToast={config.showToast}
                        isUsCustomer={config.isUsCustomer}
                        initialJobId={config.initialJobId}
                        onNavigate={config.onNavigate}
                        setRefreshCallback={(cb) => {
                            refreshCallback = cb;
                        }}
                    />
                </ErrorBoundary>
            </ThemeProvider>
        </ReactQueryProvider>
    );

    console.log('[DispatchReact] Dispatch page rendered');
}

/**
 * Triggers a data refresh in the React component
 */
export function refreshDispatchPage(): void {
    if (refreshCallback) {
        refreshCallback();
    }
}

/**
 * Unmounts the dispatch dashboard page
 */
export function unmountDispatchPage(): void {
    console.log('[DispatchReact] Unmounting dispatch page');

    if (dispatchRoot) {
        dispatchRoot.unmount();
        dispatchRoot = null;
    }

    dispatchContainer = null;
    refreshCallback = null;
}

// Expose globally for AngularJS access (typed via global.d.ts)
window.ReactDispatch = {
    mount: mountDispatchPage,
    unmount: unmountDispatchPage,
    refresh: refreshDispatchPage,
};

// Register as AngularJS module (for ocLazyLoad compatibility)
const dispatchReactModule = window.angular!.module(
    'uDispatch.dispatchReact',
    []
);

console.log('[DispatchReact] Module registered');

export default dispatchReactModule;
