/**
 * React Side Nav Component
 *
 * A modern replacement for the AngularJS side-nav component using MUI Drawer.
 */

import React, {useMemo} from 'react';
import {
    Drawer,
    Box,
    List,
    ListItem,
    ListItemButton,
    ListItemIcon,
    ListItemText,
    Typography,
    alpha,
} from '@mui/material';
import {
    AccountCircle as AccountCircleIcon,
    Dashboard as DashboardIcon,
    LocalShipping as LocalShippingIcon,
    Assessment as AssessmentIcon,
    TaskAlt as TaskAltIcon,
    Search as SearchIcon,
    Schedule as ScheduleIcon,
    Map as MapIcon,
    ManageAccounts as ManageAccountsIcon,
    Favorite as FavoriteIcon,
} from '@mui/icons-material';
import dayjs from 'dayjs';

export interface NavItem {
    id: string;
    label: string;
    icon: React.ReactNode;
    state: string;
    usOnly?: boolean;
    nzOnly?: boolean;
}

export interface SideNavProps {
    open: boolean;
    userName: string;
    companyName?: string;
    isUsCustomer: boolean;
    currentState: string;
    onClose: () => void;
    onNavigate: (state: string) => void;
    onMouseEnter?: () => void;
    onMouseLeave?: () => void;
}

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
    const currentYear = useMemo(() => dayjs().year(), []);
    const currentDate = useMemo(() => {
        const locale = isUsCustomer ? 'en' : 'en-nz';
        return dayjs().locale(locale).format('dddd, MMMM D, YYYY');
    }, [isUsCustomer]);

    const navItems: NavItem[] = useMemo(() => [
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
            state: 'cs',
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
    ], [isUsCustomer]);

    const filteredNavItems = useMemo(() => {
        return navItems.filter(item => {
            if (item.usOnly && !isUsCustomer) return false;
            return !(item.nzOnly && isUsCustomer);
        });
    }, [navItems, isUsCustomer]);

    const handleNavClick = (state: string) => {
        onNavigate(state);
        onClose();
    };

    return (
        <Drawer
            anchor="right"
            open={open}
            onClose={onClose}
            variant="temporary"
            ModalProps={{
                keepMounted: true,
            }}
            PaperProps={{
                onMouseEnter,
                onMouseLeave,
                sx: {
                    width: drawerWidth,
                    bgcolor: 'background.default',
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
                        <Typography variant="h6" fontWeight={600}>
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
                                        primaryTypographyProps={{
                                            fontWeight: isActive ? 600 : 400,
                                            color: isActive ? 'primary.main' : 'text.primary',
                                        }}
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
                <Typography variant="caption" color="text.secondary">
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
                        <Typography variant="caption" color="text.secondary">
                            Made with aroha in Aotearoa
                        </Typography>
                    </Box>
                )}
            </Box>
        </Drawer>
    );
};

export default SideNav;
