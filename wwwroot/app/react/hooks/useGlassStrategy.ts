import { useMediaQuery } from '@mantine/hooks';
import { useLiquidGlassEnabled } from './useLiquidGlassPreference';

interface NavigatorUAData {
  brands?: Array<{ brand: string; version: string }>;
}

type NavigatorWithUAData = Navigator & { userAgentData?: NavigatorUAData };

/**
 * `navigator.userAgentData` only exists in Chromium engines (Chrome, Edge, Opera, Brave,
 * Samsung Internet) — Safari/Firefox/WebKit browsers don't expose it. Only Chromium can bend the
 * live page via `backdrop-filter: url()`, so this is the lens-vs-plain-CSS split. Falls back to the
 * user agent when `userAgentData` is unavailable (insecure origins).
 */
export function isChromiumEngine(nav: Navigator | undefined = typeof navigator === 'undefined' ? undefined : navigator): boolean {
  const uaData = (nav as NavigatorWithUAData | undefined)?.userAgentData;
  if (uaData) return uaData.brands?.some((brand) => brand.brand === 'Chromium') ?? false;
  // `userAgentData` is only exposed on secure origins; over plain http a Chromium browser would
  // otherwise be misread as Safari/Firefox and lose the lens. iOS Chromium builds (CriOS/EdgiOS)
  // are WebKit and don't carry the `Chrome/` token.
  return (nav?.userAgent ?? '').includes('Chrome/');
}

function supportsBackdropFilter(): boolean {
  return typeof CSS !== 'undefined' && !!CSS.supports?.('backdrop-filter', 'blur(1px)');
}

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
