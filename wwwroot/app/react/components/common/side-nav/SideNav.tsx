/**
 * React Side Nav Component
 *
 * A modern replacement for the AngularJS side-nav component using a Mantine Drawer.
 */

import React, {useMemo, useCallback} from 'react';
import {Avatar, Box, Drawer, em, Group, NavLink, ScrollArea, Stack, Text, useMantineTheme} from '@mantine/core';
import {useMediaQuery} from '@mantine/hooks';
import {
    CalendarDays,
    CircleUserRound,
    LayoutDashboard,
    ChartColumn,
    CircleCheckBig,
    Search,
    Clock,
    UserCog,
    Heart,
} from 'lucide-react';
import {IconTruck, IconMap} from '@tabler/icons-react';
import dayjs from 'dayjs';
import {Icon} from '../icon/Icon';
import {getHeaderSurfaceAccent} from '../../dialogs/shared/mantine/styles';
import {getDispatchBetaEnabled} from '../../../pages/dispatch/lib/betaPreference';
import {getJobSearchBetaEnabled} from '../../../pages/job-search/lib/betaPreference';
import {NavItem, SideNavProps} from "./SideNav.types";
import classes from './SideNav.module.css';

const drawerWidth = 264;

/**
 * Bigger than the shared `UI_ICON_SIZE` (20), which is the *dense* default for
 * controls and table rows. A 48px drawer row is not dense UI — this is the classic
 * drawer's 24px glyph, and with the 20px gap below it rebuilds that drawer's 44px
 * icon column.
 */
const NAV_ICON_SIZE = 24;

