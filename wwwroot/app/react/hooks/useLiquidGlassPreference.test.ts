import {act, renderHook} from '@testing-library/react';
import {isLiquidGlassEnabled, setLiquidGlassEnabled, useLiquidGlassEnabled} from './useLiquidGlassPreference';

describe('liquid glass preference', () => {
    beforeEach(() => localStorage.clear());

    it('is off by default', () => {
        expect(isLiquidGlassEnabled()).toBe(false);
        expect(renderHook(() => useLiquidGlassEnabled()).result.current).toBe(false);
    });

    it('turns on and off, and live-updates mounted hooks', () => {
        const {result} = renderHook(() => useLiquidGlassEnabled());
        act(() => setLiquidGlassEnabled(true));
        expect(result.current).toBe(true);
        expect(localStorage.getItem('dd-liquid-glass')).toBe('on');
        act(() => setLiquidGlassEnabled(false));
        expect(result.current).toBe(false);
    });

    it('treats any value other than "on" as off', () => {
        localStorage.setItem('dd-liquid-glass', 'true');
        expect(isLiquidGlassEnabled()).toBe(false);
    });
});
