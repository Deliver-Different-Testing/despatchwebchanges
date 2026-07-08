import * as fs from 'fs';
import * as path from 'path';
import {
    createAppTheme,
    dfrntPrimaryPalette,
    urgentPrimaryPalette,
    accentPalette,
    tokens,
    sharedColors,
    bodyFontFamily,
    displayFontFamily,
} from './muiTheme';
import {DialogTransition} from './DialogTransition';

// Read the LESS variables file once for all sync tests
const lessPath = path.resolve(__dirname, '../../../css/variables.less');
const lessContent = fs.readFileSync(lessPath, 'utf-8');

/** Extract a LESS variable value like `@foo: #abc123;` → `#abc123` */
function getLessVar(name: string): string {
    const re = new RegExp(`${name}:\\s*([^;]+);`);
    const match = lessContent.match(re);
    if (!match) throw new Error(`LESS variable ${name} not found`);
    return match[1].trim();
}

describe('MUI theme palettes', () => {
    it('US theme uses blue primary', () => {
        const theme = createAppTheme(true);
        expect(theme.palette.primary.main).toBe('#2196f3');
    });

    it('NZ theme uses warm amber primary', () => {
        const theme = createAppTheme(false);
        expect(theme.palette.primary.main).toBe('#f4c430');
    });

    it('US theme has white contrast text on primary', () => {
        const theme = createAppTheme(true);
        expect(theme.palette.primary.contrastText).toBe('#FFFFFF');
    });

    it('NZ theme has dark contrast text on primary', () => {
        const theme = createAppTheme(false);
        expect(theme.palette.primary.contrastText).toBe('rgba(0, 0, 0, 0.87)');
    });

    it('both themes share the same secondary (accent) palette', () => {
        const us = createAppTheme(true);
        const nz = createAppTheme(false);
        expect(us.palette.secondary.main).toBe(accentPalette[500]);
        expect(nz.palette.secondary.main).toBe(accentPalette[500]);
    });

    it('both themes share the same semantic colors', () => {
        const theme = createAppTheme(true);
        expect(theme.palette.success.main).toBe('#4CAF50');
        expect(theme.palette.warning.main).toBe('#FF9800');
        expect(theme.palette.error.main).toBe('#F44336');
        expect(theme.palette.info.main).toBe('#2196F3');
    });

    it('background colors match expected values', () => {
        const theme = createAppTheme(true);
        expect(theme.palette.background.default).toBe('#FAFAFA');
        expect(theme.palette.background.paper).toBe('#FFFFFF');
    });

    it('table cells use tabular figures so numeric columns align', () => {
        const theme = createAppTheme(true);
        const root = theme.components?.MuiTableCell?.styleOverrides?.root as
            | {fontVariantNumeric?: string}
            | undefined;
        expect(root?.fontVariantNumeric).toBe('tabular-nums');
    });

    it('caps the Select options menu height so long lists scroll instead of filling the screen', () => {
        const theme = createAppTheme(true);
        const menuProps = theme.components?.MuiSelect?.defaultProps?.MenuProps as
            | {slotProps?: {paper?: {sx?: {maxHeight?: number}}}}
            | undefined;
        expect(menuProps?.slotProps?.paper?.sx?.maxHeight).toBe(320);
    });

    it('body text uses Plus Jakarta Sans', () => {
        const theme = createAppTheme(true);
        expect(theme.typography.fontFamily).toBe(bodyFontFamily);
        expect(theme.typography.body1.fontFamily ?? theme.typography.fontFamily).toContain('Plus Jakarta Sans');
    });

    it('headings use the Plus Jakarta Sans face', () => {
        const theme = createAppTheme(true);
        expect(displayFontFamily).toBe(bodyFontFamily);
        expect(theme.typography.h1.fontFamily).toBe(displayFontFamily);
        expect(theme.typography.h2.fontFamily).toBe(displayFontFamily);
        expect(theme.typography.h3.fontFamily).toBe(displayFontFamily);
        expect(theme.typography.h4.fontFamily).toBe(displayFontFamily);
    });

    it('secondary text is dark enough to clear WCAG AA on the surface', () => {
        // rgba(0,0,0,0.54) (#767676) came in at 4.35:1 on #FAFAFA; 0.6 clears 4.5:1.
        const theme = createAppTheme(true);
        expect(theme.palette.text.secondary).toBe('rgba(0, 0, 0, 0.6)');
    });
});

