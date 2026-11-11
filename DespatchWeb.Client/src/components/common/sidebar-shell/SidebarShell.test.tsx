import type {Mock} from 'vitest';
import React from 'react';
import {fireEvent, screen, waitFor, within} from '@testing-library/react';
import {renderWithMantine} from '../../../test/utils';
import {SidebarShell} from './SidebarShell';
import {SIDEBAR_COLLAPSED_STORAGE_KEY} from './useSidebarCollapsed';
import {sideMenuColors} from '../../../theme/dfrntMantineTheme';
import {APP_BLURB, APP_ICON_SRC, APP_NAME} from '../../../constants/app';

describe('SidebarShell', () => {
    const defaultProps = {
        title: 'Dispatch',
        firstName: 'John',
        fullName: 'John Doe',
        isUsCustomer: false,
        currentState: 'dispatch',
        onNavigate: vi.fn(),
    };

    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
    });

    it('groups the nav by section with Settings below, marks the active row, and navigates', () => {
        renderWithMantine(<SidebarShell {...defaultProps} />);

        const nav = screen.getByRole('navigation', {name: 'Main navigation'});
        expect(within(nav).getByRole('heading', {name: 'Dashboards'})).toBeInTheDocument();
        expect(within(nav).getByRole('heading', {name: 'Operations'})).toBeInTheDocument();

        const active = within(nav).getByRole('button', {name: 'Dashboard'});
        expect(active).toHaveAttribute('aria-current', 'page');
        expect(active).toHaveStyle({boxShadow: `inset 3px 0 0 ${sideMenuColors.activeAccent}`});
        expect(within(nav).getByRole('button', {name: 'Job search'})).not.toHaveAttribute('aria-current');

        const labels = within(nav).getAllByRole('button').map(b => b.textContent);
        expect(labels[labels.length - 1]).toBe('Settings');

        fireEvent.click(within(nav).getByRole('button', {name: 'Job search'}));
        expect(defaultProps.onNavigate).toHaveBeenCalledWith('jobSearch');
    });

    it('hides nzOnly items for US customers and shows them for NZ', () => {
        const {unmount} = renderWithMantine(<SidebarShell {...defaultProps} />);
        expect(screen.getByRole('button', {name: 'Driver management'})).toBeInTheDocument();
        unmount();

        renderWithMantine(<SidebarShell {...defaultProps} isUsCustomer />);
        expect(screen.queryByRole('button', {name: 'Driver management'})).not.toBeInTheDocument();
    });

    it('collapses to an icon rail from the app-bar toggle, remembers it, and restores the labels when expanded', () => {
        const {unmount} = renderWithMantine(<SidebarShell {...defaultProps} />);
        expect(screen.getByTestId('dfrnt-sidebar')).not.toHaveAttribute('data-collapsed');
        expect(screen.getByText('Job search')).toBeInTheDocument();

        const toggle = within(screen.getByRole('banner')).getByRole('button', {name: 'Collapse sidebar'});
        expect(toggle).toHaveAttribute('aria-expanded', 'true');
        expect(within(screen.getByTestId('dfrnt-sidebar')).queryByRole('button', {name: /sidebar/})).not.toBeInTheDocument();
        fireEvent.click(toggle);

        expect(screen.getByTestId('dfrnt-sidebar')).toHaveAttribute('data-collapsed', 'true');
        expect(screen.queryByText('Job search')).not.toBeInTheDocument();
        expect(screen.getByRole('button', {name: 'Job search'})).toBeInTheDocument();
        expect(localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY)).toBe('1');
        unmount();

        renderWithMantine(<SidebarShell {...defaultProps} />);
        expect(screen.getByTestId('dfrnt-sidebar')).toHaveAttribute('data-collapsed', 'true');

        const expand = screen.getByRole('button', {name: 'Expand sidebar'});
        expect(expand).toHaveAttribute('aria-expanded', 'false');
        fireEvent.click(expand);
        expect(screen.getByText('Job search')).toBeInTheDocument();
        expect(localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY)).toBe('0');
    });

    it('shows a tooltip with the label when a rail row is hovered', async () => {
        localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, '1');
        renderWithMantine(<SidebarShell {...defaultProps} />);

        fireEvent.mouseEnter(screen.getByRole('button', {name: 'Job search'}));

        expect(await screen.findByRole('tooltip', {name: 'Job search'})).toBeInTheDocument();
    });

    it('runs the full-width toolbar above the sidebar with the logo and actions, and the page body beside the sidebar', () => {
        renderWithMantine(
            <SidebarShell {...defaultProps} body={<p>page body</p>}>
                <button>Toolbar action</button>
            </SidebarShell>
        );

        const banner = screen.getByRole('banner');
        expect(within(banner).getByAltText('DFRNT')).toBeInTheDocument();
        expect(within(banner).getByRole('button', {name: 'Toolbar action'})).toBeInTheDocument();
        expect(within(banner).queryByRole('button', {name: /navigation menu/i})).not.toBeInTheDocument();
        expect(banner).not.toContainElement(screen.getByTestId('dfrnt-sidebar'));
        expect(screen.getByText('page body').parentElement?.parentElement).toContainElement(screen.getByTestId('dfrnt-sidebar'));
    });

    it('heads the sidebar with the app icon, the app name and what the app does, not the company name', () => {
        renderWithMantine(<SidebarShell {...defaultProps} companyName="Acme Couriers" />);

        const header = screen.getByTestId('sidebar-header');
        expect(header.querySelector('img')).toHaveAttribute('src', APP_ICON_SRC);
        expect(within(header).getByRole('heading', {name: APP_NAME})).toBeInTheDocument();
        expect(header).toHaveTextContent(APP_BLURB);
        expect(header).not.toHaveTextContent('Acme Couriers');
    });

    it('keeps only the logo in the rail header, labelled as the app home', () => {
        localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, '1');
        renderWithMantine(<SidebarShell {...defaultProps} onLogoClick={vi.fn()} />);

        const header = screen.getByTestId('sidebar-header');
        expect(header).not.toHaveTextContent(APP_BLURB);
        expect(within(header).getByRole('button', {name: `${APP_NAME} home`})).toBeInTheDocument();
    });

    it('carries the identity card, colour mode switcher and network-partner chip in the footer', () => {
        renderWithMantine(<SidebarShell {...defaultProps} companyName="Acme Couriers" isNetworkPartner />);

        expect(screen.getByTestId('sidebar-identity')).toHaveTextContent('John Doe');
        expect(screen.getByTestId('sidebar-identity')).toHaveTextContent('Acme Couriers');
        expect(screen.getByTestId('sidebar-np-chip')).toBeInTheDocument();
        expect(screen.getByRole('radiogroup', {name: 'Colour mode'})).toBeInTheDocument();
    });

    describe('on small screens', () => {
        beforeEach(() => {
            (window.matchMedia as Mock).mockImplementation((query: string) => ({
                matches: true,
                media: query,
                addListener: vi.fn(),
                removeListener: vi.fn(),
                addEventListener: vi.fn(),
                removeEventListener: vi.fn(),
            }));
        });

        afterEach(() => {
            (window.matchMedia as Mock).mockImplementation((query: string) => ({
                matches: false,
                media: query,
                addListener: vi.fn(),
                removeListener: vi.fn(),
                addEventListener: vi.fn(),
                removeEventListener: vi.fn(),
            }));
        });

        it('opens the full labelled menu in a drawer from the toggle, and closes it on navigate', async () => {
            renderWithMantine(<SidebarShell {...defaultProps} />);

            await waitFor(() => expect(screen.queryByTestId('dfrnt-sidebar')).not.toBeInTheDocument());
            fireEvent.click(screen.getByRole('button', {name: 'Expand sidebar'}));

            const sidebar = await screen.findByTestId('dfrnt-sidebar');
            expect(sidebar).not.toHaveAttribute('data-collapsed');
            expect(screen.getByRole('button', {name: 'Collapse sidebar'})).toHaveAttribute('aria-expanded', 'true');

            fireEvent.click(within(sidebar).getByRole('button', {name: 'Job search'}));
            expect(defaultProps.onNavigate).toHaveBeenCalledWith('jobSearch');
            await waitFor(() => expect(screen.queryByTestId('dfrnt-sidebar')).not.toBeInTheDocument());
        });
    });
});
