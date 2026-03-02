/**
 * DriverListItem Component
 *
 * Individual driver row in the drivers panel with avatar,
 * name, code, and job count. Built with MUI components.
 */

import React from 'react';
import {
    Avatar,
    Box,
    Chip,
    ListItemButton,
    ListItemAvatar,
    ListItemText,
    Typography,
} from '@mui/material';
import { NearMe, WorkOutline } from '@mui/icons-material';
import type { DriverListItemProps } from '../CourierMapPage.types';
import { AVATAR_COLORS } from '../CourierMapPage.types';

function getDriverColor(courierId: number): string {
    return AVATAR_COLORS[courierId % AVATAR_COLORS.length];
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
    const avatarColor = getDriverColor(driver.courierId);
    const initials = getDriverInitials(driver.courierName);

    return (
        <ListItemButton
            onClick={onClick}
            sx={{
                mx: 1,
                borderRadius: 2.5,
                py: 1,
                px: 1.5,
                gap: 1.5,
                '&:hover .locate-icon': {
                    opacity: 1,
                    transform: 'translateX(0)',
                },
            }}
        >
            <ListItemAvatar sx={{ minWidth: 0 }}>
                <Avatar
                    sx={{
                        bgcolor: avatarColor,
                        width: 40,
                        height: 40,
                        fontSize: 13,
                        fontWeight: 600,
                        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
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
                            fontWeight: 500,
                            color: 'text.primary',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            lineHeight: 1.25,
                        }}
                    >
                        {driver.courierName}
                    </Typography>
                }
                secondary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                        {driver.code && (
                            <Chip
                                label={driver.code}
                                size="small"
                                color="primary"
                                variant="outlined"
                                sx={{
                                    height: 20,
                                    fontSize: 11,
                                    fontWeight: 600,
                                    '& .MuiChip-label': { px: 0.75 },
                                }}
                            />
                        )}
                        {driver.totalJobs > 0 && (
                            <Box
                                sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 0.375,
                                    color: 'text.secondary',
                                }}
                            >
                                <WorkOutline sx={{ fontSize: 14 }} />
                                <Typography variant="caption" sx={{ fontSize: 11 }}>
                                    {driver.totalJobs} {driver.totalJobs === 1 ? 'job' : 'jobs'}
                                </Typography>
                            </Box>
                        )}
                    </Box>
                }
            />

            <NearMe
                className="locate-icon"
                sx={{
                    fontSize: 18,
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
