/**
 * Refraction maths for the liquid-glass lens (after kube.io, "Liquid Glass in the Browser").
 * The glass edge is a convex squircle bezel; a vertical ray hitting the sloped surface is
 * bent by Snell's law, and the sideways shift it accumulates crossing the glass is the
 * displacement. Pure functions only — the strategies (SVG map, WebGL shader) consume them.
 */

export interface GlassOptics {
  /** Glass thickness in px — scales how far rays travel sideways. */
  thickness: number;
  /** Index of refraction of the glass (air = 1). */
  ior: number;
}

export interface DisplacementProfile {
  /** Displacement magnitude (px) sampled from the glass edge (index 0) towards the centre. */
  samples: number[];
  /** Largest absolute sample — the range used to encode a displacement map. */
  max: number;
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/** Surface height (0 at the edge → 1 at the end of the bezel) of a convex squircle. */
export function convexSquircleHeight(x: number): number {
  const t = clamp01(x);
  return Math.pow(1 - Math.pow(1 - t, 4), 1 / 4);
}

function convexSquircleSlope(x: number): number {
  const t = clamp01(x);
  return Math.pow(1 - t, 3) * Math.pow(1 - Math.pow(1 - t, 4), -3 / 4);
}

/** Sideways shift (px) of a vertical ray entering the glass at normalised bezel position `x`. */
export function refractedDisplacement(x: number, { thickness, ior }: GlassOptics): number {
  const incidence = Math.atan(convexSquircleSlope(x));
  const transmitted = Math.asin(Math.sin(incidence) / ior);
  return convexSquircleHeight(x) * thickness * Math.tan(incidence - transmitted);
}

export function buildDisplacementProfile(optics: GlassOptics, sampleCount: number): DisplacementProfile {
  if (sampleCount < 2) throw new RangeError('sampleCount must be at least 2');
  const samples = Array.from({ length: sampleCount }, (_, i) =>
    refractedDisplacement(i / (sampleCount - 1), optics),
  );
  return { samples, max: Math.max(...samples.map(Math.abs)) };
}

/** Encodes a signed displacement into a 0–255 map channel where 128 means "no shift". */
export function encodeDisplacementChannel(value: number, max: number): number {
  if (max <= 0) return 128;
  const normalised = Math.min(1, Math.max(-1, value / max));
  return Math.round(127.5 + normalised * 127.5);
}
