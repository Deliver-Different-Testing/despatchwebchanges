import React from 'react';
import {DriverManagementPage} from './DriverManagementPage';
import {MountDriverManagementConfig} from '../../interfaces';
import {ErrorBoundary} from '../../components/common/error-boundary';
import {islandTree} from '../../theme/DfrntMantineProvider';
import {createPageHost} from '../../utils/reactPageHost';
import {toastService} from '../../services/toastService';
import type {ShowToastFn} from '../../services/toastTypes';

let refreshCallback: (() => void) | null = null;

/**
 * Page toasts render through the same Mantine notification surface the dialogs
 * already use. The AngularJS host used to inject a `showToast` backed by
 * `$mdToast`, which meant two toast systems on screen at once; that prop is
 * ignored now and disappears with the host in Phase 5.
 */
const showMantineToast: ShowToastFn = (message, type, action) =>
    toastService.showToast(message, type, action);

const host = createPageHost<MountDriverManagementConfig>({
    logName: 'DriverManagementReact',
    render: (config) => islandTree(
        <ErrorBoundary>
            <DriverManagementPage
                showToast={showMantineToast}
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
