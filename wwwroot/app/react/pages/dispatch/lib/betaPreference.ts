/**
 * Per-user preference for the React Dispatch page.
 *
 * Stored in localStorage keyed by ContactID (a dispatch-specific key, separate
 * from the Job Search preference) so each operator's choice is independent and
 * persists across sessions.
 *
 * **Default OFF (classic V1):** users land on the AngularJS dispatch page unless
 * they explicitly opt in to V2 (only a stored `'true'` enables the React page).
 *
 * Read by:
 *   - the `home` (`/`) route `redirectTo` (sends to `/dispatchV2` only when opted in)
 *   - the dashboard settings dialog (renders the toggle for both versions)
 *
 * Mirrors `wwwroot/app/react/pages/job-search/lib/betaPreference.ts`.
 */

import {ContactID} from '../../../../contants';

const STORAGE_KEY = `dispatchBetaEnabled-${ContactID}`;

export function getDispatchBetaEnabled(): boolean {
    try {
        // Default OFF: only an explicit opt-in (`'true'`) uses the React page.
        return localStorage.getItem(STORAGE_KEY) === 'true';
    } catch {
        return false;
    }
}

export function setDispatchBetaEnabled(enabled: boolean): void {
    try {
        localStorage.setItem(STORAGE_KEY, enabled ? 'true' : 'false');
    } catch {
        // localStorage may be unavailable (private browsing); silently ignore.
    }
}
