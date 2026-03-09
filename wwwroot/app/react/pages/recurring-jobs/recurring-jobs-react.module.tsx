/**
 * Recurring Jobs React Module
 *
 * Entry point for the React-based Recurring Jobs page.
 * Provides functions to mount/unmount the page in an AngularJS context.
 */

import React from 'react';
import {createRoot, Root} from 'react-dom/client';
import {CssBaseline, ThemeProvider} from '@mui/material';
import {RecurringJobsPage} from './RecurringJobsPage';
import {getTheme} from '../../theme/muiTheme';
import {ReactQueryProvider} from '../../query';
import {MountRecurringJobsConfig} from "../../interfaces";

let recurringJobsRoot: Root | null = null;
let recurringJobsContainer: HTMLElement | null = null;

// Store config for refresh functionality
let refreshCallback: (() => void) | null = null;

/**
 * Mounts the recurring jobs page component into a container element
 */
export function mountRecurringJobsPage(
    containerId: string,
    config: MountRecurringJobsConfig
): void {
    console.log('[RecurringJobsReact] Mounting to container:', containerId);

    // If there's an existing root for a different container, unmount it first
    if (recurringJobsRoot && recurringJobsContainer && recurringJobsContainer.id !== containerId) {
        console.log('[RecurringJobsReact] Unmounting previous page from:', recurringJobsContainer.id);
        recurringJobsRoot.unmount();
        recurringJobsRoot = null;
        recurringJobsContainer = null;
    }

    // Find the container
    let container = document.getElementById(containerId);
    if (!container) {
        console.error('[RecurringJobsReact] Container not found:', containerId);
        container = document.createElement('div');
        container.id = containerId;
        document.body.appendChild(container);
        console.log('[RecurringJobsReact] Created fallback container');
    }

    recurringJobsContainer = container;

    // Create new root if needed
    if (!recurringJobsRoot) {
        console.log('[RecurringJobsReact] Creating new React root');
        recurringJobsRoot = createRoot(container);
    }

    const currentTheme = getTheme();

    recurringJobsRoot.render(
        <ReactQueryProvider>
            <ThemeProvider theme={currentTheme}>
                <CssBaseline/>
                <RecurringJobsPage
                    showToast={config.showToast}
                    isUsCustomer={config.isUsCustomer}
                    onAddStop={config.onAddStop}
                    onJobSelect={config.onJobSelect}
                    setRefreshCallback={(cb) => {
                        refreshCallback = cb;
                    }}
                />
            </ThemeProvider>
        </ReactQueryProvider>
    );

    console.log('[RecurringJobsReact] Recurring jobs page rendered');
}

/**
 * Triggers a data refresh in the React component
 */
export function refreshRecurringJobs(): void {
    if (refreshCallback) {
        refreshCallback();
    }
}

/**
 * Unmounts the recurring jobs page
 */
export function unmountRecurringJobsPage(): void {
    console.log('[RecurringJobsReact] Unmounting recurring jobs page');

    if (recurringJobsRoot) {
        recurringJobsRoot.unmount();
        recurringJobsRoot = null;
    }

    recurringJobsContainer = null;
}

// Expose globally for AngularJS access
(window as any).ReactRecurringJobs = {
    mount: mountRecurringJobsPage,
    unmount: unmountRecurringJobsPage,
    refresh: refreshRecurringJobs,
};

// Register as AngularJS module (for ocLazyLoad compatibility)
const recurringJobsReactModule = (window as any).angular.module(
    'uDispatch.recurringJobsReact',
    []
);

console.log('[RecurringJobsReact] Module registered');

export default recurringJobsReactModule;
