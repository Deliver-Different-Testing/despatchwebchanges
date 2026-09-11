/**
 * Per-user preference for the React Nationwide page.
 *
 * Stored in localStorage keyed by ContactID, separate from the Dispatch and Job
 * Search preferences so each operator's choice is per-screen and independent.
 *
 * **Default OFF — opt-in.** This is the one place Nationwide differs from the
 * other two: Dispatch and Job Search default ON because they have been live and
 * exercised for some time, whereas the React Nationwide page is new and
 * unproven. Operators stay on the classic AngularJS page until they turn this
 * on themselves, and the toggle gets them straight back if the new page gives
 * them trouble. Only a stored `'true'` opts in.
 *
 * Read by:
 *   - the `nw` (`/Nationwide`) route's `redirectTo` (sends to `/NationwideV2`
 *     only when opted in)
 *   - the dashboard settings dialog, which renders the toggle
 *
 * Mirrors the shape of `pages/dispatch/lib/betaPreference.ts` and
 * `pages/job-search/lib/betaPreference.ts`, inverting only the default.
 */

import {ContactID} from '../../../../contants';

const STORAGE_KEY = `nationwideBetaEnabled-${ContactID}`;

export function getNationwideBetaEnabled(): boolean {
    try {
        // Opt-in: anything other than an explicit 'true' keeps the classic page.
        return localStorage.getItem(STORAGE_KEY) === 'true';
    } catch {
        return false;
    }
}

export function setNationwideBetaEnabled(enabled: boolean): void {
    try {
        localStorage.setItem(STORAGE_KEY, enabled ? 'true' : 'false');
    } catch {
        // localStorage may be unavailable (private browsing); silently ignore.
    }
}
