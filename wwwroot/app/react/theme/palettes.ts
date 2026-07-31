/**
 * Palette constants — the single source of truth for brand colours.
 *
 * This module has NO framework dependencies on purpose: both the MUI theme
 * (`muiTheme.ts`, React) and the AngularJS Material theme (`materialTheme.ts`)
 * import these same hex values, so the two theme systems can never drift.
 * Keep it import-free so pulling it into the AngularJS bundle doesn't drag MUI
 * along with it.
 */

// DFRNT primary palette — Cyan (#3bc7f4). Single brand: the same ramp serves
// every tenant now (the old US-blue / NZ-amber split is retired). Cyan is a light
// hue, so anything filled with it needs DARK (Ink) text, not white.
export const dfrntPrimaryPalette = {
    50: '#e7f8fe',
    100: '#d8f4fd',
    200: '#b1e9fb',
    300: '#82dcf8',
    400: '#5bd1f5',
    500: '#3bc7f4',  // Main color - DFRNT Cyan
    600: '#1eb2e6',
    700: '#1590c0',
    800: '#0f6f96',
    900: '#0a4d69',
    A100: '#82dcf8',
    A200: '#5bd1f5',
    A400: '#3bc7f4',
    A700: '#1eb2e6',
};

// Single DFRNT brand — kept as a named export (still imported by materialTheme.ts
// and SideNav) but resolves to the same Cyan ramp as the primary.
export const urgentPrimaryPalette = dfrntPrimaryPalette;

// Ink Blue (#0d0c2c) — the DFRNT shell / neutral-dark family. Backs the app bar,
// side-nav header and any dark chrome. MUI-style 50→900 from the brand ink ramp.
export const inkBluePalette = {
    50: '#ecebf1',
    100: '#cfced5',
    200: '#a8a7b6',
    300: '#83829a',
    400: '#6e6d80',
    500: '#4f4e66',
    600: '#35334f',
    700: '#211f40',
    800: '#141233',
    900: '#0d0c2c',  // Ink Blue - shell
};

// Fixed Ink-Blue shell tokens (app bar + side-nav header). White-based content on
// the dark scrim. Mirrors the Mantine `sidebarColors` in the DFRNT brand theme.
export const shellColors = {
    appBar: inkBluePalette[900],   // #0d0c2c
    panel: inkBluePalette[800],    // #141233 - one tier up for the drawer panel
    border: 'rgba(255, 255, 255, 0.10)',
    textPrimary: 'rgba(255, 255, 255, 0.95)',
    textSecondary: 'rgba(255, 255, 255, 0.60)',
    textMuted: 'rgba(255, 255, 255, 0.38)',
    hoverBg: 'rgba(255, 255, 255, 0.08)',
};

// AI feature accent — the DFRNT grape/purple (#824ae0) signature used across AI
// surfaces (draft buttons, summary cards, the BETA chip). A light/main/dark ramp so
// callers can build hover/active states from tonal steps.
export const aiColors = {
    light: '#b088ec',
    main: '#824ae0',
    dark: '#6c3bbe',
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
