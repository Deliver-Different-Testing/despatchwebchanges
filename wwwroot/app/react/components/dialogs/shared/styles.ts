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
 * The header surface — a solid brand/semantic fill (the variant's `main`) with
 * its own on-colour (`contrastText`): white-on-blue for the US tenant,
 * dark-on-gold for the amber tenant, white-on-red for error, etc. A bold, flat
 * bar — the master look without the gradient. Spread into an `sx` block.
 */
export function headerSurfaceSx(theme: Theme, variant: HeaderVariant = 'primary') {
    return {
        backgroundColor: theme.palette[variant].main,
        color: theme.palette[variant].contrastText,
    };
}

/**
 * The complete header container — {@link headerSurfaceSx} plus the standard
 * padding, flex layout and a bottom divider that separates the header from the
 * content. Single source of truth for header chrome: the bar height (via `py`)
 * and icon gap live here. Spread into an `sx` block; append per-header extras
 * (e.g. `flexShrink: 0`) or override `px`/`py` for a bespoke compact header.
 */
export function headerChromeSx(theme: Theme, variant: HeaderVariant = 'primary') {
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
 * palette's on-colour (`contrastText`), matching the header text on the fill. */
export function headerAccentColor(theme: Theme, variant: HeaderVariant = 'primary'): string {
    return theme.palette[variant].contrastText;
}

/**
 * The icon badge on the solid header: a translucent scrim of the on-colour with
 * the on-colour glyph — a white 18%-opacity chip with a white icon on the blue
 * tenant, the dark-on-colour equivalent on amber.
 */
export function headerBadgeSx(theme: Theme, variant: HeaderVariant = 'primary') {
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
export function headerChipSx(theme: Theme, variant: HeaderVariant = 'primary', size = 40) {
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

/** Colour for the close/secondary action buttons on the solid header: the
 * palette's on-colour. */
export function headerOnColor(theme: Theme, variant: HeaderVariant = 'primary'): string {
    return theme.palette[variant].contrastText;
}

/** Translucent scrim (derived from the on-colour) for hover states on the
 * solid header. */
export function headerOverlayColor(
    theme: Theme,
    opacity: number,
    variant: HeaderVariant = 'primary',
): string {
    return alpha(theme.palette[variant].contrastText, opacity);
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