describe('MD3 typography role variants', () => {
    const roles = [
        'displayLarge', 'displayMedium', 'displaySmall',
        'headlineLarge', 'headlineMedium', 'headlineSmall',
        'titleLarge', 'titleMedium', 'titleSmall',
        'bodyLarge', 'bodyMedium', 'bodySmall',
        'labelLarge', 'labelMedium', 'labelSmall',
    ] as const;

    it('exposes all 15 MD3 role variants with a size and family', () => {
        const theme = createAppTheme(true);
        for (const role of roles) {
            const variant = theme.typography[role] as {fontSize?: string; fontFamily?: string};
            expect(variant?.fontSize).toBeTruthy();
            expect(variant?.fontFamily).toBeTruthy();
        }
    });

    it('carries display and body roles on the Plus Jakarta Sans face', () => {
        const theme = createAppTheme(true);
        expect(theme.typography.displayLarge.fontFamily).toBe(displayFontFamily);
        expect(theme.typography.headlineMedium.fontFamily).toBe(displayFontFamily);
        expect(theme.typography.titleLarge.fontFamily).toBe(displayFontFamily);
        expect(theme.typography.bodyMedium.fontFamily).toBe(bodyFontFamily);
        expect(theme.typography.labelLarge.fontFamily).toBe(bodyFontFamily);
    });

    it('keeps the classic h1–h6 variants for back-compat', () => {
        const theme = createAppTheme(true);
        expect(theme.typography.h1.fontSize).toBeTruthy();
        expect(theme.typography.h6.fontSize).toBeTruthy();
    });

    it('maps role variants onto semantic elements', () => {
        const theme = createAppTheme(true);
        const mapping = theme.components?.MuiTypography?.defaultProps?.variantMapping as
            | Record<string, string>
            | undefined;
        expect(mapping?.displayLarge).toBe('h1');
        expect(mapping?.titleMedium).toBe('h5');
        expect(mapping?.bodyMedium).toBe('p');
        expect(mapping?.labelLarge).toBe('span');
    });
});

describe('MUI theme accessibility', () => {
    it('default icon buttons clear a ~44px hit target, with a compact small size', () => {
        const theme = createAppTheme(true);
        const overrides = theme.components?.MuiIconButton?.styleOverrides;
        const root = overrides?.root as { minWidth?: number; minHeight?: number } | undefined;
        const small = overrides?.sizeSmall as { minWidth?: number; minHeight?: number } | undefined;
        expect(root?.minWidth).toBe(44);
        expect(root?.minHeight).toBe(44);
        expect(small?.minWidth).toBe(32);
        expect(small?.minHeight).toBe(32);
    });

    it('honours prefers-reduced-motion by disabling smooth scroll', () => {
        const theme = createAppTheme(true);
        const overrides = theme.components?.MuiCssBaseline?.styleOverrides as
            | Record<string, unknown>
            | undefined;
        const reduced = overrides?.['@media (prefers-reduced-motion: reduce)'] as
            | { html?: { scrollBehavior?: string } }
            | undefined;
        expect(reduced?.html?.scrollBehavior).toBe('auto');
    });

    it('uses the motion-accessible DialogTransition for dialogs', () => {
        const theme = createAppTheme(true);
        const slots = theme.components?.MuiDialog?.defaultProps?.slots as
            | { transition?: unknown }
            | undefined;
        // The adaptive transition (Grow, or Fade under reduced motion) rather
        // than a hardcoded Grow.
        expect(slots?.transition).toBe(DialogTransition);
    });
});

