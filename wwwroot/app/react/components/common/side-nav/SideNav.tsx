/**
 * React Side Nav Component
 *
 * A modern replacement for the AngularJS side-nav component using MUI Drawer.
 */

import React, {useMemo, useCallback} from 'react';
import {alpha, SxProps, Theme} from '@mui/material/styles';
import Drawer from '@mui/material/Drawer';
import Box from '@mui/material/Box';
import Avatar from '@mui/material/Avatar';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import ListSubheader from '@mui/material/ListSubheader';
import Typography from '@mui/material/Typography';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import CalendarTodayOutlinedIcon from '@mui/icons-material/CalendarTodayOutlined';
import DashboardIcon from '@mui/icons-material/Dashboard';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import AssessmentIcon from '@mui/icons-material/Assessment';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import SearchIcon from '@mui/icons-material/Search';
import ScheduleIcon from '@mui/icons-material/Schedule';
import MapIcon from '@mui/icons-material/Map';
import ManageAccountsIcon from '@mui/icons-material/ManageAccounts';
import FavoriteIcon from '@mui/icons-material/Favorite';
import dayjs from 'dayjs';
import {accentPalette, shellColors} from '../../../theme/muiTheme';
import {NavItem, SideNavProps} from "./SideNav.types";

const drawerWidth = 264;

const sectionHeaderSx: SxProps<Theme> = {
    px: 2.25,
    pt: 2,
    pb: 0.5,
    fontSize: '0.675rem',
    color: 'text.secondary',
    letterSpacing: '0.09em',
    textTransform: 'uppercase',
    fontWeight: 700,
    lineHeight: 1.4,
    bgcolor: 'transparent',
};

const navItemSx: SxProps<Theme> = {
    borderRadius: '999px',
    mx: 1,
    mb: 0.25,
    minHeight: 44,
    color: 'text.secondary',
    transition: (theme) =>
        theme.transitions.create(['background-color', 'color'], {duration: 150}),
    '&:hover': {
        bgcolor: 'action.hover',
        color: 'text.primary',
    },
    '&.Mui-selected': {
        bgcolor: (theme) => alpha(theme.palette.primary.main, 0.12),
        color: 'primary.main',
        '&:hover': {
            bgcolor: (theme) => alpha(theme.palette.primary.main, 0.16),
        },
    },
};

const getInitials = (name: string): string =>
    name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((word) => word.charAt(0).toUpperCase())
        .join('');

