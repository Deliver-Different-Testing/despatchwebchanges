/**
 * React Side Nav Component
 *
 * The DFRNT side menu (the brand skill's Sidebar: solid Ink panel, logo + name header,
 * inset accent bar on the active row, identity card at the foot) in a Mantine Drawer
 * that slides in from the right.
 */

import React, {useMemo, useCallback} from 'react';
import {Avatar, Badge, Box, Divider, Drawer, em, Group, Image, NavLink, ScrollArea, Stack, Text} from '@mantine/core';
import {useMediaQuery} from '@mantine/hooks';
import {
    CalendarDays,
    LayoutDashboard,
    ChartColumn,
    CircleCheckBig,
    Search,
    Clock,
    UserCog,
    Settings as SettingsIcon,
    Heart,
} from 'lucide-react';
import {IconTruck, IconMap} from '@tabler/icons-react';
import dayjs from 'dayjs';
import {Icon, UI_ICON_SIZE} from '../icon/Icon';
import {NavItem, SideNavProps} from "./SideNav.types";
import {ColorModeSwitcher} from './ColorModeSwitcher';
import {isDashboardVisible} from '../../../services/featureVisibility';
import {navRoutes, statesForFeatureKey} from '../../../routes/routeTable';
import {onBrandScrim, sideMenuColors as shell} from '../../../theme/dfrntMantineTheme';
import classes from './SideNav.module.css';

const drawerWidth = 264;

export const APP_BLURB = 'Book, dispatch and track your jobs';

type NavDisplay = {label: string; icon: React.ReactNode; nzOnly?: boolean};

const NAV_ITEM_DISPLAY: Record<string, (isUsCustomer: boolean) => NavDisplay> = {
    dashboard: () => ({label: 'Dashboard', icon: <Icon lucide={LayoutDashboard} />}),
    shipping: isUs => ({label: isUs ? 'Domestic' : 'Nationwide', icon: <Icon tabler={IconTruck} />}),
    overview: () => ({label: 'Overview', icon: <Icon lucide={ChartColumn} />}),
    tasks: () => ({label: 'Tasks', icon: <Icon lucide={CircleCheckBig} />}),
    jobSearch: () => ({label: 'Job search', icon: <Icon lucide={Search} />}),
    recurringJobs: () => ({label: 'Recurring jobs', icon: <Icon lucide={Clock} />}),
    courierMap: () => ({label: 'Courier map', icon: <Icon tabler={IconMap} />}),
    driverManagement: () => ({label: 'Driver management', icon: <Icon lucide={UserCog} />, nzOnly: true}),
};

/** Below this the panel goes full-bleed, matching the toolbar's compact breakpoint. */
const COMPACT_QUERY = `(max-width: ${em(768)})`;

const getInitials = (name: string): string =>
    name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((word) => word.charAt(0).toUpperCase())
        .join('');

/**
 * Rows read the shell tokens, never the theme primary, so a tenant's Branding primary
 * can't leak into the menu. Active = inset accent bar + 600 weight, no fill; the hover
 * tint lives in `SideNav.module.css` because Mantine only applies `--nl-hover` to the active row.
 */
const rowStyle = (active: boolean): React.CSSProperties => ({
    color: active ? shell.textPrimary : shell.textSecondary,
    fontWeight: active ? 600 : 500,
    boxShadow: active ? `inset 3px 0 0 ${shell.activeAccent}` : undefined,
    '--nl-bg': shell.hoverBg,
    '--nl-hover': shell.hoverBg,
    '--nl-color': shell.textPrimary,
} as React.CSSProperties);

