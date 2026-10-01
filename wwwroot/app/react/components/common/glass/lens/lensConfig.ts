import type { GlassOptics } from './displacementProfile';
import type { HostGeometry } from './useHostGeometry';

export const LENS_OPTICS: GlassOptics = { thickness: 40, ior: 1.5 };
const MAX_BEZEL_PX = 24;

export function lensBezel({ width, height }: HostGeometry): number {
  return Math.min(MAX_BEZEL_PX, width / 2, height / 2);
}
