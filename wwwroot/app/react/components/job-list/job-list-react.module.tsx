/**
 * Job List React Module
 *
 * Entry point for the React-based Job List component.
 * Supports two modes:
 *   1. fetchConfig mode — React owns data fetching via React Query
 *   2. Legacy mode — AngularJS pushes data via updateJobs()
 */

import React from 'react';
import {createRoot, Root} from 'react-dom/client';
import {JobListPanel} from './JobListPanel';
import {islandTree} from '../../theme/DfrntMantineProvider';
import {MuiThemeIsland} from '../common/mui-interop/MuiThemeIsland';
import type {MountJobListConfig, DispatchJob, JobListSearchParams} from '../../interfaces';
import {ErrorBoundary} from '../common/error-boundary';

let jobListRoot: Root | null = null;
let jobListContainer: HTMLElement | null = null;

// Callbacks stored at module scope so AngularJS can interact
let updateJobsCallback: ((jobs: DispatchJob[], totalCount: number) => void) | null = null;
let refreshCallback: (() => void) | null = null;
let selectJobCallback: ((jobId: number) => void) | null = null;
let updateSearchParamsCallback: ((params: Partial<JobListSearchParams>) => void) | null = null;
let currentConfig: MountJobListConfig | null = null;

/**
 * Mounts the job list component into a container element
 */
export function mountJobList(
    containerId: string,
    config: MountJobListConfig,
): void {
    console.log('[JobListReact] Mounting to container:', containerId);

    // If there's an existing root for a different container, unmount it first
    if (jobListRoot && jobListContainer && jobListContainer.id !== containerId) {
        console.log('[JobListReact] Unmounting previous instance from:', jobListContainer.id);
        jobListRoot.unmount();
        jobListRoot = null;
        jobListContainer = null;
    }

    // Find the container
    const container = document.getElementById(containerId);
    if (!container) {
        console.error('[JobListReact] Container not found:', containerId);
        return;
    }

    jobListContainer = container;
    currentConfig = config;

    // Create new root if needed
    if (!jobListRoot) {
        console.log('[JobListReact] Creating new React root');
        jobListRoot = createRoot(container);
    }

    renderJobList(config);
    console.log('[JobListReact] Job list rendered');
}

function renderJobList(config: MountJobListConfig): void {
    if (!jobListRoot) return;

    // ErrorBoundary is a shared MUI leaf still rendered by unmigrated islands.
    jobListRoot.render(islandTree(
        <MuiThemeIsland>
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
                    onJobsLoaded={config.onJobsLoaded}
                    defaultCategory={config.defaultCategory}
                    storagePrefix={config.storagePrefix}
                    hideLoggedInSwitch={config.hideLoggedInSwitch}
                    fetchConfig={config.fetchConfig}
                    setJobsCallback={(cb) => {
                        updateJobsCallback = cb;
                    }}
                    setRefreshCallback={(cb) => {
                        refreshCallback = cb;
                    }}
                    setSelectJobCallback={(cb) => {
                        selectJobCallback = cb;
                    }}
                    setUpdateSearchParamsCallback={(cb) => {
                        updateSearchParamsCallback = cb;
                    }}
                />
            </ErrorBoundary>
        </MuiThemeIsland>
    ));
}

/**
 * Push updated job data from AngularJS into the React component (legacy mode)
 */
export function updateJobListJobs(jobs: DispatchJob[], totalCount: number): void {
    if (updateJobsCallback) {
        updateJobsCallback(jobs, totalCount);
    }
}

/**
 * Update mount configuration (e.g., when appPage changes)
 */
export function updateJobListConfig(config: Partial<MountJobListConfig>): void {
    if (currentConfig) {
        currentConfig = {...currentConfig, ...config};
        renderJobList(currentConfig);
    }
}

/**
 * Set the selected job from AngularJS (e.g., map click, detail panel)
 */
export function selectJobInList(jobId: number): void {
    if (selectJobCallback) {
        selectJobCallback(jobId);
    }
}

/**
 * Triggers a data refresh in the React component
 */
export function refreshJobList(): void {
    if (refreshCallback) {
        refreshCallback();
    }
}

/**
 * Update search params from AngularJS (fetchConfig mode).
 * Triggers a React Query refetch with new params.
 */
export function updateSearchParams(params: Partial<JobListSearchParams>): void {
    if (updateSearchParamsCallback) {
        updateSearchParamsCallback(params);
    }
}

/**
 * Unmounts the job list component
 */
export function unmountJobList(): void {
    console.log('[JobListReact] Unmounting job list');

    if (jobListRoot) {
        jobListRoot.unmount();
        jobListRoot = null;
    }

    jobListContainer = null;
    updateJobsCallback = null;
    refreshCallback = null;
    selectJobCallback = null;
    updateSearchParamsCallback = null;
    currentConfig = null;
}

// Expose globally for AngularJS access (typed via global.d.ts)
window.ReactJobList = {
    mount: mountJobList,
    unmount: unmountJobList,
    updateJobs: updateJobListJobs,
    updateConfig: updateJobListConfig,
    refresh: refreshJobList,
    selectJob: selectJobInList,
    updateSearchParams,
};

// Register as AngularJS module (for ocLazyLoad compatibility)
const jobListReactModule = window.angular!.module(
    'uDispatch.jobListReact',
    [],
);

console.log('[JobListReact] Module registered');

export default jobListReactModule;
