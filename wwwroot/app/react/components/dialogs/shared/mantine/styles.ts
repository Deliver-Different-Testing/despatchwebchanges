/**
 * Shared style tokens for the Mantine dialog design language (DFRNT).
 *
 * The Mantine counterpart to the MUI `shared/styles.ts`. One notable difference:
 * chrome is expressed with **CSS variables, not `sx`** — plain style objects and
 * Mantine props over `var(--mantine-*)` tokens.
 *
 * Only the `primary` variant is tenant-dependent (Ink-Blue on US, gold elsewhere).
 * The semantic fills and the neutral `surface` bar are the same on both — the
 * neutral bar carries no brand colour at all, painting its glyph and its washes
 * in the body text colour so both follow the colour scheme.
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
 * The header bar's background + text colour, per variant. Every variant now
 * shares the same calm, neutral bar (the tone the `'surface'` variant always
 * used for page panels) — a keyline separates it from the body, not a colour
 * change. Semantic meaning moved to the icon chip's accent, see
 * {@link getHeaderAccents} — a colour change there, not a solid fill bar, is
 * the separator now.
 */
export function getHeaderColors(_isUsCustomer: boolean): Record<PanelHeaderVariant, {bg: string; fg: string}> {
    const neutral = {bg: 'var(--dd-surface-container)', fg: 'var(--mantine-color-text)'};
    return {
        primary: neutral,
        secondary: neutral,
        info: neutral,
        success: neutral,
        warning: neutral,
        error: neutral,
        surface: neutral,
    };
}

/**
 * The semantic hue behind each variant's icon chip — all that's left to carry
 * meaning now the header bar itself is neutral. `'surface'` (plain page/panel
 * headers) gets no accent at all: a neutral icon, since it isn't semantic.
 */
export function getHeaderAccents(isUsCustomer: boolean): Record<PanelHeaderVariant, string> {
    return {
        // The tenant's primary: Cyan on US, the brand gold elsewhere.
        primary: isUsCustomer ? dfrntBrand.cyan : dfrntBrand.gold,
        secondary: dfrntBrand.purple,
        info: dfrntBrand.cyan,
        success: dfrntBrand.green,
        warning: dfrntBrand.orange,
        error: dfrntBrand.red,
        surface: 'var(--mantine-color-text)',
    };
}

/**
 * The tenant's brand accent for use on paper — a darker step of the ramp, since
 * neither the Cyan nor the gold 500 reads there. Used by the controls that need to
 * signal selection on a light surface (`ActionButton`, `SegmentedToggle`, the
 * job-list view options tick), not by header chrome: the neutral bar is fully
 * neutral so it can follow the colour scheme.
 */
export function getHeaderSurfaceAccent(isUsCustomer: boolean): string {
    return isUsCustomer ? '#1590c0' : dfrntBrand.goldDeep;
}

export const headerColors = getHeaderColors(isUsTenant());

export const headerAccents = getHeaderAccents(isUsTenant());

export const headerSurfaceAccent = getHeaderSurfaceAccent(isUsTenant());

/** The header's on-colour — text and the close button sit in this. */
export function headerOnColor(variant: PanelHeaderVariant = 'primary'): string {
    return headerColors[variant].fg;
}

/** The header icon chip's colour — the one place variant meaning still shows. */
export function headerAccentColor(variant: PanelHeaderVariant = 'primary'): string {
    return headerAccents[variant];
}

/**
 * A translucent wash of the header's on-colour, for hover scrims and chip fills
 * that have to read on any of the six brand fills — and on the neutral bar, whose
 * on-colour is a CSS variable: `alpha()` emits a `color-mix` for those, so the
 * wash stays a live reference to the scheme-aware text colour and follows dark
 * mode rather than baking in a fixed accent.
 */
export function headerOverlayColor(opacity: number, variant: PanelHeaderVariant = 'primary'): string {
    return alpha(headerColors[variant].fg, opacity);
}

