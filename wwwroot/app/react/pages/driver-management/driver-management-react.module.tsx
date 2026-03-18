import React from 'react';
import {createRoot, Root} from 'react-dom/client';
import {ThemeProvider} from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import {DriverManagementPage} from './DriverManagementPage';
import {getTheme} from '../../theme/muiTheme';
import {ReactQueryProvider} from '../../query';
import {MountDriverManagementConfig} from '../../interfaces';
import {ErrorBoundary} from '../../components/common/error-boundary';

let driverManagementRoot: Root | null = null;
let driverManagementContainer: HTMLElement | null = null;
let refreshCallback: (() => void) | null = null;

export function mountDriverManagementPage(
    containerId: string,
    config: MountDriverManagementConfig
): void {
    console.log('[DriverManagementReact] Mounting to container:', containerId);

    if (driverManagementRoot && driverManagementContainer && driverManagementContainer.id !== containerId) {
        console.log('[DriverManagementReact] Unmounting previous page from:', driverManagementContainer.id);
        driverManagementRoot.unmount();
        driverManagementRoot = null;
        driverManagementContainer = null;
    }

    let container = document.getElementById(containerId);
    if (!container) {
        console.error('[DriverManagementReact] Container not found:', containerId);
        container = document.createElement('div');
        container.id = containerId;
        document.body.appendChild(container);
        console.log('[DriverManagementReact] Created fallback container');
    }

    driverManagementContainer = container;

    if (!driverManagementRoot) {
        console.log('[DriverManagementReact] Creating new React root');
        driverManagementRoot = createRoot(container);
    }

    const currentTheme = getTheme();

    driverManagementRoot.render(
        <ReactQueryProvider>
            <ThemeProvider theme={currentTheme}>
                <CssBaseline />
                <ErrorBoundary>
                    <DriverManagementPage
                        showToast={config.showToast}
                        isUsCustomer={config.isUsCustomer}
                        setRefreshCallback={(cb) => {
                            refreshCallback = cb;
                        }}
                    />
                </ErrorBoundary>
            </ThemeProvider>
        </ReactQueryProvider>
    );

    console.log('[DriverManagementReact] Driver management page rendered');
}

export function refreshDriverManagement(): void {
    if (refreshCallback) {
        refreshCallback();
    }
}

export function unmountDriverManagementPage(): void {
    console.log('[DriverManagementReact] Unmounting driver management page');

    if (driverManagementRoot) {
        driverManagementRoot.unmount();
        driverManagementRoot = null;
    }

    driverManagementContainer = null;
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