/** Below this the panel goes full-bleed, matching the toolbar's compact breakpoint. */
const COMPACT_QUERY = `(max-width: ${em(768)})`;

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
    const theme = useMantineTheme();
    const shell = theme.other.shell;
    const scrim = theme.other.scrim;
    const currentYear = dayjs().year();
    const isCompact = useMediaQuery(COMPACT_QUERY);

    /**
     * The fixed-size section keeps Lucide and Tabler glyphs on the same axis. The row
     * chrome itself — rail, hover wash, active wash — lives in `SideNav.module.css`,
     * since inline styles cannot express a pseudo-state.
     */
    const navItemStyles = useMemo(() => ({
        section: {
            width: NAV_ICON_SIZE,
            height: NAV_ICON_SIZE,
            marginInlineEnd: 20,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
        },
        label: {fontSize: 16},
    }), []);

    const currentDate = useMemo(() => {
        const locale = isUsCustomer ? 'en' : 'en-nz';
        return dayjs().locale(locale).format('dddd, MMMM D, YYYY');
    }, [isUsCustomer]);

    const filteredNavItems = useMemo((): NavItem[] => {
        const navItems: NavItem[] = [
            {
                id: 'dashboard',
                label: 'Dashboard',
                icon: <Icon lucide={LayoutDashboard} size={NAV_ICON_SIZE} />,
                // Link straight at the React page so the nav skips the classic
                // route's redirect hop; operators who opted out still get V1.
                state: getDispatchBetaEnabled() ? 'dispatchV2' : 'home',
                matchStates: ['home', 'dispatchV2'],
            },
            {
                id: 'shipping',
                label: isUsCustomer ? 'Domestic' : 'Nationwide',
                icon: <Icon tabler={IconTruck} size={NAV_ICON_SIZE} />,
                state: 'nw',
            },
            {
                id: 'overview',
                label: 'Overview',
                icon: <Icon lucide={ChartColumn} size={NAV_ICON_SIZE} />,
                state: 'overview',
            },
            {
                id: 'tasks',
                label: 'Tasks',
                icon: <Icon lucide={CircleCheckBig} size={NAV_ICON_SIZE} />,
                state: 'taskDashboard',
            },
            {
                id: 'jobSearch',
                label: 'Job Search',
                icon: <Icon lucide={Search} size={NAV_ICON_SIZE} />,
                state: getJobSearchBetaEnabled() ? 'jobSearchV2' : 'jobSearch',
                matchStates: ['jobSearch', 'jobSearchV2'],
            },
            {
                id: 'recurringJobs',
                label: 'Recurring Jobs',
                icon: <Icon lucide={Clock} size={NAV_ICON_SIZE} />,
                state: 'recurringJobs',
            },
            {
                id: 'courierMap',
                label: 'Courier Map',
                icon: <Icon tabler={IconMap} size={NAV_ICON_SIZE} />,
                state: 'courierMap',
            },
            {
                id: 'driverManagement',
                label: 'Driver Management',
                icon: <Icon lucide={UserCog} size={NAV_ICON_SIZE} />,
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

    /**
     * The active row's rail. The 12% wash alone is ~1.05:1 against the panel, so the
     * rail is what carries WCAG 1.4.11's 3:1 state boundary — hence the darker brand
     * step (cyan-7 / gold-9) rather than the light primary.
     */
    const navAccent = getHeaderSurfaceAccent(isUsCustomer);

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
                        // Same tier as Modal/Menu — a panel floating over the page —
                        // and it follows the colour scheme instead of pinning a literal.
                        backgroundColor: 'var(--dd-surface-container-high)',
                    },
                }}
            >
                {/* Account header — carries the app bar's Ink Blue so the two shell
                    surfaces read as one. The colour change is the separator, so there
                    is no keyline beneath it. */}
                <Box
                    component="header"
                    data-testid="sidenav-account"
                    px={20}
                    pt={24}
                    pb={20}
                    ta="center"
                    style={{backgroundColor: shell.appBar, color: shell.textPrimary}}
                >
                    <Avatar
                        data-testid="sidenav-avatar"
                        size={56}
                        mx="auto"
                        mb={10}
                        radius="xl"
                        fz="1.25rem"
                        style={{backgroundColor: scrim.fillStrong, color: shell.textPrimary, fontWeight: 600}}
                    >
                        {initials || <Icon lucide={CircleUserRound} size={36} />}
                    </Avatar>
                    <Text fz="0.6875rem" fw={700} lts="0.08em" tt="uppercase" lh={1.4} c={shell.textSecondary}>
                        {companyName}
                    </Text>
                    <Text fz="1rem" fw={600} lh={1.3} truncate c={shell.textPrimary}>
                        {userName}
                    </Text>
                    {/* `textSecondary`, not `textMuted` — 0.38 white on Ink is unreadable
                        at 0.7rem, and the old drawer set this line at the same 0.60 as
                        the company eyebrow above it. */}
                    <Group justify="center" gap={6} mt={6} c={shell.textSecondary}>
                        <Icon lucide={CalendarDays} size={13} />
                        <Text fz="0.7rem" lh={1.2} c="inherit">{currentDate}</Text>
                    </Group>
                </Box>

                {/* Navigation Menu */}
                <ScrollArea style={{flex: 1}}>
                    <Box
                        component="nav"
                        aria-label="Main navigation"
                        pb={8}
                        style={{'--sidenav-accent': navAccent} as React.CSSProperties}
                    >
                        {/* Same eyebrow as the company name above it — the two label their
                            section identically, so they get one treatment rather than the
                            old drawer's near-miss 0.675rem/0.09em. Aligned to the glyph
                            column (4px rail + 16px row padding), not the old 18px. */}
                        <Text
                            component="h2"
                            px={20}
                            pt={16}
                            pb={4}
                            fz="0.6875rem"
                            fw={700}
                            lts="0.08em"
                            tt="uppercase"
                            lh={1.4}
                            c="dimmed"
                        >
                            Menu
                        </Text>
                        {filteredNavItems.map((item) => {
                            const isActive =
                                currentState === item.state ||
                                (item.matchStates?.includes(currentState) ?? false);
                            return (
                                <NavLink
                                    key={item.id}
                                    component="button"
                                    className={classes.navLink}
                                    classNames={{section: classes.section}}
                                    active={isActive}
                                    aria-current={isActive ? 'page' : undefined}
                                    color="brand"
                                    variant="subtle"
                                    label={item.label}
                                    leftSection={item.icon}
                                    onClick={() => handleNavClick(item.state)}
                                    styles={navItemStyles}
                                />
                            );
                        })}
                    </Box>
                </ScrollArea>

                {/* Footer */}
                <Stack gap={4} px="md" py={16} ta="center" style={{borderTop: '1px solid var(--mantine-color-default-border)'}}>
                    <Text fz={12} fw={400} lh={1.3} c="dimmed">&copy; {currentYear} Deliver DFRNT</Text>
                    {isUsCustomer && (
                        <Group justify="center" gap={6} align="center" c="dimmed">
                            <Icon lucide={Heart} size={14} color={theme.colors.red[4]} />
                            <Text fz={12} fw={400} lh={1.3} c="inherit">Made with aroha in Aotearoa</Text>
                        </Group>
                    )}
                </Stack>
            </Drawer.Content>
        </Drawer.Root>
    );
};

export default SideNav;
