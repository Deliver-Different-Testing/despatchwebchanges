import {generateRamp, hexToHsl, hslToHex, luminance, nearestPassing} from './colorMath';
import {contrastRatio} from './md3';

describe('colorMath', () => {
    it('round-trips hex through HSL', () => {
        for (const hex of ['#3bc7f4', '#f4c430', '#0d0c2c', '#ffffff', '#000000', '#808080']) {
            expect(hslToHex(hexToHsl(hex))).toBe(hex);
        }
    });

    it('measures relative luminance on the WCAG scale', () => {
        expect(luminance('#ffffff')).toBeCloseTo(1);
        expect(luminance('#000000')).toBeCloseTo(0);
    });

    describe('generateRamp', () => {
        it('returns ten shades with the seed at the primary index and lightness falling across the ramp', () => {
            const ramp = generateRamp('#2a4eff');
            expect(ramp).toHaveLength(10);
            expect(ramp[5]).toBe('#2a4eff');
            const lightness = ramp.map(hex => hexToHsl(hex).l);
            for (let i = 1; i < lightness.length; i++) {
                expect(lightness[i]).toBeLessThanOrEqual(lightness[i - 1] + 0.005);
            }
        });

        it('still spans light to dark for a pale seed', () => {
            const ramp = generateRamp('#f4c430');
            expect(luminance(ramp[0])).toBeGreaterThan(luminance(ramp[5]));
            expect(luminance(ramp[9])).toBeLessThan(0.1);
        });
    });

    describe('nearestPassing', () => {
        it('returns the colour unchanged when it already passes', () => {
            expect(nearestPassing('#0d0c2c', hex => contrastRatio(hex, '#ffffff') >= 4.5)).toBe('#0d0c2c');
        });

        it('shifts lightness until the check passes, keeping the hue', () => {
            const fixed = nearestPassing('#f4c430', hex => contrastRatio(hex, '#ffffff') >= 4.5)!;
            expect(contrastRatio(fixed, '#ffffff')).toBeGreaterThanOrEqual(4.5);
            expect(Math.abs(hexToHsl(fixed).h - hexToHsl('#f4c430').h)).toBeLessThan(3);
        });

        it('returns null when no lightness passes', () => {
            expect(nearestPassing('#808080', () => false)).toBeNull();
        });
    });
});
