import {act, renderHook} from '@testing-library/react';
import {useDismissibleBanner} from './useDismissibleBanner';

const KEY = 'testBannerDismissed-1';

describe('useDismissibleBanner', () => {
    beforeEach(() => localStorage.clear());

    it('starts not dismissed when nothing is stored', () => {
        const {result} = renderHook(() => useDismissibleBanner(KEY));
        expect(result.current.dismissed).toBe(false);
    });

    it('dismisses and persists to localStorage', () => {
        const {result} = renderHook(() => useDismissibleBanner(KEY));
        act(() => result.current.dismiss());
        expect(result.current.dismissed).toBe(true);
        expect(localStorage.getItem(KEY)).toBe('true');
    });

    it('starts dismissed when previously stored', () => {
        localStorage.setItem(KEY, 'true');
        const {result} = renderHook(() => useDismissibleBanner(KEY));
        expect(result.current.dismissed).toBe(true);
    });
});
