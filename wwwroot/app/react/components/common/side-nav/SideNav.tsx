/**
 * React Side Nav Component
 *
 * A modern replacement for the AngularJS side-nav component using MUI Drawer.
 */

import React, {useMemo, useCallback} from 'react';
import {alpha} from '@mui/material/styles';
import Drawer from '@mui/material/Drawer';
import Box from '@mui/material/Box';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Typography from '@mui/material/Typography';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
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
import {NavItem, SideNavProps} from "./SideNav.types";

const drawerWidth = 280;

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
                        bgcolor: 'background.default',
                    },
                },
            }}
        >
            {/* User Profile Header */}
            <Box
                sx={(theme) => ({
                    background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
                    color: 'white',
                    p: 3,
                })}
            >
                <Box sx={{display: 'flex', alignItems: 'center', gap: 2, mb: 2}}>
                    <Box
                        sx={{
                            width: 52,
                            height: 52,
                            borderRadius: '50%',
                            bgcolor: 'rgba(255,255,255,0.15)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
                        <AccountCircleIcon sx={{fontSize: 36}} />
                    </Box>
                    <Box>
                        <Typography variant="h6" sx={{
                            fontWeight: 600
                        }}>
                            {userName}
                        </Typography>
                        <Typography variant="body2" sx={{opacity: 0.85}}>
                            {companyName}
                        </Typography>
                    </Box>
                </Box>
                <Typography variant="body2" sx={{opacity: 0.8}}>
                    {currentDate}
                </Typography>
            </Box>
            {/* Navigation Menu */}
            <Box sx={{flex: 1, overflow: 'auto', py: 1}}>
                <List disablePadding>
                    {filteredNavItems.map((item) => {
                        const isActive = currentState === item.state;
                        return (
                            <ListItem key={item.id} disablePadding>
                                <ListItemButton
                                    onClick={() => handleNavClick(item.state)}
                                    sx={(theme) => ({
                                        py: 1.5,
                                        px: 2,
                                        borderLeft: isActive
                                            ? `4px solid ${theme.palette.primary.main}`
                                            : '4px solid transparent',
                                        bgcolor: isActive
                                            ? alpha(theme.palette.primary.main, 0.08)
                                            : 'transparent',
                                        '&:hover': {
                                            bgcolor: alpha(theme.palette.primary.main, 0.04),
                                        },
                                    })}
                                >
                                    <ListItemIcon
                                        sx={(theme) => ({
                                            color: isActive
                                                ? theme.palette.primary.main
                                                : theme.palette.text.secondary,
                                            minWidth: 44,
                                        })}
                                    >
                                        {item.icon}
                                    </ListItemIcon>
                                    <ListItemText
                                        primary={item.label}
                                        slotProps={{primary: {
                                            color: isActive ? 'primary.main' : 'text.primary',
                                            sx: {fontWeight: isActive ? 600 : 400},
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
                    &copy; {currentYear} Deliver Different
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
