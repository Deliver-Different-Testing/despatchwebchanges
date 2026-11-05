/**
 * DFRNT left sidebar: a solid Ink panel (never glass, never the tenant primary), app icon + name
 * header, route-table sections, Settings below a divider, then the colour-mode switcher and the
 * identity card (user + company). Collapsed, it is a 72px icon rail with tooltips; the toggle lives in the app bar.
 * Ported from the brand skill's `assets/sidebar`, flattened to Despatch's route list.
 */

import React from 'react';
import {Avatar, Badge, Box, Divider, Group, Image, NavLink, ScrollArea, Stack, Text, Tooltip, UnstyledButton} from '@mantine/core';
import {ColorModeSwitcher} from '../side-nav/ColorModeSwitcher';
import type {NavItem} from '../side-nav/SideNav.types';
import {onBrandScrim, sideMenuColors as shell} from '../../../theme/dfrntMantineTheme';
import {APP_BLURB, APP_ICON_SRC, APP_NAME} from '../../../constants/app';
import classes from './Sidebar.module.css';

export const NAV_WIDTH = 264;
export const RAIL_WIDTH = 72;

export interface SidebarGroup {
    label: string;
    items: NavItem[];
}

export interface SidebarProps {
    groups: SidebarGroup[];
    settingsItem: NavItem;
    currentState: string;
    collapsed: boolean;
    onNavigate: (state: string) => void;
    onLogoClick?: () => void;
    userName: string;
    companyName?: string;
    isNetworkPartner?: boolean;
}

const getInitials = (name: string): string =>
    name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((word) => word.charAt(0).toUpperCase())
        .join('');

/** Rows read the shell tokens, never the theme primary. Active = inset accent bar + 600 weight, no fill. */
const rowStyle = (active: boolean): React.CSSProperties => ({
    color: active ? shell.textPrimary : shell.textSecondary,
    fontWeight: active ? 600 : 500,
    boxShadow: active ? `inset 3px 0 0 ${shell.activeAccent}` : undefined,
    '--nl-bg': shell.hoverBg,
    '--nl-hover': shell.hoverBg,
    '--nl-color': shell.textPrimary,
} as React.CSSProperties);

export const Sidebar: React.FC<SidebarProps> = ({
    groups,
    settingsItem,
    currentState,
    collapsed,
    onNavigate,
    onLogoClick,
    userName,
    companyName = 'DFRNT',
    isNetworkPartner = false,
}) => {
    const keyline = `1px solid ${shell.border}`;

    const renderItem = (item: NavItem) => {
        const active = currentState === item.state || (item.matchStates?.includes(currentState) ?? false);
        const link = (
            <NavLink
                key={item.id}
                component="button"
                className={collapsed ? classes.navLinkRail : undefined}
                active={active}
                aria-current={active ? 'page' : undefined}
                aria-label={collapsed ? item.label : undefined}
                label={collapsed ? undefined : item.label}
                leftSection={item.icon}
                onClick={() => onNavigate(item.state)}
                fz="sm"
                py={12}
                px={collapsed ? 0 : 16}
                style={rowStyle(active)}
            />
        );
        return collapsed ? (
            <Tooltip key={item.id} label={item.label} position="right" withArrow openDelay={200}>
                {link}
            </Tooltip>
        ) : link;
    };

    return (
        <Box
            component="aside"
            data-testid="dfrnt-sidebar"
            data-collapsed={collapsed ? 'true' : undefined}
            className={classes.aside}
            w={collapsed ? RAIL_WIDTH : NAV_WIDTH}
            h="100%"
            display="flex"
            bg={shell.bg}
            style={{flexShrink: 0, flexDirection: 'column'}}
        >
            <Box data-testid="sidebar-header" p="md" style={{flexShrink: 0, borderBottom: keyline}}>
                <Group gap="sm" wrap="nowrap" justify={collapsed ? 'center' : undefined}>
                    <UnstyledButton
                        onClick={onLogoClick}
                        aria-label={`${APP_NAME} home`}
                        disabled={!onLogoClick}
                        style={{display: 'flex', flexShrink: 0, cursor: onLogoClick ? 'pointer' : 'default'}}
                    >
                        <Box w={40} h={40} display="flex" style={{alignItems: 'center', justifyContent: 'center'}}>
                            <Image src={APP_ICON_SRC} alt="" w={32} h={32} fit="contain" />
                        </Box>
                    </UnstyledButton>
                    {!collapsed && (
                        <Box style={{flex: 1, minWidth: 0}}>
                            <Text component="h1" m={0} fz="md" fw={700} c={shell.textPrimary} truncate>
                                {APP_NAME}
                            </Text>
                            <Text fz="xs" c={shell.textSecondary} lh={1.35}>{APP_BLURB}</Text>
                        </Box>
                    )}
                </Group>
            </Box>

            <ScrollArea style={{flex: 1, minHeight: 0}} type="never">
                <Stack component="nav" aria-label="Main navigation" gap={4} py="md" px={8}>
                    {groups.map((group, index) => (
                        <Stack key={group.label} gap={4}>
                            {collapsed ? (
                                index > 0 && <Divider my={4} mx={16} color={shell.border} />
                            ) : (
                                <Text
                                    component="h2"
                                    m={0}
                                    px={16}
                                    pt={index > 0 ? 8 : 0}
                                    pb={4}
                                    fz="0.6875rem"
                                    fw={700}
                                    lts="0.08em"
                                    tt="uppercase"
                                    lh={1.4}
                                    c={shell.textMuted}
                                >
                                    {group.label}
                                </Text>
                            )}
                            {group.items.map(renderItem)}
                        </Stack>
                    ))}

                    <Divider my={8} mx={16} color={shell.border} />
                    {renderItem(settingsItem)}
                </Stack>
            </ScrollArea>

            {!collapsed && (
                <Group justify="center" px={12} py={8} style={{flexShrink: 0, borderTop: keyline}}>
                    <ColorModeSwitcher scrim={onBrandScrim} />
                </Group>
            )}

            <Group
                justify={collapsed ? 'center' : 'space-between'}
                wrap="nowrap"
                p="md"
                style={{flexShrink: 0, borderTop: keyline}}
            >
                {collapsed ? (
                    <Tooltip label={userName} position="right" withArrow openDelay={200}>
                        <Avatar data-testid="sidebar-avatar" size={32} color={shell.activeAccent} variant="filled" autoContrast>
                            {getInitials(userName)}
                        </Avatar>
                    </Tooltip>
                ) : (
                    <Group gap="sm" wrap="nowrap" data-testid="sidebar-identity" style={{flex: 1, minWidth: 0}}>
                        <Avatar
                            data-testid="sidebar-avatar"
                            aria-hidden
                            size={32}
                            color={shell.activeAccent}
                            variant="filled"
                            autoContrast
                            style={{flexShrink: 0}}
                        >
                            {getInitials(userName)}
                        </Avatar>
                        <Box style={{flex: 1, minWidth: 0}}>
                            <Text fz="sm" fw={500} c={shell.textPrimary} truncate>{userName}</Text>
                            <Text fz="xs" c={shell.textMuted} truncate>{companyName}</Text>
                            {isNetworkPartner && (
                                <Badge
                                    data-testid="sidebar-np-chip"
                                    size="xs"
                                    variant="filled"
                                    style={{backgroundColor: onBrandScrim.fillStrong, color: shell.textPrimary}}
                                >
                                    Network Partner
                                </Badge>
                            )}
                        </Box>
                    </Group>
                )}
            </Group>

        </Box>
    );
};

export default Sidebar;
