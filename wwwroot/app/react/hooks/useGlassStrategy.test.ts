import { renderHook } from '@testing-library/react';
import { isChromiumEngine, pickGlassStrategy, useLiquidGlassSupport } from './useGlassStrategy';

describe('isChromiumEngine', () => {
  it('returns true when userAgentData brands include Chromium (Chrome/Edge/Brave/Opera/Samsung Internet)', () => {
    const nav = {
      userAgentData: {
        brands: [
          { brand: 'Not?A_Brand', version: '8' },
          { brand: 'Chromium', version: '141' },
          { brand: 'Microsoft Edge', version: '141' },
        ],
      },
    } as unknown as Navigator;
    expect(isChromiumEngine(nav)).toBe(true);
  });

  it('returns false for browsers with no userAgentData and a non-Chromium user agent (Safari, Firefox)', () => {
    expect(isChromiumEngine({} as Navigator)).toBe(false);
  });

  it.each([
    ['Chrome/Brave over http', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36'],
    ['Edge over http', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0'],
  ])('falls back to the user agent when userAgentData is hidden on insecure origins (%s)', (_name, userAgent) => {
    expect(isChromiumEngine({ userAgent } as Navigator)).toBe(true);
  });

  it.each([
    ['Firefox', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:140.0) Gecko/20100101 Firefox/140.0'],
    ['Safari', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15'],
    ['Chrome on iOS (WebKit)', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/141.0.0.0 Mobile/15E148 Safari/604.1'],
  ])('treats %s as non-Chromium when falling back to the user agent', (_name, userAgent) => {
    expect(isChromiumEngine({ userAgent } as Navigator)).toBe(false);
  });

  it('returns false when userAgentData exists but has no brands', () => {
    expect(isChromiumEngine({ userAgentData: {} } as unknown as Navigator)).toBe(false);
  });

  it('returns false when navigator is undefined', () => {
    expect(isChromiumEngine(undefined)).toBe(false);
  });
});

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

describe('pickGlassStrategy', () => {
  const capable = {
    disabled: false,
    reducedTransparency: false,
    forcedColors: false,
    backdropFilter: true,
    chromium: true,
  };

  it('uses live SVG refraction on Chromium', () => {
    expect(pickGlassStrategy(capable)).toBe('svg');
  });

  it('uses plain CSS glass on non-Chromium browsers, which cannot refract the live page', () => {
    expect(pickGlassStrategy({ ...capable, chromium: false })).toBe('css');
  });

  it('falls back to CSS glass when the kill switch is on', () => {
    expect(pickGlassStrategy({ ...capable, disabled: true })).toBe('css');
  });

  it('falls back to CSS glass for reduced-transparency or forced-colors users', () => {
    expect(pickGlassStrategy({ ...capable, reducedTransparency: true })).toBe('css');
    expect(pickGlassStrategy({ ...capable, forcedColors: true })).toBe('css');
  });

  it('falls back to CSS glass without backdrop-filter support', () => {
    expect(pickGlassStrategy({ ...capable, backdropFilter: false })).toBe('css');
  });
});
