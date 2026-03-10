/**
 * DriversPanel Component
 *
 * Glassmorphic sidebar panel with summary statistics, search,
 * and a status-coded driver list. Floats over the map.
 */

import React, { useMemo } from 'react';
import {
    Box,
    CircularProgress,
    IconButton,
    InputAdornment,
    List,
    TextField,
    Tooltip,
    Typography,
    alpha,
    useTheme,
} from '@mui/material';
import {
    ChevronRight,
    Close,
    PersonOff,
    Search,
    SearchOff,
    Sync,
} from '@mui/icons-material';
import type { DriversPanelProps } from '../CourierMapPage.types';
import { DriverListItem } from './DriverListItem';

const PANEL_WIDTH = 340;
const ANIMATION_DURATION = '300ms';
const ANIMATION_EASING = 'cubic-bezier(0.2, 0, 0, 1)';

/** Compact stat card for the summary bar */
function StatCard({
    label,
    value,
    palette,
    highlight,
}: {
    label: string;
    value: number;
    palette: 'primary' | 'info' | 'error';
    highlight?: boolean;
}) {
    const theme = useTheme();
    const color = theme.palette[palette].main;

    return (
        <Box
            sx={{
                flex: 1,
                textAlign: 'center',
                py: 0.75,
                px: 0.5,
                borderRadius: 2,
                bgcolor: highlight
                    ? alpha(color, 0.1)
                    : alpha(color, 0.05),
                transition: 'background-color 200ms ease',
            }}
        >
            <Typography
                sx={{
                    fontSize: 10,
                    fontWeight: 600,
                    color: 'text.secondary',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    lineHeight: 1.4,
                }}
            >
                {label}
            </Typography>
            <Typography
                sx={{
                    fontSize: 18,
                    fontWeight: 700,
                    color,
                    lineHeight: 1.2,
                    fontVariantNumeric: 'tabular-nums',
                }}
            >
                {value}
            </Typography>
        </Box>
    );
}

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
    // Compute summary stats from the driver data
    const stats = useMemo(() => {
        const totalJobs = drivers.reduce((sum, d) => sum + d.totalJobs, 0);
        const overdueCount = drivers.filter((d) => d.overDueJobs > 0).length;
        return { totalJobs, overdueCount };
    }, [drivers]);

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
        <Box
            sx={{
                position: 'absolute',
                top: 16,
                right: 16,
                width: PANEL_WIDTH,
                maxHeight: 'calc(100% - 32px)',
                borderRadius: '16px',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'visible',
                zIndex: 50,
                bgcolor: 'rgba(255, 255, 255, 0.82)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                border: '1px solid rgba(255, 255, 255, 0.45)',
                boxShadow:
                    '0 8px 32px rgba(0, 0, 0, 0.08), 0 2px 8px rgba(0, 0, 0, 0.04)',
                transform: isPanelHidden
                    ? 'translateX(calc(100% + 4px))'
                    : 'translateX(0)',
                transition: `transform ${ANIMATION_DURATION} ${ANIMATION_EASING}, box-shadow ${ANIMATION_DURATION} ${ANIMATION_EASING}`,
            }}
        >
            {/* Panel inner wrapper for overflow clipping */}
            <Box
                sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    minWidth: 0,
                    overflow: 'hidden',
                    borderRadius: '16px',
                }}
            >
                {/* ── Header ────────────────────────── */}
                <Box
                    sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        px: 2.5,
                        pt: 2,
                        pb: 1.5,
                        flexShrink: 0,
                    }}
                >
                    <Typography
                        variant="subtitle2"
                        sx={{
                            fontWeight: 700,
                            fontSize: 14,
                            letterSpacing: '-0.01em',
                        }}
                    >
                        Drivers
                    </Typography>
                    <Tooltip title="Refresh locations">
                        <span>
                            <IconButton
                                size="small"
                                onClick={onRefresh}
                                disabled={isLoading}
                                sx={{
                                    color: 'text.secondary',
                                    width: 30,
                                    height: 30,
                                }}
                            >
                                <Sync
                                    sx={{
                                        fontSize: 18,
                                        ...(isLoading && {
                                            animation: 'spin 1s linear infinite',
                                            '@keyframes spin': {
                                                from: { transform: 'rotate(0deg)' },
                                                to: { transform: 'rotate(360deg)' },
                                            },
                                        }),
                                    }}
                                />
                            </IconButton>
                        </span>
                    </Tooltip>
                </Box>

                {/* ── Stats summary ─────────────────── */}
                <Box sx={{ display: 'flex', gap: 0.75, px: 2, pb: 1.5, flexShrink: 0 }}>
                    <StatCard
                        label="Active"
                        value={totalActiveDrivers}
                        palette="primary"
                    />
                    <StatCard
                        label="Jobs"
                        value={stats.totalJobs}
                        palette="info"
                    />
                    <StatCard
                        label="Overdue"
                        value={stats.overdueCount}
                        palette="error"
                        highlight={stats.overdueCount > 0}
                    />
                </Box>

                {/* ── Search ────────────────────────── */}
                <Box sx={{ px: 2, pb: 1, flexShrink: 0 }}>
                    <TextField
                        fullWidth
                        size="small"
                        placeholder="Search by name or code..."
                        value={searchInputValue}
                        onChange={(e) => onSearchChange(e.target.value)}
                        aria-label="Search drivers"
                        slotProps={{
                            input: {
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <Search
                                            sx={{
                                                fontSize: 18,
                                                color: 'text.disabled',
                                            }}
                                        />
                                    </InputAdornment>
                                ),
                                endAdornment: searchInputValue ? (
                                    <InputAdornment position="end">
                                        <IconButton
                                            size="small"
                                            onClick={() => onSearchChange('')}
                                            aria-label="Clear search"
                                            edge="end"
                                            sx={{ mr: -0.5 }}
                                        >
                                            <Close sx={{ fontSize: 16 }} />
                                        </IconButton>
                                    </InputAdornment>
                                ) : null,
                            },
                        }}
                        sx={{
                            '& .MuiOutlinedInput-root': {
                                borderRadius: 2.5,
                                fontSize: 13,
                                bgcolor: 'rgba(0, 0, 0, 0.03)',
                                '& fieldset': { border: 'none' },
                                '&:hover': {
                                    bgcolor: 'rgba(0, 0, 0, 0.05)',
                                },
                                '&.Mui-focused': {
                                    bgcolor: 'rgba(255, 255, 255, 0.9)',
                                    '& fieldset': {
                                        border: '1.5px solid',
                                        borderColor: 'primary.main',
                                    },
                                },
                            },
                        }}
                    />
                </Box>

                {/* ── List area ─────────────────────── */}
                <Box
                    sx={{
                        flex: 1,
                        overflowY: 'auto',
                        minHeight: 0,
                        scrollbarWidth: 'thin',
                        scrollbarColor: 'rgba(0,0,0,0.12) transparent',
                        '&::-webkit-scrollbar': { width: 5 },
                        '&::-webkit-scrollbar-track': { background: 'transparent' },
                        '&::-webkit-scrollbar-thumb': {
                            background: 'rgba(0,0,0,0.12)',
                            borderRadius: 3,
                        },
                        '&::-webkit-scrollbar-thumb:hover': {
                            background: 'rgba(0,0,0,0.2)',
                        },
                    }}
                >
                    {/* Loading state */}
                    {isLoading && (
                        <Box
                            sx={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                py: 5,
                                gap: 1.5,
                            }}
                        >
                            <CircularProgress
                                size={32}
                                thickness={4}
                            />
                            <Typography
                                variant="body2"
                                color="text.secondary"
                                sx={{ fontSize: 13 }}
                            >
                                Loading drivers...
                            </Typography>
                        </Box>
                    )}

                    {/* Empty: no drivers at all */}
                    {!isLoading && drivers.length === 0 && (
                        <Box
                            sx={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                py: 5,
                                gap: 1,
                            }}
                        >
                            <PersonOff
                                sx={{
                                    fontSize: 40,
                                    color: 'text.disabled',
                                    opacity: 0.6,
                                }}
                            />
                            <Typography
                                variant="body2"
                                color="text.secondary"
                                fontWeight={500}
                            >
                                No active drivers
                            </Typography>
                            <Typography
                                variant="caption"
                                color="text.disabled"
                            >
                                Drivers will appear when they log in
                            </Typography>
                        </Box>
                    )}

                    {/* Empty: search has no results */}
                    {!isLoading &&
                        drivers.length > 0 &&
                        filteredDrivers.length === 0 && (
                            <Box
                                sx={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    py: 5,
                                    gap: 1,
                                }}
                            >
                                <SearchOff
                                    sx={{
                                        fontSize: 40,
                                        color: 'text.disabled',
                                        opacity: 0.6,
                                    }}
                                />
                                <Typography
                                    variant="body2"
                                    color="text.secondary"
                                    fontWeight={500}
                                >
                                    No matches found
                                </Typography>
                                <Typography
                                    variant="caption"
                                    color="text.disabled"
                                >
                                    Try a different name or code
                                </Typography>
                            </Box>
                        )}

                    {/* Driver list */}
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

            {/* ── Toggle handle ─────────────────── */}
            <IconButton
                onClick={onTogglePanel}
                aria-label="Toggle drivers panel"
                size="small"
                sx={{
                    position: 'absolute',
                    left: -22,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    width: 22,
                    height: 52,
                    borderRadius: '10px 0 0 10px',
                    bgcolor: 'rgba(255, 255, 255, 0.82)',
                    backdropFilter: 'blur(20px)',
                    WebkitBackdropFilter: 'blur(20px)',
                    border: '1px solid rgba(255, 255, 255, 0.45)',
                    borderRight: 'none',
                    boxShadow: '-4px 0 12px rgba(0, 0, 0, 0.04)',
                    zIndex: 51,
                    '&:hover': {
                        bgcolor: 'rgba(255, 255, 255, 0.95)',
                    },
                    '&:active': {
                        transform: 'translateY(-50%) scale(0.95)',
                    },
                }}
            >
                <ChevronRight
                    sx={{
                        fontSize: 16,
                        color: 'text.secondary',
                        transition: 'transform 300ms cubic-bezier(0.4, 0, 0.2, 1)',
                        transform: isPanelHidden
                            ? 'rotate(180deg)'
                            : 'rotate(0deg)',
                    }}
                />
            </IconButton>
        </Box>
    );
}
