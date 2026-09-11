/**
 * Design Tokens
 *
 * Semantic color constants for use outside MUI's sx prop / theme context.
 * For MUI sx props, prefer theme path strings (e.g. bgcolor: 'background.default').
 *
 * These re-export values from palettes.ts to keep a single source of truth.
 */

import {accentPalette, aiColors, grossModeColor, sharedColors, shellColors} from './palettes';

/** Ink-Blue shell colour (#0d0c2c) — app bar, side-nav header, dark chrome. */
export const toolbarColor = shellColors.appBar;

/** Full Ink-Blue shell token set (bar/panel/border/text). */
export {shellColors};

/** Surface / dialog body background (#FAFAFA) */
export const surfaceDefault = sharedColors.surface.default;

/**
 * AI + gross-mode accents now live in the framework-free palettes.ts (the single
 * source, shared with the MUI theme's `ai` palette role); re-exported here so
 * existing `designTokens` call sites keep working.
 */
export {aiColors, grossModeColor};

/** AI feature accent color (deep purple). Kept for existing call sites. */
export const aiAccentColor = aiColors.main;

/** Status palette for feature-specific status indicators */
export const statusColors = {
    success: {main: sharedColors.success.main, light: sharedColors.success.lighter},
    warning: {main: sharedColors.warning.main, light: sharedColors.warning.lighter},
    error: {main: sharedColors.error.main, light: sharedColors.error.lighter},
    info: {main: sharedColors.info.main, light: sharedColors.info.lighter},
} as const;

/**
 * Driver Locations board colors
 *
 * Domain-specific color scheme for the three-section driver location board.
 * These are design data differentiating board sections (top/middle/bottom),
 * not general UI chrome, so they live outside the MUI theme.
 */
export const driverLocationColors = {
    title: {
        bg: accentPalette[600],
        bgHover: accentPalette[500],
        activeBg: '#ffeb3b',
        activeBgHover: '#fdd835',
    },
    top: {
        bg: '#bae1ff',
        bgHover: '#a8d4f5',
        bgActive: '#96c7eb',
        numberBg: '#94c5ea',
        numberBgActive: '#82b8e0',
        border: '#a4d2f5',
    },
    middle: {
        bg: '#d4c7ff',
        bgHover: '#c6b6fd',
        numberBg: '#bdaeef',
        numberBgActive: '#ab9ce5',
        border: '#c6b6fd',
    },
    bottom: {
        bg: '#ffdfba',
        bgHover: '#f5d0a5',
        numberBg: '#ffc888',
        numberBgActive: '#f5b870',
        border: '#efcea9',
    },
    area: accentPalette[300],
    destination: {
        bg: sharedColors.surface.default,
        border: sharedColors.divider,
    },
} as const;

/**
 * Pricing-mode identity colours.
 *
 * The three pricing modes appear in both the single-job price dialog and the
 * bulk upload dialog and mean the same thing in each, so the colour is a shared
 * token rather than a per-dialog literal. Colour is never the only cue: every
 * mode also carries its own glyph, and selection adds border weight and a tint.
 */
export const pricingModeColors = {
    recalculate: accentPalette[600],
    base: sharedColors.success.main,
    gross: grossModeColor,
} as const;

/** Blast-radius colours for the recurring-job "insert to live" scope choice. */
export const insertScopeColors = {
    group: sharedColors.info.main,
    route: sharedColors.warning.main,
} as const;
