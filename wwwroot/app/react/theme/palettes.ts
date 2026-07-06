/**
 * Palette constants — the single source of truth for brand colours.
 *
 * This module has NO framework dependencies on purpose: both the MUI theme
 * (`muiTheme.ts`, React) and the AngularJS Material theme (`materialTheme.ts`)
 * import these same hex values, so the two theme systems can never drift.
 * Keep it import-free so pulling it into the AngularJS bundle doesn't drag MUI
 * along with it.
 */

// Primary palette for US customers - professional blue
export const dfrntPrimaryPalette = {
    50: '#e3f2fd',
    100: '#bbdefb',
    200: '#90caf9',
    300: '#64b5f6',
    400: '#42a5f5',
    500: '#2196f3',  // Main color
    600: '#1e88e5',
    700: '#1976d2',
    800: '#1565c0',
    900: '#0d47a1',
    A100: '#82b1ff',
    A200: '#448aff',
    A400: '#2979ff',
    A700: '#2962ff',
};

// Primary palette for non-US customers - warm amber/gold
export const urgentPrimaryPalette = {
    50: '#fef9e7',
    100: '#fcefc4',
    200: '#fae49d',
    300: '#f8d976',
    400: '#f6d058',
    500: '#f4c430',  // Main color - warm amber gold
    600: '#e5b52a',
    700: '#d4a324',
    800: '#c3911e',
    900: '#a87614',
    A100: '#fff8e1',
    A200: '#ffecb3',
    A400: '#ffd54f',
    A700: '#ffc107',
};

// AI feature accent — the deep-purple signature used across AI surfaces
// (draft buttons, summary cards, the BETA chip). A light/main/dark ramp so
// callers can build hover/active states from tonal steps.
export const aiColors = {
    light: '#b388ff',
    main: '#7c4dff',
    dark: '#5e35b1',
};

// Accent for the "gross" pricing mode in the simple price editor. Purple has no
// slot in the tenant palettes, so it lives here as a named semantic token.
export const grossModeColor = '#9c27b0';

// Accent palette - warm grays
export const accentPalette = {
    50: '#fafaf9',   // Warm white
    100: '#f5f5f4',  // Very light warm gray
    200: '#e7e5e4',  // Light warm gray
    300: '#d6d3d1',  // Medium-light warm gray
    400: '#a8a29e',  // Medium warm gray
    500: '#78716c',  // Balanced warm gray - MAIN COLOR
    600: '#57534e',  // Dark warm gray - TOOLBAR COLOR
    700: '#44403c',  // Darker warm gray
    800: '#292524',  // Very dark warm gray
    900: '#1c1917',  // Deepest warm gray
};
