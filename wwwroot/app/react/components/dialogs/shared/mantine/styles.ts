/**
 * Shared style tokens for the Mantine dialog design language (DFRNT).
 *
 * The Mantine counterpart to the MUI `shared/styles.ts`. One notable difference:
 * chrome is expressed with **CSS variables, not `sx`** — plain style objects and
 * Mantine props over `var(--mantine-*)` tokens.
 *
 * Only the `primary` variant is tenant-dependent (Ink-Blue on US, gold elsewhere).
 * The semantic fills and the neutral `surface` bar are the same on both; on
 * `surface` it is just the glyph that follows the brand.
 */
import type React from 'react';
import {alpha} from '@mantine/core';
import {dfrntBrand} from '../../../../theme/dfrntMantineTheme';
import {isUsTenant} from '../../../../theme/tenant';

/** Header variants that map onto a brand fill. */
export type HeaderVariant =
    | 'primary'
    | 'secondary'
    | 'error'
    | 'warning'
    | 'info'
    | 'success';

/**
 * The variants a header surface can take. Dialogs use the solid
 * {@link HeaderVariant} fills; page card/panel headers use `'surface'`.
 */
export type PanelHeaderVariant = HeaderVariant | 'surface';

/**
 * The solid header fill + its on-colour, per variant. A bold flat bar (no
 * gradient); the colour change is the separator. On-colours are hand-picked for
 * legibility on each fill (dark ink on the light Cyan/Orange fills, white on the
 * dark/saturated ones).
 */
export function getHeaderColors(isUsCustomer: boolean): Record<PanelHeaderVariant, {bg: string; fg: string}> {
    return {
        // The tenant's primary: Cyan on US, the brand gold elsewhere — the same
        // fill the MUI `headerChromeSx` uses (`palette.primary.main` +
        // `contrastText`), so a Mantine dialog and an unmigrated MUI one opened
        // in the same session wear the same header. Both hues are light, so the
        // on-colour is dark Ink on either tenant.
        primary: isUsCustomer
            ? {bg: dfrntBrand.cyan, fg: dfrntBrand.inkBlue}
            : {bg: dfrntBrand.gold, fg: dfrntBrand.inkBlue},
        secondary: {bg: dfrntBrand.purple, fg: '#ffffff'},
        info: {bg: dfrntBrand.cyan, fg: dfrntBrand.inkBlue}, // light Cyan → dark ink text
        success: {bg: dfrntBrand.green, fg: '#ffffff'},
        warning: {bg: dfrntBrand.orange, fg: dfrntBrand.inkBlue},
        error: {bg: dfrntBrand.red, fg: '#ffffff'},
        // Page card/panel headers: the card's own surface, so a keyline rather than
        // a colour change separates the bar from the body. Neutral on both tenants —
        // only the glyph follows the brand. Both tokens are colour-scheme aware, so
        // this follows dark mode for free.
        surface: {bg: 'var(--dd-surface-container)', fg: 'var(--mantine-color-text)'},
    };
}

/**
 * The brand accent for glyphs on the neutral `'surface'` bar — a darker step of the
 * tenant's ramp, since neither the Cyan nor the gold 500 reads on paper.
 */
export function getHeaderSurfaceAccent(isUsCustomer: boolean): string {
    return isUsCustomer ? '#1590c0' : dfrntBrand.goldDeep;
}

export const headerColors = getHeaderColors(isUsTenant());

export const headerSurfaceAccent = getHeaderSurfaceAccent(isUsTenant());

/** The header's on-colour — text, glyphs and the close button sit in this. */
export function headerOnColor(variant: PanelHeaderVariant = 'primary'): string {
    return headerColors[variant].fg;
}

/**
 * A translucent wash of the header's on-colour, for hover scrims and chip fills
 * that have to read on any of the six brand fills. The `'surface'` bar's
 * on-colour is a CSS variable, which `alpha()` cannot decompose, so it washes
 * the brand accent instead.
 */
export function headerOverlayColor(opacity: number, variant: PanelHeaderVariant = 'primary'): string {
    return variant === 'surface'
        ? alpha(headerSurfaceAccent, opacity)
        : alpha(headerColors[variant].fg, opacity);
}

/**
 * The header bar itself: solid fill, on-colour, and the standard padding/flex
 * layout. For headers built by hand rather than through `<DialogHeader>` — panel
 * bars, page headers and compact variants. Override `padding` after spreading it
 * if a surface needs a tighter bar.
 */
export function headerChromeStyle(variant: PanelHeaderVariant = 'primary'): React.CSSProperties {
    const {bg, fg} = headerColors[variant];
    return {
        backgroundColor: bg,
        color: fg,
        // The neutral bar shares the card's fill, so it needs a keyline to
        // separate it from the body; the solid fills separate themselves.
        borderBottom: variant === 'surface'
            ? '1px solid var(--mantine-color-default-border)'
            : 'none',
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--mantine-spacing-md)',
        paddingInline: 'var(--mantine-spacing-lg)',
        paddingBlock: 'var(--mantine-spacing-sm)',
    };
}

/**
 * The square icon chip inside a header: a translucent on-colour scrim behind the
 * glyph. `size` is load-bearing — 40 in dialogs, 32 on the dispatch panel bar, 36
 * on the messaging header. Unlike the MUI original there is no `& svg` rule to
 * auto-size the glyph, so pass the icon its own size at the call site.
 */
export function headerChipStyle(variant: PanelHeaderVariant = 'primary', size = 40): React.CSSProperties {
    return {
        width: size,
        height: size,
        borderRadius: 8,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        backgroundColor: headerOverlayColor(0.18, variant),
        // On the neutral bar the chip is the only brand colour, so the glyph
        // takes the accent rather than the body text colour.
        color: variant === 'surface' ? headerSurfaceAccent : headerOnColor(variant),
    };
}

/**
 * The quiet label that sits above a section Paper. Spread onto a Mantine
 * `<Text {...sectionLabelProps}>`.
 */
export const sectionLabelProps = {
    size: 'sm',
    c: 'dimmed',
    fw: 500,
    mb: 'xs',
} as const;

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
