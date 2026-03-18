/**
 * Recurring Jobs Toolbar Component
 *
 * Search, filter, refresh, and export controls for the recurring jobs list.
 */

import React, {useCallback, useEffect, useRef, useState} from 'react';
import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import FormControl from '@mui/material/FormControl';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import type {SelectChangeEvent} from '@mui/material/Select';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Tooltip from '@mui/material/Tooltip';
import ClearIcon from '@mui/icons-material/Clear';
import ClearFiltersIcon from '@mui/icons-material/FilterAltOff';
import ExportIcon from '@mui/icons-material/FileDownload';
import RefreshIcon from '@mui/icons-material/Refresh';
import SearchIcon from '@mui/icons-material/Search';
import {CourierSuggestion, DAYS_OF_WEEK_BITS, DayOfWeekKey} from '../../../interfaces';
import {useCourierSearch} from '../../../hooks/useCourierApi';
import {useSpeedList} from '../../../hooks/useRecurringJobsApi';

export interface RecurringJobsFilters {
    speedId?: number;
    time?: string;
    courierId?: number;
    daysOfWeek?: number;
}

export interface RecurringJobsToolbarProps {
    searchText: string;
    isActive: boolean;
    isLoading: boolean;
    isExporting: boolean;
    filters: RecurringJobsFilters;
    onSearchChange: (searchText: string) => void;
    onActiveFilterChange: (isActive: boolean) => void;
    onFiltersChange: (filters: RecurringJobsFilters) => void;
    onRefresh: () => void;
    onExport: () => void;
}

const DEBOUNCE_DELAY = 300;
const MIN_SEARCH_LENGTH = 2;

