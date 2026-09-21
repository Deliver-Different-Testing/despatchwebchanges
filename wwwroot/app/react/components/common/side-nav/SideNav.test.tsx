/**
 * SideNav Component Tests
 */

import React from 'react';
import {fireEvent, screen} from '@testing-library/react';
import {renderWithMantine} from '../../../__testUtils__';
import {SideNav} from './SideNav';
import {createDfrntTheme} from '../../../theme/dfrntMantineTheme';
import {getHeaderSurfaceAccent} from '../../dialogs/shared/mantine/styles';

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

        it('carries the US app bar\'s Ink Blue on the account header', () => {
            renderWithMantine(<SideNav {...defaultProps} isUsCustomer={true} companyName="Acme" />);

            // The header picks up the bar's colour so the two shell surfaces read as
            // one; that colour change is the separator, so there is no keyline under it.
            expect(screen.getByTestId('sidenav-account')).toHaveStyle({backgroundColor: '#0d0c2c'});
            expect(screen.getByTestId('sidenav-avatar')).toHaveStyle({
                backgroundColor: 'rgba(255, 255, 255, 0.2)',
                color: 'rgba(255, 255, 255, 0.95)',
            });
        });

        it('follows a non-US gold bar, flipping the header content to Ink', () => {
            renderWithMantine(
                <SideNav {...defaultProps} isUsCustomer={false} companyName="Acme" />,
                {theme: createDfrntTheme(false)}
            );

            expect(screen.getByTestId('sidenav-account')).toHaveStyle({backgroundColor: '#f4c430'});
            expect(screen.getByTestId('sidenav-avatar')).toHaveStyle({
                backgroundColor: 'rgba(13, 12, 44, 0.2)',
                color: 'rgba(13, 12, 44, 0.95)',
            });
        });

        it('badges a network partner beside their name, and leaves everyone else unbadged', () => {
            const {unmount} = renderWithMantine(<SideNav {...defaultProps} isNetworkPartner={true} />);

            // Beside the name, not floating elsewhere in the header — the chip
            // qualifies who is signed in, so it has to read as part of that line.
            const chip = screen.getByTestId('sidenav-np-chip');
            expect(chip).toHaveTextContent('Network Partner');
            expect(screen.getByText('John Doe').parentElement).toContainElement(chip);
            unmount();

            renderWithMantine(<SideNav {...defaultProps} />);
            expect(screen.queryByTestId('sidenav-np-chip')).not.toBeInTheDocument();
        });

        it('paints the chip in the account header\'s own on-colour for either tenant', () => {
            // The header is a fixed shell surface (Ink on US, gold on NZ) and both brand
            // primaries are too light to read on it, so the chip borrows the avatar's
            // scrim treatment rather than a brand variant.
            const {unmount} = renderWithMantine(
                <SideNav {...defaultProps} isNetworkPartner={true} isUsCustomer={true} />
            );
            expect(screen.getByTestId('sidenav-np-chip')).toHaveStyle({
                backgroundColor: 'rgba(255, 255, 255, 0.2)',
                color: 'rgba(255, 255, 255, 0.95)',
            });
            unmount();

            renderWithMantine(
                <SideNav {...defaultProps} isNetworkPartner={true} isUsCustomer={false} />,
                {theme: createDfrntTheme(false)}
            );
            expect(screen.getByTestId('sidenav-np-chip')).toHaveStyle({
                backgroundColor: 'rgba(13, 12, 44, 0.2)',
                color: 'rgba(13, 12, 44, 0.95)',
            });
        });

        it('keeps the panel styling on the drawer content and off the full-screen inner wrapper', () => {
            renderWithMantine(<SideNav {...defaultProps} />);

            const content = screen.getByRole('dialog');
            expect(content).toHaveStyle({display: 'flex', flexDirection: 'column'});
            expect(content.getAttribute('style')).toMatch(/background-color:\s*var\(--dd-surface-container-high\)/);

            const inner = content.parentElement as HTMLElement;
            expect(inner).not.toHaveStyle({flexDirection: 'column'});
            expect(inner.getAttribute('style') ?? '').not.toMatch(/background-color/);
        });

        it('sits every nav glyph on one axis and leaves the row chrome to the stylesheet', () => {
            renderWithMantine(<SideNav {...defaultProps} currentState="home" />);

            // Job Search is Lucide, Courier Map is Tabler — the two families have to
            // render at the same box or the labels stop lining up.
            const lucideRow = screen.getByRole('button', {name: 'Job Search'});
            const tablerRow = screen.getByRole('button', {name: 'Courier Map'});
            for (const row of [lucideRow, tablerRow]) {
                const glyph = row.querySelector('svg');
                expect(glyph).toHaveAttribute('width', '24');
                expect(glyph).toHaveAttribute('height', '24');
            }

            // The faint cyan wash and rail are a hover/active concern, so they live in
            // the stylesheet — the row keeps the `subtle` variant's transparent fill
            // rather than the solid cyan an inline `--nl-bg` used to paint, which would
            // outrank any rule there.
            const active = screen.getByRole('button', {name: 'Dashboard'});
            expect(active).toHaveAttribute('data-active', 'true');
            expect(active.style.getPropertyValue('--nl-bg')).toBe('transparent');
        });

        it('gives the rows the Material glyph column and label size', () => {
            renderWithMantine(<SideNav {...defaultProps} />);

            // 24px glyph + 20px gap reproduces the classic drawer's 44px icon column,
            // so labels start 64px in from the panel edge.
            const row = screen.getByRole('button', {name: 'Tasks'});
            expect(row.querySelector('svg')?.parentElement).toHaveStyle({
                width: '24px',
                height: '24px',
                marginInlineEnd: '20px',
            });
            expect(screen.getByText('Tasks')).toHaveStyle({fontSize: '16px'});
        });

        it('exposes the nav as a labelled landmark with a Menu heading, and no close button', () => {
            renderWithMantine(<SideNav {...defaultProps} />);

            const nav = screen.getByRole('navigation', {name: 'Main navigation'});
            expect(nav).toContainElement(screen.getByRole('heading', {name: 'Menu'}));
            // Dismissal is the overlay and Escape, both handled by Drawer.Root.
            expect(screen.queryByRole('button', {name: 'Close navigation menu'})).not.toBeInTheDocument();
        });

        it('hands the active rail a brand step dark enough to read, on either tenant', () => {
            // The 12% wash is ~1.05:1 on the panel, so the 4px rail is what actually
            // carries WCAG 1.4.11's 3:1 state boundary — it has to be the darker step,
            // and it differs per tenant.
            const {unmount} = renderWithMantine(<SideNav {...defaultProps} isUsCustomer={true} />);
            expect(
                screen.getByRole('navigation', {name: 'Main navigation'}).style.getPropertyValue('--sidenav-accent')
            ).toBe(getHeaderSurfaceAccent(true));
            unmount();

            renderWithMantine(<SideNav {...defaultProps} isUsCustomer={false} />, {theme: createDfrntTheme(false)});
            expect(
                screen.getByRole('navigation', {name: 'Main navigation'}).style.getPropertyValue('--sidenav-accent')
            ).toBe(getHeaderSurfaceAccent(false));
        });
    });

    describe('Navigation Items', () => {
        it('renders the standard navigation items for non-US customers', () => {
            renderWithMantine(<SideNav {...defaultProps} isUsCustomer={false} />);
            expect(screen.getByText('Dashboard')).toBeInTheDocument();
            expect(screen.getByText('Nationwide')).toBeInTheDocument();
            expect(screen.getByText('Overview')).toBeInTheDocument();
            expect(screen.getByText('Tasks')).toBeInTheDocument();
            expect(screen.getByText('Job Search')).toBeInTheDocument();
            expect(screen.getByText('Recurring Jobs')).toBeInTheDocument();
            expect(screen.getByText('Courier Map')).toBeInTheDocument();
            expect(screen.getByText('Driver Management')).toBeInTheDocument();
        });

        it('renders Domestic and hides Driver Management for US customers', () => {
            renderWithMantine(<SideNav {...defaultProps} isUsCustomer={true} />);
            expect(screen.getByText('Domestic')).toBeInTheDocument();
            expect(screen.queryByText('Driver Management')).not.toBeInTheDocument();
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

            delete window.VisibleFeatures;
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
            delete window.VisibleFeatures;
        });

        it('shows only the dashboards DF Admin granted this session', () => {
            window.VisibleFeatures = ['dw-dispatch', 'dw-job-search'];

            renderWithMantine(<SideNav {...defaultProps} isUsCustomer={false} />);

            expect(screen.getByText('Dashboard')).toBeInTheDocument();
            expect(screen.getByText('Job Search')).toBeInTheDocument();
            expect(screen.queryByText('Nationwide')).not.toBeInTheDocument();
            expect(screen.queryByText('Overview')).not.toBeInTheDocument();
            expect(screen.queryByText('Tasks')).not.toBeInTheDocument();
            expect(screen.queryByText('Recurring Jobs')).not.toBeInTheDocument();
            expect(screen.queryByText('Courier Map')).not.toBeInTheDocument();
            expect(screen.queryByText('Driver Management')).not.toBeInTheDocument();
        });

        it('keeps the country filter on top of the grant', () => {
            // Granted, but Driver Management is NZ-only — both gates must pass.
            window.VisibleFeatures = ['dw-dispatch', 'dw-driver-management'];

            renderWithMantine(<SideNav {...defaultProps} isUsCustomer={true} />);

            expect(screen.getByText('Dashboard')).toBeInTheDocument();
            expect(screen.queryByText('Driver Management')).not.toBeInTheDocument();
        });

        it('renders the full nav when the session is not gated', () => {
            window.VisibleFeatures = null;

            renderWithMantine(<SideNav {...defaultProps} isUsCustomer={false} />);

            expect(screen.getByText('Dashboard')).toBeInTheDocument();
            expect(screen.getByText('Courier Map')).toBeInTheDocument();
            expect(screen.getByText('Driver Management')).toBeInTheDocument();
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

        it('should highlight Job Search on the job search state', () => {
            renderWithMantine(<SideNav {...defaultProps} currentState="jobSearch" />);
            expect(screen.getByRole('button', {name: 'Job Search'})).toHaveAttribute('data-active', 'true');
        });

        it('should highlight Job Search on the legacy jobSearchV2 bookmark state', () => {
            renderWithMantine(<SideNav {...defaultProps} currentState="jobSearchV2" />);
            expect(screen.getByRole('button', {name: 'Job Search'})).toHaveAttribute('data-active', 'true');
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

            fireEvent.click(screen.getByText('Job Search'));
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
