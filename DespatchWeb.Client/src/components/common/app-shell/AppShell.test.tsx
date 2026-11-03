/**
 * AppShell Component Tests
 * Optimised: read-only tests consolidated to reduce render count.
 */

import React from 'react';
import {act, fireEvent, screen, waitFor} from '@testing-library/react';
import {renderWithMantine} from '../../../test/utils';
import {AppShell} from './AppShell';
import {useNavStyle} from '../../../hooks/useNavStyle';

jest.mock('../../../hooks/useNavStyle', () => ({useNavStyle: jest.fn()}));
const mockUseNavStyle = useNavStyle as jest.Mock;

describe('AppShell', () => {
    const defaultProps = {
        title: 'Test Dashboard',
        firstName: 'John',
        fullName: 'John Doe',
        isUsCustomer: false,
        currentState: 'home',
        onNavigate: jest.fn(),
    };

    /** Hovering the menu button is the shell's "open the nav" gesture. */
    const openSideNav = () => {
        fireEvent.mouseEnter(screen.getByRole('button', {name: /navigation menu/i}));
    };

    beforeEach(() => {
        jest.useFakeTimers();
        mockUseNavStyle.mockReturnValue({style: 'dispatch'});
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    describe('Navigation style', () => {
        it('renders the top bar and drawer for dispatch, with the page body beneath', () => {
            renderWithMantine(<AppShell {...defaultProps} body={<p>page body</p>} />);

            expect(screen.getByRole('button', {name: /navigation menu/i})).toBeInTheDocument();
            expect(screen.queryByTestId('dfrnt-sidebar')).not.toBeInTheDocument();
            expect(screen.getByText('page body')).toBeInTheDocument();
        });

        it('renders the sidebar shell under a full-width toolbar for dfrnt, with the sidebar toggle in the bar', () => {
            mockUseNavStyle.mockReturnValue({style: 'dfrnt'});
            renderWithMantine(<AppShell {...defaultProps} body={<p>page body</p>} />);

            expect(screen.getByTestId('dfrnt-sidebar')).toBeInTheDocument();
            expect(screen.queryByRole('button', {name: /navigation menu/i})).not.toBeInTheDocument();
            expect(screen.getByRole('button', {name: 'Collapse sidebar'})).toBeInTheDocument();
            expect(screen.getByRole('heading', {level: 1, name: 'Test Dashboard'})).toBeInTheDocument();
            expect(screen.getByText('page body')).toBeInTheDocument();
        });
    });

    describe('Rendering', () => {
        it('should render toolbar title, menu button, and logo', () => {
            renderWithMantine(<AppShell {...defaultProps} />);

            expect(screen.getByText('Test Dashboard')).toBeInTheDocument();
            expect(screen.getByRole('button', {name: /navigation menu/i})).toBeInTheDocument();
            expect(screen.getByAltText('DFRNT')).toBeInTheDocument();
        });

        it('should render children when provided', () => {
            renderWithMantine(
                <AppShell {...defaultProps}>
                    <button data-testid="custom-content">Custom</button>
                </AppShell>
            );
            expect(screen.getByTestId('custom-content')).toBeInTheDocument();
        });

        it('forwards the network-partner flag to the drawer', () => {
            renderWithMantine(<AppShell {...defaultProps} isNetworkPartner={true} />);
            act(() => openSideNav());
            expect(screen.getByTestId('sidenav-np-chip')).toBeInTheDocument();
        });

        it('should use custom logo URL when provided', () => {
            renderWithMantine(
                <AppShell {...defaultProps} logoUrl="custom/logo.png" />
            );
            const logo = screen.getByAltText('DFRNT');
            expect(logo).toHaveAttribute('src', 'custom/logo.png');
        });
    });

    describe('SideNav Integration', () => {
        it('should open SideNav when avatar is hovered', async () => {
            renderWithMantine(<AppShell {...defaultProps} />);

            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

            openSideNav();

            expect(await screen.findByRole('dialog')).toBeInTheDocument();
            expect(screen.getByText('John Doe')).toBeInTheDocument();
        });

        it('should close SideNav after mouse leaves with delay', async () => {
            renderWithMantine(<AppShell {...defaultProps} />);

            openSideNav();
            const panel = await screen.findByRole('dialog');

            fireEvent.mouseLeave(panel);

            // Advance past the 300ms close delay.
            act(() => {
                jest.advanceTimersByTime(300);
            });

            await waitFor(() => {
                expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
            });
        });

        it('should not close SideNav if mouse re-enters before delay', async () => {
            renderWithMantine(<AppShell {...defaultProps} />);

            openSideNav();
            const panel = await screen.findByRole('dialog');

            fireEvent.mouseLeave(panel);
            act(() => {
                jest.advanceTimersByTime(100);
            });

            // Re-enter before the delay completes.
            fireEvent.mouseEnter(panel);
            act(() => {
                jest.advanceTimersByTime(200);
            });

            expect(screen.getByRole('dialog')).toBeInTheDocument();
            expect(screen.getByText('John Doe')).toBeInTheDocument();
        });

        it('should call onNavigate when navigation item is clicked', async () => {
            const onNavigate = jest.fn();
            renderWithMantine(<AppShell {...defaultProps} onNavigate={onNavigate} />);

            openSideNav();

            fireEvent.click(await screen.findByText('Tasks'));

            expect(onNavigate).toHaveBeenCalledWith('taskDashboard');
        });
    });

    describe('Logo Click', () => {
        it('should call onLogoClick when logo is clicked', () => {
            const onLogoClick = jest.fn();
            renderWithMantine(
                <AppShell {...defaultProps} onLogoClick={onLogoClick} />
            );

            fireEvent.click(screen.getByAltText('DFRNT'));

            expect(onLogoClick).toHaveBeenCalledTimes(1);
        });
    });

    describe('US Customer Handling', () => {
        it('should show Domestic label for US customers in SideNav', async () => {
            renderWithMantine(<AppShell {...defaultProps} isUsCustomer={true} />);

            openSideNav();

            expect(await screen.findByText('Domestic')).toBeInTheDocument();
        });

        it('should show Nationwide label for non-US customers in SideNav', async () => {
            renderWithMantine(<AppShell {...defaultProps} isUsCustomer={false} />);

            openSideNav();

            expect(await screen.findByText('Nationwide')).toBeInTheDocument();
        });
    });

    describe('Current State Highlighting', () => {
        it('should highlight current navigation item', async () => {
            renderWithMantine(<AppShell {...defaultProps} currentState="taskDashboard" />);

            openSideNav();

            expect(await screen.findByRole('button', {name: 'Tasks'}))
                .toHaveAttribute('data-active', 'true');
        });
    });

    describe('Company Name', () => {
        it('should display custom company name in SideNav', async () => {
            renderWithMantine(
                <AppShell {...defaultProps} companyName="Custom Company" />
            );

            openSideNav();

            expect(await screen.findByText('Custom Company')).toBeInTheDocument();
        });
    });
});
