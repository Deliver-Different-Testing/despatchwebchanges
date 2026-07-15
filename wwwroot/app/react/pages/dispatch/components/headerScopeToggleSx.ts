import type {SxProps, Theme} from '@mui/material/styles';

/**
 * Shared styling for the small segmented ToggleButtonGroups that sit on the
 * dispatch panels' coloured header bars (Tasks scope, Current Work scope).
 * A white-on-header outline with a translucent selected fill so the control
 * reads against the brand-coloured header. Kept in one place so the panels
 * stay visually identical.
 */
export const headerScopeToggleSx = {
    mr: 1,
    '& .MuiToggleButton-root': {
        color: 'inherit',
        borderColor: 'rgba(255,255,255,0.4)',
        textTransform: 'none',
        py: 0.25,
        px: 1.25,
    },
    '& .MuiToggleButton-root.Mui-selected': {
        bgcolor: 'rgba(255,255,255,0.2)',
        color: 'inherit',
        '&:hover': {bgcolor: 'rgba(255,255,255,0.28)'},
    },
} satisfies SxProps<Theme>;

/**
 * Shared styling for the low-emphasis text buttons that open a menu from the
 * dispatch panels' coloured header bars (Tasks "Filters", Driver Locations
 * "Trucks"). Inherits the header's contrast colour with a translucent-white
 * hover — no fill or outline, per MD3 low-emphasis actions on a coloured
 * surface. Kept in one place so those controls stay identical.
 */
export const headerTextButtonSx = {
    color: 'inherit',
    textTransform: 'none',
    '&:hover': {bgcolor: 'rgba(255,255,255,0.12)'},
} satisfies SxProps<Theme>;
