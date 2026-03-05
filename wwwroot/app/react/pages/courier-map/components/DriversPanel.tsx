/**
 * DriversPanel Component
 *
 * Sidebar panel showing list of active drivers with search functionality.
 * Built with MUI components — all styling via sx prop.
 */

import React, { useMemo } from 'react';
import {
    Box,
    Card,
    Chip,
    CircularProgress,
    IconButton,
    InputAdornment,
    List,
    TextField,
    Tooltip,
    Typography,
} from '@mui/material';
import {
    ChevronLeft,
    ChevronRight,
    Close,
    PersonOff,
    Search,
    SearchOff,
    Sync,
} from '@mui/icons-material';
import type { DriversPanelProps } from '../CourierMapPage.types';
import { DriverListItem } from './DriverListItem';

const PANEL_WIDTH = 320;
const TOGGLE_SIZE = 36;
const ANIMATION_DURATION = '280ms';
const ANIMATION_EASING = 'cubic-bezier(0.2, 0, 0, 1)';

export function DriversPanel({
    drivers,
    totalActiveDrivers,
    isLoading,
    searchInputValue,
    searchTerm,
    onSearchChange,
    onDriverClick,
    onRefresh,
    isPanelHidden,
    onTogglePanel,
}: DriversPanelProps) {
    const filteredDrivers = useMemo(() => {
        if (!searchTerm || searchTerm.trim() === '') {
            return drivers;
        }

        const term = searchTerm.toLowerCase().trim();
        return drivers.filter((driver) => {
            const name = (driver.courierName || '').toLowerCase();
            const code = (driver.code || '').toLowerCase();
            return name.includes(term) || code.includes(term);
        });
    }, [drivers, searchTerm]);

    return (
        <Card
            elevation={3}
            sx={{
                position: 'absolute',
                top: 16,
                right: 16,
                width: PANEL_WIDTH,
                maxHeight: 'calc(100% - 32px)',
                borderRadius: 3,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'visible',
                zIndex: 50,
                transform: isPanelHidden
                    ? `translateX(calc(100% - ${TOGGLE_SIZE}px + 12px))`
                    : 'translateX(0)',
                transition: `transform ${ANIMATION_DURATION} ${ANIMATION_EASING}, box-shadow ${ANIMATION_DURATION} ${ANIMATION_EASING}`,
                '&:hover': {
                    boxShadow: isPanelHidden ? undefined : 8,
                },
            }}
        >
            {/* Panel Content */}
            <Box
                sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    minWidth: 0,
                    overflow: 'hidden',
                    borderRadius: 3,
                }}
            >
                {/* Header */}
                <Box
                    sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        px: 2.5,
                        py: 2,
                        borderBottom: 1,
                        borderColor: 'divider',
                        flexShrink: 0,
                    }}
                >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                            Active Drivers
                        </Typography>
                        {totalActiveDrivers > 0 && (
                            <Chip
                                label={totalActiveDrivers}
                                size="small"
                                color="primary"
                                sx={{
                                    fontWeight: 600,
                                    fontSize: 11,
                                    height: 24,
                                    '& .MuiChip-label': { px: 1 },
                                }}
                            />
                        )}
                    </Box>
                    <Tooltip title="Refresh drivers">
                        <span>
                            <IconButton
                                size="small"
                                onClick={onRefresh}
                                disabled={isLoading}
                                sx={{ color: 'text.secondary' }}
                            >
                                <Sync
                                    fontSize="small"
                                    sx={isLoading ? {
                                        animation: 'spin 1s linear infinite',
                                        '@keyframes spin': {
                                            from: { transform: 'rotate(0deg)' },
                                            to: { transform: 'rotate(360deg)' },
                                        },
                                    } : undefined}
                                />
                            </IconButton>
                        </span>
                    </Tooltip>
                </Box>

                {/* Search */}
                <Box sx={{ px: 2, py: 1.5, flexShrink: 0 }}>
                    <TextField
                        fullWidth
                        size="small"
                        variant="outlined"
                        placeholder="Search drivers..."
                        value={searchInputValue}
                        onChange={(e) => onSearchChange(e.target.value)}
                        aria-label="Search drivers"
                        slotProps={{
                            input: {
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <Search fontSize="small" sx={{ color: 'text.secondary' }} />
                                    </InputAdornment>
                                ),
                                endAdornment: searchInputValue ? (
                                    <InputAdornment position="end">
                                        <IconButton
                                            size="small"
                                            onClick={() => onSearchChange('')}
                                            aria-label="Clear search"
                                            edge="end"
                                        >
                                            <Close fontSize="small" />
                                        </IconButton>
                                    </InputAdornment>
                                ) : null,
                            },
                        }}
                        sx={{
                            '& .MuiOutlinedInput-root': {
                                borderRadius: 2,
                                fontSize: 13,
                            },
                        }}
                    />
                </Box>

                {/* List Area */}
                <Box
                    sx={{
                        flex: 1,
                        overflowY: 'auto',
                        minHeight: 0,
                        '&::-webkit-scrollbar': { width: 6 },
                        '&::-webkit-scrollbar-track': { background: 'transparent' },
                        '&::-webkit-scrollbar-thumb': {
                            background: 'rgba(0,0,0,0.15)',
                            borderRadius: 3,
                        },
                        '&::-webkit-scrollbar-thumb:hover': {
                            background: 'rgba(0,0,0,0.25)',
                        },
                    }}
                >
                    {/* Loading State */}
                    {isLoading && (
                        <Box
                            sx={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                py: 4,
                                gap: 1.5,
                            }}
                        >
                            <CircularProgress size={36} />
                            <Typography variant="body2" color="text.secondary">
                                Loading drivers...
                            </Typography>
                        </Box>
                    )}

                    {/* No Drivers State */}
                    {!isLoading && drivers.length === 0 && (
                        <Box
                            sx={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                py: 4,
                                gap: 1,
                            }}
                        >
                            <PersonOff sx={{ fontSize: 36, color: 'text.disabled' }} />
                            <Typography variant="body2" color="text.secondary" fontWeight={500}>
                                No active drivers
                            </Typography>
                        </Box>
                    )}

                    {/* No Search Results State */}
                    {!isLoading && drivers.length > 0 && filteredDrivers.length === 0 && (
                        <Box
                            sx={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                py: 4,
                                gap: 1,
                            }}
                        >
                            <SearchOff sx={{ fontSize: 36, color: 'text.disabled' }} />
                            <Typography variant="body2" color="text.secondary" fontWeight={500}>
                                No matches found
                            </Typography>
                        </Box>
                    )}

                    {/* Driver List */}
                    {!isLoading && filteredDrivers.length > 0 && (
                        <List disablePadding sx={{ py: 0.5 }}>
                            {filteredDrivers.map((driver) => (
                                <DriverListItem
                                    key={driver.courierId}
                                    driver={driver}
                                    onClick={() => onDriverClick(driver)}
                                />
                            ))}
                        </List>
                    )}
                </Box>
            </Box>

            {/* Toggle Button */}
            <IconButton
                onClick={onTogglePanel}
                aria-label="Toggle drivers panel"
                size="small"
                sx={{
                    position: 'absolute',
                    left: -18,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    width: TOGGLE_SIZE,
                    height: TOGGLE_SIZE,
                    bgcolor: 'background.paper',
                    boxShadow: 2,
                    borderRadius: 2.5,
                    zIndex: 51,
                    '&:hover': {
                        bgcolor: 'action.hover',
                        boxShadow: 4,
                    },
                    '&:active': {
                        transform: 'translateY(-50%) scale(0.95)',
                    },
                }}
            >
                {isPanelHidden ? (
                    <ChevronLeft fontSize="small" sx={{ color: 'text.secondary' }} />
                ) : (
                    <ChevronRight fontSize="small" sx={{ color: 'text.secondary' }} />
                )}
            </IconButton>
        </Card>
    );
}
