/**
 * DriverListItem Component
 *
 * One row in the courier-map drivers panel: status keyline, initials avatar,
 * name, and a compact metadata strip (code, job counts, vehicle, fleet). The
 * locate arrow reveals on hover.
 */

import React from 'react';
import {alpha, Avatar, Badge, Box, Group, Text, UnstyledButton, useMantineTheme} from '@mantine/core';
import {Briefcase, Navigation, TriangleAlert} from 'lucide-react';
import {Icon} from '../../../components/common/icon/Icon';
import type { DriverListItemProps } from '../CourierMapPage.types';
import { getDriverStatus } from '../CourierMapPage.types';
import type { IAvailableCourierPosition } from '../../../types/interfaces/courier.interface';
import type { MantineTheme } from '@mantine/core';
import classes from './DriverListItem.module.css';
import {formatMinimumEnd, isBehind, minutesUntilMinimumEnds} from '../../../components/common/driver-locations/driverTopUp';
import {formatCurrency} from '../../../utils/currencyUtils';

/**
 * Same status → colour mapping the map markers use (see `getMarkerColors`), so a
 * row and its pin always agree. Index 5 is the theme's named shade.
 */
function getStatusColor(driver: IAvailableCourierPosition, theme: MantineTheme): string {
    const status = getDriverStatus(driver);
    if (status === 'overdue') return theme.colors.red[5];
    if (status === 'active') return theme.colors[theme.primaryColor][5];
    return theme.colors.green[5];
}

function getDriverInitials(name: string | undefined): string {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) {
        return parts[0].substring(0, 2).toUpperCase();
    }
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function DriverListItem({ driver, onClick, isSelected, showTopUpDetail = false, nowMs = 0 }: DriverListItemProps) {
    const theme = useMantineTheme();
    // Minimum hourly top-up: orange while the daily minimum is about to end, red marker while behind for the period.
    const behind = isBehind(driver);
    const minutesLeft = nowMs > 0 ? minutesUntilMinimumEnds(driver, nowMs) : null;
    const statusColor = minutesLeft !== null ? theme.colors.orange[5] : getStatusColor(driver, theme);
    const initials = getDriverInitials(driver.courierName);
    const hasOverdue = driver.overDueJobs > 0;

    return (
        <UnstyledButton
            onClick={onClick}
            className={classes.row}
            style={{
                '--status-color': statusColor,
                '--status-tint': alpha(statusColor, 0.06),
                // Inline rather than a CSS-module modifier class: the row needs to stay tinted
                // after the click, not just on hover, and an inline value is what Jest's
                // toHaveStyle can actually see (CSS modules resolve to {} under Jest).
                ...(behind && !isSelected ? {boxShadow: `inset 3px 0 0 ${theme.colors.red[6]}`} : {}),
                ...(minutesLeft !== null ? {backgroundColor: alpha(theme.colors.orange[5], 0.14)} : {}),
                ...(isSelected ? {
                    backgroundColor: alpha(statusColor, 0.12),
                    boxShadow: `inset 3px 0 0 ${statusColor}`,
                } : {}),
            } as React.CSSProperties & Record<`--${string}`, string>}
        >
            <Avatar
                size={38}
                radius="xl"
                style={{
                    backgroundColor: alpha(statusColor, 0.1),
                    color: statusColor,
                    border: `2px solid ${alpha(statusColor, 0.25)}`,
                }}
                styles={{placeholder: {fontSize: 13, fontWeight: 700, color: statusColor}}}
            >
                {initials}
            </Avatar>

            <Box style={{minWidth: 0, flex: 1}}>
                <Text fz={13} fw={600} lh={1.3} truncate>
                    {driver.courierName}
                </Text>

                <Group gap={6} mt={3} wrap="wrap">
                    {driver.code && (
                        <Badge
                            variant="outline"
                            h={18}
                            fz={10}
                            fw={700}
                            px={5}
                            style={{
                                letterSpacing: '0.02em',
                                borderColor: alpha(statusColor, 0.3),
                                color: statusColor,
                            }}
                        >
                            {driver.code}
                        </Badge>
                    )}

                    {driver.totalJobs > 0 && (
                        <Group gap={2} c="dimmed" wrap="nowrap">
                            <Icon lucide={Briefcase} size={12} />
                            <Text component="span" fz={11} lh={1}>
                                {driver.totalJobs}
                            </Text>
                        </Group>
                    )}

                    {hasOverdue && (
                        <Group gap={2} c="light-dark(var(--mantine-color-red-6), var(--mantine-color-red-4))" wrap="nowrap">
                            <Icon lucide={TriangleAlert} size={12} />
                            <Text component="span" fz={11} fw={600} lh={1}>
                                {driver.overDueJobs} late
                            </Text>
                        </Group>
                    )}

                    {driver.vehicleType && (
                        <Text component="span" fz={10} lh={1} c="var(--mantine-color-dimmed)">
                            {driver.vehicleType}
                        </Text>
                    )}

                    {driver.courierFleetName && (
                        <Text component="span" fz={10} lh={1} c="var(--mantine-color-dimmed)">
                            {driver.courierFleetName}
                        </Text>
                    )}

                    {minutesLeft !== null && driver.minimumEndsAt && (
                        <Text component="span" fz={11} fw={700} lh={1} c={theme.colors.orange[7]}>
                            Min ends {formatMinimumEnd(driver.minimumEndsAt)}
                        </Text>
                    )}
                </Group>

                {showTopUpDetail && (behind || minutesLeft !== null) && (
                    <Box mt={4}>
                        {behind && (
                            <Text fz={11} fw={600} c="light-dark(var(--mantine-color-red-7), var(--mantine-color-red-4))">
                                Behind {formatCurrency(driver.earningsBehindBy!)} this pay period
                            </Text>
                        )}
                        {minutesLeft !== null && driver.minimumEndsAt && (
                            <Text fz={11} fw={600} c={theme.colors.orange[8]}>
                                Minimum shift ends in {minutesLeft} min ({formatMinimumEnd(driver.minimumEndsAt)})
                            </Text>
                        )}
                    </Box>
                )}
            </Box>

            <Icon
                lucide={Navigation}
                size={16}
                className={classes.locateIcon}
                color="var(--mantine-primary-color-filled)"
            />
        </UnstyledButton>
    );
}
