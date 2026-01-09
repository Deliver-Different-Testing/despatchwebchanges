/**
 * AppShell Component Tests
 */

import React from 'react';
import {render, screen, fireEvent, waitFor, act} from '@testing-library/react';
import {ThemeProvider, createTheme} from '@mui/material';
import {AppShell} from './AppShell';

const theme = createTheme();

const renderWithTheme = (ui: React.ReactElement) => {
    return render(
        <ThemeProvider theme={theme}>
            {ui}
        </ThemeProvider>
    );
};

describe('AppShell', () => {
    const defaultProps = {
        title: 'Test Dashboard',
        firstName: 'John',
        fullName: 'John Doe',
        isUsCustomer: false,
        currentState: 'home',
        onNavigate: jest.fn(),
    };

    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    describe('Rendering', () => {
        it('should render AppToolbar with title', () => {
            renderWithTheme(<AppShell {...defaultProps} />);
            expect(screen.getByText('Test Dashboard')).toBeInTheDocument();
        });

        it('should render menu button', () => {
            renderWithTheme(<AppShell {...defaultProps} />);
            expect(screen.getByRole('button', {name: /navigation menu/i})).toBeInTheDocument();
        });

        it('should render logo', () => {
            renderWithTheme(<AppShell {...defaultProps} />);
            expect(screen.getByAltText('DFRNT')).toBeInTheDocument();
        });

        it('should render children when provided', () => {
            renderWithTheme(
                <AppShell {...defaultProps}>
                    <button data-testid="custom-content">Custom</button>
                </AppShell>
            );
            expect(screen.getByTestId('custom-content')).toBeInTheDocument();
        });

        it('should use custom logo URL when provided', () => {
            renderWithTheme(
                <AppShell {...defaultProps} logoUrl="custom/logo.png" />
            );
            const logo = screen.getByAltText('DFRNT');
            expect(logo).toHaveAttribute('src', 'custom/logo.png');
        });
    });

    describe('SideNav Integration', () => {
        it('should open SideNav when avatar is hovered', async () => {
            renderWithTheme(<AppShell {...defaultProps} />);

            const avatarButton = screen.getByRole('button', {name: /navigation menu/i});
            fireEvent.mouseEnter(avatarButton);

            await waitFor(() => {
                expect(screen.getByText('John Doe')).toBeInTheDocument();
            });
        });

        it('should close SideNav after mouse leaves with delay', async () => {
            // Use real timers for this test as MUI Drawer has complex animations
            jest.useRealTimers();

            renderWithTheme(<AppShell {...defaultProps} />);

            // Open sidenav
            const avatarButton = screen.getByRole('button', {name: /navigation menu/i});
            fireEvent.mouseEnter(avatarButton);

            // Verify drawer is open (has modal role with presentation)
            await waitFor(() => {
                const drawer = document.querySelector('.MuiDrawer-root');
                expect(drawer).toBeInTheDocument();
            });

            // Get the drawer and simulate mouse leave
            const drawerPaper = document.querySelector('.MuiDrawer-paper');
            if (drawerPaper) {
                fireEvent.mouseLeave(drawerPaper);
            }

            // Wait for the close delay (300ms) and check drawer is no longer visible
            await waitFor(
                () => {
                    // Check that the drawer modal is hidden
                    const drawerRoot = document.querySelector('.MuiDrawer-root');
                    // When drawer closes, MUI removes the root element or adds hidden styles
                    expect(drawerRoot?.getAttribute('aria-hidden')).toBe('true');
                },
                {timeout: 1000}
            );

            // Restore fake timers for other tests
            jest.useFakeTimers();
        });

        it('should not close SideNav if mouse re-enters before delay', async () => {
            renderWithTheme(<AppShell {...defaultProps} />);

            // Open sidenav
            const avatarButton = screen.getByRole('button', {name: /navigation menu/i});
            fireEvent.mouseEnter(avatarButton);

            await waitFor(() => {
                expect(screen.getByText('John Doe')).toBeInTheDocument();
            });

            const drawer = document.querySelector('.MuiDrawer-paper');
            if (drawer) {
                fireEvent.mouseLeave(drawer);

                // Partially advance timer
                act(() => {
                    jest.advanceTimersByTime(100);
                });

                // Re-enter before delay completes
                fireEvent.mouseEnter(drawer);

                // Complete the delay
                act(() => {
                    jest.advanceTimersByTime(200);
                });
            }

            // SideNav should still be open
            expect(screen.getByText('John Doe')).toBeInTheDocument();
        });

        it('should call onNavigate when navigation item is clicked', async () => {
            const onNavigate = jest.fn();
            renderWithTheme(<AppShell {...defaultProps} onNavigate={onNavigate} />);

            // Open sidenav
            const avatarButton = screen.getByRole('button', {name: /navigation menu/i});
            fireEvent.mouseEnter(avatarButton);

            await waitFor(() => {
                expect(screen.getByText('Tasks')).toBeInTheDocument();
            });

            fireEvent.click(screen.getByText('Tasks'));

            expect(onNavigate).toHaveBeenCalledWith('taskDashboard');
        });
    });

    describe('Logo Click', () => {
        it('should call onLogoClick when logo is clicked', () => {
            const onLogoClick = jest.fn();
            renderWithTheme(
                <AppShell {...defaultProps} onLogoClick={onLogoClick} />
            );

            const logo = screen.getByAltText('DFRNT');
            fireEvent.click(logo);

            expect(onLogoClick).toHaveBeenCalledTimes(1);
        });
    });

    describe('US Customer Handling', () => {
        it('should show Domestic label for US customers in SideNav', async () => {
            renderWithTheme(<AppShell {...defaultProps} isUsCustomer={true} />);

            const avatarButton = screen.getByRole('button', {name: /navigation menu/i});
            fireEvent.mouseEnter(avatarButton);

            await waitFor(() => {
                expect(screen.getByText('Domestic')).toBeInTheDocument();
            });
        });

        it('should show Nationwide label for non-US customers in SideNav', async () => {
            renderWithTheme(<AppShell {...defaultProps} isUsCustomer={false} />);

            const avatarButton = screen.getByRole('button', {name: /navigation menu/i});
            fireEvent.mouseEnter(avatarButton);

            await waitFor(() => {
                expect(screen.getByText('Nationwide')).toBeInTheDocument();
            });
        });
    });

    describe('Current State Highlighting', () => {
        it('should highlight current navigation item', async () => {
            renderWithTheme(<AppShell {...defaultProps} currentState="taskDashboard" />);

            const avatarButton = screen.getByRole('button', {name: /navigation menu/i});
            fireEvent.mouseEnter(avatarButton);

            await waitFor(() => {
                const tasksButton = screen.getByText('Tasks').closest('div[role="button"]');
                // Check that it has the active styling
                expect(tasksButton).toHaveStyle({borderLeft: expect.stringContaining('4px solid')});
            });
        });
    });

    describe('Company Name', () => {
        it('should display custom company name in SideNav', async () => {
            renderWithTheme(
                <AppShell {...defaultProps} companyName="Custom Company" />
            );

            const avatarButton = screen.getByRole('button', {name: /navigation menu/i});
            fireEvent.mouseEnter(avatarButton);

            await waitFor(() => {
                expect(screen.getByText('Custom Company')).toBeInTheDocument();
            });
        });
    });
});
