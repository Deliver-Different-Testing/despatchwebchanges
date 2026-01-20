/**
 * Current Work All Drivers Component
 *
 * React component that displays a list of all drivers with their job counts.
 * Features: search by courier name, sort alphabetically.
 */

import React, { useMemo, useState, useCallback } from 'react';
import {
    Box,
    List,
    ListItemButton,
    ListItemText,
    Chip,
    Typography,
    TextField,
    InputAdornment,
    IconButton,
    Tooltip,
    LinearProgress,
    Divider,
} from '@mui/material';
import {
    Search as SearchIcon,
    SortByAlpha as SortIcon,
    Clear as ClearIcon,
    LocalShipping as TruckIcon,
} from '@mui/icons-material';
import { IDriverWorkOverview, SortOrder, CurrentWorkAllDriversProps } from './CurrentWorkAllDrivers.types';

/**
 * Get chip color based on job count
 */
function getJobCountColor(jobCount: number): 'success' | 'warning' | 'error' | 'default' {
    if (jobCount === 0) return 'default';
    if (jobCount <= 3) return 'success';
    if (jobCount <= 6) return 'warning';
    return 'error';
}

export const CurrentWorkAllDrivers: React.FC<CurrentWorkAllDriversProps> = ({
    drivers,
    loading = false,
    selectedCourierId,
    onDriverSelect,
}) => {
    const [searchText, setSearchText] = useState('');
    const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

    const handleSearchChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        setSearchText(event.target.value);
    }, []);

    const handleClearSearch = useCallback(() => {
        setSearchText('');
    }, []);

    const toggleSortOrder = useCallback(() => {
        setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    }, []);

    const filteredAndSortedDrivers = useMemo(() => {
        let result = [...drivers];

        // Filter by search text
        if (searchText.trim()) {
            const searchLower = searchText.toLowerCase().trim();
            result = result.filter(driver =>
                driver.name.toLowerCase().includes(searchLower)
            );
        }

        // Sort alphabetically by name
        result.sort((a, b) => {
            const comparison = a.name.localeCompare(b.name, undefined, {
                sensitivity: 'base',
                numeric: true,
            });
            return sortOrder === 'asc' ? comparison : -comparison;
        });

        return result;
    }, [drivers, searchText, sortOrder]);

    const handleDriverClick = useCallback((driver: IDriverWorkOverview) => {
        onDriverSelect(driver);
    }, [onDriverSelect]);

    return (
        <Box
            sx={{
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
                overflow: 'hidden',
                bgcolor: 'background.paper',
            }}
        >
            {/* Search and Sort Header */}
            <Box
                sx={{
                    p: 1.5,
                    borderBottom: 1,
                    borderColor: 'divider',
                    bgcolor: 'grey.50',
                }}
            >
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                    <TextField
                        size="small"
                        placeholder="Search courier..."
                        value={searchText}
                        onChange={handleSearchChange}
                        sx={{ flex: 1 }}
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position="start">
                                    <SearchIcon fontSize="small" color="action" />
                                </InputAdornment>
                            ),
                            endAdornment: searchText && (
                                <InputAdornment position="end">
                                    <IconButton
                                        size="small"
                                        onClick={handleClearSearch}
                                        edge="end"
                                    >
                                        <ClearIcon fontSize="small" />
                                    </IconButton>
                                </InputAdornment>
                            ),
                        }}
                    />
                    <Tooltip title={`Sort ${sortOrder === 'asc' ? 'Z-A' : 'A-Z'}`}>
                        <IconButton
                            size="small"
                            onClick={toggleSortOrder}
                            color={sortOrder === 'desc' ? 'primary' : 'default'}
                        >
                            <SortIcon />
                        </IconButton>
                    </Tooltip>
                </Box>
                {searchText && (
                    <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ mt: 0.5, display: 'block' }}
                    >
                        {filteredAndSortedDrivers.length} of {drivers.length} drivers
                    </Typography>
                )}
            </Box>

            {/* Loading indicator */}
            {loading && (
                <LinearProgress sx={{ flexShrink: 0 }} />
            )}

            {/* Driver List */}
            <Box sx={{ flex: 1, overflow: 'auto' }}>
                {filteredAndSortedDrivers.length === 0 ? (
                    <Box
                        sx={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            py: 6,
                            px: 2,
                            color: 'text.secondary',
                        }}
                    >
                        <TruckIcon sx={{ fontSize: 48, mb: 2, opacity: 0.5 }} />
                        <Typography variant="subtitle1" gutterBottom>
                            {searchText ? 'No Drivers Found' : 'No Drivers Available'}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            {searchText
                                ? `No drivers match "${searchText}"`
                                : 'No active drivers found'
                            }
                        </Typography>
                    </Box>
                ) : (
                    <List disablePadding>
                        {filteredAndSortedDrivers.map((driver, index) => (
                            <React.Fragment key={driver.courierId}>
                                <ListItemButton
                                    onClick={() => handleDriverClick(driver)}
                                    selected={selectedCourierId === driver.courierId}
                                    sx={{
                                        py: 1.5,
                                        px: 2,
                                        '&.Mui-selected': {
                                            bgcolor: 'primary.50',
                                            borderLeft: 3,
                                            borderColor: 'primary.main',
                                            '&:hover': {
                                                bgcolor: 'primary.100',
                                            },
                                        },
                                    }}
                                >
                                    <ListItemText
                                        primary={
                                            <Typography
                                                variant="subtitle2"
                                                fontWeight={selectedCourierId === driver.courierId ? 600 : 500}
                                            >
                                                {driver.name}
                                            </Typography>
                                        }
                                        secondary={driver.vehicleType}
                                    />
                                    <Box
                                        sx={{
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'flex-end',
                                            gap: 0.5,
                                        }}
                                    >
                                        <Chip
                                            label={`${driver.jobCount} ${driver.jobCount === 1 ? 'job' : 'jobs'}`}
                                            size="small"
                                            color={getJobCountColor(driver.jobCount)}
                                            sx={{ fontWeight: 500 }}
                                        />
                                        <Typography
                                            variant="caption"
                                            color="text.secondary"
                                            sx={{ fontSize: '0.7rem' }}
                                        >
                                            {driver.driverStatusText}
                                        </Typography>
                                    </Box>
                                </ListItemButton>
                                {index < filteredAndSortedDrivers.length - 1 && <Divider />}
                            </React.Fragment>
                        ))}
                    </List>
                )}
            </Box>
        </Box>
    );
};

export default CurrentWorkAllDrivers;
