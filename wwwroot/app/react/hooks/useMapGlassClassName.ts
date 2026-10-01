import glassClasses from '../theme/glass.module.css';
import { useLiquidGlassEnabled } from './useLiquidGlassPreference';

/** Frosted-panel class for floating map controls; undefined while Liquid Glass is off. */
export function useMapGlassClassName(): string | undefined {
  const enabled = useLiquidGlassEnabled();
  return enabled ? `${glassClasses.glass} ${glassClasses.panel}` : undefined;
}
