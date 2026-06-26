import {useCallback, useState} from 'react';

/**
 * Persisted dismissal for a one-off banner (e.g. the V2 "BETA" notice).
 *
 * Remembers the dismissal in localStorage under `storageKey`, so the banner
 * stays hidden across reloads. To re-show the banner to everyone later (a "new"
 * announcement), bump the key (e.g. `…-v2`).
 */
export function useDismissibleBanner(storageKey: string): {
    dismissed: boolean;
    dismiss: () => void;
} {
    const [dismissed, setDismissed] = useState<boolean>(() => {
        try {
            return localStorage.getItem(storageKey) === 'true';
        } catch {
            return false;
        }
    });

    const dismiss = useCallback(() => {
        setDismissed(true);
        try {
            localStorage.setItem(storageKey, 'true');
        } catch {
            // localStorage may be unavailable (private browsing); banner just
            // reappears next load — acceptable.
        }
    }, [storageKey]);

    return {dismissed, dismiss};
}
