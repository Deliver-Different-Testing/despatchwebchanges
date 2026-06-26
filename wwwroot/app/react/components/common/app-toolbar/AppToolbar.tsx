/**
 * React App Toolbar Component
 *
 * A modern Material Design 3 compliant app bar.
 * Layout: Logo | Divider | Breadcrumbs | Spacer | Actions | User Menu
 */

import React from 'react';
import {alpha} from '@mui/material/styles';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Box from '@mui/material/Box';
import Breadcrumbs from '@mui/material/Breadcrumbs';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Tooltip from '@mui/material/Tooltip';
import MenuIcon from '@mui/icons-material/Menu';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import dayjs from 'dayjs';
import {aiAccentColor} from '../../../theme/designTokens';

export interface BreadcrumbItem {
    label: string;
    href?: string;
}

export interface AppToolbarProps {
    title?: string;
    breadcrumbs?: BreadcrumbItem[];
    firstName: string;
    logoUrl?: string;
    children?: React.ReactNode;
    onLogoClick?: () => void;
    onMenuHover?: () => void;
    /** Show a BETA chip next to the page title (V2 pages). */
    beta?: boolean;
}

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

function resolveCrumbs(
    breadcrumbs?: BreadcrumbItem[],
    title?: string,
): BreadcrumbItem[] {
    if (breadcrumbs && breadcrumbs.length > 0) {
        return breadcrumbs;
    }
    if (title) {
        return [{label: title}];
    }
    return [];
}

export const AppToolbar: React.FC<AppToolbarProps> = ({
    title,
    breadcrumbs,
    firstName,
    logoUrl = 'images/dfrnt_logo.png',
    children,
    onLogoClick,
    onMenuHover,
    beta,
}) => {
    const greeting = greetUser(firstName);
    const resolvedCrumbs = resolveCrumbs(breadcrumbs, title);
    const hasMultipleCrumbs = resolvedCrumbs.length > 1;

    return (
    <AppBar
        position="static"
        elevation={1}
        sx={(theme) => ({
            bgcolor: theme.palette.primary.main,
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

            {/* Vertical divider between brand and page context */}
            {resolvedCrumbs.length > 0 && (
                <Divider
                    orientation="vertical"
                    flexItem
                    sx={(theme) => ({
                        mx: {xs: 1, sm: 2},
                        my: 1.5,
                        borderColor: alpha(theme.palette.primary.contrastText, 0.24),
                        display: hasMultipleCrumbs
                            ? {xs: 'none', sm: 'block'}
                            : 'block',
                    })}
                />
            )}

            {/* Breadcrumbs - Page Context */}
            {resolvedCrumbs.length > 0 && (
                <Breadcrumbs
                    aria-label="page navigation"
                    separator={
                        <NavigateNextIcon
                            fontSize="small"
                            sx={{opacity: 0.6}}
                        />
                    }
                    sx={{
                        color: 'inherit',
                        '& .MuiBreadcrumbs-ol': {flexWrap: 'nowrap'},
                        '& .MuiBreadcrumbs-li': {
                            whiteSpace: 'nowrap',
                            minWidth: 0,
                        },
                        '& .MuiBreadcrumbs-separator': {
                            mx: 0.75,
                        },
                    }}
                >
                    {resolvedCrumbs.map((crumb, index) => {
                        const isLast = index === resolvedCrumbs.length - 1;
                        const hideOnMobile = hasMultipleCrumbs && !isLast;
                        return (
                            <Typography
                                key={`${crumb.label}-${index}`}
                                component={isLast ? 'h1' : 'span'}
                                noWrap
                                sx={{
                                    fontSize: '0.9375rem',
                                    fontWeight: isLast ? 500 : 400,
                                    letterSpacing: 0,
                                    lineHeight: 1.25,
                                    color: 'inherit',
                                    opacity: isLast ? 1 : 0.75,
                                    margin: 0,
                                    display: hideOnMobile
                                        ? {xs: 'none', sm: 'inline'}
                                        : 'inline',
                                }}
                            >
                                {crumb.label}
                            </Typography>
                        );
                    })}
                </Breadcrumbs>
            )}

            {beta && (
                <Chip
                    label="BETA"
                    size="small"
                    sx={{
                        ml: 1,
                        height: 18,
                        fontSize: '0.625rem',
                        fontWeight: 700,
                        letterSpacing: '0.04em',
                        bgcolor: aiAccentColor,
                        color: '#fff',
                    }}
                />
            )}

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

            {/* Menu Button */}
            <Tooltip title={greeting}>
                <IconButton
                    color="inherit"
                    aria-label="Open navigation menu"
                    onMouseEnter={onMenuHover}
                    sx={(theme) => ({
                        ml: 0.5,
                        '&:hover': {
                            bgcolor: alpha(theme.palette.common.white, 0.12),
                        },
                    })}
                >
                    <MenuIcon />
                </IconButton>
            </Tooltip>
        </Toolbar>
    </AppBar>
    );
};

export default AppToolbar;
