import {glassClassNames} from '@deliver-different/glass';
import { isLiquidGlassSupported } from './glassSupport';

/** Frosted-panel class for floating map controls; undefined in a browser that can't render glass. */
export function useMapGlassClassName(): string | undefined {
  return isLiquidGlassSupported() ? `${glassClassNames.glass} ${glassClassNames.panel}` : undefined;
}
