/**
 * Per-user preference for the React Nationwide page (v2).
 *
 * Stored in localStorage keyed by ContactID, separate from the Dispatch and Job
 * Search preferences so each operator's choice is per-screen and independent.
 *
 * **Default ON.** Only a stored `'false'` keeps an operator on the classic
 * AngularJS page (v1), which they can still choose from the dashboard settings.
 * v1 has no dark mode, so while it is on the colour mode is pinned to light
 * (see `useColorMode`).
 *
 * Read by:
 *   - the `nw` (`/Nationwide`) route's `redirectTo` (sends to `/NationwideV2`
 *     unless opted out)
 *   - the dashboard settings dialog, which renders the toggle
 *   - `useColorMode` and the Settings page, to enforce light mode on v1
 */

import {ContactID} from '../../../../contants';

const STORAGE_KEY = `nationwideBetaEnabled-${ContactID}`;

export function getNationwideBetaEnabled(): boolean {
    try {
        return localStorage.getItem(STORAGE_KEY) !== 'false';
    } catch {
        return true;
    }
}

export function setNationwideBetaEnabled(enabled: boolean): void {
    try {
        localStorage.setItem(STORAGE_KEY, enabled ? 'true' : 'false');
    } catch {
        // localStorage may be unavailable (private browsing); silently ignore.
    }
}
