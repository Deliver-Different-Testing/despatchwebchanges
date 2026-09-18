/**
 * React App Toolbar Component
 *
 * The shell app bar — Ink Blue on US tenants, the brand gold elsewhere.
 * Layout: Logo | Keyline | Breadcrumbs | Spacer | Actions | Menu
 * Chrome mirrors Integration Manager's AppShell.Header.
 */

import React from 'react';
import {ActionIcon, Badge, Box, Divider, Group, Text, Tooltip, useMantineTheme} from '@mantine/core';
import {Menu as MenuIcon, ChevronRight} from 'lucide-react';
import dayjs from 'dayjs';
import {Icon} from '../icon/Icon';
import {toolbarIconButtonStyle} from './ToolbarActions';
import {APP_BAR_HEIGHT_PX} from './appBarMetrics';

/** Height of the DFRNT wordmark inside the bar. */
const LOGO_HEIGHT_PX = 26;

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
    /** Opens the nav on click/tap — the touch-accessible path (hover never fires on touch). */
    onMenuClick?: () => void;
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
    logoUrl,
    children,
    onLogoClick,
    onMenuHover,
    onMenuClick,
    beta,
}) => {
    // The shell fill, its on-colour and the wordmark that reads on it all come from
    // the theme, so the tenant's bar (Ink navy on US, gold elsewhere) is a provider
    // concern rather than a prop.
    const {shell, scrim} = useMantineTheme().other;
    const greeting = greetUser(firstName);
    const resolvedCrumbs = resolveCrumbs(breadcrumbs, title);
    const hasMultipleCrumbs = resolvedCrumbs.length > 1;

    const resolvedLogo = logoUrl ?? shell.logoSrc;

    return (
        <Box
            component="header"
            // Mantine has no AppBar, so the shell fill the MUI theme used to inject
            // via its MuiAppBar override is set here explicitly. The height is a
            // literal rather than the `h` prop so it stays in the px the route
            // templates subtract, instead of Mantine's rem/scale calc.
            style={{
                height: APP_BAR_HEIGHT_PX,
                backgroundColor: shell.appBar,
                color: scrim.text,
            }}
        >
            <Group h="100%" px="md" gap="md" wrap="nowrap">
                {/* Logo - Brand Identity */}
                <Box
                    component="img"
                    src={resolvedLogo}
                    alt="DFRNT"
                    onClick={onLogoClick}
                    style={{
                        height: LOGO_HEIGHT_PX,
                        display: 'block',
                        flexShrink: 0,
                        cursor: onLogoClick ? 'pointer' : 'default',
                        transition: 'opacity 0.2s',
                    }}
                />

                {/* Keyline separating the brand mark from the location path */}
                {resolvedCrumbs.length > 0 && (
                    <Divider
                        data-testid="toolbar-keyline"
                        orientation="vertical"
                        visibleFrom={hasMultipleCrumbs ? 'sm' : undefined}
                        // Raw px, not the `h` prop: like the bar's own height this
                        // stays out of Mantine's rem/scale calc so it tracks the
                        // fixed-px logo beside it.
                        style={{height: 22, '--divider-color': shell.border, flexShrink: 0} as React.CSSProperties}
                    />
                )}

                {/* Breadcrumbs - Page Context */}
                {resolvedCrumbs.length > 0 && (
                    <Group
                        component="nav"
                        aria-label="page navigation"
                        gap={6}
                        wrap="nowrap"
                        miw={0}
                    >
                        {resolvedCrumbs.map((crumb, index) => {
                            const isLast = index === resolvedCrumbs.length - 1;
                            const hideOnMobile = hasMultipleCrumbs && !isLast;
                            return (
                                <React.Fragment key={`${crumb.label}-${index}`}>
                                    {index > 0 && (
                                        <Box
                                            style={{color: shell.textMuted, display: 'flex'}}
                                            visibleFrom={hideOnMobile ? 'sm' : undefined}
                                        >
                                            <Icon lucide={ChevronRight} size={14} />
                                        </Box>
                                    )}
                                    <Text
                                        component={isLast ? 'h1' : 'span'}
                                        truncate
                                        visibleFrom={hideOnMobile ? 'sm' : undefined}
                                        style={{
                                            // Weight and text colour carry the hierarchy —
                                            // every crumb is set at the same size.
                                            fontSize: '0.875rem',
                                            fontWeight: isLast ? 600 : 400,
                                            lineHeight: 1.2,
                                            color: isLast ? shell.textPrimary : shell.textSecondary,
                                            margin: 0,
                                        }}
                                    >
                                        {crumb.label}
                                    </Text>
                                </React.Fragment>
                            );
                        })}
                    </Group>
                )}

                {beta && (
                    <Badge color="grape" size="xs" style={{letterSpacing: '0.04em'}}>
                        BETA
                    </Badge>
                )}

                {/* Spacer */}
                <Box style={{flex: 1}} />

                {/* Actions Container - a single cluster, so tighter than the bar's own gap */}
                {children && (
                    <Group gap={8} wrap="nowrap">
                        {children}
                    </Group>
                )}

                {/* Menu Button */}
                <Tooltip label={greeting}>
                    <ActionIcon
                        variant="subtle"
                        size="lg"
                        radius="xl"
                        aria-label="Open navigation menu"
                        onMouseEnter={onMenuHover}
                        onClick={onMenuClick}
                        style={toolbarIconButtonStyle}
                    >
                        <Icon lucide={MenuIcon} size={18} />
                    </ActionIcon>
                </Tooltip>
            </Group>
        </Box>
    );
};

export default AppToolbar;
