/**
 * Job Details React Module
 *
 * Entry point for the React-based Job Details panel.
 * Provides functions to mount/unmount/refresh the panel in an AngularJS context.
 */

import React from 'react';
import {JobDetails} from './JobDetails';
import {islandTree} from '../../../theme/DfrntMantineProvider';
import {MuiThemeIsland} from '../mui-interop/MuiThemeIsland';
import {queryClient} from '../../../query/queryClient';
import {ErrorBoundary} from '../error-boundary';
import type {MountJobDetailsConfig} from './JobDetails.types';
import {createPageHost} from '../../../utils/reactPageHost';

let currentConfig: MountJobDetailsConfig | null = null;
let refreshNonce = 0;

// JobDetails itself is still MUI (Phase 6); Mantine wraps it so the
// already-migrated DispatchDialog it opens finds a provider. The stack
// supplies ReactQueryProvider, so the island no longer adds its own.
const host = createPageHost<MountJobDetailsConfig>({
    logName: 'JobDetailsReact',
    render: (config) => islandTree(
        <MuiThemeIsland>
            <ErrorBoundary>
                <JobDetails config={config} />
            </ErrorBoundary>
        </MuiThemeIsland>
    ),
});

/**
 * Mounts the job details panel into a container element
 */
export function mountJobDetails(containerId: string, config: MountJobDetailsConfig): void {
    currentConfig = config;
    host.mount(containerId, config);
}

/**
 * Triggers a data refresh. Increments a nonce passed to JobDetails which causes
 * the component to call refetch() directly — this guarantees a network request
 * regardless of React Query's cache state.
 */
export async function refreshJobDetails(): Promise<void> {
    if (!currentConfig) return;

    console.log('[JobDetailsReact] Refreshing job details');
    refreshNonce++;
    // Pass the incremented nonce — JobDetails watches this and calls refetch()
    host.rerender({...currentConfig, _refreshNonce: refreshNonce});
    // Invalidate ancillary queries; notes are also invalidated inside JobDetails' effect
    await Promise.all([
        queryClient.invalidateQueries({queryKey: ['jobs', 'photos']}),
        queryClient.invalidateQueries({queryKey: ['priceBreakdowns']}),
    ]);
}

/**
 * Unmounts the job details panel
 */
export function unmountJobDetails(): void {
    host.unmount();
    currentConfig = null;
}

// Expose globally for AngularJS access (typed via global.d.ts)
window.ReactJobDetails = {
    mount: mountJobDetails,
    unmount: unmountJobDetails,
    refresh: refreshJobDetails,
};

// Register as AngularJS module (for ocLazyLoad compatibility)
const jobDetailsReactModule = window.angular!.module(
    'uDispatch.jobDetailsReact',
    []
);

console.log('[JobDetailsReact] Module registered');

export default jobDetailsReactModule;
