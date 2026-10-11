import {glassClassNames} from '@dfrnt/glass';
import { useLiquidGlassEnabled } from './useLiquidGlassPreference';

/** Frosted-panel class for floating map controls; undefined while Liquid Glass is off. */
export function useMapGlassClassName(): string | undefined {
  const enabled = useLiquidGlassEnabled();
  return enabled ? `${glassClassNames.glass} ${glassClassNames.panel}` : undefined;
}
