/**
 * Navigation Service
 *
 * Provides navigation helpers that were previously in the AngularJS NavigationService.
 * Pure functions with no AngularJS dependencies.
 */

import {routePath} from '../routes/routeTable';

const JOB_DETAIL_STATES = ['home', 'nationwide'];

/**
 * Opens the Hub application in a new tab by replacing "despatch" in the current URL.
 */
export function openHubUrl(): void {
    const hubUrl = window.location.href.replace(/despatch/g, 'hub');
    window.open(hubUrl, '_blank');
}

/**
 * Opens a job detail page in a new tab.
 */
export function openJobDetail(jobId: number | string, stateName = 'home'): void {
    if (!jobId) return;

    // Hash routing: #/<url>?jobId=<id>
    const base = JOB_DETAIL_STATES.includes(stateName) ? routePath(stateName) : routePath('home');
    const url = `#/${base.replace(/^\//, '')}?jobId=${jobId}`;
    window.open(url, '_blank');
}

/**
 * Opens the job search page in a new tab, deep-linked to the given job.
 */
export function openJobInSearch(jobId: number): void {
    if (!jobId) return;
    const url = `#${routePath('jobSearch')}?jobId=${jobId}`;
    window.open(url, '_blank');
}
