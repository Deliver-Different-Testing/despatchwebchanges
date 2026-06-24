/**
 * DriverListItem Component
 *
 * Individual driver row with status-colored left accent, tinted avatar,
 * overdue badges, vehicle type, and hover-reveal locate action.
 */

import React from 'react';
import {alpha, useTheme} from '@mui/material/styles';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemAvatar from '@mui/material/ListItemAvatar';
import ListItemText from '@mui/material/ListItemText';
import Typography from '@mui/material/Typography';
import NearMe from '@mui/icons-material/NearMe';
import WorkOutline from '@mui/icons-material/WorkOutlined';
import WarningAmberRounded from '@mui/icons-material/WarningAmberRounded';
import type { DriverListItemProps } from '../CourierMapPage.types';
import { getDriverStatus } from '../CourierMapPage.types';
import type { IAvailableCourierPosition } from '../../../../interfaces/courier.interface';
import type {Theme} from '@mui/material/styles';

function getStatusColor(driver: IAvailableCourierPosition, theme: Theme): string {
    const status = getDriverStatus(driver);
    if (status === 'overdue') return theme.palette.error.main;
    if (status === 'active') return theme.palette.primary.main;
    return theme.palette.success.main;
}

function getDriverInitials(name: string | undefined): string {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) {
        return parts[0].substring(0, 2).toUpperCase();
    }
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function DriverListItem({ driver, onClick }: DriverListItemProps) {
    const theme = useTheme();
    const statusColor = getStatusColor(driver, theme);
    const initials = getDriverInitials(driver.courierName);
    const hasOverdue = driver.overDueJobs > 0;

    return (
        <ListItemButton
            onClick={onClick}
            sx={{
                borderLeft: `3px solid ${statusColor}`,
                mx: 1,
                borderRadius: '0 10px 10px 0',
                py: 0.875,
                px: 1.5,
                gap: 1.25,
                transition: 'all 150ms cubic-bezier(0.2, 0, 0, 1)',
                '&:hover': {
                    bgcolor: alpha(statusColor, 0.06),
                },
                '&:hover .locate-icon': {
                    opacity: 1,
                    transform: 'translateX(0)',
                },
            }}
        >
            <ListItemAvatar sx={{ minWidth: 0 }}>
                <Avatar
                    sx={{
                        bgcolor: alpha(statusColor, 0.1),
                        color: statusColor,
                        width: 38,
                        height: 38,
                        fontSize: 13,
                        fontWeight: 700,
                        border: `2px solid ${alpha(statusColor, 0.25)}`,
                        transition: 'all 150ms ease',
                    }}
                >
                    {initials}
                </Avatar>
            </ListItemAvatar>

            <ListItemText
                disableTypography
                primary={
                    <Typography
                        variant="body2"
                        sx={{
                            fontWeight: 600,
                            color: 'text.primary',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            lineHeight: 1.3,
                            fontSize: 13,
                        }}
                    >
                        {driver.courierName}
                    </Typography>
                }
                secondary={
                    <Box
                        sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 0.75,
                            mt: 0.375,
                            flexWrap: 'wrap',
                        }}
                    >
                        {driver.code && (
                            <Chip
                                label={driver.code}
                                size="small"
                                sx={{
                                    height: 18,
                                    fontSize: 10,
                                    fontWeight: 700,
                                    letterSpacing: '0.02em',
                                    borderColor: alpha(statusColor, 0.3),
                                    color: statusColor,
                                    '& .MuiChip-label': { px: 0.625 },
                                }}
                            />
                        )}

                        {driver.totalJobs > 0 && (
                            <Box
                                sx={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 0.25,
                                    color: 'text.secondary',
                                }}
                            >
                                <WorkOutline sx={{ fontSize: 12 }} />
                                <Typography
                                    component="span"
                                    sx={{ fontSize: 11, lineHeight: 1 }}
                                >
                                    {driver.totalJobs}
                                </Typography>
                            </Box>
                        )}

                        {hasOverdue && (
                            <Box
                                sx={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 0.25,
                                    color: 'error.main',
                                }}
                            >
                                <WarningAmberRounded sx={{ fontSize: 12 }} />
                                <Typography
                                    component="span"
                                    sx={{ fontSize: 11, fontWeight: 600, lineHeight: 1 }}
                                >
                                    {driver.overDueJobs} late
                                </Typography>
                            </Box>
                        )}

                        {driver.vehicleType && (
                            <Typography
                                component="span"
                                sx={{
                                    fontSize: 10,
                                    color: 'text.disabled',
                                    lineHeight: 1,
                                }}
                            >
                                {driver.vehicleType}
                            </Typography>
                        )}

                        {driver.courierFleetName && (
                            <Typography
                                component="span"
                                sx={{
                                    fontSize: 10,
                                    color: 'text.disabled',
                                    lineHeight: 1,
                                }}
                            >
                                {driver.courierFleetName}
                            </Typography>
                        )}
                    </Box>
                }
            />

            <NearMe
                className="locate-icon"
                sx={{
                    fontSize: 16,
                    color: 'primary.main',
                    opacity: 0,
                    transform: 'translateX(-4px)',
                    transition: 'all 180ms cubic-bezier(0.2, 0, 0, 1)',
                    ml: 'auto',
                    flexShrink: 0,
                }}
            />
        </ListItemButton>
    );
}
