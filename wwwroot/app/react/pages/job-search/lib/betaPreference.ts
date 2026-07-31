/**
 * Per-user preference for the React Job Search page.
 *
 * Stored in localStorage keyed by ContactID so each operator's choice is
 * independent. **Default ON (React V2):** the rebuilt page is the default;
 * only an explicit opt-out (a stored `'false'`) falls back to the classic
 * AngularJS page. Users who previously opted in ('true') stay on V2, and
 * anyone who never touched the setting now gets V2 too.
 *
 * Read by:
 *   - the `/jobSearch` AngularJS route (redirects to `/jobSearchV2` unless opted out)
 *   - the dashboard settings dialog (renders the toggle for both versions)
 */

import {ContactID} from '../../../../contants';

const STORAGE_KEY = `jobSearchBetaEnabled-${ContactID}`;

export function getJobSearchBetaEnabled(): boolean {
    try {
        // Default ON: only an explicit opt-out (`'false'`) uses the classic page.
        return localStorage.getItem(STORAGE_KEY) !== 'false';
    } catch {
        return true;
    }
}

export function setJobSearchBetaEnabled(enabled: boolean): void {
    try {
        localStorage.setItem(STORAGE_KEY, enabled ? 'true' : 'false');
    } catch {
        // localStorage may be unavailable (private browsing); silently ignore.
    }
}
