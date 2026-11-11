import type {Mock} from 'vitest';
import {renderHook} from '@testing-library/react';
import {useNavItems} from './useNavItems';
import {navRoutes} from '../routes/routeTable';
import {isDashboardVisible} from '../services/featureVisibility';

vi.mock('../services/featureVisibility', async () => ({
    ...(await vi.importActual<typeof import('../services/featureVisibility')>('../services/featureVisibility')),
    isDashboardVisible: vi.fn(),
}));

const mockVisible = isDashboardVisible as Mock;

describe('useNavItems', () => {
    beforeEach(() => mockVisible.mockReturnValue(true));

    it('lists the route table pages in nav order, with a country-specific label and a settings item', () => {
        const nz = renderHook(() => useNavItems(false)).result.current;
        expect(nz.navItems.map(i => i.id)).toEqual(navRoutes().map(r => r.navId));
        expect(nz.navItems.find(i => i.id === 'shipping')?.label).toBe('Nationwide');
        expect(nz.navItems.find(i => i.id === 'dashboard')?.section).toBe('Dashboards');
        expect(nz.settingsItem).toMatchObject({id: 'settings', label: 'Settings', state: 'settings'});

        const us = renderHook(() => useNavItems(true)).result.current;
        expect(us.navItems.find(i => i.id === 'shipping')?.label).toBe('Domestic');
    });

    it('hides nzOnly items for US customers and feature-gated items the grant excludes', () => {
        expect(renderHook(() => useNavItems(false)).result.current.navItems.map(i => i.id)).toContain('driverManagement');
        expect(renderHook(() => useNavItems(true)).result.current.navItems.map(i => i.id)).not.toContain('driverManagement');

        mockVisible.mockReturnValue(false);
        const gated = renderHook(() => useNavItems(false)).result.current;
        expect(gated.navItems).toEqual([]);
        expect(gated.settingsItem.id).toBe('settings');
    });
});
