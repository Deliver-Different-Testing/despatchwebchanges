import type {CSSProperties} from 'react';
import {alpha, createTheme, Theme} from '@mui/material/styles';
import {DialogTransition} from './DialogTransition';
import {dfrntPrimaryPalette, urgentPrimaryPalette, accentPalette, aiColors, shellColors} from './palettes';

/**
 * Material Design 3 typography role variants.
 *
 * MD3 names type by role (Display / Headline / Title / Body / Label, each in
 * L/M/S) rather than the classic `h1`–`h6`. These are exposed *in addition to*
 * the existing `h1`–`h6` (which stay the app default), so new UI can opt into
 * MD3 roles — `<Typography variant="titleMedium">` — without disturbing
 * anything already shipped. All roles are carried on the single app typeface,
 * Plus Jakarta Sans; the role tokens vary only size/weight/spacing.
 */
type Md3Role =
    | 'displayLarge' | 'displayMedium' | 'displaySmall'
    | 'headlineLarge' | 'headlineMedium' | 'headlineSmall'
    | 'titleLarge' | 'titleMedium' | 'titleSmall'
    | 'bodyLarge' | 'bodyMedium' | 'bodySmall'
    | 'labelLarge' | 'labelMedium' | 'labelSmall';

declare module '@mui/material/styles' {
    interface TypographyVariants extends Record<Md3Role, CSSProperties> {}
    interface TypographyVariantsOptions extends Partial<Record<Md3Role, CSSProperties>> {}
}

declare module '@mui/material/Typography' {
    interface TypographyPropsVariantOverrides extends Record<Md3Role, true> {}
}

declare module '@mui/material/styles' {
    // The AI accent as a first-class palette role (a tertiary-style accent) with
    // its own on-colour, so AI surfaces use a proper token pair instead of a
    // hardcoded hex + `'common.white'`.
    interface Palette {
        ai: Palette['primary'];
    }
    interface PaletteOptions {
        ai?: PaletteOptions['primary'];
    }
    // MD3 tonal surface-container tiers, exposed on `background` so components
    // can reference `background.surfaceContainer*` as the depth cue.
    interface TypeBackground {
        surfaceContainerLow: string;
        surfaceContainer: string;
        surfaceContainerHigh: string;
        surfaceContainerHighest: string;
    }
}

// Re-export the shared palette constants so existing imports from this module
// keep working. The values themselves live in the framework-free palettes.ts,
// which the AngularJS Material theme imports too — one source of truth.
export {dfrntPrimaryPalette, urgentPrimaryPalette, accentPalette, shellColors};

/**
 * MUI Theme - Matching AngularJS Material Theme
 *
 * This theme is designed to match the existing AngularJS Material theme
 * defined in materialTheme.ts for visual consistency across the application.
 *
 * Supports two themes:
 * - US customers: Blue (professionalPrimary)
 * - Non-US customers: Yellow (urgentPrimary)
 */

/**
 * Font families
 *
 * The app uses a single typeface — Plus Jakarta Sans — for everything. The
 * `display` and `mono` aliases are kept so consumers (headings, breadcrumbs,
 * numeric job/price/metric fields) can keep referencing them, but they all
 * resolve to the body face, matching the single-typeface look from before the
 * Jul 2026 restyle.
 */
export const bodyFontFamily =
    '"Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, sans-serif';
export const displayFontFamily = bodyFontFamily;
export const monoFontFamily = bodyFontFamily;

/**
 * MD3 role type scale (see the augmentation above). Canonical MD3 proportions
 * carried on the app's own typefaces and weights. Kept as a single frozen
 * object because the roles don't vary by tenant.
 */
