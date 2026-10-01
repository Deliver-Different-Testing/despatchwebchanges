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

export function supportsBackdropFilter(): boolean {
  return typeof CSS !== 'undefined' && !!CSS.supports?.('backdrop-filter', 'blur(1px)');
}

/** Whether this browser can render Liquid Glass at all (Chromium with backdrop-filter). */
export function isLiquidGlassSupported(): boolean {
  return isChromiumEngine() && supportsBackdropFilter();
}
