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
    it('professionalPrimary matches the shared blue palette', () => {
        expect(professionalPrimaryMdPalette['500']).toBe(dfrntPrimaryPalette[500]);
        expect(professionalPrimaryMdPalette['700']).toBe(dfrntPrimaryPalette[700]);
        expect(professionalPrimaryMdPalette['A700']).toBe(dfrntPrimaryPalette.A700);
    });

    it('urgentPrimary matches the shared amber palette', () => {
        expect(urgentPrimaryMdPalette['500']).toBe(urgentPrimaryPalette[500]);
        expect(urgentPrimaryMdPalette['700']).toBe(urgentPrimaryPalette[700]);
    });

    it('accent matches the shared warm-gray ramp and keeps its A-keys', () => {
        expect(accentMdPalette['500']).toBe(accentPalette[500]);
        expect(accentMdPalette['600']).toBe(accentPalette[600]);
        expect(accentMdPalette['A100']).toBe('#ffffff');
    });

    it('each Material palette carries contrast metadata', () => {
        for (const palette of [professionalPrimaryMdPalette, urgentPrimaryMdPalette, accentMdPalette]) {
            expect(palette.contrastDefaultColor).toBe('light');
            expect(Array.isArray(palette.contrastDarkColors)).toBe(true);
            expect(Array.isArray(palette.contrastLightColors)).toBe(true);
        }
    });
});
