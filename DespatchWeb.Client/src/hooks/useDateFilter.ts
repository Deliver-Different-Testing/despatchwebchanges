import {useCallback, useEffect, useRef, useState} from 'react';
import {saveDateFilterTo, type LoadedDateFilter, type StoredDateFilter} from '../utils/dateFilterStorage';

type ExpiredRange = NonNullable<LoadedDateFilter['expiredRange']>;

/**
 * Persisted date-range filter. `load` supplies the initial value (it owns the
 * page-specific "all time" recomputation); `setValue` writes it back under `storageKey`.
 *
 * When `load` reports a stored range that has ended, the replacement is persisted on
 * mount and `onExpired` is told once, so the page can say why the dates changed.
 */
export function useDateFilter(
    storageKey: string,
    load: () => LoadedDateFilter,
    onExpired?: (range: ExpiredRange) => void,
): [StoredDateFilter, (value: StoredDateFilter) => void] {
    const [initial] = useState(load);
    const [value, setState] = useState<StoredDateFilter>(() => ({
        startDate: initial.startDate,
        endDate: initial.endDate,
        useTime: initial.useTime,
    }));

    const setValue = useCallback((next: StoredDateFilter) => {
        setState(next);
        saveDateFilterTo(storageKey, next);
    }, [storageKey]);

    const expiryHandledRef = useRef(false);
    useEffect(() => {
        if (expiryHandledRef.current || !initial.expiredRange) return;
        expiryHandledRef.current = true;
        saveDateFilterTo(storageKey, value);
        onExpired?.(initial.expiredRange);
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    return [value, setValue];
}
