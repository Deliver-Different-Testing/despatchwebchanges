/**
 * SideNav Component Tests
 */

import React from 'react';
import {fireEvent, screen} from '@testing-library/react';
import {renderWithMantine} from '../../../__testUtils__';
import {SideNav} from './SideNav';

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

        it('carries the app bar\'s Ink Blue on the account header, for every tenant', () => {
            const {rerender} = renderWithMantine(
                <SideNav {...defaultProps} isUsCustomer={false} companyName="Acme" />
            );

            // The header picks up the bar's colour so the two shell surfaces read as
            // one; that colour change is the separator, so there is no keyline under it.
            expect(screen.getByTestId('sidenav-account')).toHaveStyle({backgroundColor: '#0d0c2c'});
            expect(screen.getByTestId('sidenav-avatar')).toHaveStyle({
                backgroundColor: 'rgba(255, 255, 255, 0.15)',
                color: 'rgba(255, 255, 255, 0.95)',
            });

            rerender(<SideNav {...defaultProps} isUsCustomer={true} companyName="Acme" />);
            expect(screen.getByTestId('sidenav-account')).toHaveStyle({backgroundColor: '#0d0c2c'});
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
                expect(glyph).toHaveAttribute('width', '20');
                expect(glyph).toHaveAttribute('height', '20');
            }

            // The faint cyan wash and pill are a hover/active concern, so they live in
            // the stylesheet — the row keeps the `subtle` variant's transparent fill
            // rather than the solid cyan an inline `--nl-bg` used to paint, which would
            // outrank any rule there.
            const active = screen.getByRole('button', {name: 'Dashboard'});
            expect(active).toHaveAttribute('data-active', 'true');
            expect(active.style.getPropertyValue('--nl-bg')).toBe('transparent');
        });

        it('exposes the nav as a labelled landmark, with no close button in the header', () => {
            renderWithMantine(<SideNav {...defaultProps} />);

            expect(screen.getByRole('navigation', {name: 'Main navigation'})).toBeInTheDocument();
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

    describe('Active State', () => {
        it('should highlight the current navigation item', () => {
            renderWithMantine(<SideNav {...defaultProps} currentState="home" />);
            expect(screen.getByRole('button', {name: 'Dashboard'})).toHaveAttribute('data-active', 'true');
        });

        it('should highlight Dashboard on the v2 dispatch state', () => {
            renderWithMantine(<SideNav {...defaultProps} currentState="dispatchV2" />);
            expect(screen.getByRole('button', {name: 'Dashboard'})).toHaveAttribute('data-active', 'true');
        });

        it('should highlight Job Search on the v2 job search state', () => {
            renderWithMantine(<SideNav {...defaultProps} currentState="jobSearchV2" />);
            expect(screen.getByRole('button', {name: 'Job Search'})).toHaveAttribute('data-active', 'true');
        });

        it('should not highlight unrelated items on the v2 job search state', () => {
            renderWithMantine(<SideNav {...defaultProps} currentState="jobSearchV2" />);
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

        it('navigates straight to the V2 dispatch and job search pages', () => {
            const onNavigate = jest.fn();
            renderWithMantine(<SideNav {...defaultProps} onNavigate={onNavigate} />);

            fireEvent.click(screen.getByText('Dashboard'));
            expect(onNavigate).toHaveBeenLastCalledWith('dispatchV2');

            fireEvent.click(screen.getByText('Job Search'));
            expect(onNavigate).toHaveBeenLastCalledWith('jobSearchV2');
        });

        it('falls back to the classic pages for operators who opted out of V2', () => {
            localStorage.setItem('dispatchBetaEnabled-0', 'false');
            localStorage.setItem('jobSearchBetaEnabled-0', 'false');
            const onNavigate = jest.fn();
            renderWithMantine(<SideNav {...defaultProps} onNavigate={onNavigate} />);

            fireEvent.click(screen.getByText('Dashboard'));
            expect(onNavigate).toHaveBeenLastCalledWith('home');

            fireEvent.click(screen.getByText('Job Search'));
            expect(onNavigate).toHaveBeenLastCalledWith('jobSearch');
            localStorage.clear();
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
