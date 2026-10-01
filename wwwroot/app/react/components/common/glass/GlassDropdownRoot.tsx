import { useEffect, useRef, useState, type ComponentPropsWithRef } from 'react';
import { useMergedRef } from '@mantine/hooks';
import { useGlassStrategy } from '../../../hooks/useGlassStrategy';
import { useLiquidGlassEnabled } from '../../../hooks/useLiquidGlassPreference';
import { SvgBackdropLens } from './lens/SvgBackdropLens';
import glassClasses from '../../../theme/glass.module.css';

/** Outlasts Mantine's popover open transition, so the lens never has to animate. */
export const LENS_MOUNT_DELAY_MS = 250;

type GlassDropdownRootProps = ComponentPropsWithRef<'div'>;

/**
 * Root-element override for Mantine's `PopoverDropdown` (also used by `MenuDropdown`, since
 * Menu renders through Popover internally — see theme.ts's `PopoverDropdown` defaultProps).
 * Renders a plain div identical to Mantine's own Box unless the dropdown carries the `.glass`
 * marker class (set by the Menu/Popover `classNames.dropdown` overrides in theme.ts) AND the
 * browser can refract (live SVG on Chromium, page snapshot on Safari/Firefox — see
 * `useGlassStrategy`). The lens only mounts once the open transition has settled: until then the
 * plain CSS glass shows, because animating a backdrop SVG filter (CPU-rasterised in Chromium)
 * mid-open is what made dropdowns slow to appear. `Select`/`Autocomplete`/`Combobox` dropdowns also render through `PopoverDropdown` but use a different static
 * selector, so they never carry the `.glass` class and are unaffected either way.
 */
export function GlassDropdownRoot({ ref, className, children, ...rest }: GlassDropdownRootProps) {
  const localRef = useRef<HTMLDivElement>(null);
  const mergedRef = useMergedRef(ref, localRef);
  const strategy = useGlassStrategy();
  const glassEnabled = useLiquidGlassEnabled();
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(true), LENS_MOUNT_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);
  const glassMarker = glassClasses.glass;
  const isGlass =
    typeof className === 'string' && typeof glassMarker === 'string' && className.split(' ').includes(glassMarker);

  if (!glassEnabled && isGlass) {
    // Opt-in feature: with it off, strip the glass material so the dropdown is a plain surface.
    const plain = className
      .split(' ')
      .filter((name) => name !== glassClasses.glass && name !== glassClasses.panel)
      .join(' ');
    return (
      <div ref={mergedRef} className={plain} {...rest}>
        {children}
      </div>
    );
  }

  if (!isGlass || strategy === 'css' || !settled) {
    return (
      <div ref={mergedRef} className={className} {...rest}>
        {children}
      </div>
    );
  }

  return (
    <div ref={mergedRef} className={className} data-liquid-glass={strategy} {...rest}>
      <SvgBackdropLens hostRef={localRef} />
      {children}
    </div>
  );
}
