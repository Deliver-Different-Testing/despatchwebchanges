import {useCallback, useState} from 'react';
import {saveDateFilterTo, type StoredDateFilter} from '../utils/dateFilterStorage';

/**
 * Persisted date-range filter. `load` supplies the initial value (it owns the
 * page-specific "all time" recomputation); `setValue` writes it back under `storageKey`.
 */
export function useDateFilter(
    storageKey: string,
    load: () => StoredDateFilter,
): [StoredDateFilter, (value: StoredDateFilter) => void] {
    const [value, setState] = useState<StoredDateFilter>(load);

    const setValue = useCallback((next: StoredDateFilter) => {
        setState(next);
        saveDateFilterTo(storageKey, next);
    }, [storageKey]);

    return [value, setValue];
}
