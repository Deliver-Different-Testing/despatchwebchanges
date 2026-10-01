import {
  buildDisplacementProfile,
  encodeDisplacementChannel,
  type GlassOptics,
} from './displacementProfile';

export interface DisplacementMapOptions {
  width: number;
  height: number;
  /** Corner radius of the glass in px. */
  radius: number;
  /** Width in px of the refracting rim; the interior further in than this is flat glass. */
  bezel: number;
  optics: GlassOptics;
}

export interface DisplacementMap {
  /** RGBA. R/G encode the x/y sampling offset (128 = none), B is neutral, A is opaque. */
  data: Uint8ClampedArray<ArrayBuffer>;
  width: number;
  height: number;
  /** Displacement (px) that a fully saturated channel represents. */
  max: number;
}

const PROFILE_SAMPLES = 128;

/** RGBA bytes [n, n, n, 255] as one little-endian word, so a whole map can be filled in one call. */
function packNeutral(n: number): number {
  return ((255 << 24) | (n << 16) | (n << 8) | n) >>> 0;
}

function profileAt(samples: number[], x: number): number {
  const position = Math.min(1, Math.max(0, x)) * (samples.length - 1);
  const lower = Math.floor(position);
  const upper = Math.min(samples.length - 1, lower + 1);
  const low = samples[lower] ?? 0;
  const high = samples[upper] ?? low;
  return low + (high - low) * (position - lower);
}

/**
 * Rasterises the lens displacement for a rounded rectangle. Each pixel near the rim points
 * inward (towards where the ray entered the glass), scaled by the refraction profile.
 * Consumed by the SVG `feDisplacementMap` (Chromium) and `remapSnapshot` (Safari/Firefox).
 */
export function renderDisplacementMap({ width, height, radius, bezel, optics }: DisplacementMapOptions): DisplacementMap {
  if (width <= 0 || height <= 0) throw new RangeError('width and height must be positive');

  const halfW = width / 2;
  const halfH = height / 2;
  const cornerRadius = Math.min(radius, halfW, halfH);
  const rim = Math.min(bezel, halfW, halfH);
  const { samples, max } = buildDisplacementProfile(optics, PROFILE_SAMPLES);
  const data = new Uint8ClampedArray(width * height * 4);
  const neutral = encodeDisplacementChannel(0, max);
  new Uint32Array(data.buffer).fill(packNeutral(neutral));

  // Only the rim refracts, so the (much larger) flat interior keeps the neutral fill instead of
  // being evaluated. Straight sides need a strip `rim` wide; the corners curve away from the
  // bounding box, so their rim reaches up to `cornerRadius + rim` in from the box.
  const edge = Math.ceil(rim) + 1;
  const corner = Math.ceil(cornerRadius + rim) + 1;
  const writePixel = (px: number, py: number) => {
    const i = (py * width + px) * 4;
    const cx = px + 0.5 - halfW;
    const cy = py + 0.5 - halfH;
    const qx = Math.abs(cx) - (halfW - cornerRadius);
    const qy = Math.abs(cy) - (halfH - cornerRadius);
    const outsideLength = Math.hypot(Math.max(qx, 0), Math.max(qy, 0));
    const signedDistance = outsideLength + Math.min(Math.max(qx, qy), 0) - cornerRadius;
    const depth = -signedDistance;
    if (depth <= 0 || depth >= rim) return;

    // Outward normal of the rounded-rectangle edge.
    let nx: number;
    let ny: number;
    if (qx > 0 && qy > 0) {
      nx = (qx / outsideLength) * Math.sign(cx);
      ny = (qy / outsideLength) * Math.sign(cy);
    } else if (qx > qy) {
      nx = Math.sign(cx);
      ny = 0;
    } else {
      nx = 0;
      ny = Math.sign(cy);
    }
    const displacement = profileAt(samples, depth / rim);
    data[i] = encodeDisplacementChannel(-nx * displacement, max);
    data[i + 1] = encodeDisplacementChannel(-ny * displacement, max);
  };

  for (let py = 0; py < height; py++) {
    const sideSpan = py < corner || py >= height - corner ? corner : edge;
    if (py < edge || py >= height - edge || sideSpan * 2 >= width) {
      for (let px = 0; px < width; px++) writePixel(px, py);
    } else {
      for (let px = 0; px < sideSpan; px++) writePixel(px, py);
      for (let px = width - sideSpan; px < width; px++) writePixel(px, py);
    }
  }

  return { data, width, height, max };
}
