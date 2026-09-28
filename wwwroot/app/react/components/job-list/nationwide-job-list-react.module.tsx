/**
 * Nationwide Job List React Module
 *
 * Multi-instance bridge module for the nationwide/domestic page — one React root per
 * job list (New Jobs, Awaiting POD, Reprice).
 *
 * Supports two modes:
 *   1. fetchConfig mode — React owns data fetching via React Query
 *   2. Legacy mode — AngularJS pushes data via updateJobs()
 *
 * Exposed on window.ReactNationwideJobList with instance-keyed API.
 */

import {createJobListBridge} from './jobListBridge';

const bridge = createJobListBridge({
    logName: 'NationwideJobListReact',
    defaultAppPage: 1,
});

// Expose globally for AngularJS access (typed via global.d.ts)
window.ReactNationwideJobList = {
    mount: bridge.mount,
    unmount: bridge.unmount,
    unmountAll: bridge.unmountAll,
    updateJobs: bridge.updateJobs,
    updateConfig: bridge.updateConfig,
    refresh: bridge.refresh,
    selectJob: bridge.selectJob,
    updateSearchParams: bridge.updateSearchParams,
};

// Register as AngularJS module (for ocLazyLoad compatibility)
const nationwideJobListReactModule = window.angular!.module(
    'uDispatch.nationwideJobListReact',
    [],
);

console.log('[NationwideJobListReact] Module registered');

export default nationwideJobListReactModule;
