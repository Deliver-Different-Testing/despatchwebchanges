/**
 * Per-user persistence for the courier map's fleet filter.
 *
 * The page is mounted/unmounted by the AngularJS host bridge on every visit
 * (see courier-map-react.module.tsx), so plain component state loses the
 * selection on every nav-away/nav-back. Stored in localStorage keyed by
 * ContactID, mirroring pages/nationwide/lib/betaPreference.ts.
 */

import {ContactID} from '../../../contants';

const STORAGE_KEY = `courierMapFleetFilter-${ContactID}`;

/** [] means "all fleets" — the same default the page already uses when nothing is selected. */
export function loadSelectedFleetIds(): number[] {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (!saved) return [];

        const parsed = JSON.parse(saved);
        return Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'number') : [];
    } catch {
        return [];
    }
}

export function saveSelectedFleetIds(ids: number[]): void {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
    } catch {
        // localStorage may be unavailable (private browsing); silently ignore.
    }
}
