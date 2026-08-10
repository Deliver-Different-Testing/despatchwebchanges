import type {SxProps, Theme} from '@mui/material/styles';
import {headerOverlayColor} from '../../../components/dialogs/shared/styles';

/**
 * Shared styling for the small segmented ToggleButtonGroups that sit on the
 * dispatch panels' header bars (Tasks scope, Current Work scope). The bar is a
 * plain `'surface'` paper header, so the outline and selected fill are derived
 * from the header's on-colour rather than assuming a brand-coloured fill. Kept
 * in one place so the panels stay visually identical.
 */
export const headerScopeToggleSx = ((theme: Theme) => ({
    mr: 1,
    '& .MuiToggleButton-root': {
        color: 'inherit',
        borderColor: 'divider',
        textTransform: 'none',
        py: 0.25,
        px: 1.25,
    },
    '& .MuiToggleButton-root.Mui-selected': {
        bgcolor: headerOverlayColor(theme, 0.12, 'surface'),
        color: 'inherit',
        '&:hover': {bgcolor: headerOverlayColor(theme, 0.16, 'surface')},
    },
})) satisfies SxProps<Theme>;

/**
 * Shared styling for the low-emphasis text buttons that open a menu from the
 * dispatch panels' header bars (Tasks "Filters", Driver Locations "Trucks").
 * Inherits the header's on-colour with a matching translucent hover — no fill
 * or outline, per MD3 low-emphasis actions. Kept in one place so those controls
 * stay identical.
 */
export const headerTextButtonSx = ((theme: Theme) => ({
    color: 'inherit',
    textTransform: 'none',
    '&:hover': {bgcolor: headerOverlayColor(theme, 0.08, 'surface')},
})) satisfies SxProps<Theme>;

/** Icon-button counterpart of {@link headerTextButtonSx} for the same header bars. */
export const headerIconButtonSx = ((theme: Theme) => ({
    color: 'inherit',
    '&:hover': {bgcolor: headerOverlayColor(theme, 0.08, 'surface')},
})) satisfies SxProps<Theme>;
