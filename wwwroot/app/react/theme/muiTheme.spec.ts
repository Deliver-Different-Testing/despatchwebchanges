import * as fs from 'fs';
import * as path from 'path';
import {goldShellColors} from './palettes';
import {
    createAppTheme,
    dfrntPrimaryPalette,
    urgentPrimaryPalette,
    shellColors,
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
    it('gives US tenants the DFRNT cyan primary', () => {
        const theme = createAppTheme(true);
        expect(theme.palette.primary.main).toBe(dfrntPrimaryPalette[500]);
        expect(theme.palette.primary.main).toBe('#3bc7f4');
    });

    it('gives non-US tenants the urgent gold primary', () => {
        const theme = createAppTheme(false);
        expect(theme.palette.primary.main).toBe(urgentPrimaryPalette[500]);
        expect(theme.palette.primary.main).toBe('#f4c430');
    });

    it('takes dark Ink contrast text on both brands — cyan and gold are light hues', () => {
        expect(createAppTheme(true).palette.primary.contrastText).toBe('#0d0c2c');
        expect(createAppTheme(false).palette.primary.contrastText).toBe('#0d0c2c');
    });

    it('gives US tenants an Ink Blue app bar with white content', () => {
        const bar = (createAppTheme(true).components?.MuiAppBar?.styleOverrides?.root ?? {}) as Record<string, string>;
        expect(bar.backgroundColor).toBe(shellColors.appBar);
        expect(bar.color).toBe(shellColors.textPrimary);
    });

    it('gives non-US tenants a gold app bar with Ink content', () => {
        const bar = (createAppTheme(false).components?.MuiAppBar?.styleOverrides?.root ?? {}) as Record<string, string>;
        expect(bar.backgroundColor).toBe(goldShellColors.appBar);
        expect(bar.backgroundColor).toBe(urgentPrimaryPalette[500]);
        expect(bar.color).toBe(goldShellColors.textPrimary);
    });

    it('uses the warm-gray accent as the secondary palette', () => {
        expect(createAppTheme().palette.secondary.main).toBe(accentPalette[500]);
    });

    it('carries the DFRNT semantic colors', () => {
        const theme = createAppTheme();
        expect(theme.palette.success.main).toBe('#13b964');
        expect(theme.palette.warning.main).toBe('#fe811a');
        expect(theme.palette.error.main).toBe('#dc3246');
        expect(theme.palette.info.main).toBe('#2a4eff');
    });

    it('background colors match expected values', () => {
        const theme = createAppTheme();
        expect(theme.palette.background.default).toBe('#f4f2f1');
        expect(theme.palette.background.paper).toBe('#FFFFFF');
    });

    it('table cells use tabular figures so numeric columns align', () => {
        const theme = createAppTheme();
        const root = theme.components?.MuiTableCell?.styleOverrides?.root as
            | {fontVariantNumeric?: string}
            | undefined;
        expect(root?.fontVariantNumeric).toBe('tabular-nums');
    });

    it('caps the Select options menu height so long lists scroll instead of filling the screen', () => {
        const theme = createAppTheme();
        const menuProps = theme.components?.MuiSelect?.defaultProps?.MenuProps as
            | {slotProps?: {paper?: {sx?: {maxHeight?: number}}}}
            | undefined;
        expect(menuProps?.slotProps?.paper?.sx?.maxHeight).toBe(320);
    });

    it('body text uses Plus Jakarta Sans', () => {
        const theme = createAppTheme();
        expect(theme.typography.fontFamily).toBe(bodyFontFamily);
        expect(theme.typography.body1.fontFamily ?? theme.typography.fontFamily).toContain('Plus Jakarta Sans');
    });

    it('headings use the Plus Jakarta Sans face', () => {
        const theme = createAppTheme();
        expect(displayFontFamily).toBe(bodyFontFamily);
        expect(theme.typography.h1.fontFamily).toBe(displayFontFamily);
        expect(theme.typography.h2.fontFamily).toBe(displayFontFamily);
        expect(theme.typography.h3.fontFamily).toBe(displayFontFamily);
        expect(theme.typography.h4.fontFamily).toBe(displayFontFamily);
    });

    it('secondary text is dark enough to clear WCAG AA on the surface', () => {
        // rgba(0,0,0,0.54) (#767676) came in at 4.35:1 on #FAFAFA; 0.6 clears 4.5:1.
        const theme = createAppTheme();
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
        const theme = createAppTheme();
        for (const role of roles) {
            const variant = theme.typography[role] as {fontSize?: string; fontFamily?: string};
            expect(variant?.fontSize).toBeTruthy();
            expect(variant?.fontFamily).toBeTruthy();
        }
    });

    it('carries display and body roles on the Plus Jakarta Sans face', () => {
        const theme = createAppTheme();
        expect(theme.typography.displayLarge.fontFamily).toBe(displayFontFamily);
        expect(theme.typography.headlineMedium.fontFamily).toBe(displayFontFamily);
        expect(theme.typography.titleLarge.fontFamily).toBe(displayFontFamily);
        expect(theme.typography.bodyMedium.fontFamily).toBe(bodyFontFamily);
        expect(theme.typography.labelLarge.fontFamily).toBe(bodyFontFamily);
    });

    it('keeps the classic h1–h6 variants for back-compat', () => {
        const theme = createAppTheme();
        expect(theme.typography.h1.fontSize).toBeTruthy();
        expect(theme.typography.h6.fontSize).toBeTruthy();
    });

    it('maps role variants onto semantic elements', () => {
        const theme = createAppTheme();
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
        const theme = createAppTheme();
        const overrides = theme.components?.MuiIconButton?.styleOverrides;
        const root = overrides?.root as { minWidth?: number; minHeight?: number } | undefined;
        const small = overrides?.sizeSmall as { minWidth?: number; minHeight?: number } | undefined;
        expect(root?.minWidth).toBe(44);
        expect(root?.minHeight).toBe(44);
        expect(small?.minWidth).toBe(32);
        expect(small?.minHeight).toBe(32);
    });

    it('honours prefers-reduced-motion by disabling smooth scroll', () => {
        const theme = createAppTheme();
        const overrides = theme.components?.MuiCssBaseline?.styleOverrides as
            | Record<string, unknown>
            | undefined;
        const reduced = overrides?.['@media (prefers-reduced-motion: reduce)'] as
            | { html?: { scrollBehavior?: string } }
            | undefined;
        expect(reduced?.html?.scrollBehavior).toBe('auto');
    });

    it('uses the motion-accessible DialogTransition for dialogs', () => {
        const theme = createAppTheme();
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

        it('@nz-primary matches the non-US gold primary', () => {
            expect(getLessVar('@nz-primary')).toBe(urgentPrimaryPalette[500]);
        });

        it('@nz-primary-dark matches the gold 700 step', () => {
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
            expect(getLessVar('@main-background-color').toLowerCase())
                .toBe(sharedColors.surface.default.toLowerCase());
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
