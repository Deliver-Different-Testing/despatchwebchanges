/**
 * Per-user / per-tenant appearance: contrast level plus optional primary, secondary and body-text
 * colours. The same JSON shape is stored as the user's `ThemeCustomisation` StaffPreference and as
 * the tenant default (`tblSetting.AppearanceDefaultsJson`, set in the Configurator); the user's
 * fields win over the tenant's one by one.
 *
 * Colours are validated against WCAG before they can be saved: body text needs 4.5:1 against the
 * scheme's page and card surfaces (7:1 in high contrast, the AAA / Windows contrast-theme bar), and
 * a primary/secondary seed needs 4.5:1 against the text Mantine's autoContrast puts on it as a fill.
 */
import {contrastRatio, getMd3Scheme} from './md3';
import {luminance, nearestPassing} from './colorMath';

export type ContrastPreference = 'auto' | 'standard' | 'high';

export interface AppearanceSettings {
    contrast?: ContrastPreference;
    primary?: string;
    secondary?: string;
    textLight?: string;
    textDark?: string;
}

export type AppearanceColorField = 'primary' | 'secondary' | 'textLight' | 'textDark';

export const APPEARANCE_COLOR_FIELDS: readonly AppearanceColorField[] = ['primary', 'secondary', 'textLight', 'textDark'];

/** What the theme needs once contrast is resolved against the OS preference. */
export interface ThemeAppearance {
    highContrast: boolean;
    primary?: string;
    secondary?: string;
    textLight?: string;
    textDark?: string;
}

export const TEXT_MIN_CONTRAST = 4.5;
export const TEXT_MIN_CONTRAST_HIGH = 7;

const HEX_COLOR = /^#[0-9a-f]{6}$/i;
const CONTRAST_VALUES: readonly ContrastPreference[] = ['auto', 'standard', 'high'];

// Mirror the theme: autoContrast puts `black` (Ink) or white on a fill by this luminance threshold.
const LUMINANCE_THRESHOLD = 0.4;
const ON_FILL_DARK = '#0d0c2c';
const ON_FILL_LIGHT = '#ffffff';

export function isHexColor(value: unknown): value is string {
    return typeof value === 'string' && HEX_COLOR.test(value);
}

/** Valid fields of a stored settings blob (JSON string or object), or null when none are. */
export function parseAppearanceSettings(raw: unknown): AppearanceSettings | null {
    let value = raw;
    if (typeof raw === 'string') {
        if (!raw) return null;
        try {
            value = JSON.parse(raw);
        } catch {
            return null;
        }
    }
    if (!value || typeof value !== 'object') return null;
    const source = value as Record<string, unknown>;
    const settings: AppearanceSettings = {};
    if (CONTRAST_VALUES.includes(source.contrast as ContrastPreference)) {
        settings.contrast = source.contrast as ContrastPreference;
    }
    for (const field of APPEARANCE_COLOR_FIELDS) {
        const color = source[field];
        if (isHexColor(color)) settings[field] = color.toLowerCase();
    }
    return Object.keys(settings).length > 0 ? settings : null;
}

export function mergeAppearance(tenant: AppearanceSettings | null, user: AppearanceSettings | null): AppearanceSettings {
    return {...tenant, ...user};
}

export function resolveHighContrast(contrast: ContrastPreference | undefined, systemPrefersMore: boolean): boolean {
    return contrast === 'high' || ((contrast ?? 'auto') === 'auto' && systemPrefersMore);
}

export function toThemeAppearance(settings: AppearanceSettings, systemPrefersMore: boolean): ThemeAppearance {
    const {contrast, ...colors} = settings;
    return {...colors, highContrast: resolveHighContrast(contrast, systemPrefersMore)};
}

export interface ContrastCheck {
    ratio: number;
    min: number;
    passes: boolean;
}

function surfacesFor(field: 'textLight' | 'textDark'): string[] {
    if (field === 'textLight') {
        const light = getMd3Scheme('light');
        return [light.surface, light.surfaceContainerLowest];
    }
    const dark = getMd3Scheme('dark');
    return [dark.surface, dark.surfaceContainer, dark.surfaceContainerHigh];
}

/** Whether Ink (rather than white) is the text colour on a filled `fill`, as Mantine's autoContrast decides. */
export function inkReadsOnFill(fill: string): boolean {
    return luminance(fill) > LUMINANCE_THRESHOLD;
}

function onFill(fill: string): string {
    return inkReadsOnFill(fill) ? ON_FILL_DARK : ON_FILL_LIGHT;
}

/** The worst-case WCAG ratio for a chosen colour, against the minimum it has to meet. */
export function checkAppearanceColor(field: AppearanceColorField, hex: string, highContrast: boolean): ContrastCheck {
    if (field === 'textLight' || field === 'textDark') {
        const ratio = Math.min(...surfacesFor(field).map(bg => contrastRatio(hex, bg)));
        const min = highContrast ? TEXT_MIN_CONTRAST_HIGH : TEXT_MIN_CONTRAST;
        return {ratio, min, passes: ratio >= min};
    }
    const ratio = contrastRatio(onFill(hex), hex);
    return {ratio, min: TEXT_MIN_CONTRAST, passes: ratio >= TEXT_MIN_CONTRAST};
}

export function fixAppearanceColor(field: AppearanceColorField, hex: string, highContrast: boolean): string | null {
    return nearestPassing(hex, candidate => checkAppearanceColor(field, candidate, highContrast).passes);
}
