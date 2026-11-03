import React, {useMemo} from 'react';
import {ChartColumn, CircleCheckBig, Clock, LayoutDashboard, Search, Settings as SettingsIcon, UserCog} from 'lucide-react';
import {IconMap, IconTruck} from '@tabler/icons-react';
import {Icon} from '../components/common/icon/Icon';
import type {NavItem} from '../components/common/side-nav/SideNav.types';
import {isDashboardVisible} from '../services/featureVisibility';
import {navRoutes, statesForFeatureKey} from '../routes/routeTable';

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

/**
 * The nav entries both shells list: the route table's nav pages, filtered by country and by the
 * DF Admin feature grant, plus the always-present Settings item (a utility, not a dashboard, so
 * never gated by `dashboardFeatureKeys`).
 */
export function useNavItems(isUsCustomer: boolean): {navItems: NavItem[]; settingsItem: NavItem} {
    const navItems = useMemo((): NavItem[] => {
        const items: NavItem[] = navRoutes().map(route => {
            const {label, icon, nzOnly} = NAV_ITEM_DISPLAY[route.navId!](isUsCustomer);
            return {
                id: route.navId!,
                label,
                icon,
                // Link straight at the page so the nav skips alias redirect hops.
                state: route.state,
                matchStates: statesForFeatureKey(route.featureKey!),
                featureKey: route.featureKey,
                section: route.section,
                nzOnly,
            };
        });

        return items.filter(item => {
            if (item.usOnly && !isUsCustomer) return false;
            if (item.nzOnly && isUsCustomer) return false;
            // DF Admin's grant, on top of the country filter. Ungated sessions
            // pass everything, so this is inert for every audience but NP.
            return !item.featureKey || isDashboardVisible(item.featureKey);
        });
    }, [isUsCustomer]);

    const settingsItem = useMemo((): NavItem => ({
        id: 'settings',
        label: 'Settings',
        icon: <Icon lucide={SettingsIcon} />,
        state: 'settings',
    }), []);

    return {navItems, settingsItem};
}
