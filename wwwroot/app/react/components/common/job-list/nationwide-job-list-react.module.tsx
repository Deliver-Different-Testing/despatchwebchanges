/**
 * Nationwide Job List React Module
 *
 * Multi-instance bridge module for the nationwide/domestic page.
 * Uses a Map to manage three independent React roots — one per
 * job list (New Jobs, Awaiting POD, Reprice).
 *
 * Supports two modes:
 *   1. fetchConfig mode — React owns data fetching via React Query
 *   2. Legacy mode — AngularJS pushes data via updateJobs()
 *
 * Exposed on window.ReactNationwideJobList with instance-keyed API.
 */

import React from 'react';
import {createRoot, Root} from 'react-dom/client';
import {ThemeProvider} from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import {JobListPanel} from './JobListPanel';
import {getTheme} from '../../../theme/muiTheme';
import {ReactQueryProvider} from '../../../query';
import type {DispatchJob, MountJobListConfig, JobListSearchParams} from '../../../interfaces';
import {ErrorBoundary} from '../error-boundary';

interface JobListInstance {
    root: Root;
    container: HTMLElement;
    config: MountJobListConfig;
    updateJobsCallback: ((jobs: DispatchJob[], totalCount: number) => void) | null;
    refreshCallback: (() => void) | null;
    selectJobCallback: ((jobId: number) => void) | null;
    updateSearchParamsCallback: ((params: Partial<JobListSearchParams>) => void) | null;
}

const instances = new Map<string, JobListInstance>();

/**
 * Renders a single instance's JobListPanel into its React root.
 */
function renderInstance(instance: JobListInstance): void {
    const currentTheme = getTheme();

    instance.root.render(
        <ReactQueryProvider>
            <ThemeProvider theme={currentTheme}>
                <CssBaseline/>
                <ErrorBoundary>
                    <JobListPanel
                        showToast={instance.config.showToast}
                        isUsCustomer={instance.config.isUsCustomer}
                        appPage={instance.config.appPage ?? 1}
                        onJobSelect={instance.config.onJobSelect}
                        onJobDispatch={instance.config.onJobDispatch}
                        onRefresh={instance.config.onRefresh}
                        onSearchChange={instance.config.onSearchChange}
                        onCategoryChange={instance.config.onCategoryChange}
                        onBackendFilter={instance.config.onBackendFilter}
                        onLoadMoreJobs={instance.config.onLoadMoreJobs}
                        onAddStop={instance.config.onAddStop}
                        defaultCategory={instance.config.defaultCategory}
                        storagePrefix={instance.config.storagePrefix}
                        fetchConfig={instance.config.fetchConfig}
                        setJobsCallback={(cb) => {
                            instance.updateJobsCallback = cb;
                        }}
                        setRefreshCallback={(cb) => {
                            instance.refreshCallback = cb;
                        }}
                        setSelectJobCallback={(cb) => {
                            instance.selectJobCallback = cb;
                        }}
                        setUpdateSearchParamsCallback={(cb) => {
                            instance.updateSearchParamsCallback = cb;
                        }}
                    />
                </ErrorBoundary>
            </ThemeProvider>
        </ReactQueryProvider>,
    );
}

/**
 * Mounts a job list instance into a container element.
 */
function mount(instanceId: string, containerId: string, config: MountJobListConfig): void {
    console.log(`[NationwideJobListReact] Mounting instance '${instanceId}' to container:`, containerId);

    const existing = instances.get(instanceId);

    // If instance exists but container was removed from DOM, unmount old root
    if (existing) {
        if (!document.contains(existing.container)) {
            console.log(`[NationwideJobListReact] Container for '${instanceId}' removed from DOM, re-creating root`);
            existing.root.unmount();
            instances.delete(instanceId);
        } else if (existing.container.id === containerId) {
            // Same container still in DOM — just update config and re-render
            existing.config = config;
            renderInstance(existing);
            return;
        } else {
            // Different container — unmount old
            existing.root.unmount();
            instances.delete(instanceId);
        }
    }

    const container = document.getElementById(containerId);
    if (!container) {
        console.error(`[NationwideJobListReact] Container not found: ${containerId}`);
        return;
    }

    const instance: JobListInstance = {
        root: createRoot(container),
        container,
        config,
        updateJobsCallback: null,
        refreshCallback: null,
        selectJobCallback: null,
        updateSearchParamsCallback: null,
    };

    instances.set(instanceId, instance);
    renderInstance(instance);
    console.log(`[NationwideJobListReact] Instance '${instanceId}' mounted`);
}

/**
 * Unmounts a single instance by ID.
 */
function unmount(instanceId: string): void {
    const instance = instances.get(instanceId);
    if (instance) {
        console.log(`[NationwideJobListReact] Unmounting instance '${instanceId}'`);
        instance.root.unmount();
        instances.delete(instanceId);
    }
}

/**
 * Unmounts all instances. Called from $onDestroy.
 */
function unmountAll(): void {
    console.log(`[NationwideJobListReact] Unmounting all instances (${instances.size})`);
    for (const [_id, instance] of instances) {
        instance.root.unmount();
    }
    instances.clear();
}

/**
 * Push updated job data from AngularJS into a specific instance (legacy mode).
 */
function updateJobs(instanceId: string, jobs: DispatchJob[], totalCount: number): void {
    const instance = instances.get(instanceId);
    if (instance?.updateJobsCallback) {
        instance.updateJobsCallback(jobs, totalCount);
    }
}

/**
 * Update mount configuration for a specific instance and re-render.
 */
function updateConfig(instanceId: string, config: Partial<MountJobListConfig>): void {
    const instance = instances.get(instanceId);
    if (instance) {
        instance.config = {...instance.config, ...config};
        renderInstance(instance);
    }
}

/**
 * Triggers a data refresh in a specific instance.
 */
function refresh(instanceId: string): void {
    const instance = instances.get(instanceId);
    if (instance?.refreshCallback) {
        instance.refreshCallback();
    }
}

/**
 * Set the selected job from AngularJS in a specific instance.
 */
function selectJob(instanceId: string, jobId: number): void {
    const instance = instances.get(instanceId);
    if (instance?.selectJobCallback) {
        instance.selectJobCallback(jobId);
    }
}

/**
 * Update search params from AngularJS (fetchConfig mode).
 * Triggers a React Query refetch with new params.
 */
function updateSearchParams(instanceId: string, params: Partial<JobListSearchParams>): void {
    const instance = instances.get(instanceId);
    if (instance?.updateSearchParamsCallback) {
        instance.updateSearchParamsCallback(params);
    }
}

// Expose globally for AngularJS access (typed via global.d.ts)
window.ReactNationwideJobList = {
    mount,
    unmount,
    unmountAll,
    updateJobs,
    updateConfig,
    refresh,
    selectJob,
    updateSearchParams,
};

// Register as AngularJS module (for ocLazyLoad compatibility)
const nationwideJobListReactModule = window.angular!.module(
    'uDispatch.nationwideJobListReact',
    [],
);

console.log('[NationwideJobListReact] Module registered');

export default nationwideJobListReactModule;
