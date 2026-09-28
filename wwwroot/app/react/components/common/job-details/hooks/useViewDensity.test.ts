/** @jest-environment jest-environment-jsdom */
/**
 * useViewDensity Hook Tests
 */

import {renderHook, act} from '@testing-library/react';
import {useViewDensity} from './useViewDensity';

const CONTACT_ID = 42;
const STORAGE_KEY = `jobDetail_viewDensity_${CONTACT_ID}`;

describe('useViewDensity', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('defaults to normal density', () => {
        const {result} = renderHook(() => useViewDensity(CONTACT_ID));

        expect(result.current.viewDensity).toBe('normal');
        expect(result.current.isDense).toBe(false);
    });

    it('loads saved density from localStorage', () => {
        localStorage.setItem(STORAGE_KEY, 'dense');

        const {result} = renderHook(() => useViewDensity(CONTACT_ID));
        expect(result.current.viewDensity).toBe('dense');
        expect(result.current.isDense).toBe(true);
    });

    it('toggleDensity cycles between normal and dense', () => {
        const {result} = renderHook(() => useViewDensity(CONTACT_ID));

        act(() => {
            result.current.toggleDensity();
        });
        expect(result.current.viewDensity).toBe('dense');
        expect(result.current.isDense).toBe(true);
        expect(localStorage.getItem(STORAGE_KEY)).toBe('dense');

        act(() => {
            result.current.toggleDensity();
        });
        expect(result.current.viewDensity).toBe('normal');
        expect(result.current.isDense).toBe(false);
    });

    it('handles invalid localStorage value gracefully', () => {
        localStorage.setItem(STORAGE_KEY, 'invalid-value');

        const {result} = renderHook(() => useViewDensity(CONTACT_ID));
        expect(result.current.viewDensity).toBe('normal');
    });
});
