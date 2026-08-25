/**
 * Job Search Job List React Module
 *
 * Multi-instance bridge module for the job search page — one React root for the main
 * job list and one for the bulk job list.
 *
 * Supports two modes:
 *   1. fetchConfig mode — React owns data fetching via React Query
 *   2. Legacy mode — AngularJS pushes data via updateJobs()
 *
 * Exposed on window.ReactJobSearchJobList with instance-keyed API.
 */

import {createJobListBridge} from './jobListBridge';

const bridge = createJobListBridge({
    logName: 'JobSearchJobListReact',
    defaultAppPage: 3,
});

// Expose globally for AngularJS access (typed via global.d.ts)
window.ReactJobSearchJobList = {
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
const jobSearchJobListReactModule = window.angular!.module(
    'uDispatch.jobSearchJobListReact',
    [],
);

console.log('[JobSearchJobListReact] Module registered');

export default jobSearchJobListReactModule;
