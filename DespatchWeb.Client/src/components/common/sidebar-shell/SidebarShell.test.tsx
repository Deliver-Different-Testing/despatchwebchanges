import React from 'react';
import {fireEvent, screen, within} from '@testing-library/react';
import {renderWithMantine} from '../../../test/utils';
import {SidebarShell} from './SidebarShell';
import {SIDEBAR_COLLAPSED_STORAGE_KEY} from './useSidebarCollapsed';
import {sideMenuColors} from '../../../theme/dfrntMantineTheme';

describe('SidebarShell', () => {
    const defaultProps = {
        title: 'Dispatch',
        firstName: 'John',
        fullName: 'John Doe',
        isUsCustomer: false,
        currentState: 'dispatch',
        onNavigate: jest.fn(),
    };

    beforeEach(() => {
        jest.clearAllMocks();
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

    it('collapses to an icon rail, remembers it, and restores the labels when expanded', () => {
        const {unmount} = renderWithMantine(<SidebarShell {...defaultProps} />);
        expect(screen.getByTestId('dfrnt-sidebar')).not.toHaveAttribute('data-collapsed');
        expect(screen.getByText('Job search')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', {name: 'Collapse sidebar'}));

        expect(screen.getByTestId('dfrnt-sidebar')).toHaveAttribute('data-collapsed', 'true');
        expect(screen.queryByText('Job search')).not.toBeInTheDocument();
        expect(screen.getByRole('button', {name: 'Job search'})).toBeInTheDocument();
        expect(localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY)).toBe('1');
        unmount();

        renderWithMantine(<SidebarShell {...defaultProps} />);
        expect(screen.getByTestId('dfrnt-sidebar')).toHaveAttribute('data-collapsed', 'true');

        fireEvent.click(screen.getByRole('button', {name: 'Expand sidebar'}));
        expect(screen.getByText('Job search')).toBeInTheDocument();
        expect(localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY)).toBe('0');
    });

    it('shows a tooltip with the label when a rail row is hovered', async () => {
        localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, '1');
        renderWithMantine(<SidebarShell {...defaultProps} />);

        fireEvent.mouseEnter(screen.getByRole('button', {name: 'Job search'}));

        expect(await screen.findByRole('tooltip', {name: 'Job search'})).toBeInTheDocument();
    });

    it('renders the slim toolbar with the actions, and the page body in the page column', () => {
        renderWithMantine(
            <SidebarShell {...defaultProps} body={<p>page body</p>}>
                <button>Toolbar action</button>
            </SidebarShell>
        );

        expect(screen.getByRole('banner')).toBeInTheDocument();
        expect(screen.getByRole('button', {name: 'Toolbar action'})).toBeInTheDocument();
        expect(screen.queryByAltText('DFRNT')).not.toBeInTheDocument();
        expect(screen.getByText('page body')).toBeInTheDocument();
    });

    it('carries the identity card, colour mode switcher and network-partner chip in the footer', () => {
        renderWithMantine(<SidebarShell {...defaultProps} isNetworkPartner />);

        expect(screen.getByTestId('sidebar-identity')).toHaveTextContent('John Doe');
        expect(screen.getByTestId('sidebar-np-chip')).toBeInTheDocument();
        expect(screen.getByRole('radiogroup', {name: 'Colour mode'})).toBeInTheDocument();
    });
});
