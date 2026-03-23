/**
 * Job Details React Module
 *
 * Entry point for the React-based Job Details panel.
 * Provides functions to mount/unmount/refresh the panel in an AngularJS context.
 */

import React from 'react';
import {createRoot, Root} from 'react-dom/client';
import {ThemeProvider} from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import {JobDetails} from './JobDetails';
import {getTheme} from '../../../theme/muiTheme';
import {ReactQueryProvider} from '../../../query';
import {ErrorBoundary} from '../error-boundary';
import type {MountJobDetailsConfig} from './JobDetails.types';

let jobDetailsRoot: Root | null = null;
let jobDetailsContainer: HTMLElement | null = null;
let currentConfig: MountJobDetailsConfig | null = null;

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

    const currentTheme = getTheme();

    jobDetailsRoot.render(
        <ReactQueryProvider>
            <ThemeProvider theme={currentTheme}>
                <CssBaseline />
                <ErrorBoundary>
                    <JobDetails config={config} />
                </ErrorBoundary>
            </ThemeProvider>
        </ReactQueryProvider>
    );
}

/**
 * Triggers a data refresh by re-rendering with current config
 */
export function refreshJobDetails(): void {
    if (currentConfig && jobDetailsRoot) {
        console.log('[JobDetailsReact] Refreshing job details');
        renderJobDetails(currentConfig);
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
