/**
 * Job List view options — density selector, reset-columns, and the (dispatch-only)
 * "logged-in couriers only" toggle. Rendered either inline in the toolbar
 * (default) or, on the dispatch page, portaled into the gradient panel header
 * (`headerVariant`), where controls inherit the header's contrast colour.
 */

import React, {useCallback} from 'react';
import Box from '@mui/material/Box';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import ViewCompactIcon from '@mui/icons-material/ViewCompact';
import ViewListIcon from '@mui/icons-material/ViewList';
import DensitySmallIcon from '@mui/icons-material/DensitySmall';
import ViewWeekIcon from '@mui/icons-material/ViewWeek';
import type {SxProps, Theme} from '@mui/material';
import type {DensityMode} from '../../interfaces/dispatchJob';

interface JobListViewOptionsProps {
    densityMode: DensityMode;
    onDensityModeChange: (mode: DensityMode) => void;
    onResetColumns: () => void;
    loggedInCouriersOnly: boolean;
    onLoggedInCouriersOnlyChange: (checked: boolean) => void;
    /** Show the logged-in-couriers toggle (dispatch contexts only). */
    showLoggedInSwitch?: boolean;
    /** Style for the gradient panel header (inherit contrast colour) vs the toolbar. */
    headerVariant?: boolean;
}

const headerToggleSx = {
    '& .MuiToggleButton-root': {
        color: 'inherit',
        borderColor: 'rgba(255,255,255,0.5)',
        px: 0.75,
        py: 0.5,
    },
    '& .MuiToggleButton-root:hover': {bgcolor: 'rgba(255,255,255,0.12)'},
    '& .MuiToggleButton-root.Mui-selected': {
        color: 'inherit',
        bgcolor: 'rgba(255,255,255,0.25)',
        '&:hover': {bgcolor: 'rgba(255,255,255,0.32)'},
    },
} satisfies SxProps<Theme>;

const toolbarToggleSx = {
    '& .MuiToggleButton-root': {px: 0.75, py: 0.5},
} satisfies SxProps<Theme>;

export const JobListViewOptions: React.FC<JobListViewOptionsProps> = ({
    densityMode,
    onDensityModeChange,
    onResetColumns,
    loggedInCouriersOnly,
    onLoggedInCouriersOnlyChange,
    showLoggedInSwitch,
    headerVariant,
}) => {
    const handleDensityChange = useCallback(
        (_: React.MouseEvent<HTMLElement>, newMode: DensityMode | null) => {
            if (newMode !== null) onDensityModeChange(newMode);
        },
        [onDensityModeChange],
    );

    return (
        <Box sx={{display: 'flex', alignItems: 'center', gap: headerVariant ? 0.5 : 1}}>
            {showLoggedInSwitch && (
                <FormControlLabel
                    control={
                        <Switch
                            size="small"
                            checked={loggedInCouriersOnly}
                            onChange={(_, checked) => onLoggedInCouriersOnlyChange(checked)}
                        />
                    }
                    label="Logged-in only"
                    slotProps={{typography: {variant: 'body2', sx: {fontSize: '0.75rem', whiteSpace: 'nowrap', color: 'inherit'}}}}
                    sx={{ml: 0, mr: 0, color: 'inherit'}}
                />
            )}

            <ToggleButtonGroup
                value={densityMode}
                exclusive
                onChange={handleDensityChange}
                size="small"
                aria-label="Row density"
                sx={headerVariant ? headerToggleSx : toolbarToggleSx}
            >
                <ToggleButton value="normal">
                    <Tooltip title="Normal"><ViewListIcon fontSize="small"/></Tooltip>
                </ToggleButton>
                <ToggleButton value="dense">
                    <Tooltip title="Dense"><ViewCompactIcon fontSize="small"/></Tooltip>
                </ToggleButton>
                <ToggleButton value="ultra-dense">
                    <Tooltip title="Ultra Dense"><DensitySmallIcon fontSize="small"/></Tooltip>
                </ToggleButton>
            </ToggleButtonGroup>

            <Tooltip title="Reset column widths">
                <IconButton
                    size="small"
                    onClick={onResetColumns}
                    aria-label="Reset column widths"
                    sx={headerVariant
                        ? {color: 'inherit', '&:hover': {bgcolor: 'rgba(255,255,255,0.12)'}}
                        : {color: 'text.secondary'}}
                >
                    <ViewWeekIcon fontSize="small"/>
                </IconButton>
            </Tooltip>
        </Box>
    );
};
