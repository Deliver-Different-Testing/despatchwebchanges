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
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import RestoreIcon from '@mui/icons-material/Restore';
import MarkEmailReadIcon from '@mui/icons-material/MarkEmailRead';
import MarkEmailUnreadIcon from '@mui/icons-material/MarkEmailUnread';
import type {SxProps, Theme} from '@mui/material';
import type {JobCategory, DensityMode} from '../../interfaces/dispatchJob';
import {AppPage} from '../../interfaces/dispatchJob';
import {JobListViewOptions} from './JobListViewOptions';

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
    selectedCount?: number;
    onClearSelection?: () => void;
    /** Opens the universal dispatch dialog in bulk mode. */
    onBulkDispatchClick?: () => void;
    onBulkRestore?: () => void;
    onBulkMarkRead?: () => void;
    onBulkMarkUnread?: () => void;
    hideLoggedInSwitch?: boolean;
    /**
     * Render the view options (density / reset columns / logged-in toggle) inline
     * in the toolbar. Set false when they're relocated to the panel header.
     * Defaults to true.
     */
    renderViewOptions?: boolean;
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
    selectedCount = 0,
    onClearSelection,
    onBulkDispatchClick,
    onBulkRestore,
    onBulkMarkRead,
    onBulkMarkUnread,
    hideLoggedInSwitch,
    renderViewOptions = true,
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

    // Selection action bar
    if (selectedCount > 0) {
        return (
            <Box sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                px: 2,
                py: 1,
                borderBottom: 1,
                borderColor: 'divider',
                bgcolor: 'rgba(25, 118, 210, 0.08)',
                minHeight: 44,
            }}>
                <IconButton size="small" onClick={onClearSelection} sx={{mr: 0.5}}>
                    <CloseIcon fontSize="small"/>
                </IconButton>
                <Typography variant="body2" sx={{fontWeight: 600, mr: 2}}>
                    {selectedCount} job{selectedCount !== 1 ? 's' : ''} selected
                </Typography>

                {allowDispatch && (
                    <Button
                        size="small"
                        variant="outlined"
                        startIcon={<LocalShippingIcon/>}
                        onClick={onBulkDispatchClick}
                    >
                        Dispatch
                    </Button>
                )}

                {allowDispatch && (
                    <Button size="small" variant="outlined" startIcon={<RestoreIcon/>} onClick={onBulkRestore}>
                        Restore
                    </Button>
                )}

                <Button size="small" variant="outlined" startIcon={<MarkEmailReadIcon/>} onClick={onBulkMarkRead}>
                    Mark Read
                </Button>
                <Button size="small" variant="outlined" startIcon={<MarkEmailUnreadIcon/>} onClick={onBulkMarkUnread}>
                    Mark Unread
                </Button>
            </Box>
        );
    }

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

            <Box sx={{flex: 1}}/>

            {/* View options — relocated to the panel header on the dispatch page
                (renderViewOptions=false); rendered inline elsewhere. */}
            {renderViewOptions && (
                <JobListViewOptions
                    densityMode={densityMode}
                    onDensityModeChange={onDensityModeChange}
                    onResetColumns={onResetColumns}
                    loggedInCouriersOnly={loggedInCouriersOnly}
                    onLoggedInCouriersOnlyChange={onLoggedInCouriersOnlyChange}
                    showLoggedInSwitch={allowDispatch && !hideLoggedInSwitch}
                />
            )}
        </Box>
    );
};
