/** @jest-environment jest-environment-jsdom */
/**
 * useAutoRefresh Hook Tests
 */

import {renderHook, act} from '@testing-library/react';
import {useAutoRefresh} from './useAutoRefresh';

const STORAGE_KEY = 'test_autoRefresh';

describe('useAutoRefresh', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('defaults to provided defaultMs value', () => {
        const {result} = renderHook(() => useAutoRefresh(STORAGE_KEY, 120_000));

        expect(result.current.intervalMs).toBe(120_000);
    });

    it('refetchInterval returns false when intervalMs is 0', () => {
        const {result} = renderHook(() => useAutoRefresh(STORAGE_KEY, 0));

        expect(result.current.refetchInterval).toBe(false);
    });

    it('refetchInterval returns intervalMs when > 0', () => {
        const {result} = renderHook(() => useAutoRefresh(STORAGE_KEY, 60_000));

        expect(result.current.refetchInterval).toBe(60_000);
    });

    it('setIntervalMs updates the interval', () => {
        const {result} = renderHook(() => useAutoRefresh(STORAGE_KEY, 60_000));

        act(() => {
            result.current.setIntervalMs(300_000);
        });

        expect(result.current.intervalMs).toBe(300_000);
        expect(result.current.refetchInterval).toBe(300_000);
    });

    it('setIntervalMs persists to localStorage', () => {
        const {result} = renderHook(() => useAutoRefresh(STORAGE_KEY, 60_000));

        act(() => {
            result.current.setIntervalMs(120_000);
        });

        expect(localStorage.getItem(STORAGE_KEY)).toBe('120000');
    });

    it('loads saved interval from localStorage', () => {
        localStorage.setItem(STORAGE_KEY, '300000');

        const {result} = renderHook(() => useAutoRefresh(STORAGE_KEY, 60_000));

        expect(result.current.intervalMs).toBe(300_000);
    });

    it('ignores invalid stored values and uses default', () => {
        localStorage.setItem(STORAGE_KEY, '99999');

        const {result} = renderHook(() => useAutoRefresh(STORAGE_KEY, 60_000));

        expect(result.current.intervalMs).toBe(60_000);
    });
});
