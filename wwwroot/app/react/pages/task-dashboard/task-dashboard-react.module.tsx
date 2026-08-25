/**
 * Task Dashboard React Module
 *
 * Entry point for the React-based Task Dashboard page.
 * Provides functions to mount/unmount the page in an AngularJS context.
 */

import React from 'react';
import {TaskDashboardPage} from './TaskDashboardPage';
import {MountTaskDashboardConfig} from './TaskDashboardPage.interfaces';
import {islandTree} from '../../theme/DfrntMantineProvider';
import {MuiThemeIsland} from '../../components/common/mui-interop/MuiThemeIsland';
import {ErrorBoundary} from '../../components/common/error-boundary';
import {createPageHost} from '../../utils/reactPageHost';

// Store config for refresh functionality
let refreshCallback: (() => void) | null = null;

// The page is still MUI; Mantine wraps it so the already-migrated
// DispatchDialog that JobDetails opens inside it finds a provider.
const host = createPageHost<MountTaskDashboardConfig>({
    logName: 'TaskDashboardReact',
    render: (config) => islandTree(
        <MuiThemeIsland>
            <ErrorBoundary>
                <TaskDashboardPage
                    showToast={config.showToast}
                    isUsCustomer={config.isUsCustomer}
                    setRefreshCallback={(cb) => {
                        refreshCallback = cb;
                    }}
                />
            </ErrorBoundary>
        </MuiThemeIsland>
    ),
});

/**
 * Mounts the task dashboard page component into a container element
 */
export function mountTaskDashboardPage(containerId: string, config: MountTaskDashboardConfig): void {
    host.mount(containerId, config);
}

/**
 * Triggers a data refresh in the React component
 */
export function refreshTaskDashboard(): void {
    refreshCallback?.();
}

/**
 * Unmounts the task dashboard page
 */
export function unmountTaskDashboardPage(): void {
    host.unmount();
    refreshCallback = null;
}

// Expose globally for AngularJS access (typed via global.d.ts)
window.ReactTaskDashboard = {
    mount: mountTaskDashboardPage,
    unmount: unmountTaskDashboardPage,
    refresh: refreshTaskDashboard,
};

// Register as AngularJS module (for ocLazyLoad compatibility)
const taskDashboardReactModule = window.angular!.module(
    'uDispatch.taskDashboardReact',
    []
);

console.log('[TaskDashboardReact] Module registered');

export default taskDashboardReactModule;
