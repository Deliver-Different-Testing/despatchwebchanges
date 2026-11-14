import {
  useGlassAllowed as usePackageGlassAllowed,
  useGlassStrategy as usePackageGlassStrategy,
  type GlassStrategy,
} from '@deliver-different/glass';
import { isLiquidGlassSupported } from './glassSupport';

export { isChromiumEngine, isLiquidGlassSupported, pickGlassStrategy } from '@deliver-different/glass';
export type { GlassCapabilities, GlassStrategy } from '@deliver-different/glass';

/**
 * The package decides from the browser and `GlassProvider`; despatchweb additionally gates on
 * browser support, so these stay correct even outside a provider.
 */
export function useGlassStrategy(): GlassStrategy {
  const strategy = usePackageGlassStrategy();
  return isLiquidGlassSupported() ? strategy : 'css';
}

export function useGlassAllowed(): boolean {
  const allowed = usePackageGlassAllowed();
  return isLiquidGlassSupported() && allowed;
}

/** Whether the live lens is available; otherwise the CSS glass applies. */
export function useLiquidGlassSupport(): boolean {
  return useGlassStrategy() !== 'css';
}
