/**
 * Hook for managing view density via localStorage
 */

import {useState, useCallback} from 'react';

export type ViewDensity = 'normal' | 'dense';

const STORAGE_KEY_PREFIX = 'jobDetail_viewDensity_';

function loadFromStorage(contactId: number): ViewDensity {
    try {
        const stored = localStorage.getItem(`${STORAGE_KEY_PREFIX}${contactId}`);
        if (stored === 'normal' || stored === 'dense') return stored;
    } catch {
        // Ignore
    }
    return 'normal';
}

export function useViewDensity(contactId: number) {
    const [viewDensity, setViewDensity] = useState<ViewDensity>(
        () => loadFromStorage(contactId)
    );

    const toggleDensity = useCallback(() => {
        setViewDensity(prev => {
            const next = prev === 'normal' ? 'dense' : 'normal';
            try {
                localStorage.setItem(`${STORAGE_KEY_PREFIX}${contactId}`, next);
            } catch {
                // Ignore
            }
            return next;
        });
    }, [contactId]);

    const isDense = viewDensity === 'dense';

    return {viewDensity, toggleDensity, isDense};
}
