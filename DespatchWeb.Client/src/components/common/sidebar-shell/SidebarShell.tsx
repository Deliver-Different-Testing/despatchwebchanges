/**
 * DFRNT-style shell, laid out like dfrntcrm: a full-width app bar (sidebar toggle, logo, breadcrumbs,
 * actions) over a row holding the left Sidebar and the page body. The bar keeps the standard height,
 * so the page body's `BELOW_APP_BAR_HEIGHT` sizing is unchanged. On small screens the toggle opens the
 * full menu in a drawer instead of collapsing to the rail.
 */

import React, {useMemo} from 'react';
import {Box, Drawer, em} from '@mantine/core';
import {useDisclosure, useMediaQuery} from '@mantine/hooks';
import {AppToolbar} from '../app-toolbar/AppToolbar';
import type {AppShellProps} from '../app-shell/app-shell.types';
import {useNavItems} from '../../../hooks/useNavItems';
import type {NavItem} from '../side-nav/SideNav.types';
import type {RouteSection} from '../../../routes/routeTable';
import {NAV_WIDTH, Sidebar, type SidebarGroup} from './Sidebar';
import {useSidebarCollapsed} from './useSidebarCollapsed';

/** Mantine `sm`: below this the menu is a drawer. */
const DRAWER_QUERY = `(max-width: ${em(767)})`;

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
    logoUrl,
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
    const isMobile = useMediaQuery(DRAWER_QUERY) ?? false;
    const [drawerOpened, drawer] = useDisclosure(false);

    const sidebarOpen = isMobile ? drawerOpened : !collapsed;
    const handleToggle = isMobile ? drawer.toggle : toggle;

    const sidebarProps = {
        groups,
        settingsItem,
        currentState,
        onLogoClick,
        userName: fullName,
        companyName,
        isNetworkPartner,
    };

    return (
        <Box style={{display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden'}}>
            <AppToolbar
                title={title}
                breadcrumbs={breadcrumbs}
                firstName={firstName}
                logoUrl={logoUrl}
                onLogoClick={onLogoClick}
                beta={beta}
                sidebarToggle={{open: sidebarOpen, onToggle: handleToggle}}
            >
                {children}
            </AppToolbar>
            <Box style={{display: 'flex', flex: '1 1 0', minHeight: 0}}>
                {isMobile ? (
                    <Drawer
                        opened={drawerOpened}
                        onClose={drawer.close}
                        size={NAV_WIDTH}
                        withCloseButton={false}
                        padding={0}
                        aria-label="Navigation menu"
                        styles={{body: {height: '100%'}}}
                    >
                        <Sidebar
                            {...sidebarProps}
                            collapsed={false}
                            onNavigate={(state) => {
                                drawer.close();
                                onNavigate(state);
                            }}
                        />
                    </Drawer>
                ) : (
                    <Sidebar {...sidebarProps} collapsed={collapsed} onNavigate={onNavigate} />
                )}
                <Box style={{flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column'}}>
                    {body}
                </Box>
            </Box>
        </Box>
    );
};

export default SidebarShell;
