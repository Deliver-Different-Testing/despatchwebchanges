/**
 * DFRNT Mantine theme — the single source of truth for the brand in the React app.
 *
 * Ported from the `dfrnt-brand-theming` skill (`assets/mantineTheme.ts`), which is
 * the IntegrationManager AdminPortal's shipped theme. Prefer re-copying from the
 * skill over editing here, so despatchweb and IntegrationManager don't drift.
 *
 * Deviations from the skill's copy, all deliberate:
 *   - `carrierBrandColors` dropped — despatchweb has no carrier logo surfaces.
 *   - Plus Jakarta Sans is bundled from `@fontsource-variable/plus-jakarta-sans`
 *     (imported in `main.tsx`), not loaded from Google Fonts.
 *   - `dfrntBrand` semantic-hex export added for the non-Mantine consumers that
 *     need a plain hex (the dialog header map).
 *   - Radius scale squared off and the lozenge-button defaults dropped (see
 *     `tokens.radius` and the `Button`/`ActionIcon`/`Chip`/`SegmentedControl`
 *     component overrides below) — this app's operators found the fully-rounded
 *     brand shape read as toy-like on a dense operational dashboard, so it's
 *     softly rounded rather than fully square or a lozenge. `Switch` keeps its
 *     pill track; that's a near-universal toggle affordance, not the decorative
 *     pill shape being moved away from. Don't re-copy this file's radius section
 *     from the skill without re-applying this deviation.
 *
 * Brand: Ink Blue #0d0c2c shell · Cyan #3bc7f4 primary · Light Grey #f4f2f1 page
 * (light) / charcoal #2c2a30 (dark). Elevation by tone, plus a soft shadow.
 */
import {createTheme, type CSSVariablesResolver, type MantineColorsTuple} from '@mantine/core';
import {GlassDropdownRoot, glassClassNames} from '@deliver-different/glass';
import {contrastRatio, getMd3Scheme, type Md3Mode} from './md3';
import {generateRamp} from './colorMath';
import {inkReadsOnFill, TEXT_MIN_CONTRAST_HIGH, type ThemeAppearance} from './appearance';

// --- Brand ramps (0 lightest → 9 darkest) ---

const cyan: MantineColorsTuple = [
    '#e7f8fe', '#d8f4fd', '#b1e9fb', '#82dcf8', '#5bd1f5',
    '#3bc7f4', '#1eb2e6', '#1590c0', '#0f6f96', '#0a4d69',
]; // Cyan — the built-in DFRNT primary

