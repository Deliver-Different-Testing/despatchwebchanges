/**
 * DriversPanel Component
 *
 * Sidebar panel with summary statistics, search, and a status-coded driver
 * list. Floats over the map on an opaque surface with theme elevation, matching
 * the app's MD3 surface language.
 */

import React, { useMemo } from 'react';
import {alpha, useTheme} from '@mui/material/styles';
import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import List from '@mui/material/List';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import CheckBoxOutlineBlank from '@mui/icons-material/CheckBoxOutlineBlank';
import CheckBoxIcon from '@mui/icons-material/CheckBox';
import ChevronRight from '@mui/icons-material/ChevronRight';
import Close from '@mui/icons-material/Close';
import Search from '@mui/icons-material/Search';
import PersonOffOutlined from '@mui/icons-material/PersonOffOutlined';
import SearchOffOutlined from '@mui/icons-material/SearchOffOutlined';
import { NoData } from '../../../components/common/no-data';
import type { DriversPanelProps, FleetSelectorOption } from '../CourierMapPage.types';
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

const FLEET_CHECKBOX_BLANK = <CheckBoxOutlineBlank fontSize="small" />;
const FLEET_CHECKBOX_CHECKED = <CheckBoxIcon fontSize="small" />;

export function DriversPanel({
    drivers,
    totalActiveDrivers,
    isLoading,
    searchInputValue,
    searchTerm,
    onSearchChange,
    onDriverClick,
    isPanelHidden,
    onTogglePanel,
    fleetOptions,
    isFleetOptionsLoading,
    selectedFleetIds,
    onSelectedFleetIdsChange,
}: DriversPanelProps) {
    const selectedFleets = useMemo(() => {
        const lookup = new Map(fleetOptions.map((f) => [f.id, f]));
        return selectedFleetIds
            .map((id) => lookup.get(id))
            .filter((f): f is FleetSelectorOption => f != null);
    }, [fleetOptions, selectedFleetIds]);
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
                borderRadius: 2,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'visible',
                zIndex: 50,
                // Opaque surface + theme elevation to match the rest of the app;
                // the shadow doubles as MD3 "busy background" protection over the map.
                bgcolor: 'background.paper',
                border: '1px solid',
                borderColor: 'divider',
                boxShadow: 8,
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
                    borderRadius: 2,
                }}
            >
                {/* ── Header ────────────────────────── */}
                <Box
                    sx={{
                        display: 'flex',
                        alignItems: 'center',
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

                {/* ── Fleet filter ──────────────────── */}
                <Box sx={{ px: 2, pb: 1, flexShrink: 0 }}>
                    <Autocomplete
                        multiple
                        disableCloseOnSelect
                        size="small"
                        options={fleetOptions}
                        loading={isFleetOptionsLoading}
                        value={selectedFleets}
                        getOptionLabel={(option) => option.text}
                        isOptionEqualToValue={(option, value) => option.id === value.id}
                        onChange={(_, value) => onSelectedFleetIdsChange(value.map((v) => v.id))}
                        renderOption={(props, option, { selected }) => {
                            const {key, ...optionProps} = props as React.HTMLAttributes<HTMLLIElement> & { key: React.Key };
                            return (
                                <li key={key} {...optionProps}>
                                    <Checkbox
                                        icon={FLEET_CHECKBOX_BLANK}
                                        checkedIcon={FLEET_CHECKBOX_CHECKED}
                                        sx={{ mr: 1, p: 0.5 }}
                                        checked={selected}
                                    />
                                    {option.text}
                                </li>
                            );
                        }}
                        renderValue={(value, getItemProps) =>
                            value.map((option, index) => {
                                const {key, ...itemProps} = getItemProps({ index });
                                return (
                                    <Chip
                                        key={key}
                                        label={option.text}
                                        size="small"
                                        {...itemProps}
                                        sx={{ height: 22, fontSize: 11 }}
                                    />
                                );
                            })
                        }
                        renderInput={(params) => (
                            <TextField
                                {...params}
                                placeholder={selectedFleets.length === 0 ? 'All fleets' : ''}
                                aria-label="Filter by fleet"
                            />
                        )}
                        sx={{ '& .MuiOutlinedInput-root': { fontSize: 13 } }}
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
                        sx={{ '& .MuiOutlinedInput-root': { fontSize: 13 } }}
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
                                sx={{
                                    color: "text.secondary",
                                    fontSize: 13
                                }}>
                                Loading drivers...
                            </Typography>
                        </Box>
                    )}

                    {/* Empty: no drivers at all */}
                    {!isLoading && drivers.length === 0 && (
                        <NoData
                            icon={<PersonOffOutlined/>}
                            title="No active drivers"
                            message="Drivers will appear when they log in"
                        />
                    )}

                    {/* Empty: search has no results */}
                    {!isLoading &&
                        drivers.length > 0 &&
                        filteredDrivers.length === 0 && (
                            <NoData
                                icon={<SearchOffOutlined/>}
                                title="No matches found"
                                message="Try a different name or code"
                            />
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
                    bgcolor: 'background.paper',
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRight: 'none',
                    boxShadow: 4,
                    zIndex: 51,
                    // Keep the visual sliver narrow but extend the touch target to
                    // ≥44px in both axes (Material's accessibility minimum).
                    '&::after': {
                        content: '""',
                        position: 'absolute',
                        top: -4,
                        bottom: -4,
                        left: -14,
                        right: -8,
                    },
                    '&:hover': {
                        bgcolor: 'background.surfaceContainer',
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
