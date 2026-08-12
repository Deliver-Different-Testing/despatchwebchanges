/**
 * Job Details React Module
 *
 * Entry point for the React-based Job Details panel.
 * Provides functions to mount/unmount/refresh the panel in an AngularJS context.
 */

import React from 'react';
import {createRoot, Root} from 'react-dom/client';
import {JobDetails} from './JobDetails';
import {islandTree} from '../../../theme/DfrntMantineProvider';
import {MuiThemeIsland} from '../mui-interop/MuiThemeIsland';
import {queryClient} from '../../../query/queryClient';
import {ErrorBoundary} from '../error-boundary';
import type {MountJobDetailsConfig} from './JobDetails.types';

let jobDetailsRoot: Root | null = null;
let jobDetailsContainer: HTMLElement | null = null;
let currentConfig: MountJobDetailsConfig | null = null;
let refreshNonce = 0;

/**
 * Mounts the job details panel into a container element
 */
export function mountJobDetails(
    containerId: string,
    config: MountJobDetailsConfig
): void {
    console.log('[JobDetailsReact] Mounting to container:', containerId, 'jobId:', config.jobId);

    // If there's an existing root for a different container, unmount it first
    if (jobDetailsRoot && jobDetailsContainer && jobDetailsContainer.id !== containerId) {
        console.log('[JobDetailsReact] Unmounting previous panel from:', jobDetailsContainer.id);
        jobDetailsRoot.unmount();
        jobDetailsRoot = null;
        jobDetailsContainer = null;
    }

    // Find the container
    let container = document.getElementById(containerId);
    if (!container) {
        console.error('[JobDetailsReact] Container not found:', containerId);
        container = document.createElement('div');
        container.id = containerId;
        document.body.appendChild(container);
        console.log('[JobDetailsReact] Created fallback container');
    }

    jobDetailsContainer = container;
    currentConfig = config;

    // Create new root if needed
    if (!jobDetailsRoot) {
        console.log('[JobDetailsReact] Creating new React root');
        jobDetailsRoot = createRoot(container);
    }

    renderJobDetails(config);
}

/**
 * Renders the component with the given config
 */
function renderJobDetails(config: MountJobDetailsConfig): void {
    if (!jobDetailsRoot) return;

    // JobDetails itself is still MUI (Phase 6); Mantine wraps it so the
    // already-migrated DispatchDialog it opens finds a provider. The stack
    // supplies ReactQueryProvider, so the island no longer adds its own.
    jobDetailsRoot.render(islandTree(
        <MuiThemeIsland>
            <ErrorBoundary>
                <JobDetails config={config} />
            </ErrorBoundary>
        </MuiThemeIsland>
    ));
}

/**
 * Triggers a data refresh. Increments a nonce passed to JobDetails which causes
 * the component to call refetch() directly — this guarantees a network request
 * regardless of React Query's cache state.
 */
export async function refreshJobDetails(): Promise<void> {
    if (currentConfig && jobDetailsRoot) {
        console.log('[JobDetailsReact] Refreshing job details');
        refreshNonce++;
        // Pass the incremented nonce — JobDetails watches this and calls refetch()
        renderJobDetails({...currentConfig, _refreshNonce: refreshNonce});
        // Invalidate ancillary queries; notes are also invalidated inside JobDetails' effect
        await Promise.all([
            queryClient.invalidateQueries({queryKey: ['jobs', 'photos']}),
            queryClient.invalidateQueries({queryKey: ['priceBreakdowns']}),
        ]);
    }
}

/**
 * Unmounts the job details panel
 */
export function unmountJobDetails(): void {
    console.log('[JobDetailsReact] Unmounting job details panel');

    if (jobDetailsRoot) {
        jobDetailsRoot.unmount();
        jobDetailsRoot = null;
    }

    jobDetailsContainer = null;
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
