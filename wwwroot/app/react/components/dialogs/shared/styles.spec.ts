import {createAppTheme} from '../../../theme/muiTheme';
import {alpha} from '@mui/material/styles';
import {
    headerAccentColor,
    headerBadgeSx,
    headerChipSx,
    headerChromeSx,
    headerOnColor,
    headerOverlayColor,
    headerSurfaceSx,
    type HeaderVariant,
} from './styles';

/**
 * The dialog/panel header is a solid brand/semantic fill (the variant's `main`)
 * with its own on-colour (`contrastText`) for text/icons — dark Ink on the
 * DFRNT cyan. A bold, flat bar (no gradient).
 */

const VARIANTS: HeaderVariant[] = ['primary', 'error', 'warning', 'info', 'success'];

describe('headerSurfaceSx (solid header)', () => {
    it('is a solid fill of the variant colour with its on-colour text', () => {
        const theme = createAppTheme();
        for (const variant of VARIANTS) {
            const surface = headerSurfaceSx(theme, variant);
            expect(surface.backgroundColor).toBe(theme.palette[variant].main);
            expect(surface.color).toBe(theme.palette[variant].contrastText);
        }
        // flat, no gradient
        expect('background' in headerSurfaceSx(theme)).toBe(false);
    });

    it('uses Ink text on the cyan header fill', () => {
        expect(headerSurfaceSx(createAppTheme()).color).toBe('#0d0c2c');
    });
});

describe('headerChromeSx (header container)', () => {
    it('carries the solid surface plus the standard padding and flex layout', () => {
        const theme = createAppTheme();
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
        const theme = createAppTheme();
        const badge = headerBadgeSx(theme);
        expect(badge.bgcolor).toBe(alpha(theme.palette.primary.contrastText, 0.18));
        expect(badge.color).toBe(theme.palette.primary.contrastText);
    });

    it('chip defaults to 40px with a proportional glyph, scaling with size', () => {
        const theme = createAppTheme();
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
        const theme = createAppTheme();
        expect(headerOnColor(theme)).toBe(theme.palette.primary.contrastText);
        expect(headerAccentColor(theme)).toBe(theme.palette.primary.contrastText);
    });
});

/**
 * The 'surface' variant is the page card/panel header: a plain paper bar with
 * primary text and a divider keyline instead of a solid brand fill. Only the
 * icon chip keeps any brand colour. Dialogs never opt into it — the solid-fill
 * expectations above are the guard that they haven't moved.
 */
describe('surface variant (page card headers)', () => {
    it('is a paper fill with primary text and a divider keyline, not a brand fill', () => {
        const theme = createAppTheme();
        const surface = headerSurfaceSx(theme, 'surface');
        expect(surface.backgroundColor).toBe(theme.palette.background.paper);
        expect(surface.color).toBe(theme.palette.text.primary);
        expect(surface.borderBottom).toBe(`1px solid ${theme.palette.divider}`);
        expect(surface.backgroundColor).not.toBe(theme.palette.primary.main);
    });

    it('carries the keyline through the header chrome', () => {
        const theme = createAppTheme();
        const chrome = headerChromeSx(theme, 'surface');
        expect(chrome.backgroundColor).toBe(theme.palette.background.paper);
        expect(chrome.borderBottom).toBe(`1px solid ${theme.palette.divider}`);
        expect(chrome.display).toBe('flex');
    });

    it('tints the icon chip with the brand: a cyan wash under a legible cyan glyph', () => {
        const theme = createAppTheme();
        const badge = headerBadgeSx(theme, 'surface');
        expect(badge.bgcolor).toBe(alpha(theme.palette.primary.main, 0.16));
        // primary.main (#3bc7f4) fails contrast on white; the darker ramp step does not.
        expect(badge.color).toBe(theme.palette.primary.dark);
        expect(headerChipSx(theme, 'surface', 32).color).toBe(theme.palette.primary.dark);
    });

    it('gives bare glyphs the brand accent but keeps buttons and hovers neutral', () => {
        const theme = createAppTheme();
        expect(headerAccentColor(theme, 'surface')).toBe(theme.palette.primary.dark);
        expect(headerOnColor(theme, 'surface')).toBe(theme.palette.text.primary);
        expect(headerOverlayColor(theme, 0.08, 'surface'))
            .toBe(alpha(theme.palette.text.primary, 0.08));
    });
});
