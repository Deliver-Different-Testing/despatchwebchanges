import {useCallback, useEffect, useRef, useState} from 'react';
import {saveDateFilterTo, type LoadedDateFilter, type StoredDateFilter} from '../utils/dateFilterStorage';

type ExpiredRange = NonNullable<LoadedDateFilter['expiredRange']>;

/**
 * Persisted date-range filter. `load` supplies the initial value (it owns the
 * page-specific "all time" recomputation); `setValue` writes it back under `storageKey`.
 *
 * When `load` reports a stored range that has ended, the replacement is persisted on
 * mount and `onExpired` is told once, so the page can say why the dates changed. A preset
 * such as Today re-derives its range on mount (the date menu's effect runs before this
 * one); that new range stands and nothing has expired.
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

    const setBeforeMountRef = useRef(false);
    const setValue = useCallback((next: StoredDateFilter) => {
        setBeforeMountRef.current = true;
        setState(next);
        saveDateFilterTo(storageKey, next);
    }, [storageKey]);

    const expiryHandledRef = useRef(false);
    useEffect(() => {
        if (expiryHandledRef.current || !initial.expiredRange) return;
        expiryHandledRef.current = true;
        if (setBeforeMountRef.current) return;
        saveDateFilterTo(storageKey, value);
        onExpired?.(initial.expiredRange);
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    return [value, setValue];
}
