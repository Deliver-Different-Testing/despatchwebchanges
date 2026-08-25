/**
 * Courier Map React Module
 *
 * Entry point for the React-based Courier Map page.
 * Provides functions to mount/unmount the page in an AngularJS context.
 */

import React from 'react';
import {CourierMapPage} from './CourierMapPage';
import {ErrorBoundary} from '../../components/common/error-boundary';
import {islandTree} from '../../theme/DfrntMantineProvider';
import {MuiThemeIsland} from '../../components/common/mui-interop/MuiThemeIsland';
import {createPageHost} from '../../utils/reactPageHost';

export interface MountCourierMapConfig {
    isUsCustomer: boolean;
    mapCenter: { lat: number; lng: number };
    apiKey: string | null;
}

const host = createPageHost<MountCourierMapConfig>({
    logName: 'CourierMapReact',
    render: (config) => islandTree(
        <MuiThemeIsland>
            <ErrorBoundary>
                <CourierMapPage
                    isUsCustomer={config.isUsCustomer}
                    mapCenter={config.mapCenter}
                    apiKey={config.apiKey}
                />
            </ErrorBoundary>
        </MuiThemeIsland>
    ),
});

/**
 * Mounts the courier map page component into a container element
 */
export function mountCourierMapPage(containerId: string, config: MountCourierMapConfig): void {
    host.mount(containerId, config);
}

/**
 * Unmounts the courier map page
 */
export function unmountCourierMapPage(): void {
    host.unmount();
}

// Expose globally for AngularJS access (typed via global.d.ts)
window.ReactCourierMap = {
    mount: mountCourierMapPage,
    unmount: unmountCourierMapPage,
};

// Register as AngularJS module (for ocLazyLoad compatibility)
const courierMapReactModule = window.angular!.module(
    'uDispatch.courierMapReact',
    []
);

console.log('[CourierMapReact] Module registered');

export default courierMapReactModule;
