/**
 * Current Work Job List React Module
 *
 * Separate bridge module for the "Current Work" panel (selected courier's jobs).
 * Follows the same pattern as job-list-react.module.tsx but with its own
 * module-scope singletons so both panels can coexist independently.
 */

import React from 'react';
import {createRoot, Root} from 'react-dom/client';
import {ThemeProvider} from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import {JobListPanel} from './JobListPanel';
import {getTheme} from '../../theme/muiTheme';
import {ReactQueryProvider} from '../../query';
import type {DispatchJob, MountJobListConfig} from '../../interfaces';
import {ErrorBoundary} from '../common/error-boundary';

let cwRoot: Root | null = null;
let cwContainer: HTMLElement | null = null;

// Callbacks stored at module scope so AngularJS can push data
let updateJobsCallback: ((jobs: DispatchJob[], totalCount: number) => void) | null = null;
let refreshCallback: (() => void) | null = null;
let currentConfig: MountJobListConfig | null = null;

/**
 * Mounts the current work job list component into a container element
 */
export function mountCurrentWorkJobList(
    containerId: string,
    config: MountJobListConfig,
): void {
    console.log('[CurrentWorkJobListReact] Mounting to container:', containerId);

    // If there's an existing root for a different container, unmount it first
    if (cwRoot && cwContainer && cwContainer.id !== containerId) {
        console.log('[CurrentWorkJobListReact] Unmounting previous instance from:', cwContainer.id);
        cwRoot.unmount();
        cwRoot = null;
        cwContainer = null;
    }

    // Find the container
    const container = document.getElementById(containerId);
    if (!container) {
        console.error('[CurrentWorkJobListReact] Container not found:', containerId);
        return;
    }

    cwContainer = container;
    currentConfig = config;

    // Create new root if needed
    if (!cwRoot) {
        console.log('[CurrentWorkJobListReact] Creating new React root');
        cwRoot = createRoot(container);
    }

    renderCurrentWorkJobList(config);
    console.log('[CurrentWorkJobListReact] Job list rendered');
}

function renderCurrentWorkJobList(config: MountJobListConfig): void {
    if (!cwRoot) return;

    const currentTheme = getTheme();

    cwRoot.render(
        <ReactQueryProvider>
            <ThemeProvider theme={currentTheme}>
                <CssBaseline/>
                <ErrorBoundary>
                    <JobListPanel
                        showToast={config.showToast}
                        isUsCustomer={config.isUsCustomer}
                        appPage={config.appPage ?? 1}
                        onJobSelect={config.onJobSelect}
                        onJobDispatch={config.onJobDispatch}
                        onRefresh={config.onRefresh}
                        onSearchChange={config.onSearchChange}
                        onCategoryChange={config.onCategoryChange}
                        onBackendFilter={config.onBackendFilter}
                        onLoadMoreJobs={config.onLoadMoreJobs}
                        onAddStop={config.onAddStop}
                        defaultCategory={config.defaultCategory}
                        storagePrefix={config.storagePrefix ?? 'currentWorkJobList'}
                        setJobsCallback={(cb) => {
                            updateJobsCallback = cb;
                        }}
                        setRefreshCallback={(cb) => {
                            refreshCallback = cb;
                        }}
                        setSelectJobCallback={() => {
                        }}
                    />
                </ErrorBoundary>
            </ThemeProvider>
        </ReactQueryProvider>,
    );
}

/**
 * Push updated job data from AngularJS into the React component
 */
export function updateCurrentWorkJobs(jobs: DispatchJob[], totalCount: number): void {
    if (updateJobsCallback) {
        updateJobsCallback(jobs, totalCount);
    }
}

/**
 * Update mount configuration (e.g., when appPage changes)
 */
export function updateCurrentWorkConfig(config: Partial<MountJobListConfig>): void {
    if (currentConfig) {
        currentConfig = {...currentConfig, ...config};
        renderCurrentWorkJobList(currentConfig);
    }
}

/**
 * Triggers a data refresh in the React component
 */
export function refreshCurrentWorkJobList(): void {
    if (refreshCallback) {
        refreshCallback();
    }
}

/**
 * Unmounts the current work job list component
 */
export function unmountCurrentWorkJobList(): void {
    console.log('[CurrentWorkJobListReact] Unmounting job list');

    if (cwRoot) {
        cwRoot.unmount();
        cwRoot = null;
    }

    cwContainer = null;
    updateJobsCallback = null;
    refreshCallback = null;
    currentConfig = null;
}

// Expose globally for AngularJS access (typed via global.d.ts)
window.ReactCurrentWorkJobList = {
    mount: mountCurrentWorkJobList,
    unmount: unmountCurrentWorkJobList,
    updateJobs: updateCurrentWorkJobs,
    updateConfig: updateCurrentWorkConfig,
    refresh: refreshCurrentWorkJobList,
};

// Register as AngularJS module (for ocLazyLoad compatibility)
const currentWorkJobListReactModule = window.angular!.module(
    'uDispatch.currentWorkJobListReact',
    [],
);

console.log('[CurrentWorkJobListReact] Module registered');

export default currentWorkJobListReactModule;
