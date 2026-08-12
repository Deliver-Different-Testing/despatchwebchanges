/**
 * DFRNT Mantine theme — the single source of truth for the brand in the React app.
 *
 * Ported from the `dfrnt-brand-theming` skill (`assets/mantineTheme.ts`), which is
 * the IntegrationManager AdminPortal's shipped theme. Prefer re-copying from the
 * skill over editing here, so despatchweb and IntegrationManager don't drift.
 *
 * Deviations from the skill's copy, all deliberate:
 *   - `carrierBrandColors` dropped — despatchweb has no carrier logo surfaces.
 *   - Font stack drops the `"Plus Jakarta Sans Variable"` (fontsource) name: this
 *     app already loads Plus Jakarta Sans from Google Fonts in `_Layout.cshtml`.
 *   - `dfrntBrand` semantic-hex export added for the non-Mantine consumers that
 *     need a plain hex (the dialog header map).
 *
 * Brand: Ink Blue #0d0c2c shell · Cyan #3bc7f4 primary · Light Grey #f4f2f1 page
 * (light) / charcoal #2c2a30 (dark). Lozenge buttons, elevation by tone not shadow.
 */
import {createTheme, type CSSVariablesResolver, type MantineColorsTuple} from '@mantine/core';
import {getMd3Scheme} from './md3';
import {isUsTenant} from './tenant';

// --- Brand ramps (0 lightest → 9 darkest) ---

const cyan: MantineColorsTuple = [
    '#e7f8fe', '#d8f4fd', '#b1e9fb', '#82dcf8', '#5bd1f5',
    '#3bc7f4', '#1eb2e6', '#1590c0', '#0f6f96', '#0a4d69',
]; // Cyan — the US tenant primary

const gold: MantineColorsTuple = [
    '#fef9e7', '#fcefc4', '#fae49d', '#f8d976', '#f6d058',
    '#f4c430', '#e5b52a', '#d4a324', '#c3911e', '#a87614',
]; // Warm amber gold — the non-US ("urgent") tenant primary

/** The tenant's primary ramp. Mirrors `dfrntPrimaryPalette`/`urgentPrimaryPalette` in palettes.ts. */
function brandRamp(isUsCustomer: boolean): MantineColorsTuple {
    return isUsCustomer ? cyan : gold;
}

const ink: MantineColorsTuple = [
    '#ecebf1', '#cfced5', '#a8a7b6', '#83829a', '#6e6d80',
    '#4f4e66', '#35334f', '#211f40', '#141233', '#0d0c2c',
]; // Ink Blue — shell / neutral-dark

const reflex: MantineColorsTuple = [
    '#eaeeff', '#d4dcff', '#aab8ff', '#7d92ff', '#5670ff',
    '#2a4eff', '#233fd6', '#1b31a8', '#132279', '#0b134a',
]; // #2a4eff — info / links

const grape: MantineColorsTuple = [
    '#f3edfc', '#e6dbf9', '#cdb7f3', '#b088ec', '#9865e5',
    '#824ae0', '#6c3bbe', '#552e95', '#3f226e', '#291546',
]; // #824ae0 — AI / Auto-Mate accent

const green: MantineColorsTuple = [
    '#e5f8ee', '#d0f1e0', '#a1e3c1', '#5fd199', '#2ec27a',
    '#13b964', '#0f9d55', '#0b7d44', '#085e33', '#053f22',
]; // #13b964 — success

const orange: MantineColorsTuple = [
    '#fff3e6', '#ffe6d1', '#ffcda3', '#ffab63', '#fe9333',
    '#fe811a', '#e06d10', '#b3560b', '#853f08', '#582905',
]; // #fe811a — warning

const red: MantineColorsTuple = [
    '#fdeaec', '#f8d6da', '#f1adb5', '#e97b88', '#e25062',
    '#dc3246', '#bb2a3c', '#93212f', '#6c1823', '#460f16',
]; // #dc3246 — error

// Warm-grey neutral ramp for the light surfaces (Light Grey #f4f2f1 family).
const gray: MantineColorsTuple = [
    '#ffffff', '#f8f7f7', '#f4f2f1', '#e7e5e4', '#d6d3d1',
    '#a8a29e', '#78716c', '#57534e', '#44403c', '#292524',
];

// Mantine's `dark` tuple drives every default surface/text role in dark mode
// (`--mantine-color-body` = dark[7], default component bg = dark[6], border = dark[4],
// text = dark[0], dimmed = dark[2]). Mapped 1:1 onto the DFRNT charcoal ladder in
// md3.ts so raw Mantine roles resolve to our tones, not Mantine's generic charcoal.
const D = getMd3Scheme('dark');
const dark: MantineColorsTuple = [
    D.onSurface,               // 0 text
    D.onSurfaceVariant,        // 1
    D.outline,                 // 2 dimmed
    '#6f6c75',                 // 3 (interpolated)
    D.outlineVariant,          // 4 border
    D.surfaceContainerHighest, // 5 hover
    D.surfaceContainerHigh,    // 6 default bg
    D.surface,                 // 7 body / page
    D.surfaceDim,              // 8
    D.surfaceContainerLowest,  // 9 deepest
];

