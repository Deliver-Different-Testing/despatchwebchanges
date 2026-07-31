/**
 * Per-user preference for the React Dispatch page.
 *
 * Stored in localStorage keyed by ContactID (a dispatch-specific key, separate
 * from the Job Search preference) so each operator's choice is independent and
 * persists across sessions.
 *
 * **Default ON (React V2):** users land on the rebuilt React dispatch page
 * unless they explicitly opt out (only a stored `'false'` falls back to the
 * classic AngularJS page). Users who previously opted in ('true') stay on V2,
 * and anyone who never touched the setting now gets V2 too.
 *
 * Read by:
 *   - the `home` (`/`) route `redirectTo` (sends to `/dispatchV2` unless opted out)
 *   - the dashboard settings dialog (renders the toggle for both versions)
 *
 * Mirrors `wwwroot/app/react/pages/job-search/lib/betaPreference.ts`.
 */

import {ContactID} from '../../../../contants';

const STORAGE_KEY = `dispatchBetaEnabled-${ContactID}`;

export function getDispatchBetaEnabled(): boolean {
    try {
        // Default ON: only an explicit opt-out (`'false'`) uses the classic page.
        return localStorage.getItem(STORAGE_KEY) !== 'false';
    } catch {
        return true;
    }
}

export function setDispatchBetaEnabled(enabled: boolean): void {
    try {
        localStorage.setItem(STORAGE_KEY, enabled ? 'true' : 'false');
    } catch {
        // localStorage may be unavailable (private browsing); silently ignore.
    }
}
