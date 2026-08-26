/**
 * DriversPanel Component
 *
 * Sidebar panel with summary statistics, search, and a status-coded driver
 * list. Floats over the map on an opaque surface with theme elevation, matching
 * the app's MD3 surface language.
 */

import React, { useMemo } from 'react';
import {
    alpha, Box, CloseButton, Group, Loader, MultiSelect, Stack, Text, TextInput,
    UnstyledButton, useMantineTheme,
} from '@mantine/core';
import {ChevronRight, Search, SearchX, UserX} from 'lucide-react';
import {Icon} from '../../../components/common/icon/Icon';
import classes from './DriversPanel.module.css';
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
    const theme = useMantineTheme();
    // 'info' was MUI's Reflex Blue (#2a4eff) — the `reflex` ramp here, not the
    // brand primary, so the three cards stay visually distinct.
    const rampName = palette === 'primary' ? theme.primaryColor : palette === 'info' ? 'reflex' : 'red';
    const color = (theme.colors[rampName] ?? theme.colors.gray)[5];

    return (
        <Box
            ta="center"
            py={6}
            px={4}
            style={{
                flex: 1,
                borderRadius: 'var(--mantine-radius-md)',
                backgroundColor: alpha(color, highlight ? 0.1 : 0.05),
                transition: 'background-color 200ms ease',
            }}
        >
            <Text fz={10} fw={600} c="dimmed" tt="uppercase" lh={1.4} style={{letterSpacing: '0.06em'}}>
                {label}
            </Text>
            <Text fz={18} fw={700} lh={1.2} style={{color, fontVariantNumeric: 'tabular-nums'}}>
                {value}
            </Text>
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

    // MultiSelect speaks strings; the fleet ids are numbers.
    const fleetData = useMemo(
        () => fleetOptions.map((f) => ({value: String(f.id), label: f.text})),
        [fleetOptions],
    );
    const selectedFleetValues = useMemo(() => selectedFleetIds.map(String), [selectedFleetIds]);

    return (
        <Box
            w={PANEL_WIDTH}
            style={{
                position: 'absolute',
                top: 16,
                right: 16,
                maxHeight: 'calc(100% - 32px)',
                borderRadius: 'var(--mantine-radius-md)',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'visible',
                zIndex: 50,
                // Opaque surface + elevation to match the rest of the app; the shadow
                // doubles as MD3 "busy background" protection over the map.
                backgroundColor: 'var(--mantine-color-body)',
                border: '1px solid var(--mantine-color-default-border)',
                boxShadow: 'var(--mantine-shadow-lg)',
                transform: isPanelHidden ? 'translateX(calc(100% + 4px))' : 'translateX(0)',
                transition: `transform ${ANIMATION_DURATION} ${ANIMATION_EASING}, box-shadow ${ANIMATION_DURATION} ${ANIMATION_EASING}`,
            }}
        >
            {/* Panel inner wrapper for overflow clipping */}
            <Box
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    minWidth: 0,
                    overflow: 'hidden',
                    borderRadius: 'var(--mantine-radius-md)',
                }}
            >
                {/* ── Header ────────────────────────── */}
                <Group px={20} pt={16} pb={12} style={{flexShrink: 0}}>
                    <Text fz={14} fw={700} style={{letterSpacing: '-0.01em'}}>
                        Drivers
                    </Text>
                </Group>

                {/* ── Stats summary ─────────────────── */}
                <Group gap={6} px={16} pb={12} grow style={{flexShrink: 0}}>
                    <StatCard label="Active" value={totalActiveDrivers} palette="primary" />
                    <StatCard label="Jobs" value={stats.totalJobs} palette="info" />
                    <StatCard
                        label="Overdue"
                        value={stats.overdueCount}
                        palette="error"
                        highlight={stats.overdueCount > 0}
                    />
                </Group>

                {/* ── Fleet filter ──────────────────── */}
                <Box px={16} pb={8} style={{flexShrink: 0}}>
                    <MultiSelect
                        size="xs"
                        data={fleetData}
                        value={selectedFleetValues}
                        onChange={(values) => onSelectedFleetIdsChange(values.map(Number))}
                        placeholder={selectedFleetIds.length === 0 ? 'All fleets' : ''}
                        aria-label="Filter by fleet"
                        searchable
                        clearable
                        // MultiSelect keeps its dropdown open across picks and renders the
                        // selection as pills natively, so the MUI original's
                        // disableCloseOnSelect, renderOption checkbox and renderValue Chip
                        // all fall away. The check mark is the selected affordance.
                        rightSection={
                            isFleetOptionsLoading ? <Loader size={14} aria-label="Loading fleets" /> : undefined
                        }
                        nothingFoundMessage="No fleets"
                    />
                </Box>

                {/* ── Search ────────────────────────── */}
                <Box px={16} pb={8} style={{flexShrink: 0}}>
                    <TextInput
                        size="xs"
                        placeholder="Search by name or code..."
                        value={searchInputValue}
                        onChange={(e) => onSearchChange(e.currentTarget.value)}
                        aria-label="Search drivers"
                        leftSection={<Icon lucide={Search} size={16} />}
                        rightSection={
                            searchInputValue ? (
                                <CloseButton
                                    size="sm"
                                    onClick={() => onSearchChange('')}
                                    aria-label="Clear search"
                                />
                            ) : undefined
                        }
                    />
                </Box>

                {/* ── List area ─────────────────────── */}
                <Box className={classes.listArea} style={{flex: 1, overflowY: 'auto', minHeight: 0}}>
                    {isLoading && (
                        <Stack align="center" gap={12} py={40}>
                            <Loader size={32} aria-label="Loading drivers" />
                            <Text fz={13} c="dimmed">
                                Loading drivers...
                            </Text>
                        </Stack>
                    )}

                    {/* Empty: no drivers at all */}
                    {!isLoading && drivers.length === 0 && (
                        <NoData
                            icon={<Icon lucide={UserX} />}
                            title="No active drivers"
                            message="Drivers will appear when they log in"
                        />
                    )}

                    {/* Empty: search has no results */}
                    {!isLoading && drivers.length > 0 && filteredDrivers.length === 0 && (
                        <NoData
                            icon={<Icon lucide={SearchX} />}
                            title="No matches found"
                            message="Try a different name or code"
                        />
                    )}

                    {/* Driver list */}
                    {!isLoading && filteredDrivers.length > 0 && (
                        <Box component="ul" py={4} m={0} style={{listStyle: 'none', paddingInline: 0}}>
                            {filteredDrivers.map((driver) => (
                                <Box component="li" key={driver.courierId}>
                                    <DriverListItem
                                        driver={driver}
                                        onClick={() => onDriverClick(driver)}
                                    />
                                </Box>
                            ))}
                        </Box>
                    )}
                </Box>
            </Box>

            {/* ── Toggle handle ─────────────────── */}
            <UnstyledButton
                onClick={onTogglePanel}
                aria-label="Toggle drivers panel"
                className={classes.toggleHandle}
                data-hidden={isPanelHidden}
            >
                <Icon
                    lucide={ChevronRight}
                    size={16}
                    className={classes.toggleChevron}
                    color="var(--mantine-color-dimmed)"
                />
            </UnstyledButton>
        </Box>
    );
}
