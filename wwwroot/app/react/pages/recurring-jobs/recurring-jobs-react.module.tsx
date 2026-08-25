/**
 * Recurring Jobs React Module
 *
 * Entry point for the React-based Recurring Jobs page.
 * Provides functions to mount/unmount the page in an AngularJS context.
 */

import React from 'react';
import {RecurringJobsPage} from './RecurringJobsPage';
import {islandTree} from '../../theme/DfrntMantineProvider';
import {MuiThemeIsland} from '../../components/common/mui-interop/MuiThemeIsland';
import {MountRecurringJobsConfig} from "../../interfaces";
import {ErrorBoundary} from '../../components/common/error-boundary';
import {createPageHost} from '../../utils/reactPageHost';

// Store config for refresh functionality
let refreshCallback: (() => void) | null = null;

// The page is still MUI; Mantine wraps it so the already-migrated
// DispatchDialog that JobDetails opens inside it finds a provider.
const host = createPageHost<MountRecurringJobsConfig>({
    logName: 'RecurringJobsReact',
    render: (config) => islandTree(
        <MuiThemeIsland>
            <ErrorBoundary>
                <RecurringJobsPage
                    showToast={config.showToast}
                    isUsCustomer={config.isUsCustomer}
                    onAddStop={config.onAddStop}
                    setRefreshCallback={(cb) => {
                        refreshCallback = cb;
                    }}
                />
            </ErrorBoundary>
        </MuiThemeIsland>
    ),
});

/**
 * Mounts the recurring jobs page component into a container element
 */
export function mountRecurringJobsPage(containerId: string, config: MountRecurringJobsConfig): void {
    host.mount(containerId, config);
}

/**
 * Triggers a data refresh in the React component
 */
export function refreshRecurringJobs(): void {
    refreshCallback?.();
}

/**
 * Unmounts the recurring jobs page
 */
export function unmountRecurringJobsPage(): void {
    host.unmount();
}

// Expose globally for AngularJS access (typed via global.d.ts)
window.ReactRecurringJobs = {
    mount: mountRecurringJobsPage,
    unmount: unmountRecurringJobsPage,
    refresh: refreshRecurringJobs,
};

// Register as AngularJS module (for ocLazyLoad compatibility)
const recurringJobsReactModule = window.angular!.module(
    'uDispatch.recurringJobsReact',
    []
);

console.log('[RecurringJobsReact] Module registered');

export default recurringJobsReactModule;
