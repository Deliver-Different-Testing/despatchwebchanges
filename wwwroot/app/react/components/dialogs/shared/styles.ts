/**
 * Shared style constants for the dialog design language.
 *
 * These encode the visual language documented in the project CLAUDE.md
 * ("Dialog design language"). Prefer the <DialogShell>, <DialogHeader> and
 * <DialogFooter> primitives over hand-rolling these; the raw constants are
 * exported for the cases where a dialog needs a bespoke section layout.
 */
import type {SxProps, Theme} from '@mui/material';
import {alpha} from '@mui/material/styles';

/** The header variants that map onto a palette colour. */
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
 * The header surface.
 *
 * The palette variants are a solid brand/semantic fill (the variant's `main`)
 * with its own on-colour (`contrastText`) — dark Ink on the DFRNT cyan,
 * white on red for error. A bold, flat bar. This is the dialog header.
 *
 * `'surface'` is the page card/panel header: a plain paper bar with primary
 * text, separated from the card body by a divider keyline rather than by a
 * change of colour. The card title then reads as part of its card instead of as
 * a coloured banner competing with the app bar.
 *
 * Spread into an `sx` block.
 */
export function headerSurfaceSx(theme: Theme, variant: PanelHeaderVariant = 'primary') {
    if (variant === 'surface') {
        return {
            backgroundColor: theme.palette.background.paper,
            color: theme.palette.text.primary,
            borderBottom: `1px solid ${theme.palette.divider}`,
        };
    }
    return {
        backgroundColor: theme.palette[variant].main,
        color: theme.palette[variant].contrastText,
        borderBottom: 'none',
    };
}

/**
 * The complete header container — {@link headerSurfaceSx} plus the standard
 * padding, flex layout and a bottom divider that separates the header from the
 * content. Single source of truth for header chrome: the bar height (via `py`)
 * and icon gap live here. Spread into an `sx` block; append per-header extras
 * (e.g. `flexShrink: 0`) or override `px`/`py` for a bespoke compact header.
 */
export function headerChromeSx(theme: Theme, variant: PanelHeaderVariant = 'primary') {
    return {
        ...headerSurfaceSx(theme, variant),
        px: 3,
        py: 1.5,
        display: 'flex',
        alignItems: 'center',
        gap: 1.75,
    };
}

/** The colour for a *bare* header icon (one not wrapped in a chip): the
 * palette's on-colour (`contrastText`), matching the header text on the fill.
 * On the `'surface'` bar there is no fill to match, so the glyph carries the
 * brand accent instead — `primary.dark`, since `primary.main` (cyan) is too
 * light to be legible on paper. */
export function headerAccentColor(theme: Theme, variant: PanelHeaderVariant = 'primary'): string {
    return variant === 'surface'
        ? theme.palette.primary.dark
        : theme.palette[variant].contrastText;
}

/**
 * The icon badge: a translucent scrim with a matching glyph. On the solid
 * headers that is the on-colour at 18% (a white chip with a white icon on a
 * dark fill, the dark-on-colour equivalent on cyan). On the `'surface'` bar it
 * is a light brand wash under {@link headerAccentColor} — the only brand colour
 * left on an otherwise neutral card header.
 */
export function headerBadgeSx(theme: Theme, variant: PanelHeaderVariant = 'primary') {
    if (variant === 'surface') {
        return {
            bgcolor: alpha(theme.palette.primary.main, 0.16),
            color: headerAccentColor(theme, variant),
        };
    }
    return {
        bgcolor: alpha(theme.palette[variant].contrastText, 0.18),
        color: theme.palette[variant].contrastText,
    };
}

/**
 * The complete icon chip — sizing, shape, {@link headerBadgeSx} fill, centring,
 * and a glyph size scaled to the chip. Single source of truth for chip size:
 * pass `size` for a bespoke compact header (e.g. 32 on the panel bar, 36 on the
 * messaging header); the glyph scales with it. Spread into an `sx` block.
 */
export function headerChipSx(theme: Theme, variant: PanelHeaderVariant = 'primary', size = 40) {
    return {
        width: size,
        height: size,
        borderRadius: 1.5,
        ...headerBadgeSx(theme, variant),
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        '& svg': {fontSize: Math.round(size * 0.55)},
    };
}

/** Colour for the close/secondary action buttons on the header: the palette's
 * on-colour, or the body text colour on the `'surface'` bar — the buttons stay
 * neutral so the brand accent belongs to the icon chip alone. */
export function headerOnColor(theme: Theme, variant: PanelHeaderVariant = 'primary'): string {
    return variant === 'surface'
        ? theme.palette.text.primary
        : theme.palette[variant].contrastText;
}

/** Translucent scrim (derived from {@link headerOnColor}) for hover states on
 * the header — a light wash on the solid fills, a dark one on the paper bar. */
export function headerOverlayColor(
    theme: Theme,
    opacity: number,
    variant: PanelHeaderVariant = 'primary',
): string {
    return alpha(headerOnColor(theme, variant), opacity);
}

/**
 * Standard white "section" Paper used inside dialog content. Spread-friendly:
 * `<Paper sx={{...sectionPaperSx, p: 2}}>` still type-checks.
 */
export const sectionPaperSx = {
    bgcolor: 'background.paper',
    borderRadius: 1.5,
    p: 2.5,
    border: '1px solid',
    borderColor: 'divider',
} satisfies SxProps<Theme>;

/**
 * Field label placed above a section Paper.
 */
export const sectionLabelSx = {
    color: 'text.secondary',
    fontWeight: 500,
    mb: 1,
} satisfies SxProps<Theme>;

/**
 * `sx` for TextFields inside dialog content, so the white input stands out
 * against the `background.default` content area.
 */
export const dialogFieldSx = {
    '& .MuiOutlinedInput-root': {bgcolor: 'background.paper'},
} satisfies SxProps<Theme>;
