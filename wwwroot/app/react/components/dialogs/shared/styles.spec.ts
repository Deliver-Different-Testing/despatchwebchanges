import {createAppTheme} from '../../../theme/muiTheme';
import {alpha} from '@mui/material/styles';
import {
    headerAccentColor,
    headerBadgeSx,
    headerChipSx,
    headerChromeSx,
    headerOnColor,
    headerSurfaceSx,
    type HeaderVariant,
} from './styles';

/**
 * The dialog/panel header is a solid brand/semantic fill (the variant's `main`)
 * with its own on-colour (`contrastText`) for text/icons — white-on-blue for
 * the US tenant, dark-on-gold for the amber tenant. A bold, flat bar (no
 * gradient).
 */

const VARIANTS: HeaderVariant[] = ['primary', 'error', 'warning', 'info', 'success'];

describe('headerSurfaceSx (solid header)', () => {
    it('is a solid fill of the variant colour with its on-colour text', () => {
        const theme = createAppTheme(true);
        for (const variant of VARIANTS) {
            const surface = headerSurfaceSx(theme, variant);
            expect(surface.backgroundColor).toBe(theme.palette[variant].main);
            expect(surface.color).toBe(theme.palette[variant].contrastText);
        }
        // flat, no gradient
        expect('background' in headerSurfaceSx(theme)).toBe(false);
    });

    it('uses Ink text on the cyan header fill for every tenant (single brand)', () => {
        expect(headerSurfaceSx(createAppTheme(true)).color).toBe('#0d0c2c');
        expect(headerSurfaceSx(createAppTheme(false)).color).toBe('#0d0c2c');
    });
});

describe('headerChromeSx (header container)', () => {
    it('carries the solid surface plus the standard padding and flex layout', () => {
        const theme = createAppTheme(true);
        const chrome = headerChromeSx(theme);
        expect(chrome.backgroundColor).toBe(theme.palette.primary.main);
        expect(chrome.color).toBe(theme.palette.primary.contrastText);
        expect(chrome.py).toBe(1.5);
        expect(chrome.px).toBe(3);
        expect(chrome.display).toBe('flex');
        expect(chrome.alignItems).toBe('center');
    });
});

describe('headerBadgeSx / headerChipSx (icon chip)', () => {
    it('is a translucent on-colour scrim with the on-colour glyph', () => {
        const theme = createAppTheme(true);
        const badge = headerBadgeSx(theme);
        expect(badge.bgcolor).toBe(alpha(theme.palette.primary.contrastText, 0.18));
        expect(badge.color).toBe(theme.palette.primary.contrastText);
    });

    it('chip defaults to 40px with a proportional glyph, scaling with size', () => {
        const theme = createAppTheme(true);
        const chip = headerChipSx(theme);
        expect(chip.width).toBe(40);
        expect(chip.color).toBe(theme.palette.primary.contrastText);
        expect((chip['& svg'] as { fontSize: number }).fontSize).toBe(22);
        expect((headerChipSx(theme, 'primary', 32)['& svg'] as { fontSize: number }).fontSize).toBe(18);
        expect((headerChipSx(theme, 'primary', 36)['& svg'] as { fontSize: number }).fontSize).toBe(20);
    });
});

describe('header on-colours', () => {
    it('close buttons and bare icons use the palette on-colour', () => {
        const blue = createAppTheme(true);
        const amber = createAppTheme(false);
        expect(headerOnColor(blue)).toBe(blue.palette.primary.contrastText);
        expect(headerAccentColor(blue)).toBe(blue.palette.primary.contrastText);
        expect(headerAccentColor(amber)).toBe(amber.palette.primary.contrastText);
    });
});
