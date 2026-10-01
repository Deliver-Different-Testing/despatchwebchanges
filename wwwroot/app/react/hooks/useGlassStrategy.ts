import { useMediaQuery } from '@mantine/hooks';
import { isChromiumEngine, supportsBackdropFilter } from './glassSupport';
import { useLiquidGlassEnabled } from './useLiquidGlassPreference';

export { isChromiumEngine, isLiquidGlassSupported } from './glassSupport';

export type GlassStrategy = 'svg' | 'css';

export interface GlassCapabilities {
  disabled: boolean;
  reducedTransparency: boolean;
  forcedColors: boolean;
  backdropFilter: boolean;
  chromium: boolean;
}

/**
 * How a glass surface should be rendered:
 * - `svg`: live refraction through `backdrop-filter: url(#displacement)` — Chromium only.
 * - `css`: the plain `.glass` blur, no lens (non-Chromium, user toggle off, reduced-transparency,
 *   forced-colors, no backdrop-filter). There is deliberately no page-capture fallback: it took
 *   seconds on the dispatch page.
 */
export function pickGlassStrategy(caps: GlassCapabilities): GlassStrategy {
  if (caps.disabled || caps.reducedTransparency || caps.forcedColors || !caps.backdropFilter) return 'css';
  return caps.chromium ? 'svg' : 'css';
}

function useGlassCapabilities(): GlassCapabilities {
  const enabled = useLiquidGlassEnabled();
  const reducedTransparency = useMediaQuery('(prefers-reduced-transparency: reduce)', false, {
    getInitialValueInEffect: false,
  });
  const forcedColors = useMediaQuery('(forced-colors: active)', false, { getInitialValueInEffect: false });

  return {
    disabled: !enabled,
    reducedTransparency,
    forcedColors,
    backdropFilter: supportsBackdropFilter(),
    chromium: isChromiumEngine(),
  };
}

export function useGlassStrategy(): GlassStrategy {
  return pickGlassStrategy(useGlassCapabilities());
}

/**
 * Whether any glass may render (toggle on, no reduced-transparency/forced-colors, backdrop-filter
 * supported). Decided in JS rather than CSS media queries because Safari ignores
 * `prefers-reduced-transparency`, and a negated unknown media feature would drop glass there.
 */
export function useGlassAllowed(): boolean {
  const caps = useGlassCapabilities();
  return !caps.disabled && !caps.reducedTransparency && !caps.forcedColors && caps.backdropFilter;
}

/** Whether the live lens is available; otherwise the CSS `.glass` applies. */
export function useLiquidGlassSupport(): boolean {
  return useGlassStrategy() !== 'css';
}