/**
 * The header bar itself: neutral fill, body text colour, and the standard
 * padding/flex layout. Every variant shares this now — the icon chip carries
 * the semantic colour, see {@link headerChipProps}. For headers built by hand
 * rather than through `<DialogHeader>` — panel bars, page headers and compact
 * variants. Override `padding` after spreading it if a surface needs a
 * tighter bar.
 */
export function headerChromeStyle(variant: PanelHeaderVariant = 'primary'): React.CSSProperties {
    const {bg, fg} = headerColors[variant];
    return {
        backgroundColor: bg,
        color: fg,
        // Every variant now shares the neutral bar, so it always needs the
        // keyline to separate it from the body.
        borderBottom: '1px solid var(--mantine-color-default-border)',
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--mantine-spacing-md)',
        paddingInline: 'var(--mantine-spacing-lg)',
        paddingBlock: 'var(--mantine-spacing-sm)',
    };
}

/**
 * The square icon chip inside a header: a translucent scrim of the variant's
 * accent colour behind the glyph — the one place a header still signals error/
 * warning/success/etc. at a glance, now that the bar itself is neutral.
 * `size` is load-bearing — 40 in dialogs, 32 on the dispatch panel bar, 36 on
 * the messaging header. Spread onto a `<ThemeIcon {...headerChipProps(v)}>`,
 * which brings the box, the centring and `min-width`/`min-height` natively; the
 * scrim rides ThemeIcon's own `--ti-bg`/`--ti-color` variables. Pass the icon its
 * own size at the call site — ThemeIcon sizes the box, not the glyph.
 */
export function headerChipProps(variant: PanelHeaderVariant = 'primary', size = 40) {
    const accent = headerAccentColor(variant);
    return {
        size,
        radius: 'md' as const,
        // Typed to admit the custom properties — `CSSProperties` alone cannot be
        // indexed by `--*`, which makes the vars unassertable in tests.
        style: {
            '--ti-bg': alpha(accent, 0.15),
            '--ti-color': accent,
        } as React.CSSProperties & Record<`--${string}`, string>,
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

/**
 * The modal shell's Mantine `styles`.
 *
 * The shell is a three-part column — header / scrolling body / footer — and the
 * shell itself never scrolls. Mantine caps `Modal.Content` at ~90dvh; the body
 * absorbs that cap and owns the only scrollbar, so the track stays inside the
 * body instead of running the full height of the dialog past the solid header
 * bar and across the 28px corners.
 *
 * `flex: '1 1 auto'` rather than `flex: 1`: a `0%` basis would contribute nothing
 * to the shell's auto height and collapse every dialog to header + footer. The
 * `minHeight: 0` is what lets the body shrink below its content once the cap
 * bites — without it the column overflows instead of scrolling.
 */
export const dialogShellStyles = {
    content: {display: 'flex', flexDirection: 'column', overflow: 'hidden'},
    body: {padding: 0, display: 'flex', flexDirection: 'column', flex: '1 1 auto', minHeight: 0, overflow: 'hidden'},
} satisfies Record<'content' | 'body', React.CSSProperties>;

/**
 * The scrolling region `<DialogShell>` wraps around everything between the
 * header and the footer.
 */
export const dialogScrollRegionStyle: React.CSSProperties = {
    flex: '1 1 auto',
    minHeight: 0,
    overflowY: 'auto',
};

/**
 * Pins dialog chrome against the nearest scroll container, so a title or action
 * bar rendered *inside* the scrolling body stays on screen while the rest of it
 * scrolls under. Both bars paint an opaque fill of their own, so nothing shows
 * through. `<DialogShell>` lifts a top-level `<DialogHeader>`/`<DialogFooter>`
 * out of the scroll region entirely, so there this is inert and harmless.
 */
export function dialogStickyChromeStyle(edge: 'top' | 'bottom'): React.CSSProperties {
    return {position: 'sticky', [edge]: 0, zIndex: 2};
}
