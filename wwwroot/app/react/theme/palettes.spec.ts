import {
    dfrntPrimaryPalette,
    urgentPrimaryPalette,
    accentPalette,
} from './palettes';
import {
    professionalPrimaryMdPalette,
    urgentPrimaryMdPalette,
    accentMdPalette,
} from '../../materialTheme';

/**
 * The AngularJS Material palettes must be built from the same shared hex
 * constants the MUI theme uses. These tests fail if the two ever diverge.
 */
describe('AngularJS Material palettes share the palette source of truth', () => {
    it('professionalPrimary matches the shared cyan palette', () => {
        expect(professionalPrimaryMdPalette['500']).toBe(dfrntPrimaryPalette[500]);
        expect(professionalPrimaryMdPalette['700']).toBe(dfrntPrimaryPalette[700]);
        expect(professionalPrimaryMdPalette['A700']).toBe(dfrntPrimaryPalette.A700);
    });

    it('urgentPrimary matches the shared amber-gold palette, distinct from cyan', () => {
        expect(urgentPrimaryMdPalette['500']).toBe(urgentPrimaryPalette[500]);
        expect(urgentPrimaryMdPalette['700']).toBe(urgentPrimaryPalette[700]);
        expect(urgentPrimaryPalette[500]).toBe('#f4c430');
        // Non-US tenants get a genuinely different brand from the US cyan primary.
        expect(urgentPrimaryPalette[500]).not.toBe(dfrntPrimaryPalette[500]);
    });

    it('accent matches the shared warm-gray ramp and keeps its A-keys', () => {
        expect(accentMdPalette['500']).toBe(accentPalette[500]);
        expect(accentMdPalette['600']).toBe(accentPalette[600]);
        expect(accentMdPalette['A100']).toBe('#ffffff');
    });

    it('each Material palette carries contrast metadata', () => {
        for (const palette of [professionalPrimaryMdPalette, urgentPrimaryMdPalette, accentMdPalette]) {
            expect(['light', 'dark']).toContain(palette.contrastDefaultColor);
            expect(Array.isArray(palette.contrastDarkColors)).toBe(true);
            expect(Array.isArray(palette.contrastLightColors)).toBe(true);
        }
    });

    it('both primary palettes default to dark (Ink) text — cyan and gold are light hues', () => {
        expect(professionalPrimaryMdPalette.contrastDefaultColor).toBe('dark');
        expect(urgentPrimaryMdPalette.contrastDefaultColor).toBe('dark');
        // Gold stays light across its whole ramp, so no shade takes white text.
        expect(urgentPrimaryMdPalette.contrastLightColors).toHaveLength(0);
    });
});
