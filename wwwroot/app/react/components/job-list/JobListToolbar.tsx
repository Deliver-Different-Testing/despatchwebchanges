/**
 * Job List Toolbar
 *
 * Category filter tabs, search input, density mode selector, and reset button.
 * Follows the app's standard toolbar pattern (44px minHeight, divider border).
 */

import React, {useCallback, useRef, useEffect, useState} from 'react';
import Box from '@mui/material/Box';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import Tooltip from '@mui/material/Tooltip';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Popover from '@mui/material/Popover';
import Autocomplete from '@mui/material/Autocomplete';
import CircularProgress from '@mui/material/CircularProgress';
import SearchIcon from '@mui/icons-material/Search';
import ViewCompactIcon from '@mui/icons-material/ViewCompact';
import ViewListIcon from '@mui/icons-material/ViewList';
import DensitySmallIcon from '@mui/icons-material/DensitySmall';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import CloseIcon from '@mui/icons-material/Close';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import RestoreIcon from '@mui/icons-material/Restore';
import MarkEmailReadIcon from '@mui/icons-material/MarkEmailRead';
import MarkEmailUnreadIcon from '@mui/icons-material/MarkEmailUnread';
import type {SxProps, Theme} from '@mui/material';
import type {JobCategory, DensityMode} from '../../interfaces/dispatchJob';
import {AppPage} from '../../interfaces/dispatchJob';
import {searchActiveCouriersExtended} from '../../services/courierApi';

interface CourierOption {
    id: number;
    text: string;
}

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
    onBulkDispatch?: (courierId: number, courierName: string) => void;
    onBulkRestore?: () => void;
    onBulkMarkRead?: () => void;
    onBulkMarkUnread?: () => void;
    hideLoggedInSwitch?: boolean;
    todayOnly?: boolean;
    onTodayOnlyChange?: (checked: boolean) => void;
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
    onBulkDispatch,
    onBulkRestore,
    onBulkMarkRead,
    onBulkMarkUnread,
    hideLoggedInSwitch,
    todayOnly,
    onTodayOnlyChange,
}) => {
    const allowDispatch = appPage === AppPage.Dispatch || appPage === AppPage.JobSearch;
    const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const localInputRef = useRef(searchQuery);

    // Dispatch popover state
    const [dispatchAnchor, setDispatchAnchor] = useState<HTMLElement | null>(null);
    const [courierOptions, setCourierOptions] = useState<CourierOption[]>([]);
    const [courierLoading, setCourierLoading] = useState(false);
    const courierDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const courierAbortRef = useRef<AbortController | null>(null);

    useEffect(() => {
        return () => {
            if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
            if (courierDebounceRef.current) clearTimeout(courierDebounceRef.current);
            if (courierAbortRef.current) courierAbortRef.current.abort();
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

    const handleCourierSearch = useCallback((_event: React.SyntheticEvent, value: string) => {
        if (courierDebounceRef.current) clearTimeout(courierDebounceRef.current);
        if (courierAbortRef.current) courierAbortRef.current.abort();

        setCourierLoading(true);
        courierDebounceRef.current = setTimeout(async () => {
            const controller = new AbortController();
            courierAbortRef.current = controller;
            try {
                const results = await searchActiveCouriersExtended(value, {
                    loggedInOnly: loggedInCouriersOnly || undefined,
                    signal: controller.signal,
                });
                setCourierOptions(results.map(r => ({id: r.id, text: r.text})));
            } catch (err: any) {
                if (err?.name !== 'AbortError') setCourierOptions([]);
            } finally {
                setCourierLoading(false);
            }
        }, 300);
    }, [loggedInCouriersOnly]);

    const handleCourierSelect = useCallback((_event: React.SyntheticEvent, value: CourierOption | null) => {
        if (value && onBulkDispatch) {
            onBulkDispatch(value.id, value.text);
        }
        setDispatchAnchor(null);
        setCourierOptions([]);
    }, [onBulkDispatch]);

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
                    <>
                        <Button
                            size="small"
                            variant="outlined"
                            startIcon={<LocalShippingIcon/>}
                            onClick={(e) => setDispatchAnchor(e.currentTarget)}
                        >
                            Dispatch
                        </Button>
                        <Popover
                            open={Boolean(dispatchAnchor)}
                            anchorEl={dispatchAnchor}
                            onClose={() => {
                                setDispatchAnchor(null);
                                setCourierOptions([]);
                            }}
                            anchorOrigin={{vertical: 'bottom', horizontal: 'left'}}
                        >
                            <Box sx={{p: 2, width: 300}}>
                                <Autocomplete
                                    autoFocus
                                    openOnFocus
                                    size="small"
                                    options={courierOptions}
                                    getOptionLabel={(o) => o.text}
                                    loading={courierLoading}
                                    onInputChange={handleCourierSearch}
                                    onChange={handleCourierSelect}
                                    renderInput={(params) => (
                                        <TextField
                                            {...params}
                                            label="Search courier..."
                                            autoFocus
                                            slotProps={{
                                                input: {
                                                    ...params.InputProps,
                                                    endAdornment: (
                                                        <>
                                                            {courierLoading ? <CircularProgress size={18}/> : null}
                                                            {params.InputProps.endAdornment}
                                                        </>
                                                    ),
                                                },
                                            }}
                                        />
                                    )}
                                />
                            </Box>
                        </Popover>
                    </>
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

            {/* Logged-in couriers only toggle - only shown when dispatching is enabled */}
            {allowDispatch && !hideLoggedInSwitch && (
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

            {/* Today only toggle - shown on current work list */}
            {onTodayOnlyChange && (
                <FormControlLabel
                    control={
                        <Switch
                            size="small"
                            checked={todayOnly ?? true}
                            onChange={(_, checked) => onTodayOnlyChange(checked)}
                        />
                    }
                    label="Today only"
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
