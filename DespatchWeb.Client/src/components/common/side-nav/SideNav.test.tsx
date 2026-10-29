/**
 * SideNav Component Tests
 */

import React from 'react';
import {fireEvent, screen} from '@testing-library/react';
import dayjs from 'dayjs';
import {renderWithMantine} from '../../../test/utils';
import {APP_BLURB, SideNav} from './SideNav';
import {createDfrntTheme, sideMenuColors} from '../../../theme/dfrntMantineTheme';

describe('SideNav', () => {
    const defaultProps = {
        open: true,
        userName: 'John Doe',
        isUsCustomer: false,
        currentState: 'home',
        onClose: jest.fn(),
        onNavigate: jest.fn(),
    };

    describe('Rendering', () => {
        it('renders the user name, default company name, and copyright', () => {
            renderWithMantine(<SideNav {...defaultProps} />);
            expect(screen.getByText('John Doe')).toBeInTheDocument();
            expect(screen.getByText('DFRNT')).toBeInTheDocument();
            expect(screen.getByText(/Deliver DFRNT/)).toBeInTheDocument();
        });

        it('should render a custom user name', () => {
            renderWithMantine(<SideNav {...defaultProps} userName="Jane Smith" />);
            expect(screen.getByText('Jane Smith')).toBeInTheDocument();
        });

        it('should render a custom company name', () => {
            renderWithMantine(
                <SideNav {...defaultProps} companyName="Test Company" />
            );
            expect(screen.getByText('Test Company')).toBeInTheDocument();
        });

        it('paints the panel the Ink shell, whatever the tenant primary', () => {
            renderWithMantine(
                <SideNav {...defaultProps} />,
                {theme: createDfrntTheme({highContrast: false, primary: '#f4c430'})}
            );

            const content = screen.getByRole('dialog');
            expect(content).toHaveStyle({display: 'flex', flexDirection: 'column', backgroundColor: sideMenuColors.bg});

            const inner = content.parentElement as HTMLElement;
            expect(inner).not.toHaveStyle({flexDirection: 'column'});
            expect(inner.getAttribute('style') ?? '').not.toMatch(/background-color/);
        });

        it('heads the panel with the reversed logo and the company name', () => {
            renderWithMantine(<SideNav {...defaultProps} companyName="Acme" />);

            const header = screen.getByTestId('sidenav-account');
            expect(header.querySelector('img')).toHaveAttribute('src', sideMenuColors.logoSrc);
            expect(screen.getByRole('heading', {name: 'Acme'})).toBeInTheDocument();
            expect(header).toHaveTextContent(APP_BLURB);
        });

        it('writes the date in the tenant’s order', () => {
            const {unmount} = renderWithMantine(<SideNav {...defaultProps} isUsCustomer={false} />);
            expect(screen.getByTestId('sidenav-account')).toHaveTextContent(dayjs().format('dddd, D MMMM YYYY'));
            unmount();

            renderWithMantine(<SideNav {...defaultProps} isUsCustomer={true} />);
            expect(screen.getByTestId('sidenav-account')).toHaveTextContent(dayjs().format('dddd, MMMM D, YYYY'));
        });

        it('shows the signed-in user in an identity card at the foot', () => {
            renderWithMantine(<SideNav {...defaultProps} />);

            expect(screen.getByTestId('sidenav-avatar')).toHaveTextContent('JD');
            expect(screen.getByTestId('sidenav-identity')).toContainElement(screen.getByText('John Doe'));
        });

        it('badges a network partner beside their name, and leaves everyone else unbadged', () => {
            const {unmount} = renderWithMantine(<SideNav {...defaultProps} isNetworkPartner={true} />);

            const chip = screen.getByTestId('sidenav-np-chip');
            expect(chip).toHaveTextContent('Network Partner');
            expect(screen.getByText('John Doe').parentElement).toContainElement(chip);
            unmount();

            renderWithMantine(<SideNav {...defaultProps} />);
            expect(screen.queryByTestId('sidenav-np-chip')).not.toBeInTheDocument();
        });

        it('marks the active row with the inset accent bar in shell colours, not the tenant primary', () => {
            renderWithMantine(
                <SideNav {...defaultProps} currentState="home" />,
                {theme: createDfrntTheme({highContrast: false, primary: '#f4c430'})}
            );

            const active = screen.getByRole('button', {name: 'Dashboard'});
            expect(active).toHaveAttribute('data-active', 'true');
            expect(active.style.boxShadow).toMatch(/^inset 3px 0(px)? 0(px)? /);
            expect(active).toHaveStyle({color: sideMenuColors.textPrimary});

            const inactive = screen.getByRole('button', {name: 'Tasks'});
            expect(inactive.style.boxShadow).toBe('');
            expect(inactive).toHaveStyle({color: sideMenuColors.textSecondary});
        });

        it('sits every nav glyph on one axis', () => {
            renderWithMantine(<SideNav {...defaultProps} />);

            // Job search is Lucide, Courier map is Tabler — the two families have to
            // render at the same box or the labels stop lining up.
            for (const name of ['Job search', 'Courier map']) {
                const glyph = screen.getByRole('button', {name}).querySelector('svg');
                expect(glyph).toHaveAttribute('width', '20');
                expect(glyph).toHaveAttribute('height', '20');
            }
        });

        it('exposes the nav as a labelled landmark with a Menu heading, and no close button', () => {
            renderWithMantine(<SideNav {...defaultProps} />);

            const nav = screen.getByRole('navigation', {name: 'Main navigation'});
            expect(nav).toContainElement(screen.getByRole('heading', {name: 'Menu'}));
            // Dismissal is the overlay and Escape, both handled by Drawer.Root.
            expect(screen.queryByRole('button', {name: 'Close navigation menu'})).not.toBeInTheDocument();
        });
    });

    describe('Navigation Items', () => {
        it('renders the standard navigation items for non-US customers', () => {
            renderWithMantine(<SideNav {...defaultProps} isUsCustomer={false} />);
            expect(screen.getByText('Dashboard')).toBeInTheDocument();
            expect(screen.getByText('Nationwide')).toBeInTheDocument();
            expect(screen.getByText('Overview')).toBeInTheDocument();
            expect(screen.getByText('Tasks')).toBeInTheDocument();
            expect(screen.getByText('Job search')).toBeInTheDocument();
            expect(screen.getByText('Recurring jobs')).toBeInTheDocument();
            expect(screen.getByText('Courier map')).toBeInTheDocument();
            expect(screen.getByText('Driver management')).toBeInTheDocument();
        });

        it('renders Domestic and hides Driver management for US customers', () => {
            renderWithMantine(<SideNav {...defaultProps} isUsCustomer={true} />);
            expect(screen.getByText('Domestic')).toBeInTheDocument();
            expect(screen.queryByText('Driver management')).not.toBeInTheDocument();
        });
    });

    describe('Settings item', () => {
        it('renders Settings separated from the primary nav by a divider', () => {
            renderWithMantine(<SideNav {...defaultProps} />);

            expect(screen.getByRole('button', {name: 'Settings'})).toBeInTheDocument();
            expect(screen.getByRole('separator')).toBeInTheDocument();
        });

        it('is not affected by dashboard feature-visibility gating', () => {
            window.VisibleFeatures = ['dw-dispatch'];

            renderWithMantine(<SideNav {...defaultProps} />);

            expect(screen.getByRole('button', {name: 'Settings'})).toBeInTheDocument();

            window.VisibleFeatures = undefined;
        });

        it('navigates to the settings state and closes on click', () => {
            const onNavigate = jest.fn();
            const onClose = jest.fn();
            renderWithMantine(<SideNav {...defaultProps} onNavigate={onNavigate} onClose={onClose} />);

            fireEvent.click(screen.getByRole('button', {name: 'Settings'}));

            expect(onNavigate).toHaveBeenCalledWith('settings');
            expect(onClose).toHaveBeenCalledTimes(1);
        });
    });

    describe('Dashboard visibility', () => {
        // The Razor global is written once at page load, before React mounts, so
        // setting it before render matches production ordering.
        afterEach(() => {
            window.VisibleFeatures = undefined;
        });

        it('shows only the dashboards DF Admin granted this session', () => {
            window.VisibleFeatures = ['dw-dispatch', 'dw-job-search'];

            renderWithMantine(<SideNav {...defaultProps} isUsCustomer={false} />);

            expect(screen.getByText('Dashboard')).toBeInTheDocument();
            expect(screen.getByText('Job search')).toBeInTheDocument();
            expect(screen.queryByText('Nationwide')).not.toBeInTheDocument();
            expect(screen.queryByText('Overview')).not.toBeInTheDocument();
            expect(screen.queryByText('Tasks')).not.toBeInTheDocument();
            expect(screen.queryByText('Recurring jobs')).not.toBeInTheDocument();
            expect(screen.queryByText('Courier map')).not.toBeInTheDocument();
            expect(screen.queryByText('Driver management')).not.toBeInTheDocument();
        });

        it('keeps the country filter on top of the grant', () => {
            // Granted, but Driver management is NZ-only — both gates must pass.
            window.VisibleFeatures = ['dw-dispatch', 'dw-driver-management'];

            renderWithMantine(<SideNav {...defaultProps} isUsCustomer={true} />);

            expect(screen.getByText('Dashboard')).toBeInTheDocument();
            expect(screen.queryByText('Driver management')).not.toBeInTheDocument();
        });

        it('renders the full nav when the session is not gated', () => {
            window.VisibleFeatures = null;

            renderWithMantine(<SideNav {...defaultProps} isUsCustomer={false} />);

            expect(screen.getByText('Dashboard')).toBeInTheDocument();
            expect(screen.getByText('Courier map')).toBeInTheDocument();
            expect(screen.getByText('Driver management')).toBeInTheDocument();
        });
    });

    describe('Active State', () => {
        it('should highlight the current navigation item', () => {
            renderWithMantine(<SideNav {...defaultProps} currentState="home" />);
            expect(screen.getByRole('button', {name: 'Dashboard'})).toHaveAttribute('data-active', 'true');
        });

        it('marks only the current item as the current page for screen readers', () => {
            renderWithMantine(<SideNav {...defaultProps} currentState="home" />);
            expect(screen.getByRole('button', {name: 'Dashboard'})).toHaveAttribute('aria-current', 'page');
            expect(screen.getByRole('button', {name: 'Tasks'})).not.toHaveAttribute('aria-current');
        });

        it('should highlight Dashboard on the dispatch state', () => {
            renderWithMantine(<SideNav {...defaultProps} currentState="dispatch" />);
            expect(screen.getByRole('button', {name: 'Dashboard'})).toHaveAttribute('data-active', 'true');
        });

        it('should highlight Dashboard on the legacy dispatchV2 bookmark state', () => {
            renderWithMantine(<SideNav {...defaultProps} currentState="dispatchV2" />);
            expect(screen.getByRole('button', {name: 'Dashboard'})).toHaveAttribute('data-active', 'true');
        });

        it('should highlight Job search on the job search state', () => {
            renderWithMantine(<SideNav {...defaultProps} currentState="jobSearch" />);
            expect(screen.getByRole('button', {name: 'Job search'})).toHaveAttribute('data-active', 'true');
        });

        it('should highlight Job search on the legacy jobSearchV2 bookmark state', () => {
            renderWithMantine(<SideNav {...defaultProps} currentState="jobSearchV2" />);
            expect(screen.getByRole('button', {name: 'Job search'})).toHaveAttribute('data-active', 'true');
        });

        it('should not highlight unrelated items on the job search state', () => {
            renderWithMantine(<SideNav {...defaultProps} currentState="jobSearch" />);
            expect(screen.getByRole('button', {name: 'Dashboard'})).not.toHaveAttribute('data-active');
        });
    });

    describe('Interactions', () => {
        it('should call onNavigate with correct state when item is clicked', () => {
            const onNavigate = jest.fn();
            renderWithMantine(<SideNav {...defaultProps} onNavigate={onNavigate} />);

            fireEvent.click(screen.getByText('Tasks'));

            expect(onNavigate).toHaveBeenCalledWith('taskDashboard');
        });

        it('navigates straight to the dispatch and job search pages', () => {
            const onNavigate = jest.fn();
            renderWithMantine(<SideNav {...defaultProps} onNavigate={onNavigate} />);

            fireEvent.click(screen.getByText('Dashboard'));
            expect(onNavigate).toHaveBeenLastCalledWith('dispatch');

            fireEvent.click(screen.getByText('Job search'));
            expect(onNavigate).toHaveBeenLastCalledWith('jobSearch');
        });

        it('should call onClose when item is clicked', () => {
            const onClose = jest.fn();
            renderWithMantine(<SideNav {...defaultProps} onClose={onClose} />);

            fireEvent.click(screen.getByText('Dashboard'));

            expect(onClose).toHaveBeenCalledTimes(1);
        });

        it('calls onMouseEnter and onMouseLeave on the drawer panel', () => {
            const onMouseEnter = jest.fn();
            const onMouseLeave = jest.fn();
            renderWithMantine(
                <SideNav {...defaultProps} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave} />
            );

            const panel = screen.getByRole('dialog');
            fireEvent.mouseEnter(panel);
            expect(onMouseEnter).toHaveBeenCalledTimes(1);

            fireEvent.mouseLeave(panel);
            expect(onMouseLeave).toHaveBeenCalledTimes(1);
        });
    });

    describe('US Customer Footer', () => {
        it('should show "Made with aroha" for US customers', () => {
            renderWithMantine(<SideNav {...defaultProps} isUsCustomer={true} />);
            expect(screen.getByText(/Made with aroha/)).toBeInTheDocument();
        });

        it('should not show "Made with aroha" for non-US customers', () => {
            renderWithMantine(<SideNav {...defaultProps} isUsCustomer={false} />);
            expect(screen.queryByText(/Made with aroha/)).not.toBeInTheDocument();
        });
    });
});