// --- DFRNT design tokens — framework-free constants consumed across the app ---

/** Semantic brand hexes, for the rare consumer that needs a plain colour string. */
export const dfrntBrand = {
    inkBlue: ink[9],
    cyan: cyan[5],
    gold: gold[5],
    goldDeep: gold[9], // the only gold step dark enough to read as a glyph on paper
    lightGrey: gray[2],
    white: '#ffffff',
    reflexBlue: reflex[5],
    purple: grape[5],
    green: green[5],
    orange: orange[5],
    red: red[5],
} as const;

/**
 * The shell surface (app bar + side-nav account header) and the logo that reads on
 * it. US tenants get the Ink-Blue navy in both colour modes; non-US tenants get the
 * gold brand fill, which is a light hue and so carries Ink content and the standard
 * (dark) wordmark rather than the reversed one.
 */
export function getSidebarColors(isUsCustomer: boolean) {
    return isUsCustomer
        ? {
            appBar: ink[9],
            bg: ink[8], // drawer panel, one tier lighter than the bar
            logoSrc: 'images/dfrnt_logo_reversed.png',
            border: 'rgba(255, 255, 255, 0.10)',
            textPrimary: 'rgba(255, 255, 255, 0.95)',
            textSecondary: 'rgba(255, 255, 255, 0.60)',
            textMuted: 'rgba(255, 255, 255, 0.38)',
            hoverBg: 'rgba(255, 255, 255, 0.08)',
        }
        : {
            appBar: gold[5],
            bg: ink[8],
            logoSrc: 'images/dfrnt_logo.png',
            // Ink at the same alphas as the white set would fade out on a bright
            // fill, so the secondary/muted steps sit a little stronger.
            border: 'rgba(13, 12, 44, 0.14)',
            textPrimary: 'rgba(13, 12, 44, 0.95)',
            textSecondary: 'rgba(13, 12, 44, 0.65)',
            textMuted: 'rgba(13, 12, 44, 0.45)',
            hoverBg: 'rgba(13, 12, 44, 0.08)',
        };
}

/**
 * Overlays for content sitting on the shell scrim (shell chrome, dialog headers) —
 * white-based on the Ink bar, Ink-based on the gold one.
 */
export function getOnBrandScrim(isUsCustomer: boolean) {
    const on = isUsCustomer ? '255,255,255' : '13,12,44';
    return {
        text: isUsCustomer ? '#fff' : '#0d0c2c',
        bodyText: `rgba(${on},0.85)`,
        subtleText: `rgba(${on},0.8)`,
        mutedText: `rgba(${on},0.7)`,
        fill: `rgba(${on},0.15)`,
        fillStrong: `rgba(${on},0.2)`,
        hoverFill: `rgba(${on},0.1)`,
        faintHoverFill: `rgba(${on},0.08)`,
        solidHoverFill: `rgba(${on},0.9)`,
        border: `rgba(${on},0.4)`,
    };
}

/**
 * The wash a shell icon button shows on hover.
 *
 * Pinned rather than left to `variant="subtle"` because that variable resolves
 * against the *page's* colour scheme while the bar's fill never changes, so a
 * scheme flip would swap in a tint meant for a different background. On gold the
 * brand wash would be gold-on-gold, so the non-US bar washes with its Ink
 * on-colour instead.
 */
export function getShellIconHoverFill(isUsCustomer: boolean): string {
    return isUsCustomer
        ? 'color-mix(in srgb, var(--mantine-color-brand-5) 12%, transparent)'
        : 'color-mix(in srgb, var(--mantine-color-ink-9) 10%, transparent)';
}

/** The current tenant's shell tokens, for the few consumers outside a provider. */
export const sidebarColors = getSidebarColors(isUsTenant());

/** The current tenant's scrim overlays, for the few consumers outside a provider. */
export const onBrandScrim = getOnBrandScrim(isUsTenant());

/** Theme-aware palette for code / terminal blocks (on Ink Blue). */
export const codeBlockPalette = {
    background: '#141233',
    backgroundError: '#2e1a1a',
    textSuccess: '#5fd199',
    textInfo: '#7d92ff',
    textError: '#f1adb5',
};

/** Radius / duration / shadow tokens (MD3 corner scale). */
export const tokens = {
    radius: {xs: 4, sm: 8, md: 12, lg: 16, xl: 28, full: 9999, tile: 2},
    duration: {instant: 100, fast: 150, normal: 200, slow: 350},
    shadow: {
        sm: '0 1px 3px 0 rgba(0,0,0,.1), 0 1px 2px -1px rgba(0,0,0,.1)',
        md: '0 4px 6px -1px rgba(0,0,0,.1), 0 2px 4px -2px rgba(0,0,0,.1)',
        lg: '0 10px 15px -3px rgba(0,0,0,.1), 0 4px 6px -4px rgba(0,0,0,.1)',
        xl: '0 20px 25px -5px rgba(0,0,0,.1), 0 8px 10px -6px rgba(0,0,0,.1)',
    },
};

