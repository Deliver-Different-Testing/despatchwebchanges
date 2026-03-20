/**
 * Navigation Service
 *
 * Provides navigation helpers that were previously in the AngularJS NavigationService.
 * Pure functions with no AngularJS dependencies.
 */

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

    // UI-Router hash-based routing: #!/<url>?jobId=<id>
    const stateUrls: Record<string, string> = {
        home: '/',
        nw: '/Nationwide',
    };
    const base = stateUrls[stateName] ?? '/';
    const url = `#!/${base.replace(/^\//, '')}?jobId=${jobId}`;
    window.open(url, '_blank');
}
