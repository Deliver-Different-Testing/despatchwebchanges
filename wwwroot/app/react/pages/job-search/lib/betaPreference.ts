/**
 * Per-user opt-in for the React Job Search beta.
 *
 * Stored in localStorage keyed by ContactID so each operator's choice is
 * independent. Default is `false` (stay on the AngularJS version).
 *
 * Read by:
 *   - the `/jobSearch` AngularJS route (redirects to `/jobSearchV2` when true)
 *   - the dashboard settings dialog (renders the toggle for both V1 and V2)
 */

import {ContactID} from '../../../../contants';

const STORAGE_KEY = `jobSearchBetaEnabled-${ContactID}`;

export function getJobSearchBetaEnabled(): boolean {
    try {
        return localStorage.getItem(STORAGE_KEY) === 'true';
    } catch {
        return false;
    }
}

export function setJobSearchBetaEnabled(enabled: boolean): void {
    try {
        localStorage.setItem(STORAGE_KEY, enabled ? 'true' : 'false');
    } catch {
        // localStorage may be unavailable (private browsing); silently ignore.
    }
}
