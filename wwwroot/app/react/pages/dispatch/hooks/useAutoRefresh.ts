/**
 * useAutoRefresh Hook
 *
 * Manages configurable auto-refresh intervals with localStorage persistence.
 * Supports multiple independent instances via different storage keys.
 */

import {useCallback, useState} from 'react';

export const REFRESH_OPTIONS = [
    {label: 'Disabled', value: 0},
    {label: '30 seconds', value: 30_000},
    {label: '1 minute', value: 60_000},
    {label: '2 minutes', value: 120_000},
    {label: '5 minutes', value: 300_000},
    {label: '10 minutes', value: 600_000},
    {label: '15 minutes', value: 900_000},
] as const;

export type RefreshIntervalMs = (typeof REFRESH_OPTIONS)[number]['value'];

function loadInterval(storageKey: string, defaultValue: number): number {
    try {
        const stored = localStorage.getItem(storageKey);
        if (stored != null) {
            const parsed = Number(stored);
            if (REFRESH_OPTIONS.some(o => o.value === parsed)) return parsed;
        }
    } catch { /* ignore */ }
    return defaultValue;
}

export interface UseAutoRefreshReturn {
    /** Current interval in ms (0 = disabled) */
    intervalMs: number;
    /** React Query compatible value: intervalMs or false when disabled */
    refetchInterval: number | false;
    /** Set the interval and persist to localStorage */
    setIntervalMs: (ms: number) => void;
}

export function useAutoRefresh(storageKey: string, defaultMs: number = 60_000): UseAutoRefreshReturn {
    const [intervalMs, setIntervalMsState] = useState(() => loadInterval(storageKey, defaultMs));

    const setIntervalMs = useCallback((ms: number) => {
        setIntervalMsState(ms);
        try {
            localStorage.setItem(storageKey, String(ms));
        } catch { /* ignore */ }
    }, [storageKey]);

    return {
        intervalMs,
        refetchInterval: intervalMs > 0 ? intervalMs : false,
        setIntervalMs,
    };
}
