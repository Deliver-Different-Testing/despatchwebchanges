import {
  buildDisplacementProfile,
  convexSquircleHeight,
  encodeDisplacementChannel,
  refractedDisplacement,
} from './displacementProfile';

describe('convexSquircleHeight', () => {
  it('is 0 at the glass edge and 1 at the end of the bezel', () => {
    expect(convexSquircleHeight(0)).toBeCloseTo(0, 6);
    expect(convexSquircleHeight(1)).toBeCloseTo(1, 6);
  });

  it('rises monotonically across the bezel', () => {
    let previous = -1;
    for (let i = 0; i <= 20; i++) {
      const h = convexSquircleHeight(i / 20);
      expect(h).toBeGreaterThanOrEqual(previous);
      previous = h;
    }
  });
});

describe('refractedDisplacement', () => {
  const optics = { thickness: 40, ior: 1.5 };

  it('is zero everywhere when the glass has the same index as air', () => {
    for (let i = 0; i <= 10; i++) {
      expect(refractedDisplacement(i / 10, { ...optics, ior: 1 })).toBeCloseTo(0, 6);
    }
  });

  it('is zero on the flat centre of the glass', () => {
    expect(refractedDisplacement(1, optics)).toBeCloseTo(0, 6);
  });

  it('bends light inside the bezel', () => {
    expect(refractedDisplacement(0.3, optics)).toBeGreaterThan(0);
  });

  it('bends more with a higher index of refraction', () => {
    expect(refractedDisplacement(0.3, { ...optics, ior: 1.8 })).toBeGreaterThan(
      refractedDisplacement(0.3, { ...optics, ior: 1.3 }),
    );
  });
});

describe('buildDisplacementProfile', () => {
  it('returns one sample per step from edge to centre and the peak magnitude', () => {
    const { samples, max } = buildDisplacementProfile({ thickness: 40, ior: 1.5 }, 64);
    expect(samples).toHaveLength(64);
    expect(max).toBeCloseTo(Math.max(...samples.map(Math.abs)), 9);
    expect(max).toBeGreaterThan(0);
  });

  it('rejects fewer than two samples', () => {
    expect(() => buildDisplacementProfile({ thickness: 40, ior: 1.5 }, 1)).toThrow();
  });
});

describe('encodeDisplacementChannel', () => {
  it('maps zero displacement to the neutral 128', () => {
    expect(encodeDisplacementChannel(0, 10)).toBe(128);
  });

  it('maps +max to 255 and -max to 0', () => {
    expect(encodeDisplacementChannel(10, 10)).toBe(255);
    expect(encodeDisplacementChannel(-10, 10)).toBe(0);
  });

  it('stays neutral when there is no displacement range', () => {
    expect(encodeDisplacementChannel(5, 0)).toBe(128);
  });

  it('clamps out-of-range values', () => {
    expect(encodeDisplacementChannel(99, 10)).toBe(255);
    expect(encodeDisplacementChannel(-99, 10)).toBe(0);
  });
});
