import {
  useGlassAllowed as usePackageGlassAllowed,
  useGlassStrategy as usePackageGlassStrategy,
  type GlassStrategy,
} from '@deliver-different/glass';
import { useLiquidGlassEnabled } from './useLiquidGlassPreference';

export { isChromiumEngine, isLiquidGlassSupported, pickGlassStrategy } from '@deliver-different/glass';
export type { GlassCapabilities, GlassStrategy } from '@deliver-different/glass';

/**
 * The package decides from the browser and `GlassProvider`; despatchweb additionally gates on the
 * per-user preference, so these stay correct even outside a provider.
 */
export function useGlassStrategy(): GlassStrategy {
  const enabled = useLiquidGlassEnabled();
  const strategy = usePackageGlassStrategy();
  return enabled ? strategy : 'css';
}

export function useGlassAllowed(): boolean {
  const enabled = useLiquidGlassEnabled();
  const allowed = usePackageGlassAllowed();
  return enabled && allowed;
}

/** Whether the live lens is available; otherwise the CSS glass applies. */
export function useLiquidGlassSupport(): boolean {
  return useGlassStrategy() !== 'css';
}
