/**
 * DFRNT surface ladder + semantic scheme builder — framework-free.
 *
 * Ported from the `dfrnt-brand-theming` skill (`assets/md3.ts`), which is itself
 * the IntegrationManager AdminPortal's `src/styles/md3.ts`. Keep the dark
 * charcoal ladder below in sync with the skill — it is shared verbatim with the
 * Hub app's LESS `.dd-dark-scheme()` ramp.
 *
 * One deliberate deviation from the skill's copy: the brand ramp is imported
 * from `./palettes` (this app's existing source of truth, also consumed by the
 * AngularJS `materialTheme.ts`) instead of being redeclared here, so there is a
 * single set of hexes.
 */
import {dfrntPrimaryPalette, accentPalette} from './palettes';

export type Md3Mode = 'light' | 'dark';

export interface Md3Scheme {
    primary: string;
    primaryLight: string;
    primaryDark: string;
    onPrimary: string;
    primaryContainer: string;
    onPrimaryContainer: string;
    secondary: string;
    onSecondary: string;
    secondaryContainer: string;
    onSecondaryContainer: string;
    surface: string;
    onSurface: string;
    onSurfaceVariant: string;
    surfaceContainerLowest: string;
    surfaceContainerLow: string;
    surfaceContainer: string;
    surfaceContainerHigh: string;
    surfaceContainerHighest: string;
    surfaceDim: string;
    surfaceBright: string;
    outline: string;
    outlineVariant: string;
    inverseSurface: string;
    inverseOnSurface: string;
}

const N = accentPalette;

// Cool soft-charcoal dark tiers — the canonical DFRNT dark surface ladder, shared
// with the Hub app. The container ladder stays monotonic (lowest → highest gets
// progressively lighter), preserving tonal elevation.
const darkSurface = {
    dim: '#28262c',
    containerLowest: '#252429',
    base: '#2c2a30', // surface / page background
    containerLow: '#312f36',
    container: '#37353c', // elevated surface — cards / paper in dark
    containerHigh: '#413f47', // menus / popovers in dark
    containerHighest: '#4c4952',
    bright: '#56535c',
};

function buildScheme(dark: boolean): Md3Scheme {
    const P = dfrntPrimaryPalette;
    return dark
        ? {
            primary: P[300],
            primaryLight: P[200],
            primaryDark: P[400],
            onPrimary: P[900],
            primaryContainer: P[900],
            onPrimaryContainer: P[100],
            secondary: N[300],
            onSecondary: N[900],
            secondaryContainer: N[700],
            onSecondaryContainer: N[100],
            surface: darkSurface.base,
            onSurface: '#E6E1E9',
            onSurfaceVariant: '#CAC4D0',
            surfaceContainerLowest: darkSurface.containerLowest,
            surfaceContainerLow: darkSurface.containerLow,
            surfaceContainer: darkSurface.container,
            surfaceContainerHigh: darkSurface.containerHigh,
            surfaceContainerHighest: darkSurface.containerHighest,
            surfaceDim: darkSurface.dim,
            surfaceBright: darkSurface.bright,
            outline: '#939099',
            outlineVariant: '#56535c',
            inverseSurface: '#E6E1E9',
            inverseOnSurface: '#322F35',
        }
        : {
            primary: P[500],
            primaryLight: P[300],
            primaryDark: P[700],
            onPrimary: '#0d0c2c', // dark Ink text on light cyan (WCAG)
            primaryContainer: P[50],
            onPrimaryContainer: P[900],
            secondary: N[500],
            onSecondary: '#ffffff',
            secondaryContainer: N[100],
            onSecondaryContainer: N[900],
            surface: '#f4f2f1', // Light Grey page background
            onSurface: '#0d0c2c',
            onSurfaceVariant: '#6e6d80', // brand Ink-Blue 60% — secondary text/icons
            surfaceContainerLowest: '#ffffff',
            surfaceContainerLow: '#f8f7f7',
            surfaceContainer: N[100],
            surfaceContainerHigh: N[200],
            surfaceContainerHighest: N[300],
            surfaceDim: N[200],
            surfaceBright: '#ffffff',
            outline: N[400],
            outlineVariant: N[200],
            inverseSurface: N[700],
            inverseOnSurface: '#ffffff',
        };
}

export const md3Schemes: Record<Md3Mode, Md3Scheme> = {
    light: buildScheme(false),
    dark: buildScheme(true),
};

export function getMd3Scheme(mode: Md3Mode): Md3Scheme {
    return md3Schemes[mode];
}

/** Relative-luminance WCAG contrast ratio between two hex colours. */
export function contrastRatio(fgHex: string, bgHex: string): number {
    const toLinear = (c: number): number => {
        const s = c / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    const lum = (hex: string): number => {
        const n = parseInt(hex.replace('#', ''), 16);
        const r = toLinear((n >> 16) & 0xff);
        const g = toLinear((n >> 8) & 0xff);
        const b = toLinear(n & 0xff);
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const l1 = lum(fgHex);
    const l2 = lum(bgHex);
    const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
    return (hi + 0.05) / (lo + 0.05);
}
