/**
 * Views Rail
 *
 * The scope selector at the top of the dispatch job list card: one pill per
 * admin-configured page view, multi-select, scrolling horizontally when the
 * card is narrow. Ports the V1 job-list card's view tab strip
 * (`components/home/home.template.html` `.view-tabs-header`).
 *
 * Presentational only — the page owns the selection and its persistence.
 */

import React, {useCallback} from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Skeleton from '@mui/material/Skeleton';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import ClearAllIcon from '@mui/icons-material/ClearAll';
import LayersOutlinedIcon from '@mui/icons-material/LayersOutlined';
import type {SxProps, Theme} from '@mui/material';
import type {DfrntPageViewModel} from '../../../../interfaces/dfrnt-page-view-model.interface';

export interface ViewsRailProps {
    views: DfrntPageViewModel[];
    selectedIds: number[];
    /**
     * Drives the empty-selection copy: with no view selected the server returns
     * every job on US tenants but nothing at all on NZ tenants
     * (`Repositories/BaseJobRepository.cs`).
     */
    isUsCustomer: boolean;
    loading?: boolean;
    onToggle: (viewId: number) => void;
    onClearAll: () => void;
}

// Matches the card's standard toolbar chrome (JobListToolbar) so the rail and
// the category tabs below it read as one bar of controls.
const railSx = {
    display: 'flex',
    alignItems: 'center',
    gap: 1.5,
    px: 2,
    py: 0.75,
    minHeight: 40,
    borderBottom: 1,
    borderColor: 'divider',
    bgcolor: 'background.paper',
} satisfies SxProps<Theme>;

const scrollSx = {
    flex: '1 1 auto',
    minWidth: 0,
    overflowX: 'auto',
    overflowY: 'hidden',
    py: 0.25,
    scrollbarWidth: 'thin',
    '&::-webkit-scrollbar': {height: 6},
    '&::-webkit-scrollbar-thumb': {
        borderRadius: 3,
        bgcolor: 'action.disabled',
    },
} satisfies SxProps<Theme>;

// Same pill geometry as the category tabs; primary fill for the neutral
// "scope" meaning, leaving the semantic colours to the status tabs.
const toggleGroupSx = {
    borderRadius: 1,
    '& .MuiToggleButton-root': {
        px: 1.5,
        py: 0.5,
        fontSize: '0.75rem',
        textTransform: 'none',
        fontWeight: 500,
        whiteSpace: 'nowrap',
    },
    '& .MuiToggleButton-root.Mui-selected': {
        bgcolor: 'primary.main',
        color: 'primary.contrastText',
        '&:hover': {bgcolor: 'primary.dark'},
    },
} satisfies SxProps<Theme>;

const trailingSx = {flexShrink: 0} satisfies SxProps<Theme>;

export const ViewsRail: React.FC<ViewsRailProps> = ({
    views,
    selectedIds,
    isUsCustomer,
    loading = false,
    onToggle,
    onClearAll,
}) => {
    const handleChange = useCallback(
        (_event: React.MouseEvent<HTMLElement>, nextIds: number[]) => {
            const before = new Set(selectedIds);
            const after = new Set(nextIds);
            const changed = [...before, ...after].find(id => before.has(id) !== after.has(id));
            if (changed !== undefined) onToggle(changed);
        },
        [selectedIds, onToggle],
    );

    if (loading) {
        return (
            <Box sx={railSx} data-testid="views-rail-loading">
                <LayersOutlinedIcon fontSize="small" sx={{color: 'text.secondary'}} aria-hidden/>
                {[96, 78, 64].map(width => (
                    <Skeleton key={width} variant="rounded" width={width} height={28}/>
                ))}
            </Box>
        );
    }

    if (views.length === 0) return null;

    return (
        <Box sx={railSx}>
            <LayersOutlinedIcon fontSize="small" sx={{color: 'text.secondary', flexShrink: 0}} aria-hidden/>
            <Box sx={scrollSx}>
                <ToggleButtonGroup
                    size="small"
                    value={selectedIds}
                    onChange={handleChange}
                    aria-label="Job list views"
                    sx={toggleGroupSx}
                >
                    {views.map(view => (
                        <ToggleButton key={view.id} value={view.id}>
                            {view.name}
                        </ToggleButton>
                    ))}
                </ToggleButtonGroup>
            </Box>
            {selectedIds.length > 0 ? (
                <Button
                    size="small"
                    startIcon={<ClearAllIcon/>}
                    onClick={onClearAll}
                    sx={{...trailingSx, textTransform: 'none'}}
                >
                    Clear
                </Button>
            ) : (
                <Typography variant="caption" sx={{...trailingSx, color: 'text.secondary'}}>
                    {isUsCustomer ? 'No view selected — showing all jobs.' : 'Select a view to load jobs.'}
                </Typography>
            )}
        </Box>
    );
};

export default ViewsRail;
