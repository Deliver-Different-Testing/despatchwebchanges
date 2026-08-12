/**
 * Current Work All Drivers Component
 *
 * React component that displays a list of all drivers with their job counts.
 * Features: search by courier name, sort alphabetically.
 */

import React, { useMemo, useState, useCallback } from 'react';
import {
    ActionIcon,
    Badge,
    Box,
    Divider,
    Group,
    Progress,
    Text,
    TextInput,
    Tooltip,
    UnstyledButton,
} from '@mantine/core';
import { ArrowDownAZ, Search, X } from 'lucide-react';
import { Icon } from '../icon/Icon';
import { MuiThemeIsland } from '../mui-interop/MuiThemeIsland';
import { NoData } from '../no-data';
import { IDriverWorkOverview, SortOrder, CurrentWorkAllDriversProps } from './CurrentWorkAllDrivers.types';
import classes from './CurrentWorkAllDrivers.module.css';

/** How loaded a driver is — a workload signal, so it climbs the semantic ramp. */
export type DriverLoadTier = 'none' | 'light' | 'busy' | 'heavy';

export function getDriverLoadTier(jobCount: number): DriverLoadTier {
    if (jobCount === 0) return 'none';
    if (jobCount <= 3) return 'light';
    if (jobCount <= 6) return 'busy';
    return 'heavy';
}

const LOAD_TIER_COLORS: Record<DriverLoadTier, string> = {
    none: 'gray',
    light: 'green',
    busy: 'orange',
    heavy: 'red',
};

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
            style={{
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
                overflow: 'hidden',
                backgroundColor: 'var(--dd-surface-container)',
            }}
        >
            {/* Search and Sort Header */}
            <Box
                p="sm"
                style={{
                    borderBottom: '1px solid var(--mantine-color-default-border)',
                    backgroundColor: 'var(--mantine-color-gray-1)',
                }}
            >
                <Group gap="xs" align="center" wrap="nowrap">
                    <TextInput
                        size="xs"
                        placeholder="Search courier..."
                        value={searchText}
                        onChange={handleSearchChange}
                        style={{ flex: 1 }}
                        leftSection={<Icon lucide={Search} size={16} color="var(--mantine-color-gray-5)"/>}
                        rightSection={searchText
                            ? (
                                <ActionIcon size="sm" variant="subtle" color="gray" aria-label="Clear search" onClick={handleClearSearch}>
                                    <Icon lucide={X} size={16}/>
                                </ActionIcon>
                            )
                            : null}
                    />
                    <Tooltip label={`Sort ${sortOrder === 'asc' ? 'Z-A' : 'A-Z'}`} withArrow>
                        <ActionIcon
                            size="md"
                            variant="subtle"
                            color={sortOrder === 'desc' ? 'brand' : 'gray'}
                            aria-label={`Sort ${sortOrder === 'asc' ? 'Z-A' : 'A-Z'}`}
                            onClick={toggleSortOrder}
                        >
                            <Icon lucide={ArrowDownAZ} size={18}/>
                        </ActionIcon>
                    </Tooltip>
                </Group>
                {searchText && (
                    <Text size="xs" c="dimmed" mt={4}>
                        {filteredAndSortedDrivers.length} of {drivers.length} drivers
                    </Text>
                )}
            </Box>
            {/* Loading indicator */}
            {loading && (
                <Progress.Root size="xs" style={{ flexShrink: 0 }}>
                    <Progress.Section value={100} animated aria-label="Loading drivers"/>
                </Progress.Root>
            )}
            {/* Driver List */}
            <Box style={{ flex: 1, overflow: 'auto' }}>
                {filteredAndSortedDrivers.length === 0 ? (
                    // NoData is a shared MUI leaf that moves with its other hosts.
                    <MuiThemeIsland>
                        <NoData
                            title={searchText ? 'No Drivers Found' : 'No Drivers Available'}
                            message={
                                searchText
                                    ? `No drivers match "${searchText}"`
                                    : 'No active drivers found'
                            }
                        />
                    </MuiThemeIsland>
                ) : (
                    <Box component="ul" className={classes.list}>
                        {filteredAndSortedDrivers.map((driver, index) => {
                            const selected = selectedCourierId === driver.courierId;
                            return (
                                <li key={driver.courierId}>
                                    <UnstyledButton
                                        className={classes.row}
                                        data-selected={selected || undefined}
                                        aria-current={selected || undefined}
                                        onClick={() => handleDriverClick(driver)}
                                    >
                                        <Box style={{ flex: 1, minWidth: 0 }}>
                                            <Text size="sm" fw={selected ? 600 : 500}>
                                                {driver.name}
                                            </Text>
                                            <Text size="xs" c="dimmed">{driver.vehicleType}</Text>
                                        </Box>
                                        <Box
                                            style={{
                                                display: 'flex',
                                                flexDirection: 'column',
                                                alignItems: 'flex-end',
                                                gap: 4,
                                            }}
                                        >
                                            <Badge
                                                size="sm"
                                                variant="light"
                                                color={LOAD_TIER_COLORS[getDriverLoadTier(driver.jobCount)]}
                                                // The tier, not the colour, is the contract — so a palette
                                                // change cannot silently invert what the badge means.
                                                data-tier={getDriverLoadTier(driver.jobCount)}
                                                fw={500}
                                            >
                                                {`${driver.jobCount} ${driver.jobCount === 1 ? 'job' : 'jobs'}`}
                                            </Badge>
                                            <Text c="dimmed" style={{ fontSize: '0.7rem' }}>
                                                {driver.driverStatusText}
                                            </Text>
                                        </Box>
                                    </UnstyledButton>
                                    {index < filteredAndSortedDrivers.length - 1 && <Divider/>}
                                </li>
                            );
                        })}
                    </Box>
                )}
            </Box>
        </Box>
    );
};

export default CurrentWorkAllDrivers;
