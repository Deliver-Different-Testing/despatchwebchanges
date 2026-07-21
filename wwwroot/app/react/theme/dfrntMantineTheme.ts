/**
 * DFRNT Mantine theme — the single source of truth for the DFRNT brand in the
 * React app after the move off MUI/Material Design.
 *
 * Derived directly from the Feb 2026 DFRNT Brand Guidelines (docs/) and the
 * DFRNT UI Design refinement doc:
 *   - Primary:   Ink Blue (#0d0c2c) chrome, Cyan (#3bc7f4) UI accent, warm Light
 *                Grey (#f4f2f1) background.
 *   - Secondary: Reflex Blue / Purple / Green / Orange / Red — icons, buttons and
 *                the semantic roles (green=success, orange=warning, red=error).
 *   - Shape:     lozenge (pill) primary buttons, flat surfaces, keyline dividers
 *                instead of nested boxes.
 *
 * Deliberate deviations from the brand book, per product decision (Jul 2026):
 *   - Typeface stays **Plus Jakarta Sans** (the existing dispatch UI font) rather
 *     than the book's Roboto/DM Sans. The brand guidelines are to be updated to
 *     match the software UI.
 *   - **One** brand only — the previous US-blue / 'urgent' amber-gold tenant
 *     switch is retired. There is no per-tenant palette here.
 *
 * Colour ramps are 10-step Mantine tuples with the brand hex anchored at index 6
 * (Mantine's default `primaryShade`); index 1–2 reproduce the brand's published
 * 20% / 40% tints. `autoContrast` picks readable on-colours (Cyan is light, so a
 * filled Cyan button gets dark ink text — matching the mock's lozenge button).
 */
import {createTheme, type MantineColorsTuple, rem} from '@mantine/core';

/**
 * Framework-free brand hex constants. Import-free on purpose so the AngularJS
 * side (and any non-React surface) can share the exact same values — the role
 * `palettes.ts` plays for the MUI theme today.
 */
export const dfrntBrand = {
    inkBlue: '#0d0c2c',
    cyan: '#3bc7f4',
    lightGrey: '#f4f2f1',
    white: '#ffffff',
    reflexBlue: '#2a4eff',
    purple: '#824ae0',
    green: '#13b964',
    orange: '#fe811a',
    red: '#dc3246',
} as const;

// --- Colour ramps (light → dark, brand hex at index 6 for the vivid colours) ---

const cyan: MantineColorsTuple = [
    '#ebf9fe', '#d8f4fd', '#baebfb', '#99e2f9', '#7ad9f8',
    '#5ad0f6', '#3bc7f4', '#33abd2', '#2a8fb0', '#216f89',
];

const reflexBlue: MantineColorsTuple = [
    '#eaedff', '#d4dcff', '#b4c1ff', '#90a3ff', '#6e87ff',
    '#4c6aff', '#2a4eff', '#2443db', '#1e38b8', '#182c8f',
];

const purple: MantineColorsTuple = [
    '#f3edfc', '#e6dbf9', '#d3c0f4', '#bea1ef', '#aa84ea',
    '#9667e5', '#824ae0', '#7040c1', '#5e35a1', '#49297d',
];

const green: MantineColorsTuple = [
    '#e7f8f0', '#d0f1e0', '#ace7c9', '#84dbae', '#5fcf96',
    '#39c47d', '#13b964', '#109f56', '#0e8548', '#0b6838',
];

const orange: MantineColorsTuple = [
    '#fff2e8', '#ffe6d1', '#ffd3af', '#febd88', '#fea963',
    '#fe953f', '#fe811a', '#da6f16', '#b75d13', '#8e480f',
];

const red: MantineColorsTuple = [
    '#fcebed', '#f8d6da', '#f3b7be', '#ed949f', '#e77481',
    '#e25364', '#dc3246', '#bd2b3c', '#9e2432', '#7b1c27',
];

// Ink Blue as a dark-surface ramp (light → dark), brand hex at index 9. Used for
// the sidebar/top-chrome and as Mantine's `dark` scale so dark surfaces read as
// Ink Blue rather than a neutral charcoal.
const ink: MantineColorsTuple = [
    '#f0f0f2', '#e2e2e6', '#cacad1', '#a8a8b3', '#868696',
    '#5f5f74', '#3d3d56', '#252441', '#171634', '#0d0c2c',
];

// Warm neutral ramp anchored on the brand's warm Light Grey / Ink tints. Drives
// text, borders, dividers and the warm off-white page background.
const neutral: MantineColorsTuple = [
    '#ffffff', '#f8f7f7', '#f4f2f1', '#e9e7e6', '#cfced5',
    '#a6a5b0', '#6e6d80', '#4a4959', '#2b2a3d', '#14132b',
];

/** Plus Jakarta Sans — the existing dispatch UI typeface, kept as the brand face. */
const fontStack =
    '"Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