export const SideNav: React.FC<SideNavProps> = ({
    open,
    userName,
    companyName = 'DFRNT',
    isUsCustomer,
    isNetworkPartner = false,
    currentState,
    onClose,
    onNavigate,
    onMouseEnter,
    onMouseLeave,
}) => {
    const currentYear = dayjs().year();
    const isCompact = useMediaQuery(COMPACT_QUERY);

    const currentDate = useMemo(() => {
        return isUsCustomer
            ? dayjs().locale('en').format('dddd, MMMM D, YYYY')
            : dayjs().locale('en-nz').format('dddd, D MMMM YYYY');
    }, [isUsCustomer]);

    const filteredNavItems = useMemo((): NavItem[] => {
        const navItems: NavItem[] = navRoutes().map(route => {
            const {label, icon, nzOnly} = NAV_ITEM_DISPLAY[route.navId!](isUsCustomer);
            return {
                id: route.navId!,
                label,
                icon,
                // Link straight at the page so the nav skips alias redirect hops.
                state: route.state,
                matchStates: statesForFeatureKey(route.featureKey!),
                featureKey: route.featureKey,
                nzOnly,
            };
        });

        return navItems.filter(item => {
            if (item.usOnly && !isUsCustomer) return false;
            if (item.nzOnly && isUsCustomer) return false;
            // DF Admin's grant, on top of the country filter. Ungated sessions
            // pass everything, so this is inert for every audience but NP.
            return !item.featureKey || isDashboardVisible(item.featureKey);
        });
    }, [isUsCustomer]);

    const handleNavClick = useCallback((state: string): void => {
        onNavigate(state);
        onClose();
    }, [onNavigate, onClose]);

    const settingsNavItem: NavItem = useMemo(() => ({
        id: 'settings',
        label: 'Settings',
        icon: <Icon lucide={SettingsIcon} />,
        state: 'settings',
    }), []);

    const renderNavItem = useCallback((item: NavItem) => {
        const isActive =
            currentState === item.state ||
            (item.matchStates?.includes(currentState) ?? false);
        return (
            <NavLink
                key={item.id}
                component="button"
                className={classes.navLink}
                active={isActive}
                aria-current={isActive ? 'page' : undefined}
                label={item.label}
                leftSection={item.icon}
                onClick={() => handleNavClick(item.state)}
                fz="sm"
                py={12}
                px={16}
                style={rowStyle(isActive)}
            />
        );
    }, [currentState, handleNavClick]);

    const initials = getInitials(userName);
    const keyline = `1px solid ${shell.border}`;

    return (
        <Drawer.Root
            opened={open}
            onClose={onClose}
            position="right"
            size={isCompact ? '100%' : drawerWidth}
            padding={0}
            keepMounted
        >
            <Drawer.Overlay />
            <Drawer.Content
                onMouseEnter={onMouseEnter}
                onMouseLeave={onMouseLeave}
                styles={{
                    content: {
                        display: 'flex',
                        flexDirection: 'column',
                        // A solid shell panel in both schemes — never glass, never the tenant primary.
                        backgroundColor: shell.bg,
                    },
                }}
            >
                {/* Logo + company name */}
                <Box component="header" data-testid="sidenav-account" p="md" style={{flexShrink: 0, borderBottom: keyline}}>
                    <Group gap="sm" wrap="nowrap">
                        <Box w={40} h={40} display="flex" style={{alignItems: 'center', justifyContent: 'center', flexShrink: 0}}>
                            <Image src={shell.logoSrc} alt="" w={32} h={32} fit="contain" />
                        </Box>
                        <Box style={{flex: 1, minWidth: 0}}>
                            <Text component="h1" m={0} fz="md" fw={700} c={shell.textPrimary} truncate>
                                {companyName}
                            </Text>
                            <Text fz="xs" c={shell.textSecondary} lh={1.35}>{APP_BLURB}</Text>
                            <Group gap={6} wrap="nowrap" mt={2} c={shell.textMuted}>
                                <Icon lucide={CalendarDays} size={13} />
                                <Text fz="xs" c="inherit" truncate>{currentDate}</Text>
                            </Group>
                        </Box>
                    </Group>
                </Box>

                <ScrollArea style={{flex: 1}} type="never">
                    <Stack component="nav" aria-label="Main navigation" gap={4} py="md" px={8}>
                        <Text
                            component="h2"
                            m={0}
                            px={16}
                            pb={4}
                            fz="0.6875rem"
                            fw={700}
                            lts="0.08em"
                            tt="uppercase"
                            lh={1.4}
                            c={shell.textMuted}
                        >
                            Menu
                        </Text>
                        {filteredNavItems.map((item) => renderNavItem(item))}

                        {/* Settings sits apart from the dashboards above it — a utility
                            item, not gated by dashboardFeatureKeys — so it gets its own
                            divider rather than joining the filtered list. */}
                        <Divider my={8} mx={16} color={shell.border}/>
                        {renderNavItem(settingsNavItem)}
                    </Stack>
                </ScrollArea>

                {/* Action strip */}
                <Group justify="center" px={12} py={8} style={{flexShrink: 0, borderTop: keyline}}>
                    <ColorModeSwitcher scrim={onBrandScrim} />
                </Group>

                {/* Identity card */}
                <Box data-testid="sidenav-identity" p="md" style={{flexShrink: 0, borderTop: keyline}}>
                    <Group gap="sm" wrap="nowrap">
                        <Avatar
                            data-testid="sidenav-avatar"
                            aria-hidden
                            size={32}
                            color={shell.activeAccent}
                            variant="filled"
                            autoContrast
                            style={{flexShrink: 0}}
                        >
                            {initials}
                        </Avatar>
                        <Box style={{flex: 1, minWidth: 0}}>
                            <Group gap={6} wrap="nowrap">
                                <Text fz="sm" fw={500} c={shell.textPrimary} truncate>{userName}</Text>
                                {isNetworkPartner && (
                                    <Badge
                                        data-testid="sidenav-np-chip"
                                        size="xs"
                                        variant="filled"
                                        style={{backgroundColor: onBrandScrim.fillStrong, color: shell.textPrimary, flexShrink: 0}}
                                    >
                                        Network Partner
                                    </Badge>
                                )}
                            </Group>
                            <Text fz="xs" c={shell.textMuted} truncate>&copy; {currentYear} Deliver DFRNT</Text>
                            {isUsCustomer && (
                                <Group gap={4} wrap="nowrap" c={shell.textMuted}>
                                    <Icon lucide={Heart} size={12} color="var(--mantine-color-red-4)" />
                                    <Text fz="xs" c="inherit" truncate>Made with aroha in Aotearoa</Text>
                                </Group>
                            )}
                        </Box>
                    </Group>
                </Box>
            </Drawer.Content>
        </Drawer.Root>
    );
};

export default SideNav;
