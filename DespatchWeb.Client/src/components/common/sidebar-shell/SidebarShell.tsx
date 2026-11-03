/**
 * DFRNT-style shell: the left Sidebar beside a page column holding a slim toolbar (breadcrumbs and
 * actions) over the page body. Widths come from flex layout; the slim bar keeps the standard bar
 * height, so the page body's `BELOW_APP_BAR_HEIGHT` sizing is unchanged.
 */

import React, {useMemo} from 'react';
import {Box, em} from '@mantine/core';
import {useMediaQuery} from '@mantine/hooks';
import {AppToolbar} from '../app-toolbar/AppToolbar';
import type {AppShellProps} from '../app-shell/app-shell.types';
import {useNavItems} from '../../../hooks/useNavItems';
import type {NavItem} from '../side-nav/SideNav.types';
import type {RouteSection} from '../../../routes/routeTable';
import {Sidebar, type SidebarGroup} from './Sidebar';
import {useSidebarCollapsed} from './useSidebarCollapsed';

/** Mantine `sm`: below this only the rail is offered. */
const RAIL_ONLY_QUERY = `(max-width: ${em(767)})`;

const SECTION_ORDER: RouteSection[] = ['Dashboards', 'Operations'];

function groupBySection(items: NavItem[]): SidebarGroup[] {
    return SECTION_ORDER
        .map((section) => ({label: section, items: items.filter((item) => item.section === section)}))
        .filter((group) => group.items.length > 0);
}

export const SidebarShell: React.FC<AppShellProps> = ({
    title,
    breadcrumbs,
    firstName,
    fullName,
    isUsCustomer,
    isNetworkPartner,
    currentState,
    companyName,
    children,
    body,
    onLogoClick,
    onNavigate,
    beta,
}) => {
    const {navItems, settingsItem} = useNavItems(isUsCustomer);
    const groups = useMemo(() => groupBySection(navItems), [navItems]);
    const {collapsed, toggle} = useSidebarCollapsed();
    const railOnly = useMediaQuery(RAIL_ONLY_QUERY) ?? false;

    return (
        <Box style={{display: 'flex', height: '100vh'}}>
            <Sidebar
                groups={groups}
                settingsItem={settingsItem}
                currentState={currentState}
                collapsed={collapsed || railOnly}
                onToggleCollapsed={railOnly ? undefined : toggle}
                onNavigate={onNavigate}
                onLogoClick={onLogoClick}
                userName={fullName}
                companyName={companyName}
                isNetworkPartner={isNetworkPartner}
            />
            <Box style={{flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column'}}>
                <AppToolbar title={title} breadcrumbs={breadcrumbs} firstName={firstName} beta={beta} slim>
                    {children}
                </AppToolbar>
                {body}
            </Box>
        </Box>
    );
};

export default SidebarShell;