declare module '@mantine/core' {
    export interface MantineThemeOther {
        shell: typeof sidebarColors;
        scrim: typeof onBrandScrim;
        shellIconHoverFill: string;
        code: typeof codeBlockPalette;
        tokens: typeof tokens;
    }
}

// --- The theme ---

/**
 * Builds the theme for a tenant. `brand` is the tenant's primary ramp, so every
 * `color="brand"` / `--mantine-color-brand-*` consumer follows without edits.
 */
export function createDfrntTheme(isUsCustomer: boolean = isUsTenant()) {
    return createTheme({
        primaryColor: 'brand',
        primaryShade: {light: 5, dark: 4},
        autoContrast: true,
        luminanceThreshold: 0.4,
        // FloatingIndicator and the control transitions read this; without it
        // Mantine animates regardless of the OS preference.
        respectReducedMotion: true,
        colors: {brand: brandRamp(isUsCustomer), cyan, gold, ink, reflex, grape, green, orange, red, gray, dark},
        white: '#ffffff',
        black: ink[9],
        fontFamily: '"Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        fontFamilyMonospace: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        headings: {
            fontFamily: '"Plus Jakarta Sans", sans-serif',
            fontWeight: '600',
        },
        defaultRadius: 'md',
        radius: {xs: '4px', sm: '8px', md: '12px', lg: '16px', xl: '28px'},
        components: {
            Button: {defaultProps: {radius: 9999}}, // lozenge
            ActionIcon: {defaultProps: {radius: 9999}},
            // Cards/paper sit one tonal tier above the page in both schemes (elevation by
            // tone, not shadow). Applied as a class-based `styles.root`, NOT a `bg`
            // defaultProp, so a component's own inline `style={{background}}` still wins.
            Card: {
                defaultProps: {radius: 'md'},
                styles: {root: {backgroundColor: 'var(--dd-surface-container)'}},
            },
            Paper: {
                defaultProps: {radius: 'md'},
                styles: {root: {backgroundColor: 'var(--dd-surface-container)'}},
            },
            Modal: {
                defaultProps: {radius: 'lg', centered: true},
                styles: {content: {backgroundColor: 'var(--dd-surface-container-high)'}},
            },
            TextInput: {defaultProps: {radius: 'sm'}},
            Textarea: {defaultProps: {radius: 'sm'}},
            Select: {defaultProps: {radius: 'sm'}},
            Autocomplete: {defaultProps: {radius: 'sm'}},
            Menu: {
                defaultProps: {radius: 'sm', shadow: 'md'},
                styles: {dropdown: {backgroundColor: 'var(--dd-surface-container-high)'}},
            },
            Tooltip: {defaultProps: {radius: 'sm', color: 'ink'}},
            Badge: {defaultProps: {radius: 'sm'}},
            Chip: {defaultProps: {radius: 9999}},
            // Selection controls. Prefer `SegmentedToggle` (components/common/
            // segmented-toggle) for any single-select choice — these defaults
            // only keep stock usages on-brand.
            SegmentedControl: {defaultProps: {radius: 9999, withItemsBorders: false}},
            Switch: {defaultProps: {radius: 9999}},
            Radio: {defaultProps: {size: 'sm'}},
            Tabs: {styles: {tab: {paddingBlock: 14, fontWeight: 500}}},
        },
        other: {
            shell: getSidebarColors(isUsCustomer),
            scrim: getOnBrandScrim(isUsCustomer),
            shellIconHoverFill: getShellIconHoverFill(isUsCustomer),
            code: codeBlockPalette,
            tokens,
        },
    });
}

export const dfrntTheme = createDfrntTheme();

/**
 * Bridges the DFRNT surface ladder (md3.ts) into Mantine's CSS variables per
 * colour scheme. Passed to `<MantineProvider cssVariablesResolver>`.
 *
 * `--mantine-color-body` sets the page background; the `--dd-surface-*` custom vars
 * back the Card/Paper/Menu/Modal defaults above, so one scheme flip repaints
 * page → cards → menus with the intended tones.
 */
export const dfrntCssVariablesResolver: CSSVariablesResolver = (theme) => {
    const light = getMd3Scheme('light');
    const dk = getMd3Scheme('dark');
    return {
        variables: {
            // Shell chrome, published as vars so the static style objects in
            // `toolbarIconStyles` don't each need the theme threaded to them.
            '--dd-shell-bar': theme.other.shell.appBar,
            '--dd-on-shell': theme.other.scrim.text,
            '--dd-shell-icon-hover': theme.other.shellIconHoverFill,
        },
        light: {
            '--mantine-color-body': light.surface, // #f4f2f1 page
            '--dd-surface': light.surface,
            '--dd-surface-container': light.surfaceContainerLowest, // #ffffff cards
            '--dd-surface-container-high': light.surfaceContainerLowest, // #ffffff menus/dialogs
        },
        dark: {
            '--mantine-color-body': dk.surface, // #2c2a30 page
            '--dd-surface': dk.surface,
            '--dd-surface-container': dk.surfaceContainer, // #37353c cards
            '--dd-surface-container-high': dk.surfaceContainerHigh, // #413f47 menus/dialogs
        },
    };
};

export default dfrntTheme;
