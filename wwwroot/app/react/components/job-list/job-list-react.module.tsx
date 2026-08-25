/**
 * Job List React Module
 *
 * Entry point for the React-based Job List component.
 * Supports two modes:
 *   1. fetchConfig mode — React owns data fetching via React Query
 *   2. Legacy mode — AngularJS pushes data via updateJobs()
 */

import type {MountJobListConfig, DispatchJob, JobListSearchParams} from '../../interfaces';
import {createJobListBridge} from './jobListBridge';

const INSTANCE = 'jobList';

const bridge = createJobListBridge({
    logName: 'JobListReact',
    defaultAppPage: 1,
});

/**
 * Mounts the job list component into a container element
 */
export function mountJobList(containerId: string, config: MountJobListConfig): void {
    bridge.mount(INSTANCE, containerId, config);
}

/**
 * Push updated job data from AngularJS into the React component (legacy mode)
 */
export function updateJobListJobs(jobs: DispatchJob[], totalCount: number): void {
    bridge.updateJobs(INSTANCE, jobs, totalCount);
}

/**
 * Update mount configuration (e.g., when appPage changes)
 */
export function updateJobListConfig(config: Partial<MountJobListConfig>): void {
    bridge.updateConfig(INSTANCE, config);
}

/**
 * Set the selected job from AngularJS (e.g., map click, detail panel)
 */
export function selectJobInList(jobId: number): void {
    bridge.selectJob(INSTANCE, jobId);
}

/**
 * Triggers a data refresh in the React component
 */
export function refreshJobList(): void {
    bridge.refresh(INSTANCE);
}

/**
 * Update search params from AngularJS (fetchConfig mode).
 * Triggers a React Query refetch with new params.
 */
export function updateSearchParams(params: Partial<JobListSearchParams>): void {
    bridge.updateSearchParams(INSTANCE, params);
}

/**
 * Unmounts the job list component
 */
export function unmountJobList(): void {
    bridge.unmount(INSTANCE);
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