export const md3RoleTypography: Record<Md3Role, CSSProperties> = {
    displayLarge: {fontFamily: displayFontFamily, fontWeight: 400, fontSize: '3.5625rem', lineHeight: 1.12, letterSpacing: '-0.015em'},
    displayMedium: {fontFamily: displayFontFamily, fontWeight: 400, fontSize: '2.8125rem', lineHeight: 1.16, letterSpacing: '0em'},
    displaySmall: {fontFamily: displayFontFamily, fontWeight: 400, fontSize: '2.25rem', lineHeight: 1.22, letterSpacing: '0em'},
    headlineLarge: {fontFamily: displayFontFamily, fontWeight: 400, fontSize: '2rem', lineHeight: 1.25, letterSpacing: '0em'},
    headlineMedium: {fontFamily: displayFontFamily, fontWeight: 400, fontSize: '1.75rem', lineHeight: 1.29, letterSpacing: '0em'},
    headlineSmall: {fontFamily: displayFontFamily, fontWeight: 400, fontSize: '1.5rem', lineHeight: 1.33, letterSpacing: '0em'},
    titleLarge: {fontFamily: displayFontFamily, fontWeight: 500, fontSize: '1.375rem', lineHeight: 1.27, letterSpacing: '0em'},
    titleMedium: {fontFamily: bodyFontFamily, fontWeight: 500, fontSize: '1rem', lineHeight: 1.5, letterSpacing: '0.009em'},
    titleSmall: {fontFamily: bodyFontFamily, fontWeight: 500, fontSize: '0.875rem', lineHeight: 1.43, letterSpacing: '0.007em'},
    bodyLarge: {fontFamily: bodyFontFamily, fontWeight: 400, fontSize: '1rem', lineHeight: 1.5, letterSpacing: '0.031em'},
    bodyMedium: {fontFamily: bodyFontFamily, fontWeight: 400, fontSize: '0.875rem', lineHeight: 1.43, letterSpacing: '0.018em'},
    bodySmall: {fontFamily: bodyFontFamily, fontWeight: 400, fontSize: '0.75rem', lineHeight: 1.33, letterSpacing: '0.033em'},
    labelLarge: {fontFamily: bodyFontFamily, fontWeight: 500, fontSize: '0.875rem', lineHeight: 1.43, letterSpacing: '0.007em'},
    labelMedium: {fontFamily: bodyFontFamily, fontWeight: 500, fontSize: '0.75rem', lineHeight: 1.33, letterSpacing: '0.033em'},
    labelSmall: {fontFamily: bodyFontFamily, fontWeight: 500, fontSize: '0.6875rem', lineHeight: 1.45, letterSpacing: '0.033em'},
};

// Design tokens
export const tokens = {
    // Corner radii on the MD3 shape scale (raw px, used in component styleOverrides).
    // NB: the sx `borderRadius` multiplier base is pinned separately to 8 in
    // `shape.borderRadius`, so these values do not shift existing `sx={{borderRadius:n}}`.
    radius: {
        none: 0,
        xs: 4,   // extra-small — chips, snackbars, tooltips
        sm: 8,   // small — text fields, menus
        md: 12,  // medium — cards
        lg: 16,  // large — nav drawer, sheets
        xl: 28,  // extra-large — dialogs, bottom sheets
        full: 9999, // pill — buttons, progress
    },
    duration: {
        instant: 100,
        fast: 150,
        normal: 200,
        slow: 350,
    },
    shadow: {
        sm: '0 1px 3px 0 rgba(0,0,0,.1), 0 1px 2px -1px rgba(0,0,0,.1)',
        md: '0 4px 6px -1px rgba(0,0,0,.1), 0 2px 4px -2px rgba(0,0,0,.1)',
        lg: '0 10px 15px -3px rgba(0,0,0,.1), 0 4px 6px -4px rgba(0,0,0,.1)',
        xl: '0 20px 25px -5px rgba(0,0,0,.1), 0 8px 10px -6px rgba(0,0,0,.1)',
    },
};