export const dfrntTheme = createTheme({
    // Cyan is the DFRNT UI accent (buttons, active states, links, focus rings).
    primaryColor: 'cyan',
    primaryShade: 6,
    // Let Mantine choose black/white text on filled surfaces by luminance — a
    // filled Cyan control gets dark ink text, matching the brand's lozenge button.
    autoContrast: true,
    luminanceThreshold: 0.45,

    white: dfrntBrand.white,
    black: dfrntBrand.inkBlue,

    colors: {
        cyan,
        reflexBlue,
        purple,
        green,
        orange,
        red,
        ink,
        // Override Mantine's built-in neutral scales so all greys are the brand's
        // warm neutral and dark surfaces are Ink Blue.
        gray: neutral,
        dark: ink,
    },

    fontFamily: fontStack,
    fontFamilyMonospace: fontStack,
    headings: {
        fontFamily: fontStack,
        fontWeight: '600',
        sizes: {
            h1: {fontSize: rem(34), lineHeight: '1.2', fontWeight: '700'},
            h2: {fontSize: rem(24), lineHeight: '1.25', fontWeight: '600'},
            h3: {fontSize: rem(20), lineHeight: '1.3', fontWeight: '600'},
            h4: {fontSize: rem(18), lineHeight: '1.35', fontWeight: '600'},
            h5: {fontSize: rem(16), lineHeight: '1.4', fontWeight: '500'},
            h6: {fontSize: rem(14), lineHeight: '1.4', fontWeight: '500'},
        },
    },

    // Corner radii on the same scale the MUI theme used, so shapes don't shift:
    // sm=8 (inputs/menus), md=12 (cards), lg=16 (sheets), xl=28 (dialogs).
    defaultRadius: 'md',
    radius: {
        xs: rem(4),
        sm: rem(8),
        md: rem(12),
        lg: rem(16),
        xl: rem(28),
    },

    // Flat by default — the brand look is flat surfaces + keyline dividers, with
    // shadow reserved for lifted chrome (menus, dialogs).
    shadows: {
        xs: '0 1px 3px 0 rgba(13,12,44,.08), 0 1px 2px -1px rgba(13,12,44,.08)',
        sm: '0 1px 3px 0 rgba(13,12,44,.10), 0 1px 2px -1px rgba(13,12,44,.10)',
        md: '0 4px 6px -1px rgba(13,12,44,.10), 0 2px 4px -2px rgba(13,12,44,.10)',
        lg: '0 10px 15px -3px rgba(13,12,44,.10), 0 4px 6px -4px rgba(13,12,44,.10)',
        xl: '0 20px 25px -5px rgba(13,12,44,.10), 0 8px 10px -6px rgba(13,12,44,.10)',
    },

    // Keep MUI's 14px base so dense data UI doesn't reflow on migration.
    fontSizes: {
        xs: rem(12),
        sm: rem(13),
        md: rem(14),
        lg: rem(16),
        xl: rem(18),
    },
    lineHeights: {
        xs: '1.4',
        sm: '1.43',
        md: '1.5',
        lg: '1.55',
        xl: '1.6',
    },

    cursorType: 'pointer',

    components: {
        // Lozenge (pill) primary buttons per the brand book; flat unless hovered.
        Button: {
            defaultProps: {radius: rem(9999)},
            styles: {
                root: {fontWeight: 600},
            },
        },
        ActionIcon: {
            // Keep the accessible ~44px hit target the MUI theme enforced.
            defaultProps: {radius: rem(9999)},
        },
        // Cards/papers are flat with a keyline border rather than a shadow, and
        // lose the border when they sit on a shaded background (per the UI doc).
        Card: {
            defaultProps: {radius: 'md', withBorder: true, shadow: undefined},
        },
        Paper: {
            defaultProps: {radius: 'md', shadow: undefined},
        },
        Modal: {
            // Dialogs keep the MD-era 28px extra-large corner + a soft lift.
            defaultProps: {radius: 'xl', shadow: 'lg', centered: true},
        },
        Menu: {
            defaultProps: {radius: 'sm', shadow: 'md'},
        },
        Tooltip: {
            defaultProps: {radius: 'xs', color: 'ink'},
        },
        TextInput: {defaultProps: {radius: 'sm'}},
        Textarea: {defaultProps: {radius: 'sm'}},
        Select: {defaultProps: {radius: 'sm'}},
        NumberInput: {defaultProps: {radius: 'sm'}},
        Autocomplete: {defaultProps: {radius: 'sm'}},
        MultiSelect: {defaultProps: {radius: 'sm'}},
        DateInput: {defaultProps: {radius: 'sm'}},
        // Soft-tint status pills (e.g. Active = green tint) — the mock's chip look.
        Badge: {
            defaultProps: {radius: 'sm', variant: 'light'},
        },
        Chip: {
            defaultProps: {radius: 'sm'},
        },
        Progress: {defaultProps: {radius: rem(9999)}},
        Divider: {
            // Keyline dividers use the warm neutral ramp (brand Light-Grey family).
            styles: {root: {borderColor: 'var(--mantine-color-gray-3)'}},
        },
    },

    other: {
        /**
         * Brand roles for consumers that need a specific hex outside the Mantine
         * variant system (charts, the dark sidebar, the AI accent, semantics).
         */
        brand: {
            surface: dfrntBrand.lightGrey,      // warm page background
            surfacePaper: dfrntBrand.white,     // cards / panels
            chrome: dfrntBrand.inkBlue,          // sidebar / top bar (dark)
            accent: dfrntBrand.cyan,             // primary UI accent
            ai: dfrntBrand.purple,               // AI / Auto-Mate accent
        },
        semantic: {
            success: 'green',
            warning: 'orange',
            error: 'red',
            info: 'cyan',
        },
        /**
         * DFRNT icon spec (brand book p.17): Lucide for UI chrome, Tabler for
         * transport/logistics; always 36px / 1.25 stroke via the shared Icon
         * wrapper. Exposed here so the wrapper reads from one place.
         */
        icon: {size: 36, stroke: 1.25},
    },
});

export default dfrntTheme;
