/**
 * Overview React Module
 *
 * Entry point for the React-based Overview page.
 * Provides mount/unmount/refresh for AngularJS integration.
 */

import React from 'react';
import {OverviewPage} from './OverviewPage';
import {MountOverviewConfig} from './OverviewPage.interfaces';
import {ErrorBoundary} from '../../components/common/error-boundary';
import {islandTree} from '../../theme/DfrntMantineProvider';
import {MuiThemeIsland} from '../../components/common/mui-interop/MuiThemeIsland';
import {createPageHost} from '../../utils/reactPageHost';

let refreshCallback: (() => void) | null = null;

const host = createPageHost<MountOverviewConfig>({
    logName: 'OverviewReact',
    render: (config) => islandTree(
        <MuiThemeIsland>
            <ErrorBoundary>
                <OverviewPage
                    showToast={config.showToast}
                    isUsCustomer={config.isUsCustomer}
                    onOpenJobDetail={config.onOpenJobDetail}
                    setRefreshCallback={(cb) => {
                        refreshCallback = cb;
                    }}
                />
            </ErrorBoundary>
        </MuiThemeIsland>
    ),
});

/**
 * Mounts the overview page component into a container element
 */
export function mountOverviewPage(containerId: string, config: MountOverviewConfig): void {
    host.mount(containerId, config);
}

/**
 * Triggers a data refresh in the React component
 */
export function refreshOverview(): void {
    refreshCallback?.();
}

/**
 * Unmounts the overview page
 */
export function unmountOverviewPage(): void {
    host.unmount();
    refreshCallback = null;
}

// Expose globally for AngularJS access (typed via global.d.ts)
window.ReactOverview = {
    mount: mountOverviewPage,
    unmount: unmountOverviewPage,
    refresh: refreshOverview,
};

// Register as AngularJS module (for ocLazyLoad compatibility)
const overviewReactModule = window.angular!.module(
    'uDispatch.overviewReact',
    [],
);

console.log('[OverviewReact] Module registered');

export default overviewReactModule;
