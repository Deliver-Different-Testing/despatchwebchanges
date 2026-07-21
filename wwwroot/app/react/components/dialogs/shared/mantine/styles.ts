/**
 * Shared style tokens for the Mantine dialog design language (DFRNT).
 *
 * The Mantine counterpart to the MUI `shared/styles.ts`. Two big simplifications
 * vs the MUI version, both from the rebrand:
 *   - **One brand, no tenant.** The MUI header logic branched on the tenant
 *     palette (white-on-blue vs dark-on-gold). DFRNT is a single identity, so a
 *     header variant maps to one fixed fill + on-colour.
 *   - **CSS variables, not `sx`.** Section chrome is expressed as plain style
 *     objects / Mantine props, using `var(--mantine-*)` tokens.
 */
import {dfrntBrand} from '../../../../theme/dfrntMantineTheme';

/** Header variants that map onto a brand fill. */
export type HeaderVariant =
    | 'primary'
    | 'secondary'
    | 'error'
    | 'warning'
    | 'info'
    | 'success';

/**
 * The solid header fill + its on-colour, per variant. A bold flat bar (no
 * gradient); the colour change is the separator. On-colours are hand-picked for
 * legibility on each fill (dark ink on the light Cyan/Orange fills, white on the
 * dark/saturated ones).
 */
export const headerColors: Record<HeaderVariant, {bg: string; fg: string}> = {
    primary: {bg: dfrntBrand.inkBlue, fg: '#ffffff'},   // Ink-Blue chrome, white on it
    secondary: {bg: dfrntBrand.purple, fg: '#ffffff'},
    info: {bg: dfrntBrand.cyan, fg: dfrntBrand.inkBlue}, // light Cyan → dark ink text
    success: {bg: dfrntBrand.green, fg: '#ffffff'},
    warning: {bg: dfrntBrand.orange, fg: dfrntBrand.inkBlue},
    error: {bg: dfrntBrand.red, fg: '#ffffff'},
};

/**
 * Props for a white "section" Paper used inside dialog content — flat, keyline
 * border, medium (12px) corner. Spread onto a Mantine `<Paper {...sectionPaperProps}>`.
 */
export const sectionPaperProps = {
    withBorder: true,
    radius: 'md',
    p: 'md',
    bg: 'var(--mantine-color-white)',
} as const;

/** The dialog content area background — the warm off-white the white sections sit on. */
export const dialogContentBg = 'var(--mantine-color-gray-1)';

/** Footer keyline (top border) colour. */
export const dialogFooterBorder = '1px solid var(--mantine-color-gray-3)';
