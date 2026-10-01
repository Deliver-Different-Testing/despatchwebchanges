import { renderDisplacementMap } from './displacementMap';

const base = { width: 100, height: 61, radius: 30, bezel: 20, optics: { thickness: 40, ior: 1.5 } };

function pixel(map: ReturnType<typeof renderDisplacementMap>, x: number, y: number) {
  const i = (y * map.width + x) * 4;
  return { r: map.data[i], g: map.data[i + 1], b: map.data[i + 2], a: map.data[i + 3] };
}

describe('renderDisplacementMap', () => {
  it('produces one RGBA pixel per map cell', () => {
    const map = renderDisplacementMap(base);
    expect(map.data).toHaveLength(base.width * base.height * 4);
    expect(map.max).toBeGreaterThan(0);
  });

  it('is neutral (128) at the flat centre of the glass', () => {
    const { r, g } = pixel(renderDisplacementMap(base), 50, 30);
    expect(r).toBe(128);
    expect(g).toBe(128);
  });

  it('pulls the left edge towards the centre (+x) and leaves y neutral', () => {
    const { r, g } = pixel(renderDisplacementMap(base), 2, 30);
    expect(r).toBeGreaterThan(128);
    expect(g).toBe(128);
  });

  it('pulls the right edge towards the centre (-x)', () => {
    expect(pixel(renderDisplacementMap(base), 97, 30).r).toBeLessThan(128);
  });

  it('pulls the top edge towards the centre (+y) and the bottom edge the other way', () => {
    const map = renderDisplacementMap(base);
    expect(pixel(map, 50, 2).g).toBeGreaterThan(128);
    expect(pixel(map, 50, 58).g).toBeLessThan(128);
  });

  it('is neutral outside the rounded corner', () => {
    const { r, g } = pixel(renderDisplacementMap(base), 0, 0);
    expect(r).toBe(128);
    expect(g).toBe(128);
  });

  it('is fully opaque with neutral blue everywhere', () => {
    const { b, a } = pixel(renderDisplacementMap(base), 2, 30);
    expect(b).toBe(128);
    expect(a).toBe(255);
  });

  it('clamps a bezel wider than half the smallest side', () => {
    expect(() => renderDisplacementMap({ ...base, bezel: 500 })).not.toThrow();
  });

  it('rejects non-positive sizes', () => {
    expect(() => renderDisplacementMap({ ...base, width: 0 })).toThrow();
  });

  it('keeps the rasterised output byte-identical (golden checksums)', () => {
    const checksum = (d: Uint8ClampedArray) => {
      let s = 0;
      for (let i = 0; i < d.length; i++) s = (s * 31 + d[i]!) >>> 0;
      return s;
    };
    const wide = { width: 300, height: 120, radius: 12, bezel: 24, optics: { thickness: 40, ior: 1.5 } };
    expect(checksum(renderDisplacementMap(base).data)).toBe(1174922784);
    expect(checksum(renderDisplacementMap(wide).data)).toBe(376254696);
  });
});