const gold: MantineColorsTuple = [
    '#fef9e7', '#fcefc4', '#fae49d', '#f8d976', '#f6d058',
    '#f4c430', '#e5b52a', '#d4a324', '#c3911e', '#a87614',
]; // Warm amber gold

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
 * it. The bar is the primary colour (tenant default or the user's own), Ink Blue
 * when none is chosen. Content on it is Ink or white by the same rule the colour
 * validation uses, so a light primary carries Ink content and the standard (dark)
 * wordmark, and a dark one the reversed set.
 */
export function getSidebarColors(primary?: string) {
    const appBar = primary ?? ink[9];
    return inkReadsOnFill(appBar)
        ? {
            appBar,
            bg: ink[8], // drawer panel
            logoSrc: 'images/dfrnt_logo.png',
            // Ink at the same alphas as the white set would fade out on a bright
            // fill, so the secondary/muted steps sit a little stronger.
            border: 'rgba(13, 12, 44, 0.14)',
            textPrimary: 'rgba(13, 12, 44, 0.95)',
            textSecondary: 'rgba(13, 12, 44, 0.65)',
            textMuted: 'rgba(13, 12, 44, 0.45)',
            hoverBg: 'rgba(13, 12, 44, 0.08)',
        }
        : {
            appBar,
            bg: ink[8], // drawer panel, one tier lighter than the Ink bar
            logoSrc: 'images/dfrnt_logo_reversed.png',
            border: 'rgba(255, 255, 255, 0.10)',
            textPrimary: 'rgba(255, 255, 255, 0.95)',
            textSecondary: 'rgba(255, 255, 255, 0.60)',
            textMuted: 'rgba(255, 255, 255, 0.38)',
            hoverBg: 'rgba(255, 255, 255, 0.08)',
        };
}

/** Overlays for content sitting on the shell scrim (shell chrome, dialog headers). */
export function getOnBrandScrim(primary?: string) {
    const onInk = inkReadsOnFill(primary ?? ink[9]);
    const on = onInk ? '13,12,44' : '255,255,255';
    return {
        text: onInk ? '#0d0c2c' : '#fff',
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

/** The default (Ink) shell tokens, for the few consumers outside a provider. */
export const sidebarColors = getSidebarColors();

/** The default (Ink) scrim overlays, for the few consumers outside a provider. */
export const onBrandScrim = getOnBrandScrim();

/** Theme-aware palette for code / terminal blocks (on Ink Blue). */
export const codeBlockPalette = {
    background: '#141233',
    backgroundError: '#2e1a1a',
    textSuccess: '#5fd199',
    textInfo: '#7d92ff',
    textError: '#f1adb5',
};

/**
 * Radius / duration / shadow tokens (softly-rounded corporate corner scale).
 * `xl` stays large deliberately — it's what makes `radius="xl"` clip to a full
 * circle on avatars/ThemeIcons app-wide; shrinking it would turn those circles
 * into rounded squares, which was never part of the "less rounded" complaint.
 */
export const tokens = {
    // `card` (16px) is deliberately larger than `md`/`lg` — Apple-HIG-style
    // content containers (Card/Paper) read as roomier than the controls
    // sitting inside them (`sm`, 8px).
    radius: {xs: 2, sm: 8, md: 10, lg: 14, xl: 28, full: 9999, tile: 2, card: 16},
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
        code: typeof codeBlockPalette;
        tokens: typeof tokens;
        appearance: ThemeAppearance;
    }
}

// --- The theme ---

const STANDARD_APPEARANCE: ThemeAppearance = {highContrast: false};

/**
 * Builds the theme for a resolved appearance (tenant default with the user's
 * override on top). `brand` is DFRNT cyan unless a primary is chosen, so every
 * `color="brand"` / `--mantine-color-brand-*` consumer follows without edits, and
 * the app bar takes the primary too (Ink Blue without one); a
 * custom secondary replaces the `reflex` (links / info) ramp. The semantic status
 * ramps (red, green, orange) are never customised, so a status reads the same for
 * everyone.
 */
export function createDfrntTheme(appearance: ThemeAppearance = STANDARD_APPEARANCE) {
    const brand = appearance.primary ? generateRamp(appearance.primary) : cyan;
    const secondary = appearance.secondary ? generateRamp(appearance.secondary) : reflex;
    return createTheme({
        primaryColor: 'brand',
        primaryShade: {light: 5, dark: 4},
        autoContrast: true,
        luminanceThreshold: 0.4,
        // FloatingIndicator and the control transitions read this; without it
        // Mantine animates regardless of the OS preference.
        respectReducedMotion: true,
        colors: {brand, cyan, gold, ink, reflex: secondary, grape, green, orange, red, gray, dark},
        white: '#ffffff',
        black: ink[9],
        fontFamily: '"Plus Jakarta Sans Variable", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        fontFamilyMonospace: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        headings: {
            fontFamily: '"Plus Jakarta Sans Variable", sans-serif',
            fontWeight: '600',
        },
        defaultRadius: 'sm',
        // `xl` stays large — see the `tokens.radius` comment above.
        radius: {xs: '2px', sm: '8px', md: '10px', lg: '14px', xl: '28px'},
        // Wires the app's own soft shadow scale (`tokens.shadow`, already what the
        // LESS `@elevation-*` vars sync against) into Mantine's native shadow
        // system, so every `var(--mantine-shadow-*)` consumer app-wide gets the
        // same soft values instead of Mantine's un-customized defaults. `tokens.shadow`
        // has no `xs` tier, so it reuses `sm` — Mantine requires all five sizes.
        shadows: {xs: tokens.shadow.sm, ...tokens.shadow},
        components: {
            Button: {defaultProps: {radius: 'sm'}},
            ActionIcon: {defaultProps: {radius: 'sm'}},
            // Cards/paper sit one tonal tier above the page in both schemes, plus a soft
            // shadow for a little lift. Background applied as a class-based `styles.root`,
            // NOT a `bg` defaultProp, so a component's own inline `style={{background}}`
            // still wins.
            Card: {
                defaultProps: {radius: tokens.radius.card, shadow: 'sm'},
                styles: {root: {backgroundColor: 'var(--dd-surface-container)'}},
            },
            Paper: {
                defaultProps: {radius: tokens.radius.card, shadow: 'sm'},
                styles: {root: {backgroundColor: 'var(--dd-surface-container)'}},
            },
            // Not given the `card` radius or glass `overlayProps` defaults: every dialog
            // goes through DialogShell, which composes `Modal.Root`/`Overlay`/`Content`
            // directly and applies the glass overlay itself.
            Modal: {
                defaultProps: {radius: 'md', centered: true, shadow: 'md'},
                styles: {content: {backgroundColor: 'var(--dd-surface-container-high)'}},
            },
            TextInput: {defaultProps: {radius: 'sm'}},
            Textarea: {defaultProps: {radius: 'sm'}},
            Select: {defaultProps: {radius: 'sm'}},
            Autocomplete: {defaultProps: {radius: 'sm'}},
            Menu: {
                defaultProps: {radius: 'sm', shadow: 'md'},
                classNames: {dropdown: `${glassClassNames.glass} ${glassClassNames.panel}`},
            },
            Popover: {
                defaultProps: {radius: 'sm', shadow: 'md'},
                classNames: {dropdown: `${glassClassNames.glass} ${glassClassNames.panel}`},
            },
            // Menu renders through Popover, so this reaches both; Select/Autocomplete
            // dropdowns lack the glass class and render unchanged.
            PopoverDropdown: {defaultProps: {component: GlassDropdownRoot}},
            Tooltip: {defaultProps: {radius: 'sm', color: 'ink'}},
            Badge: {defaultProps: {radius: 'sm'}},
            Chip: {defaultProps: {radius: 'sm'}},
            // Selection controls. Prefer `SegmentedToggle` (components/common/
            // segmented-toggle) for any single-select choice — these defaults
            // only keep stock usages on-brand.
            SegmentedControl: {defaultProps: {radius: 'sm', withItemsBorders: false}},
            // Kept fully round: a pill toggle track is the universal switch
            // affordance, not the decorative lozenge shape the rest of the
            // controls moved away from.
            Switch: {defaultProps: {radius: 9999}},
            Radio: {defaultProps: {size: 'sm'}},
            Tabs: {styles: {tab: {paddingBlock: 14, fontWeight: 500}}},
        },
        other: {
            shell: getSidebarColors(appearance.primary),
            scrim: getOnBrandScrim(appearance.primary),
            code: codeBlockPalette,
            tokens,
            appearance,
        },
    });
}

export const dfrntTheme = createDfrntTheme();

/** Ramps whose `light`/`text`/`outline` roles carry meaning on the page (badges, links, alerts). */
const ROLE_RAMPS = ['brand', 'reflex', 'red', 'green', 'orange', 'grape', 'ink', 'cyan', 'gold'] as const;

/** Status/marker colours on the job list and elsewhere, published as `--dd-indicator-*`. */
const INDICATOR_RAMPS = {info: 'reflex', error: 'red', warning: 'orange', success: 'green', brand: 'brand'} as const;

type ResolverTheme = Parameters<CSSVariablesResolver>[0];

function surfacesFor(mode: Md3Mode): string[] {
    const scheme = getMd3Scheme(mode);
    return mode === 'light'
        ? [scheme.surface, scheme.surfaceContainerLowest]
        : [scheme.surface, scheme.surfaceContainer, scheme.surfaceContainerHigh];
}

/**
 * The mildest shade of a ramp that reaches `min` against every page/card surface of
 * the scheme (darker in light mode, lighter in dark) so the hue survives where it
 * can; the scheme's text colour when no shade does (e.g. pale gold).
 */
function strongShade(ramp: readonly string[], mode: Md3Mode, min: number, fallback: string): string {
    const order = mode === 'light' ? [6, 7, 8, 9] : [3, 2, 1, 0];
    const surfaces = surfacesFor(mode);
    return order.map(i => ramp[i]).find(hex => surfaces.every(bg => contrastRatio(hex, bg) >= min)) ?? fallback;
}

/** Standard: shade 5 of each ramp. High contrast: a shade that reaches 4.5:1 on the scheme. */
function indicatorVariables(theme: ResolverTheme, highContrast?: {mode: Md3Mode; fallback: string}): Record<string, string> {
    return Object.fromEntries(Object.entries(INDICATOR_RAMPS).map(([name, ramp]) => [
        `--dd-indicator-${name}`,
        highContrast
            ? strongShade(theme.colors[ramp], highContrast.mode, 4.5, highContrast.fallback)
            : `var(--mantine-color-${ramp}-5)`,
    ]));
}

/**
 * High contrast strengthens what is already there rather than swapping palettes:
 * dimmed text and placeholders go full-strength, hairlines become outlines, and every
 * coloured text role (light badges, links, alerts) moves to a shade reaching 7:1.
 */
function highContrastVariables(theme: ResolverTheme, mode: Md3Mode): Record<string, string> {
    const scheme = getMd3Scheme(mode);
    // Secondary text shares the full-strength colour: the dark scheme's onSurfaceVariant stops short of 7:1.
    const text = mode === 'light' ? theme.colors.gray[8] : scheme.onSurface;
    const border = mode === 'light' ? theme.colors.gray[6] : scheme.outline;
    const vars: Record<string, string> = {
        '--mantine-color-dimmed': text,
        '--mantine-color-placeholder': text,
        '--mantine-color-default-border': border,
        '--dd-outline-variant': border,
        '--mantine-color-gray-light-color': text,
        '--mantine-color-gray-text': text,
        '--mantine-color-gray-outline': text,
        ...indicatorVariables(theme, {mode, fallback: text}),
    };
    for (const name of ROLE_RAMPS) {
        const strong = strongShade(theme.colors[name], mode, TEXT_MIN_CONTRAST_HIGH, text);
        vars[`--mantine-color-${name}-light-color`] = strong;
        vars[`--mantine-color-${name}-text`] = strong;
        vars[`--mantine-color-${name}-outline`] = strong;
    }
    vars['--mantine-color-anchor'] = vars['--mantine-color-brand-text'];
    return vars;
}

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
    const {highContrast, textLight, textDark} = theme.other.appearance ?? STANDARD_APPEARANCE;
    return {
        variables: {
            // Shell chrome, published as vars so the static style objects in
            // `toolbarIconStyles` don't each need the theme threaded to them.
            '--dd-shell-bar': theme.other.shell.appBar,
            '--dd-on-shell': theme.other.scrim.text,
            ...indicatorVariables(theme),
        },
        light: {
            '--mantine-color-body': light.surface, // #f4f2f1 page
            '--dd-surface': light.surface,
            '--dd-surface-container': light.surfaceContainerLowest, // #ffffff cards
            '--dd-surface-container-high': light.surfaceContainerLowest, // #ffffff menus/dialogs
            '--dd-outline-variant': light.outlineVariant, // #e7e5e4 keyline divider / hairline border
            '--dd-dialog-section': 'var(--mantine-color-white)',
            '--dd-dialog-bar': 'var(--mantine-color-gray-1)',
            '--dd-dialog-body': 'var(--mantine-color-gray-2)',
            ...(highContrast ? highContrastVariables(theme, 'light') : {}),
            ...(textLight ? {'--mantine-color-text': textLight} : {}),
        },
        dark: {
            '--mantine-color-body': dk.surface, // #2c2a30 page
            '--dd-surface': dk.surface,
            '--dd-surface-container': dk.surfaceContainer, // #37353c cards
            '--dd-surface-container-high': dk.surfaceContainerHigh, // #413f47 menus/dialogs
            '--dd-outline-variant': dk.outlineVariant, // #56535c keyline divider / hairline border
            // Dialog planes by elevation: sections sit on the bars, which sit on the body.
            '--dd-dialog-section': dk.surfaceContainerHigh,
            '--dd-dialog-bar': dk.surfaceContainer,
            '--dd-dialog-body': dk.surfaceContainerLow,
            // Mantine's dark error is red-8, which vanishes on the charcoal ladder; red-2 is
            // the only step that holds 4.5:1 for small error text up to the dialog tier.
            '--mantine-color-error': theme.colors.red[2],
            // Mantine's gray-0..4 are fixed palette values that never flip, and the app uses
            // them as quiet fills (zebra rows, headers, hovers) and hairline borders. Remap
            // them onto the dark ladder so those follow the scheme. `white` is left alone:
            // it is used as text on filled badges and buttons.
            '--mantine-color-gray-0': dk.surfaceContainerLow,
            '--mantine-color-gray-1': dk.surfaceContainerHigh,
            '--mantine-color-gray-2': dk.surfaceContainerHighest,
            '--mantine-color-gray-3': dk.outlineVariant,
            '--mantine-color-gray-4': dk.outline,
            // Mantine derives `color="gray"` roles from gray-0/-8 in dark mode, which the remap
            // above turned into near-page surface tones (glyphs vanished). Set the roles directly.
            '--mantine-color-gray-light-color': dk.onSurfaceVariant,
            '--mantine-color-gray-text': dk.onSurfaceVariant,
            '--mantine-color-gray-outline': dk.onSurfaceVariant,
            '--mantine-color-gray-outline-hover': `color-mix(in srgb, ${dk.onSurfaceVariant} 10%, transparent)`,
            '--mantine-color-gray-light': `color-mix(in srgb, ${dk.onSurfaceVariant} 12%, transparent)`,
            '--mantine-color-gray-light-hover': `color-mix(in srgb, ${dk.onSurfaceVariant} 20%, transparent)`,
            '--mantine-color-gray-filled': dk.surfaceContainerHighest,
            '--mantine-color-gray-filled-hover': dk.surfaceBright,
            ...(highContrast ? highContrastVariables(theme, 'dark') : {}),
            ...(textDark ? {'--mantine-color-text': textDark} : {}),
        },
    };
};

export default dfrntTheme;