// Shared colors (non-primary)
export const sharedColors = {
    success: {
        main: '#13b964',   // DFRNT Green
        light: '#5fd199',
        dark: '#0b7d44',
        lighter: '#e5f8ee',
        contrast: '#FFFFFF',
    },
    warning: {
        main: '#fe811a',   // DFRNT Orange
        light: '#ffab63',
        dark: '#b3560b',
        lighter: '#fff3e6',
        contrast: '#000000',
    },
    error: {
        main: '#dc3246',   // DFRNT Red
        light: '#e97b88',
        dark: '#93212f',
        lighter: '#fdeaec',
        contrast: '#FFFFFF',
    },
    info: {
        main: '#2a4eff',   // DFRNT Reflex Blue
        light: '#7d92ff',
        dark: '#1b31a8',
        lighter: '#eaeeff',
        contrast: '#FFFFFF',
    },
    // Surface colors - matching Angular Material
    surface: {
        default: '#f4f2f1',   // DFRNT Light Grey page background
        paper: '#FFFFFF',
        elevated: '#FFFFFF',
        // MD3 tonal surface-container tiers (warm-neutral, derived from the
        // accent ramp). These are the tonal depth cue that supplements shadows
        // — menus/popovers sit on `container`, higher-emphasis chrome on the
        // stronger tiers — so depth reads from surface colour, not just shadow.
        containerLow: accentPalette[50],
        container: accentPalette[100],
        containerHigh: accentPalette[200],
        containerHighest: accentPalette[300],
    },
    // Text hierarchy
    text: {
        // 0.6 (not MD2's 0.54) so secondary text — section labels, table
        // heads, dialog subtitles — clears WCAG AA 4.5:1 on the #FAFAFA
        // surface; 0.54 (#767676) came in at 4.35:1.
        primary: 'rgba(0, 0, 0, 0.87)',
        secondary: 'rgba(0, 0, 0, 0.6)',
        disabled: 'rgba(0, 0, 0, 0.38)',
        hint: 'rgba(0, 0, 0, 0.38)',
    },
    // Dividers
    divider: 'rgba(0, 0, 0, 0.12)',
};

/**
 * Creates a theme based on the customer region
 * @param isUsCustomer - true for US customers (blue theme), false for non-US (yellow theme)
 */
