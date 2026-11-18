import {glassClassNames} from '@deliver-different/glass';
import { useGlassAllowed } from './useGlassStrategy';

/** Frosted-panel class for floating map controls; undefined where glass is off (unsupported browser, high contrast). */
export function useMapGlassClassName(): string | undefined {
  return useGlassAllowed() ? `${glassClassNames.glass} ${glassClassNames.panel}` : undefined;
}
