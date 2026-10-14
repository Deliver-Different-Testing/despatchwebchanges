import { renderHook } from '@testing-library/react';
import { useLiquidGlassSupport } from './useGlassStrategy';

describe('useLiquidGlassSupport', () => {
  afterEach(() => {
    Object.defineProperty(window.navigator, 'userAgentData', { value: undefined, configurable: true });
    Reflect.deleteProperty(CSS, 'supports');
    localStorage.removeItem('dd-liquid-glass');
  });

  beforeEach(() => {
    localStorage.setItem('dd-liquid-glass', 'on');
  });

  function stubCssSupports(result: boolean) {
    Object.defineProperty(CSS, 'supports', { value: jest.fn().mockReturnValue(result), configurable: true });
  }

  it('falls back to false in jsdom (no userAgentData, no CSS.supports)', () => {
    const { result } = renderHook(() => useLiquidGlassSupport());
    expect(result.current).toBe(false);
  });

  it('returns true when Chromium + backdrop-filter supported + no accessibility overrides', () => {
    Object.defineProperty(window.navigator, 'userAgentData', {
      value: { brands: [{ brand: 'Chromium', version: '141' }] },
      configurable: true,
    });
    stubCssSupports(true);

    const { result } = renderHook(() => useLiquidGlassSupport());
    expect(result.current).toBe(true);
  });

  it('returns false when the user has not turned Liquid Glass on (the default), even on Chromium', () => {
    Object.defineProperty(window.navigator, 'userAgentData', {
      value: { brands: [{ brand: 'Chromium', version: '141' }] },
      configurable: true,
    });
    stubCssSupports(true);
    localStorage.removeItem('dd-liquid-glass');

    const { result } = renderHook(() => useLiquidGlassSupport());
    expect(result.current).toBe(false);
  });

  it('returns false when CSS.supports reports no backdrop-filter support, even on Chromium', () => {
    Object.defineProperty(window.navigator, 'userAgentData', {
      value: { brands: [{ brand: 'Chromium', version: '141' }] },
      configurable: true,
    });
    stubCssSupports(false);

    const { result } = renderHook(() => useLiquidGlassSupport());
    expect(result.current).toBe(false);
  });
});
