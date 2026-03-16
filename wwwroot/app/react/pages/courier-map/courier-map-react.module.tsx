/**
 * Courier Map React Module
 *
 * Entry point for the React-based Courier Map page.
 * Provides functions to mount/unmount the page in an AngularJS context.
 */

import React from 'react';
import {createRoot, Root} from 'react-dom/client';
import {ThemeProvider} from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import {CourierMapPage} from './CourierMapPage';
import {getTheme} from '../../theme/muiTheme';
import {ReactQueryProvider} from '../../query';

export interface MountCourierMapConfig {
    isUsCustomer: boolean;
    mapCenter: { lat: number; lng: number };
    apiKey: string | null;
}

let courierMapRoot: Root | null = null;
let courierMapContainer: HTMLElement | null = null;

/**
 * Mounts the courier map page component into a container element
 */
export function mountCourierMapPage(
    containerId: string,
    config: MountCourierMapConfig
): void {
    console.log('[CourierMapReact] Mounting to container:', containerId);

    // If there's an existing root for a different container, unmount it first
    if (courierMapRoot && courierMapContainer && courierMapContainer.id !== containerId) {
        console.log('[CourierMapReact] Unmounting previous page from:', courierMapContainer.id);
        courierMapRoot.unmount();
        courierMapRoot = null;
        courierMapContainer = null;
    }

    // Find the container
    let container = document.getElementById(containerId);
    if (!container) {
        console.error('[CourierMapReact] Container not found:', containerId);
        container = document.createElement('div');
        container.id = containerId;
        document.body.appendChild(container);
        console.log('[CourierMapReact] Created fallback container');
    }

    courierMapContainer = container;

    // Create new root if needed
    if (!courierMapRoot) {
        console.log('[CourierMapReact] Creating new React root');
        courierMapRoot = createRoot(container);
    }

    const currentTheme = getTheme();

    courierMapRoot.render(
        <ReactQueryProvider>
            <ThemeProvider theme={currentTheme}>
                <CssBaseline />
                <CourierMapPage
                    isUsCustomer={config.isUsCustomer}
                    mapCenter={config.mapCenter}
                    apiKey={config.apiKey}
                />
            </ThemeProvider>
        </ReactQueryProvider>
    );

    console.log('[CourierMapReact] Courier map page rendered');
}

/**
 * Unmounts the courier map page
 */
export function unmountCourierMapPage(): void {
    console.log('[CourierMapReact] Unmounting courier map page');

    if (courierMapRoot) {
        courierMapRoot.unmount();
        courierMapRoot = null;
    }

    courierMapContainer = null;
}

// Expose globally for AngularJS access (typed via global.d.ts)
window.ReactCourierMap = {
    mount: mountCourierMapPage,
    unmount: unmountCourierMapPage,
};

// Register as AngularJS module (for ocLazyLoad compatibility)
const courierMapReactModule = (window as any).angular.module(
    'uDispatch.courierMapReact',
    []
);

console.log('[CourierMapReact] Module registered');

export default courierMapReactModule;
