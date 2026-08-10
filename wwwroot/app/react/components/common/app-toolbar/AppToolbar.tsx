/**
 * React App Toolbar Component
 *
 * The Ink-Blue app bar.
 * Layout: Logo | Keyline | Breadcrumbs | Spacer | Actions | Menu
 * Chrome mirrors Integration Manager's AppShell.Header.
 */

import React from 'react';
import {ActionIcon, Badge, Box, Group, Text, Tooltip} from '@mantine/core';
import {Menu as MenuIcon, ChevronRight} from 'lucide-react';
import dayjs from 'dayjs';
import {Icon} from '../icon/Icon';
import {onBrandScrim, sidebarColors} from '../../../theme/dfrntMantineTheme';
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
    const greeting = greetUser(firstName);
    const resolvedCrumbs = resolveCrumbs(breadcrumbs, title);
    const hasMultipleCrumbs = resolvedCrumbs.length > 1;

    const resolvedLogo = logoUrl ?? 'images/dfrnt_logo_reversed.png';

    return (
        <Box
            component="header"
            // Mantine has no AppBar, so the Ink navy the MUI theme used to inject
            // via its MuiAppBar override is set here explicitly. The height is a
            // literal rather than the `h` prop so it stays in the px the route
            // templates subtract, instead of Mantine's rem/scale calc.
            style={{
                height: APP_BAR_HEIGHT_PX,
                backgroundColor: sidebarColors.appBar,
                color: onBrandScrim.text,
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
                    <Box
                        data-testid="toolbar-keyline"
                        visibleFrom={hasMultipleCrumbs ? 'sm' : undefined}
                        style={{
                            width: 1,
                            height: 22,
                            backgroundColor: sidebarColors.border,
                            flexShrink: 0,
                        }}
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
                                            style={{color: sidebarColors.textMuted, display: 'flex'}}
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
                                            color: isLast ? sidebarColors.textPrimary : sidebarColors.textSecondary,
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
                    <Group gap={4} wrap="nowrap">
                        {children}
                    </Group>
                )}

                {/* Menu Button */}
                <Tooltip label={greeting}>
                    <ActionIcon
                        variant="subtle"
                        size="lg"
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