const DAYS_ORDER: DayOfWeekKey[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DAY_ABBREVIATIONS: Record<DayOfWeekKey, string> = {
    Monday: 'M',
    Tuesday: 'T',
    Wednesday: 'W',
    Thursday: 'Th',
    Friday: 'F',
    Saturday: 'S',
    Sunday: 'Su',
};

export const RecurringJobsToolbar: React.FC<RecurringJobsToolbarProps> = ({
                                                                              searchText,
                                                                              isActive,
                                                                              isLoading,
                                                                              isExporting,
                                                                              filters,
                                                                              onSearchChange,
                                                                              onActiveFilterChange,
                                                                              onFiltersChange,
                                                                              onRefresh,
                                                                              onExport,
                                                                          }) => {
    const [localSearchText, setLocalSearchText] = useState(searchText);
    const [courierSearchText, setCourierSearchText] = useState('');
    const [selectedCourier, setSelectedCourier] = useState<CourierSuggestion | null>(null);
    const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

    // Fetch speed list and courier search
    const {data: speeds = []} = useSpeedList();
    const {data: courierSuggestions = [], isLoading: isLoadingCouriers} = useCourierSearch(courierSearchText);

    // Sync local state with prop
    useEffect(() => {
        setLocalSearchText(searchText);
    }, [searchText]);

    // Clear selected courier if filter is cleared externally
    useEffect(() => {
        if (!filters.courierId && selectedCourier) {
            setSelectedCourier(null);
        }
    }, [filters.courierId, selectedCourier]);

    const handleSearchInputChange = useCallback(
        (event: React.ChangeEvent<HTMLInputElement>) => {
            const value = event.target.value;
            setLocalSearchText(value);

            // Clear any existing timer
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
            }

            // Debounce the search
            debounceTimerRef.current = setTimeout(() => {
                if (value.length === 0 || value.length >= MIN_SEARCH_LENGTH) {
                    onSearchChange(value);
                }
            }, DEBOUNCE_DELAY);
        },
        [onSearchChange]
    );

    const handleClearSearch = useCallback(() => {
        setLocalSearchText('');
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
        }
        onSearchChange('');
    }, [onSearchChange]);

    const handleActiveFilterChange = useCallback(
        (_event: React.MouseEvent<HTMLElement>, newValue: boolean | null) => {
            if (newValue !== null) {
                onActiveFilterChange(newValue);
            }
        },
        [onActiveFilterChange]
    );

    // Filter handlers
    const handleSpeedChange = useCallback(
        (event: SelectChangeEvent<number | ''>) => {
            const value = event.target.value;
            onFiltersChange({
                ...filters,
                speedId: value === '' ? undefined : Number(value),
            });
        },
        [filters, onFiltersChange]
    );

    const handleCourierChange = useCallback(
        (_event: React.SyntheticEvent, value: CourierSuggestion | null) => {
            setSelectedCourier(value);
            onFiltersChange({
                ...filters,
                courierId: value?.id,
            });
        },
        [filters, onFiltersChange]
    );

    const handleDayToggle = useCallback(
        (day: DayOfWeekKey) => {
            const dayBit = DAYS_OF_WEEK_BITS[day];
            const currentDays = filters.daysOfWeek || 0;
            const newDays = (currentDays & dayBit) ? (currentDays & ~dayBit) : (currentDays | dayBit);
            onFiltersChange({
                ...filters,
                daysOfWeek: newDays || undefined,
            });
        },
        [filters, onFiltersChange]
    );

    const isDaySelected = useCallback(
        (day: DayOfWeekKey) => {
            return ((filters.daysOfWeek || 0) & DAYS_OF_WEEK_BITS[day]) !== 0;
        },
        [filters.daysOfWeek]
    );

    const handleClearFilters = useCallback(() => {
        setSelectedCourier(null);
        setCourierSearchText('');
        onFiltersChange({
            speedId: undefined,
            courierId: undefined,
            daysOfWeek: undefined,
        });
    }, [onFiltersChange]);

    const hasActiveFilters = filters.speedId !== undefined ||
        filters.courierId !== undefined ||
        filters.daysOfWeek !== undefined;

    // Cleanup timer on unmount
    useEffect(() => {
        return () => {
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
            }
        };
    }, []);

    return (
        <Box
            sx={{
                display: 'flex',
                flexDirection: 'column',
                borderBottom: 1,
                borderColor: 'divider',
                bgcolor: 'grey.50',
            }}
        >
            {/* Main toolbar row */}
            <Box
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                    p: 1.5,
                }}
            >
                {/* Search Field */}
                <TextField
                    size="small"
                    placeholder="Search jobs..."
                    value={localSearchText}
                    onChange={handleSearchInputChange}
                    disabled={isLoading}
                    sx={{
                        width: 250,
                        '& .MuiOutlinedInput-root': {
                            bgcolor: 'background.paper',
                        },
                    }}
                    slotProps={{
                        input: {
                            startAdornment: (
                                <InputAdornment position="start">
                                    <SearchIcon sx={{color: 'text.secondary', fontSize: 20}}/>
                                </InputAdornment>
                            ),
                            endAdornment: localSearchText ? (
                                <InputAdornment position="end">
                                    <IconButton
                                        size="small"
                                        onClick={handleClearSearch}
                                        edge="end"
                                    >
                                        <ClearIcon sx={{fontSize: 18}}/>
                                    </IconButton>
                                </InputAdornment>
                            ) : null,
                        },
                    }}
                />

                {/* Active/Inactive Filter */}
                <ToggleButtonGroup
                    value={isActive}
                    exclusive
                    onChange={handleActiveFilterChange}
                    size="small"
                    disabled={isLoading}
                >
                    <ToggleButton
                        value={true}
                        sx={{
                            px: 2,
                            textTransform: 'none',
                            '&.Mui-selected': {
                                bgcolor: 'success.main',
                                color: 'success.contrastText',
                                '&:hover': {
                                    bgcolor: 'success.dark',
                                },
                            },
                        }}
                    >
                        Active
                    </ToggleButton>
                    <ToggleButton
                        value={false}
                        sx={{
                            px: 2,
                            textTransform: 'none',
                            '&.Mui-selected': {
                                bgcolor: 'grey.600',
                                color: 'common.white',
                                '&:hover': {
                                    bgcolor: 'grey.700',
                                },
                            },
                        }}
                    >
                        Inactive
                    </ToggleButton>
                </ToggleButtonGroup>

                {/* Spacer */}
                <Box sx={{flex: 1}}/>

                {/* Refresh Button */}
                <Tooltip title="Refresh">
                    <span>
                        <IconButton
                            onClick={onRefresh}
                            disabled={isLoading}
                            size="small"
                            sx={{
                                bgcolor: 'background.paper',
                                border: 1,
                                borderColor: 'divider',
                                '&:hover': {bgcolor: 'grey.100'},
                            }}
                        >
                            {isLoading ? (
                                <CircularProgress size={20}/>
                            ) : (
                                <RefreshIcon/>
                            )}
                        </IconButton>
                    </span>
                </Tooltip>

                {/* Export Button */}
                <Tooltip title="Export to CSV">
                    <span>
                        <IconButton
                            onClick={onExport}
                            disabled={isLoading || isExporting}
                            size="small"
                            sx={{
                                bgcolor: 'background.paper',
                                border: 1,
                                borderColor: 'divider',
                                '&:hover': {bgcolor: 'grey.100'},
                            }}
                        >
                            {isExporting ? (
                                <CircularProgress size={20}/>
                            ) : (
                                <ExportIcon/>
                            )}
                        </IconButton>
                    </span>
                </Tooltip>
            </Box>

            {/* Filters row */}
            <Box
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                    px: 1.5,
                    pb: 1.5,
                    flexWrap: 'wrap',
                }}
            >
                {/* Speed Filter */}
                <FormControl size="small" sx={{minWidth: 120}}>
                    <InputLabel>Speed</InputLabel>
                    <Select
                        value={filters.speedId ?? ''}
                        onChange={handleSpeedChange}
                        label="Speed"
                        disabled={isLoading}
                        sx={{bgcolor: 'background.paper'}}
                    >
                        <MenuItem value="">
                            <em>All</em>
                        </MenuItem>
                        {speeds.map((speed) => (
                            <MenuItem key={speed.id} value={speed.id}>
                                {speed.text}
                            </MenuItem>
                        ))}
                    </Select>
                </FormControl>

                {/* Courier Filter */}
                <Autocomplete
                    size="small"
                    options={courierSuggestions}
                    getOptionLabel={(option) => option.text}
                    value={selectedCourier}
                    onChange={handleCourierChange}
                    onInputChange={(_event, value) => setCourierSearchText(value)}
                    loading={isLoadingCouriers}
                    disabled={isLoading}
                    sx={{width: 200}}
                    renderInput={({InputProps: autoInputProps, ...params}) => (
                        <TextField
                            {...params}
                            label="Courier"
                            sx={{
                                '& .MuiOutlinedInput-root': {
                                    bgcolor: 'background.paper',
                                },
                            }}
                            slotProps={{
                                input: {
                                    ...autoInputProps,
                                    endAdornment: (
                                        <>
                                            {isLoadingCouriers ? <CircularProgress color="inherit" size={16}/> : null}
                                            {autoInputProps.endAdornment}
                                        </>
                                    ),
                                },
                            }}
                        />
                    )}
                />

                {/* Days of Week Filter */}
                <Box sx={{display: 'flex', alignItems: 'center', gap: 0.5}}>
                    <Box component="span" sx={{color: 'text.secondary', fontSize: '0.875rem', mr: 0.5}}>
                        Days:
                    </Box>
                    <ToggleButtonGroup size="small" disabled={isLoading}>
                        {DAYS_ORDER.map((day) => (
                            <ToggleButton
                                key={day}
                                value={day}
                                selected={isDaySelected(day)}
                                onClick={() => handleDayToggle(day)}
                                sx={{
                                    px: 1,
                                    py: 0.5,
                                    minWidth: 32,
                                    textTransform: 'none',
                                    fontSize: '0.75rem',
                                    '&.Mui-selected': {
                                        bgcolor: 'primary.main',
                                        color: 'primary.contrastText',
                                        '&:hover': {
                                            bgcolor: 'primary.dark',
                                        },
                                    },
                                }}
                            >
                                {DAY_ABBREVIATIONS[day]}
                            </ToggleButton>
                        ))}
                    </ToggleButtonGroup>
                </Box>

                {/* Clear Filters Button */}
                {hasActiveFilters && (
                    <Tooltip title="Clear all filters">
                        <IconButton
                            onClick={handleClearFilters}
                            disabled={isLoading}
                            size="small"
                            sx={{
                                bgcolor: 'background.paper',
                                border: 1,
                                borderColor: 'divider',
                                '&:hover': {bgcolor: 'error.50'},
                            }}
                        >
                            <ClearFiltersIcon sx={{fontSize: 20, color: 'error.main'}}/>
                        </IconButton>
                    </Tooltip>
                )}
            </Box>
        </Box>
    );
};

export default RecurringJobsToolbar;
