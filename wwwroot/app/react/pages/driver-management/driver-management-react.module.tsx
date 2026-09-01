import React from 'react';
import {DriverManagementPage} from './DriverManagementPage';
import {MountDriverManagementConfig} from '../../interfaces';
import {ErrorBoundary} from '../../components/common/error-boundary';
import {islandTree} from '../../theme/DfrntMantineProvider';
import {createPageHost} from '../../utils/reactPageHost';

let refreshCallback: (() => void) | null = null;

const host = createPageHost<MountDriverManagementConfig>({
    logName: 'DriverManagementReact',
    render: (config) => islandTree(
        <ErrorBoundary>
            <DriverManagementPage
                showToast={config.showToast}
                isUsCustomer={config.isUsCustomer}
                setRefreshCallback={(cb) => {
                    refreshCallback = cb;
                }}
            />
        </ErrorBoundary>
    ),
});

export function mountDriverManagementPage(
    containerId: string,
    config: MountDriverManagementConfig
): void {
    host.mount(containerId, config);
}

export function refreshDriverManagement(): void {
    refreshCallback?.();
}

export function unmountDriverManagementPage(): void {
    host.unmount();
}

// Expose globally for AngularJS access (typed via global.d.ts)
window.ReactDriverManagement = {
    mount: mountDriverManagementPage,
    unmount: unmountDriverManagementPage,
    refresh: refreshDriverManagement,
};

const driverManagementReactModule = window.angular!.module(
    'uDispatch.driverManagementReact',
    []
);

console.log('[DriverManagementReact] Module registered');

export default driverManagementReactModule;