describe('MUI ↔ LESS variable sync', () => {
    describe('primary colors', () => {
        it('@primary-blue matches MUI US primary', () => {
            expect(getLessVar('@primary-blue')).toBe(dfrntPrimaryPalette[500]);
        });

        it('@primary-color matches MUI US primary', () => {
            expect(getLessVar('@primary-color')).toBe(dfrntPrimaryPalette[500]);
        });

        it('@theme-us-primary matches MUI US primary', () => {
            expect(getLessVar('@theme-us-primary')).toBe(dfrntPrimaryPalette[500]);
        });
    });

    describe('NZ/non-US colors', () => {
        it('@theme-nz-primary matches MUI urgent palette 500', () => {
            expect(getLessVar('@theme-nz-primary')).toBe(urgentPrimaryPalette[500]);
        });

        it('@nz-primary matches MUI urgent palette 500', () => {
            expect(getLessVar('@nz-primary')).toBe(urgentPrimaryPalette[500]);
        });

        it('@nz-primary-dark matches MUI urgent palette 700', () => {
            expect(getLessVar('@nz-primary-dark')).toBe(urgentPrimaryPalette[700]);
        });
    });

    describe('semantic colors', () => {
        it('@error-red matches MUI error.main', () => {
            expect(getLessVar('@error-red')).toBe(sharedColors.error.main);
        });

        it('@primary-green matches MUI success.main', () => {
            expect(getLessVar('@primary-green')).toBe(sharedColors.success.main);
        });

        it('@primary-warning matches MUI warning.main', () => {
            expect(getLessVar('@primary-warning')).toBe(sharedColors.warning.main);
        });
    });

    describe('surface and background', () => {
        it('@main-background-color matches MUI surface.default', () => {
            expect(getLessVar('@main-background-color').toUpperCase())
                .toBe(sharedColors.surface.default);
        });

        it('@card-background matches MUI surface.paper', () => {
            expect(getLessVar('@card-background')).toBe(sharedColors.surface.paper.toLowerCase());
        });
    });

    describe('interactive states', () => {
        it('@hover-color uses neutral rgba(0,0,0) base', () => {
            expect(getLessVar('@hover-color')).toBe('rgba(0, 0, 0, 0.04)');
        });

        it('@active-color uses neutral rgba(0,0,0) base', () => {
            expect(getLessVar('@active-color')).toBe('rgba(0, 0, 0, 0.12)');
        });
    });

    describe('design tokens', () => {
        it('@radius-sm matches MUI tokens.radius.sm', () => {
            expect(getLessVar('@radius-sm')).toBe(`${tokens.radius.sm}px`);
        });

        it('@radius-md matches MUI tokens.radius.md', () => {
            expect(getLessVar('@radius-md')).toBe(`${tokens.radius.md}px`);
        });

        it('@radius-lg matches MUI tokens.radius.lg', () => {
            expect(getLessVar('@radius-lg')).toBe(`${tokens.radius.lg}px`);
        });

        it('@elevation-1 matches MUI tokens.shadow.sm', () => {
            expect(getLessVar('@elevation-1')).toBe(tokens.shadow.sm);
        });

        it('@elevation-2 matches MUI tokens.shadow.md', () => {
            expect(getLessVar('@elevation-2')).toBe(tokens.shadow.md);
        });

        it('@elevation-3 matches MUI tokens.shadow.lg', () => {
            expect(getLessVar('@elevation-3')).toBe(tokens.shadow.lg);
        });
    });

    describe('text hierarchy', () => {
        it('@text-dark matches MUI text.primary', () => {
            expect(getLessVar('@text-dark')).toBe(sharedColors.text.primary);
        });

        it('@text-muted matches MUI text.secondary', () => {
            expect(getLessVar('@text-muted')).toBe(sharedColors.text.secondary);
        });
    });
});
