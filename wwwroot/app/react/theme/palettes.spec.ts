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

    it('urgentPrimary resolves to the same single-brand cyan palette', () => {
        expect(urgentPrimaryMdPalette['500']).toBe(urgentPrimaryPalette[500]);
        expect(urgentPrimaryMdPalette['700']).toBe(urgentPrimaryPalette[700]);
        // Single brand: the retired amber tenant now equals the cyan primary.
        expect(urgentPrimaryPalette[500]).toBe(dfrntPrimaryPalette[500]);
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

    it('the cyan primary palettes default to dark (Ink) text — cyan is a light hue', () => {
        expect(professionalPrimaryMdPalette.contrastDefaultColor).toBe('dark');
        expect(urgentPrimaryMdPalette.contrastDefaultColor).toBe('dark');
    });
});
