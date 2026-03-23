/**
 * Job List Toolbar
 *
 * Category filter tabs, search input, density mode selector, and reset button.
 * Follows the app's standard toolbar pattern (44px minHeight, divider border).
 */

import React, {useCallback, useRef, useEffect} from 'react';
import Box from '@mui/material/Box';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import Tooltip from '@mui/material/Tooltip';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import SearchIcon from '@mui/icons-material/Search';
import ViewCompactIcon from '@mui/icons-material/ViewCompact';
import ViewListIcon from '@mui/icons-material/ViewList';
import DensitySmallIcon from '@mui/icons-material/DensitySmall';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import type {SxProps, Theme} from '@mui/material';
import type {JobCategory, DensityMode} from '../../interfaces/dispatchJob';
import {AppPage} from '../../interfaces/dispatchJob';

interface JobListToolbarProps {
    selectedCategory: JobCategory;
    onCategoryChange: (category: JobCategory) => void;
    searchQuery: string;
    onSearchChange: (query: string) => void;
    loggedInCouriersOnly: boolean;
    onLoggedInCouriersOnlyChange: (checked: boolean) => void;
    densityMode: DensityMode;
    onDensityModeChange: (mode: DensityMode) => void;
    onResetColumns: () => void;
    appPage?: AppPage | number;
}

const SEARCH_DEBOUNCE_MS = 300;

const styles: Record<string, SxProps<Theme>> = {
    container: {
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        px: 2,
        py: 1,
        borderBottom: 1,
        borderColor: 'divider',
        bgcolor: 'background.paper',
        minHeight: 44,
        flexWrap: 'wrap',
    },
    categoryToggle: {
        borderRadius: 1,
        '& .MuiToggleButton-root': {
            px: 1.5,
            py: 0.5,
            fontSize: '0.75rem',
            textTransform: 'none',
            fontWeight: 500,
        },
        '& .MuiToggleButton-root[value="needs-dispatch"].Mui-selected': {
            bgcolor: 'warning.main',
            color: 'warning.contrastText',
            '&:hover': {bgcolor: 'warning.dark'},
        },
        '& .MuiToggleButton-root[value="in-progress"].Mui-selected': {
            bgcolor: 'info.main',
            color: 'info.contrastText',
            '&:hover': {bgcolor: 'info.dark'},
        },
        '& .MuiToggleButton-root[value="delivered"].Mui-selected': {
            bgcolor: 'success.main',
            color: 'success.contrastText',
            '&:hover': {bgcolor: 'success.dark'},
        },
        '& .MuiToggleButton-root[value="all"].Mui-selected': {
            bgcolor: 'primary.main',
            color: 'primary.contrastText',
            '&:hover': {bgcolor: 'primary.dark'},
        },
    },
    searchField: {
        flex: '1 1 160px',
        maxWidth: 280,
        '& .MuiOutlinedInput-root': {
            height: 32,
            borderRadius: 1,
        },
        '& .MuiInputBase-input': {
            fontSize: '0.8125rem',
            py: 0.5,
        },
    },
    densityToggle: {
        '& .MuiToggleButton-root': {
            px: 0.75,
            py: 0.5,
        },
    },
};

export const JobListToolbar: React.FC<JobListToolbarProps> = ({
    selectedCategory,
    onCategoryChange,
    searchQuery,
    onSearchChange,
    loggedInCouriersOnly,
    onLoggedInCouriersOnlyChange,
    densityMode,
    onDensityModeChange,
    onResetColumns,
    appPage,
}) => {
    const allowDispatch = appPage === AppPage.Dispatch || appPage === AppPage.JobSearch;
    const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const localInputRef = useRef(searchQuery);

    useEffect(() => {
        return () => {
            if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
        };
    }, []);

    const handleSearchInput = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            const value = e.target.value;
            localInputRef.current = value;

            if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
            searchTimerRef.current = setTimeout(() => {
                onSearchChange(value);
            }, SEARCH_DEBOUNCE_MS);
        },
        [onSearchChange],
    );

    const handleCategoryChange = useCallback(
        (_: React.MouseEvent<HTMLElement>, newCategory: JobCategory | null) => {
            if (newCategory !== null) {
                onCategoryChange(newCategory);
            }
        },
        [onCategoryChange],
    );

    const handleDensityChange = useCallback(
        (_: React.MouseEvent<HTMLElement>, newMode: DensityMode | null) => {
            if (newMode !== null) {
                onDensityModeChange(newMode);
            }
        },
        [onDensityModeChange],
    );

    return (
        <Box sx={styles.container}>
            {/* Category filter tabs */}
            <ToggleButtonGroup
                value={selectedCategory}
                exclusive
                onChange={handleCategoryChange}
                size="small"
                sx={styles.categoryToggle}
            >
                <ToggleButton value="needs-dispatch">Unassigned</ToggleButton>
                <ToggleButton value="in-progress">Active</ToggleButton>
                <ToggleButton value="delivered">Done</ToggleButton>
                <ToggleButton value="all">All</ToggleButton>
            </ToggleButtonGroup>

            {/* Search */}
            <TextField
                size="small"
                placeholder="Search jobs..."
                defaultValue={searchQuery}
                onChange={handleSearchInput}
                slotProps={{
                    input: {
                        startAdornment: (
                            <InputAdornment position="start">
                                <SearchIcon fontSize="small" sx={{color: 'text.disabled'}}/>
                            </InputAdornment>
                        ),
                    },
                }}
                sx={styles.searchField}
            />

            {/* Logged-in couriers only toggle - only shown when dispatching is enabled */}
            {allowDispatch && (
                <FormControlLabel
                    control={
                        <Switch
                            size="small"
                            checked={loggedInCouriersOnly}
                            onChange={(_, checked) => onLoggedInCouriersOnlyChange(checked)}
                        />
                    }
                    label="Logged-in only"
                    slotProps={{typography: {variant: 'body2', sx: {fontSize: '0.75rem', whiteSpace: 'nowrap'}}}}
                    sx={{ml: 0, mr: 0}}
                />
            )}

            <Box sx={{flex: 1}}/>

            {/* Density toggle */}
            <ToggleButtonGroup
                value={densityMode}
                exclusive
                onChange={handleDensityChange}
                size="small"
                sx={styles.densityToggle}
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

            {/* Reset columns */}
            <Tooltip title="Reset column widths">
                <IconButton size="small" onClick={onResetColumns} sx={{color: 'text.secondary'}}>
                    <RestartAltIcon fontSize="small"/>
                </IconButton>
            </Tooltip>
        </Box>
    );
};
