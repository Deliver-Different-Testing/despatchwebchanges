/**
 * Current Work Job List React Module
 *
 * Separate bridge module for the "Current Work" panel (selected courier's jobs), so it
 * and the dispatch job list can coexist independently.
 */

import type {DispatchJob, MountJobListConfig} from '../../interfaces';
import {createJobListBridge} from './jobListBridge';

const INSTANCE = 'currentWork';

const bridge = createJobListBridge({
    logName: 'CurrentWorkJobListReact',
    defaultAppPage: 1,
    defaultStoragePrefix: 'currentWorkJobList',
    defaultHideLoggedInSwitch: true,
});

/**
 * Mounts the current work job list component into a container element
 */
export function mountCurrentWorkJobList(containerId: string, config: MountJobListConfig): void {
    bridge.mount(INSTANCE, containerId, config);
}

/**
 * Push updated job data from AngularJS into the React component
 */
export function updateCurrentWorkJobs(jobs: DispatchJob[], totalCount: number): void {
    bridge.updateJobs(INSTANCE, jobs, totalCount);
}

/**
 * Update mount configuration (e.g., when appPage changes)
 */
export function updateCurrentWorkConfig(config: Partial<MountJobListConfig>): void {
    bridge.updateConfig(INSTANCE, config);
}

/**
 * Triggers a data refresh in the React component
 */
export function refreshCurrentWorkJobList(): void {
    bridge.refresh(INSTANCE);
}

/**
 * Unmounts the current work job list component
 */
export function unmountCurrentWorkJobList(): void {
    bridge.unmount(INSTANCE);
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