export function createAppTheme(isUsCustomer: boolean): Theme {
    // Single DFRNT brand: both tenants resolve to the same Cyan ramp. The
    // isUsCustomer flag is retained by callers for locale/labels only, never colour.
    const primaryPalette = isUsCustomer ? dfrntPrimaryPalette : urgentPrimaryPalette;

    // Cyan is a light hue — contained primary surfaces take dark Ink text (~10:1),
    // not white (which fails WCAG on cyan).
    const primaryContrastText = '#0d0c2c';

    const colors = {
        primary: {
            main: primaryPalette[500],
            light: primaryPalette[300],
            dark: primaryPalette[700],
            darker: primaryPalette[900],
            lighter: primaryPalette[50],
            contrast: primaryContrastText,
        },
        secondary: {
            main: accentPalette[500],
            light: accentPalette[300],
            dark: accentPalette[600],
            darker: accentPalette[800],
            lighter: accentPalette[50],
            contrast: '#FFFFFF',
        },
        ...sharedColors,
    };

    return createTheme({
        palette: {
            mode: 'light',
            primary: {
                main: colors.primary.main,
                light: colors.primary.light,
                dark: colors.primary.dark,
                contrastText: colors.primary.contrast,
            },
            secondary: {
                main: colors.secondary.main,
                light: colors.secondary.light,
                dark: colors.secondary.dark,
                contrastText: colors.secondary.contrast,
            },
            success: {
                main: colors.success.main,
                light: colors.success.light,
                dark: colors.success.dark,
                contrastText: colors.success.contrast,
            },
            warning: {
                main: colors.warning.main,
                light: colors.warning.light,
                dark: colors.warning.dark,
                contrastText: colors.warning.contrast,
            },
            error: {
                main: colors.error.main,
                light: colors.error.light,
                dark: colors.error.dark,
                contrastText: colors.error.contrast,
            },
            info: {
                main: colors.info.main,
                light: colors.info.light,
                dark: colors.info.dark,
                contrastText: colors.info.contrast,
            },
            ai: {
                main: aiColors.main,
                light: aiColors.light,
                dark: aiColors.dark,
                contrastText: '#FFFFFF',
            },
            background: {
                default: colors.surface.default,
                paper: colors.surface.paper,
                surfaceContainerLow: colors.surface.containerLow,
                surfaceContainer: colors.surface.container,
                surfaceContainerHigh: colors.surface.containerHigh,
                surfaceContainerHighest: colors.surface.containerHighest,
            },
            text: {
                primary: colors.text.primary,
                secondary: colors.text.secondary,
                disabled: colors.text.disabled,
            },
            divider: colors.divider,
            grey: accentPalette,
        },
        typography: {
            fontFamily: bodyFontFamily,
            fontSize: 14,
            fontWeightLight: 300,
            fontWeightRegular: 400,
            fontWeightMedium: 500,
            fontWeightBold: 700,
            // Headings use heavier weights and tighter tracking so titles carry
            // presence instead of reading like scaled-up body copy.
            h1: {
                fontFamily: displayFontFamily,
                fontSize: '2.125rem',
                fontWeight: 700,
                lineHeight: 1.2,
                letterSpacing: '-0.02em',
            },
            h2: {
                fontFamily: displayFontFamily,
                fontSize: '1.5rem',
                fontWeight: 600,
                lineHeight: 1.25,
                letterSpacing: '-0.015em',
            },
            h3: {
                fontFamily: displayFontFamily,
                fontSize: '1.25rem',
                fontWeight: 600,
                lineHeight: 1.3,
                letterSpacing: '-0.01em',
            },
            h4: {
                fontFamily: displayFontFamily,
                fontSize: '1.125rem',
                fontWeight: 600,
                lineHeight: 1.35,
                letterSpacing: '-0.005em',
            },
            h5: {
                fontSize: '1rem',
                fontWeight: 500,
                lineHeight: 1.4,
                letterSpacing: '0em',
            },
            h6: {
                fontSize: '0.875rem',
                fontWeight: 500,
                lineHeight: 1.4,
                letterSpacing: '0.0075em',
            },
            subtitle1: {
                fontSize: '1rem',
                fontWeight: 400,
                lineHeight: 1.75,
                letterSpacing: '0.00938em',
            },
            subtitle2: {
                fontSize: '0.875rem',
                fontWeight: 500,
                lineHeight: 1.57,
                letterSpacing: '0.00714em',
            },
            body1: {
                fontSize: '0.875rem',
                fontWeight: 400,
                lineHeight: 1.5,
                letterSpacing: '0.00938em',
            },
            body2: {
                fontSize: '0.8125rem',
                fontWeight: 400,
                lineHeight: 1.43,
                letterSpacing: '0.01071em',
            },
            caption: {
                fontSize: '0.75rem',
                fontWeight: 400,
                lineHeight: 1.4,
                letterSpacing: '0.03333em',
            },
            overline: {
                fontSize: '0.625rem',
                fontWeight: 500,
                lineHeight: 2.5,
                letterSpacing: '0.08333em',
                textTransform: 'uppercase',
            },
            button: {
                fontSize: '0.875rem',
                fontWeight: 500,
                textTransform: 'none',
                letterSpacing: '0.01em',
            },
            // MD3 role variants (Display/Headline/Title/Body/Label), additive to h1–h6.
            ...md3RoleTypography,
        },
        shape: {
            // The sx `borderRadius` multiplier base. Pinned to 8 (decoupled from
            // tokens.radius) so existing `sx={{borderRadius: n}}` values across the
            // app keep their meaning while component shapes move to the MD3 scale.
            borderRadius: 8,
        },
        spacing: 8,
        shadows: [
            'none',
            tokens.shadow.sm,
            tokens.shadow.sm,
            tokens.shadow.md,
            tokens.shadow.md,
            tokens.shadow.md,
            tokens.shadow.lg,
            tokens.shadow.lg,
            tokens.shadow.lg,
            tokens.shadow.lg,
            tokens.shadow.lg,
            tokens.shadow.lg,
            tokens.shadow.xl,
            tokens.shadow.xl,
            tokens.shadow.xl,
            tokens.shadow.xl,
            tokens.shadow.xl,
            tokens.shadow.xl,
            tokens.shadow.xl,
            tokens.shadow.xl,
            tokens.shadow.xl,
            tokens.shadow.xl,
            tokens.shadow.xl,
            tokens.shadow.xl,
            tokens.shadow.xl,
        ],
        components: {
            // The app shell is a fixed Ink-Blue bar (brand navy) with white content
            // in every context — decoupled from `primary` (which is the cyan accent).
            MuiAppBar: {
                defaultProps: {
                    elevation: 0,
                },
                styleOverrides: {
                    root: {
                        backgroundColor: shellColors.appBar,
                        color: shellColors.textPrimary,
                    },
                },
            },
            MuiTypography: {
                defaultProps: {
                    // Render MD3 role variants with semantically appropriate elements.
                    variantMapping: {
                        displayLarge: 'h1',
                        displayMedium: 'h1',
                        displaySmall: 'h1',
                        headlineLarge: 'h2',
                        headlineMedium: 'h2',
                        headlineSmall: 'h3',
                        titleLarge: 'h4',
                        titleMedium: 'h5',
                        titleSmall: 'h6',
                        bodyLarge: 'p',
                        bodyMedium: 'p',
                        bodySmall: 'p',
                        labelLarge: 'span',
                        labelMedium: 'span',
                        labelSmall: 'span',
                    },
                },
            },
            MuiCssBaseline: {
                styleOverrides: {
                    body: {
                        scrollbarWidth: 'thin',
                        scrollbarColor: `${accentPalette[400]} transparent`,
                    },
                    '@media (prefers-reduced-motion: reduce)': {
                        html: {
                            scrollBehavior: 'auto',
                        },
                    },
                },
            },
            MuiButton: {
                defaultProps: {
                    disableElevation: true,
                },
                styleOverrides: {
                    root: {
                        // MD3 buttons are fully rounded (pill).
                        borderRadius: tokens.radius.full,
                        padding: '6px 16px',
                        fontWeight: 500,
                        fontSize: '0.875rem',
                        textTransform: 'none' as const,
                        letterSpacing: '0.01em',
                        minHeight: 36,
                        transition: `all ${tokens.duration.normal}ms cubic-bezier(0.4, 0, 0.2, 1)`,
                        '&:focus-visible': {
                            outline: `2px solid ${colors.primary.main}`,
                            outlineOffset: 2,
                        },
                    },
                    sizeSmall: {
                        padding: '4px 12px',
                        fontSize: '0.8125rem',
                        minHeight: 32,
                    },
                    sizeLarge: {
                        padding: '8px 22px',
                        fontSize: '0.9375rem',
                        minHeight: 42,
                    },
                    contained: {
                        '&:hover': {
                            boxShadow: tokens.shadow.sm,
                        },
                    },
                    outlined: {
                        borderColor: colors.divider,
                        '&:hover': {
                            borderColor: colors.primary.main,
                            backgroundColor: alpha(colors.primary.main, 0.04),
                        },
                    },
                },
            },
            MuiIconButton: {
                styleOverrides: {
                    root: {
                        borderRadius: '50%',
                        // Default icon buttons clear the ~44px accessible hit
                        // target (MD recommends 48, iOS/pointer 44); the glyph
                        // stays 24px, the padding grows the target. Dense
                        // inline spots opt into `size="small"` below.
                        minWidth: 44,
                        minHeight: 44,
                        transition: `background-color ${tokens.duration.fast}ms`,
                        '&:hover': {
                            backgroundColor: alpha(colors.primary.main, 0.04),
                        },
                        '&:focus-visible': {
                            outline: `2px solid ${colors.primary.main}`,
                            outlineOffset: 2,
                        },
                    },
                    sizeSmall: {
                        minWidth: 32,
                        minHeight: 32,
                    },
                },
            },
            MuiPaper: {
                defaultProps: {
                    elevation: 0,
                },
                styleOverrides: {
                    root: {
                        backgroundImage: 'none',
                    },
                    rounded: {
                        borderRadius: tokens.radius.md,
                    },
                    elevation1: {
                        boxShadow: tokens.shadow.sm,
                    },
                    elevation2: {
                        boxShadow: tokens.shadow.sm,
                    },
                    elevation3: {
                        boxShadow: tokens.shadow.md,
                    },
                    elevation4: {
                        boxShadow: tokens.shadow.md,
                    },
                },
            },
            MuiCard: {
                defaultProps: {
                    variant: 'outlined',
                },
                styleOverrides: {
                    root: {
                        borderRadius: tokens.radius.md,
                        transition: `box-shadow ${tokens.duration.normal}ms cubic-bezier(0.4, 0, 0.2, 1), border-color ${tokens.duration.normal}ms cubic-bezier(0.4, 0, 0.2, 1)`,
                        '&:hover': {
                            boxShadow: tokens.shadow.sm,
                        },
                    },
                },
            },
            MuiDialog: {
                defaultProps: {
                    slots: {transition: DialogTransition},
                },
                styleOverrides: {
                    paper: {
                        // MD3 extra-large corner (28px) + a softer elevation-3
                        // shadow instead of the previous oversized drop shadow.
                        borderRadius: tokens.radius.xl,
                        boxShadow: tokens.shadow.lg,
                    },
                },
            },
            MuiDialogTitle: {
                styleOverrides: {
                    root: {
                        fontSize: '1.125rem',
                        fontWeight: 600,
                        padding: '20px 24px',
                        color: colors.text.primary,
                        borderBottom: `1px solid ${colors.divider}`,
                    },
                },
            },
            MuiDialogContent: {
                styleOverrides: {
                    root: {
                        padding: '24px 24px',
                    },
                },
            },
            MuiDialogActions: {
                styleOverrides: {
                    root: {
                        padding: '16px 24px 24px',
                        gap: 8,
                        borderTop: `1px solid ${colors.divider}`,
                    },
                },
            },
            MuiTextField: {
                styleOverrides: {
                    root: {
                        '& .MuiOutlinedInput-root': {
                            borderRadius: tokens.radius.sm,
                            '& fieldset': {
                                borderColor: colors.divider,
                            },
                            '&:hover fieldset': {
                                borderColor: colors.text.secondary,
                            },
                            '&.Mui-focused fieldset': {
                                borderWidth: 2,
                                borderColor: colors.primary.main,
                            },
                        },
                    },
                },
            },
            MuiOutlinedInput: {
                styleOverrides: {
                    root: {
                        borderRadius: tokens.radius.sm,
                        '& fieldset': {
                            borderColor: colors.divider,
                        },
                        '&:hover fieldset': {
                            borderColor: colors.text.secondary,
                        },
                    },
                    input: {
                        padding: '12px 14px',
                    },
                },
            },
            MuiInputLabel: {
                styleOverrides: {
                    root: {
                        fontSize: '0.875rem',
                        '&.Mui-focused': {
                            color: colors.primary.main,
                        },
                    },
                },
            },
            MuiChip: {
                styleOverrides: {
                    root: {
                        borderRadius: tokens.radius.sm,
                        fontWeight: 400,
                        fontSize: '0.8125rem',
                    },
                },
            },
            MuiTab: {
                styleOverrides: {
                    root: {
                        textTransform: 'none' as const,
                        fontWeight: 500,
                        fontSize: '0.875rem',
                        letterSpacing: '0.01em',
                        minHeight: 48,
                        padding: '12px 16px',
                    },
                },
            },
            MuiTabs: {
                styleOverrides: {
                    root: {
                        minHeight: 48,
                    },
                    indicator: {
                        height: 2,
                    },
                },
            },
            MuiTableCell: {
                styleOverrides: {
                    root: {
                        fontSize: '0.8125rem',
                        padding: '12px 16px',
                        borderColor: colors.divider,
                        // Align digits into columns so numeric data (IDs, prices,
                        // times, distances) reads like an instrument panel and
                        // doesn't jitter as values update.
                        fontVariantNumeric: 'tabular-nums',
                    },
                    head: {
                        fontWeight: 600,
                        color: colors.text.secondary,
                        fontSize: '0.8125rem',
                        textTransform: 'none' as const,
                        letterSpacing: 'normal',
                        backgroundColor: accentPalette[50],
                        borderBottomWidth: 1,
                        borderBottomColor: colors.divider,
                    },
                },
            },
            MuiTableRow: {
                styleOverrides: {
                    root: {
                        transition: `background-color ${tokens.duration.fast}ms`,
                        '&:hover': {
                            backgroundColor: alpha(colors.primary.main, 0.04),
                        },
                    },
                },
            },
            MuiTooltip: {
                styleOverrides: {
                    tooltip: {
                        backgroundColor: accentPalette[700],
                        fontSize: '0.75rem',
                        fontWeight: 400,
                        padding: '6px 10px',
                        borderRadius: tokens.radius.xs,
                    },
                },
            },
            MuiDivider: {
                styleOverrides: {
                    root: {
                        borderColor: colors.divider,
                    },
                },
            },
            MuiMenu: {
                styleOverrides: {
                    paper: {
                        borderRadius: tokens.radius.sm,
                        // MD3: depth from a tonal surface-container tint, with a
                        // lighter shadow than before rather than shadow alone.
                        backgroundColor: colors.surface.container,
                        boxShadow: tokens.shadow.md,
                    },
                },
            },
            MuiSelect: {
                defaultProps: {
                    // Cap the options menu so a long list scrolls instead of
                    // filling the screen (~8 rows). MUI still shrinks it to fit
                    // smaller viewports; per-Select MenuProps can override.
                    MenuProps: {
                        slotProps: {
                            paper: {
                                sx: {maxHeight: 320},
                            },
                        },
                    },
                },
            },
            MuiMenuItem: {
                styleOverrides: {
                    root: {
                        fontSize: '0.875rem',
                        padding: '8px 16px',
                        minHeight: 40,
                        '&:hover': {
                            backgroundColor: alpha(colors.primary.main, 0.04),
                        },
                    },
                },
            },
            MuiAutocomplete: {
                styleOverrides: {
                    listbox: {
                        maxHeight: 300,
                        overflow: 'auto',
                    },
                },
            },
            MuiAlert: {
                styleOverrides: {
                    root: {
                        borderRadius: tokens.radius.sm,
                    },
                },
            },
            MuiLinearProgress: {
                styleOverrides: {
                    root: {
                        borderRadius: tokens.radius.full,
                        height: 6,
                        backgroundColor: alpha(colors.primary.main, 0.12),
                    },
                    bar: {
                        borderRadius: tokens.radius.full,
                    },
                },
            },
            MuiCircularProgress: {
                styleOverrides: {
                    root: {
                        strokeLinecap: 'round',
                    },
                },
            },
        },
    });
}

/**
 * Detects if the current user is a US customer
 * Checks the body class 'theme-us' which is set by the AngularJS app
 */
export function isUsCustomer(): boolean {
    return document.body.classList.contains('theme-us');
}

/**
 * Gets the appropriate theme based on customer region
 */
export function getTheme(): Theme {
    return createAppTheme(isUsCustomer());
}

// Default theme (will be determined at runtime)
// For backwards compatibility, default to US theme
export const theme = createAppTheme(true);

export default theme;
