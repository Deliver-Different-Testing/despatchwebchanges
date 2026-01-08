/**
 * React App Toolbar Component
 *
 * A modern Material Design 3 compliant app bar.
 * Layout: Logo | Title | Spacer | Actions | User Menu
 */

import React, {useMemo} from 'react';
import {
    AppBar,
    Toolbar,
    Typography,
    IconButton,
    Box,
    Tooltip,
    Avatar,
    alpha,
} from '@mui/material';
import dayjs from 'dayjs';

export interface AppToolbarProps {
    title: string;
    firstName: string;
    logoUrl?: string;
    children?: React.ReactNode;
    onLogoClick?: () => void;
    onMenuHover?: () => void;
}

/**
 * Generate time-based greeting
 */
function greetUser(userName: string): string {
    const currentHour = dayjs().hour();
    let greeting: string;

    if (currentHour < 12) {
        greeting = 'Good morning';
    } else if (currentHour < 18) {
        greeting = 'Good afternoon';
    } else {
        greeting = 'Good evening';
    }

    return `${greeting}, ${userName}`;
}

/**
 * Get user initials for avatar
 */
function getInitials(name: string): string {
    return name.charAt(0).toUpperCase();
}

export const AppToolbar: React.FC<AppToolbarProps> = ({
    title,
    firstName,
    logoUrl = 'images/dfrnt_logo.png',
    children,
    onLogoClick,
    onMenuHover,
}) => {
    const greeting = useMemo(() => greetUser(firstName), [firstName]);
    const initials = useMemo(() => getInitials(firstName), [firstName]);

    return (
        <AppBar
            position="static"
            elevation={1}
            sx={(theme) => ({
                bgcolor: theme.palette.primary.main,
                // Ensure proper contrast for both themes
                color: theme.palette.primary.contrastText,
            })}
        >
            <Toolbar
                sx={{
                    minHeight: {xs: 56, sm: 64},
                    px: {xs: 1.5, sm: 2},
                    gap: 1,
                }}
            >
                {/* Logo - Brand Identity */}
                <Box
                    component="img"
                    src={logoUrl}
                    alt="DFRNT"
                    onClick={onLogoClick}
                    sx={{
                        height: {xs: 32, sm: 36},
                        cursor: onLogoClick ? 'pointer' : 'default',
                        transition: 'opacity 0.2s',
                        '&:hover': onLogoClick ? {
                            opacity: 0.85,
                        } : {},
                    }}
                />

                {/* Title - Page Context */}
                <Typography
                    variant="h6"
                    component="h1"
                    noWrap
                    sx={{
                        fontWeight: 500,
                        fontSize: {xs: '1rem', sm: '1.125rem'},
                        ml: 1.5,
                        letterSpacing: '0.01em',
                    }}
                >
                    {title}
                </Typography>

                {/* Spacer */}
                <Box sx={{flexGrow: 1}} />

                {/* Actions Container - Consistent spacing */}
                {children && (
                    <Box
                        sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 0.5,
                        }}
                    >
                        {children}
                    </Box>
                )}

                {/* User Section - Avatar with Menu */}
                <Tooltip title={greeting}>
                    <IconButton
                        color="inherit"
                        aria-label="Open navigation menu"
                        onMouseEnter={onMenuHover}
                        sx={(theme) => ({
                            ml: 0.5,
                            p: 0.5,
                            '&:hover': {
                                bgcolor: alpha(theme.palette.common.white, 0.12),
                            },
                        })}
                    >
                        <Avatar
                            sx={(theme) => ({
                                width: 32,
                                height: 32,
                                fontSize: '0.875rem',
                                fontWeight: 500,
                                bgcolor: alpha(theme.palette.common.white, 0.2),
                                color: 'inherit',
                            })}
                        >
                            {initials}
                        </Avatar>
                    </IconButton>
                </Tooltip>
            </Toolbar>
        </AppBar>
    );
};

export default AppToolbar;
