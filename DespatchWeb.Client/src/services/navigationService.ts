/**
 * Navigation Service
 *
 * Provides navigation helpers that were previously in the AngularJS NavigationService.
 * Pure functions with no AngularJS dependencies.
 */

import {routePath} from '../routes/routeTable';

/** The Hub twin of a Despatch URL: "despatch" becomes "hub" in the host only, never in the path or query. */
export function toHubUrl(href: string): string {
    const url = new URL(href);
    url.hostname = url.hostname.replace(/despatch/g, 'hub');
    return url.toString();
}

/**
 * Opens the Hub application in a new tab.
 */
export function openHubUrl(): void {
    window.open(toHubUrl(window.location.href), '_blank');
}

/**
 * Opens the job search page in a new tab, deep-linked to the given job.
 */
export function openJobInSearch(jobId: number): void {
    if (!jobId) return;
    const url = `#${routePath('jobSearch')}?jobId=${jobId}`;
    window.open(url, '_blank');
}