export const SideNav: React.FC<SideNavProps> = ({
    open,
    userName,
    companyName = 'DFRNT',
    isUsCustomer,
    currentState,
    onClose,
    onNavigate,
    onMouseEnter,
    onMouseLeave,
}) => {
    const currentYear = dayjs().year();

    const currentDate = useMemo(() => {
        const locale = isUsCustomer ? 'en' : 'en-nz';
        return dayjs().locale(locale).format('dddd, MMMM D, YYYY');
    }, [isUsCustomer]);

    const filteredNavItems = useMemo((): NavItem[] => {
        const navItems: NavItem[] = [
            {
                id: 'dashboard',
                label: 'Dashboard',
                icon: <DashboardIcon />,
                state: 'home',
                matchStates: ['dispatchV2'],
            },
            {
                id: 'shipping',
                label: isUsCustomer ? 'Domestic' : 'Nationwide',
                icon: <LocalShippingIcon />,
                state: 'nw',
            },
            {
                id: 'overview',
                label: 'Overview',
                icon: <AssessmentIcon />,
                state: 'overview',
            },
            {
                id: 'tasks',
                label: 'Tasks',
                icon: <TaskAltIcon />,
                state: 'taskDashboard',
            },
            {
                id: 'jobSearch',
                label: 'Job Search',
                icon: <SearchIcon />,
                state: 'jobSearch',
                matchStates: ['jobSearchV2'],
            },
            {
                id: 'recurringJobs',
                label: 'Recurring Jobs',
                icon: <ScheduleIcon />,
                state: 'recurringJobs',
            },
            {
                id: 'courierMap',
                label: 'Courier Map',
                icon: <MapIcon />,
                state: 'courierMap',
            },
            {
                id: 'driverManagement',
                label: 'Driver Management',
                icon: <ManageAccountsIcon />,
                state: 'driverManagement',
                nzOnly: true,
            },
        ];

        return navItems.filter(item => {
            if (item.usOnly && !isUsCustomer) return false;
            return !(item.nzOnly && isUsCustomer);
        });
    }, [isUsCustomer]);

    const handleNavClick = useCallback((state: string): void => {
        onNavigate(state);
        onClose();
    }, [onNavigate, onClose]);

    const initials = getInitials(userName);
    const headerBg = shellColors.appBar;

    return (
        <Drawer
            anchor="right"
            open={open}
            onClose={onClose}
            variant="temporary"
            ModalProps={{
                keepMounted: true,
            }}
            slotProps={{
                paper: {
                    onMouseEnter,
                    onMouseLeave,
                    sx: {
                        width: drawerWidth,
                        bgcolor: accentPalette[50],
                    },
                },
            }}
        >
            {/* User Profile Header */}
            <Box
                sx={{
                    bgcolor: headerBg,
                    color: 'white',
                    px: 2.5,
                    pt: 3,
                    pb: 2.5,
                    textAlign: 'center',
                }}
            >
                <Avatar
                    sx={{
                        width: 56,
                        height: 56,
                        mx: 'auto',
                        mb: 1.25,
                        fontSize: '1.25rem',
                        fontWeight: 600,
                        color: '#fff',
                        bgcolor: 'rgba(255,255,255,0.2)',
                    }}
                >
                    {initials || <AccountCircleIcon sx={{fontSize: 36}} />}
                </Avatar>
                <Typography
                    sx={{
                        fontSize: '0.6875rem',
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                        fontWeight: 700,
                        color: 'rgba(255,255,255,0.60)',
                        lineHeight: 1.4,
                    }}
                >
                    {companyName}
                </Typography>
                <Typography
                    sx={{
                        fontSize: '1rem',
                        fontWeight: 600,
                        color: 'rgba(255,255,255,0.95)',
                        lineHeight: 1.3,
                    }}
                >
                    {userName}
                </Typography>
                <Box
                    sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 0.75,
                        mt: 0.75,
                    }}
                >
                    <CalendarTodayOutlinedIcon sx={{fontSize: 13, color: 'rgba(255,255,255,0.60)'}} />
                    <Typography
                        sx={{
                            fontSize: '0.7rem',
                            color: 'rgba(255,255,255,0.60)',
                            lineHeight: 1.2,
                        }}
                    >
                        {currentDate}
                    </Typography>
                </Box>
            </Box>
            {/* Navigation Menu */}
            <Box component="nav" sx={{flex: 1, overflow: 'auto', py: 1}}>
                <List subheader={<ListSubheader sx={sectionHeaderSx}>Menu</ListSubheader>}>
                    {filteredNavItems.map((item) => {
                        const isActive =
                            currentState === item.state ||
                            (item.matchStates?.includes(currentState) ?? false);
                        return (
                            <ListItem key={item.id} disablePadding>
                                <ListItemButton
                                    selected={isActive}
                                    onClick={() => handleNavClick(item.state)}
                                    sx={navItemSx}
                                >
                                    <ListItemIcon
                                        sx={{
                                            color: isActive ? 'primary.main' : 'text.secondary',
                                            minWidth: 36,
                                        }}
                                    >
                                        {item.icon}
                                    </ListItemIcon>
                                    <ListItemText
                                        primary={item.label}
                                        slotProps={{primary: {
                                            color: isActive ? 'primary.main' : 'inherit',
                                            sx: {
                                                fontSize: '0.8125rem',
                                                fontWeight: isActive ? 600 : 500,
                                            },
                                        }}}
                                    />
                                </ListItemButton>
                            </ListItem>
                        );
                    })}
                </List>
            </Box>
            {/* Footer */}
            <Box
                sx={(theme) => ({
                    p: 2,
                    borderTop: `1px solid ${theme.palette.divider}`,
                    textAlign: 'center',
                })}
            >
                <Typography variant="caption" sx={{
                    color: "text.secondary"
                }}>
                    &copy; {currentYear} Deliver DFRNT
                </Typography>
                {isUsCustomer && (
                    <Box
                        sx={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 0.5,
                            mt: 0.5,
                        }}
                    >
                        <FavoriteIcon sx={{fontSize: 14, color: 'error.main'}} />
                        <Typography variant="caption" sx={{
                            color: "text.secondary"
                        }}>
                            Made with aroha in Aotearoa
                        </Typography>
                    </Box>
                )}
            </Box>
        </Drawer>
    );
};

export default SideNav;
