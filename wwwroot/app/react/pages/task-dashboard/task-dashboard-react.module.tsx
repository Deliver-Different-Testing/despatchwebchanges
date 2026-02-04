/**
 * Task Dashboard React Module
 *
 * Entry point for the React-based Task Dashboard page.
 * Provides functions to mount/unmount the page in an AngularJS context.
 */

import React from 'react';
import {createRoot, Root} from 'react-dom/client';
import {CssBaseline, ThemeProvider} from '@mui/material';
import {QueryClientProvider} from '@tanstack/react-query';
import {TaskDashboardPage} from './TaskDashboardPage';
import {getTheme} from '../../theme/muiTheme';
import {MountTaskDashboardConfig, LayoutActions} from './TaskDashboardPage.interfaces';
import {queryClient} from '../../query';
import angular from 'angular';

let taskDashboardRoot: Root | null = null;
let taskDashboardContainer: HTMLElement | null = null;

// Store config for refresh functionality
let refreshCallback: (() => void) | null = null;

// Store current layout actions callback for external access
let currentLayoutActionsCallback: ((actions: LayoutActions) => void) | null = null;

/**
 * Mounts the task dashboard page component into a container element
 */
export function mountTaskDashboardPage(
    containerId: string,
    config: MountTaskDashboardConfig
): void {
    console.log('[TaskDashboardReact] Mounting to container:', containerId);

    // If there's an existing root for a different container, unmount it first
    if (taskDashboardRoot && taskDashboardContainer && taskDashboardContainer.id !== containerId) {
        console.log('[TaskDashboardReact] Unmounting previous page from:', taskDashboardContainer.id);
        taskDashboardRoot.unmount();
        taskDashboardRoot = null;
        taskDashboardContainer = null;
    }

    // Find the container
    let container = document.getElementById(containerId);
    if (!container) {
        console.error('[TaskDashboardReact] Container not found:', containerId);
        container = document.createElement('div');
        container.id = containerId;
        document.body.appendChild(container);
        console.log('[TaskDashboardReact] Created fallback container');
    }

    taskDashboardContainer = container;

    // Store the layout actions callback for use by the React component
    currentLayoutActionsCallback = config.onLayoutActionsChange || null;

    // Create new root if needed
    if (!taskDashboardRoot) {
        console.log('[TaskDashboardReact] Creating new React root');
        taskDashboardRoot = createRoot(container);
    }

    const currentTheme = getTheme();

    taskDashboardRoot.render(
        <QueryClientProvider client={queryClient}>
            <ThemeProvider theme={currentTheme}>
                <CssBaseline />
                <TaskDashboardPage
                    showToast={config.showToast}
                    isUsCustomer={config.isUsCustomer}
                    onTaskSelect={config.onTaskSelect}
                    setRefreshCallback={(cb) => {
                        refreshCallback = cb;
                    }}
                    onLayoutActionsChange={config.onLayoutActionsChange}
                />
            </ThemeProvider>
        </QueryClientProvider>
    );

    console.log('[TaskDashboardReact] Task dashboard page rendered');
}

/**
 * Triggers a data refresh in the React component
 */
export function refreshTaskDashboard(): void {
    if (refreshCallback) {
        refreshCallback();
    }
}

/**
 * Unmounts the task dashboard page
 */
export function unmountTaskDashboardPage(): void {
    console.log('[TaskDashboardReact] Unmounting task dashboard page');

    if (taskDashboardRoot) {
        taskDashboardRoot.unmount();
        taskDashboardRoot = null;
    }

    taskDashboardContainer = null;
    refreshCallback = null;
    currentLayoutActionsCallback = null;
}

// Expose globally for AngularJS access
(window as any).ReactTaskDashboard = {
    mount: mountTaskDashboardPage,
    unmount: unmountTaskDashboardPage,
    refresh: refreshTaskDashboard,
};

// Register as AngularJS module (for ocLazyLoad compatibility)
const taskDashboardReactModule = (window as any).angular.module(
    'uDispatch.taskDashboardReact',
    []
);

console.log('[TaskDashboardReact] Module registered');

export default taskDashboardReactModule;
