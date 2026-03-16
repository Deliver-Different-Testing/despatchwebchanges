/**
 * SideNav Component Tests
 */

import React from 'react';
import {render, screen, fireEvent} from '@testing-library/react';
import {ThemeProvider, createTheme} from '@mui/material/styles';
import {SideNav} from './SideNav';

const theme = createTheme();

const renderWithTheme = (ui: React.ReactElement) => {
    return render(
        <ThemeProvider theme={theme}>
            {ui}
        </ThemeProvider>
    );
};

describe('SideNav', () => {
    const defaultProps = {
        open: true,
        userName: 'John Doe',
        isUsCustomer: false,
        currentState: 'home',
        onClose: jest.fn(),
        onNavigate: jest.fn(),
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('Rendering', () => {
        it('should render when open is true', () => {
            renderWithTheme(<SideNav {...defaultProps} />);
            expect(screen.getByText('John Doe')).toBeInTheDocument();
        });

        it('should render user name', () => {
            renderWithTheme(<SideNav {...defaultProps} userName="Jane Smith" />);
            expect(screen.getByText('Jane Smith')).toBeInTheDocument();
        });

        it('should render company name', () => {
            renderWithTheme(
                <SideNav {...defaultProps} companyName="Test Company" />
            );
            expect(screen.getByText('Test Company')).toBeInTheDocument();
        });

        it('should use default company name when not provided', () => {
            renderWithTheme(<SideNav {...defaultProps} />);
            expect(screen.getByText('DFRNT')).toBeInTheDocument();
        });

        it('should render copyright with current year', () => {
            renderWithTheme(<SideNav {...defaultProps} />);
            const currentYear = new Date().getFullYear();
            expect(screen.getByText(/Deliver Different/)).toBeInTheDocument();
        });
    });

    describe('Navigation Items', () => {
        it('should render Dashboard navigation item', () => {
            renderWithTheme(<SideNav {...defaultProps} />);
            expect(screen.getByText('Dashboard')).toBeInTheDocument();
        });

        it('should render Nationwide for non-US customers', () => {
            renderWithTheme(<SideNav {...defaultProps} isUsCustomer={false} />);
            expect(screen.getByText('Nationwide')).toBeInTheDocument();
        });

        it('should render Domestic for US customers', () => {
            renderWithTheme(<SideNav {...defaultProps} isUsCustomer={true} />);
            expect(screen.getByText('Domestic')).toBeInTheDocument();
        });

        it('should render Overview navigation item', () => {
            renderWithTheme(<SideNav {...defaultProps} />);
            expect(screen.getByText('Overview')).toBeInTheDocument();
        });

        it('should render Tasks navigation item', () => {
            renderWithTheme(<SideNav {...defaultProps} />);
            expect(screen.getByText('Tasks')).toBeInTheDocument();
        });

        it('should render Job Search navigation item', () => {
            renderWithTheme(<SideNav {...defaultProps} />);
            expect(screen.getByText('Job Search')).toBeInTheDocument();
        });

        it('should render Recurring Jobs navigation item', () => {
            renderWithTheme(<SideNav {...defaultProps} />);
            expect(screen.getByText('Recurring Jobs')).toBeInTheDocument();
        });

        it('should render Courier Map navigation item', () => {
            renderWithTheme(<SideNav {...defaultProps} />);
            expect(screen.getByText('Courier Map')).toBeInTheDocument();
        });

        it('should render Driver Management for non-US customers', () => {
            renderWithTheme(<SideNav {...defaultProps} isUsCustomer={false} />);
            expect(screen.getByText('Driver Management')).toBeInTheDocument();
        });

        it('should not render Driver Management for US customers', () => {
            renderWithTheme(<SideNav {...defaultProps} isUsCustomer={true} />);
            expect(screen.queryByText('Driver Management')).not.toBeInTheDocument();
        });
    });

    describe('Active State', () => {
        it('should highlight the current navigation item', () => {
            renderWithTheme(<SideNav {...defaultProps} currentState="home" />);
            const dashboardButton = screen.getByText('Dashboard').closest('div[role="button"]');
            expect(dashboardButton).toHaveStyle({borderLeft: expect.stringContaining('4px solid')});
        });
    });

    describe('Interactions', () => {
        it('should call onNavigate with correct state when item is clicked', () => {
            const onNavigate = jest.fn();
            renderWithTheme(<SideNav {...defaultProps} onNavigate={onNavigate} />);

            fireEvent.click(screen.getByText('Tasks'));

            expect(onNavigate).toHaveBeenCalledWith('taskDashboard');
        });

        it('should call onClose when item is clicked', () => {
            const onClose = jest.fn();
            renderWithTheme(<SideNav {...defaultProps} onClose={onClose} />);

            fireEvent.click(screen.getByText('Dashboard'));

            expect(onClose).toHaveBeenCalledTimes(1);
        });

        it('should call onMouseEnter when provided', () => {
            const onMouseEnter = jest.fn();
            renderWithTheme(
                <SideNav {...defaultProps} onMouseEnter={onMouseEnter} />
            );

            // Get the drawer paper element
            const drawer = document.querySelector('.MuiDrawer-paper');
            if (drawer) {
                fireEvent.mouseEnter(drawer);
                expect(onMouseEnter).toHaveBeenCalledTimes(1);
            }
        });

        it('should call onMouseLeave when provided', () => {
            const onMouseLeave = jest.fn();
            renderWithTheme(
                <SideNav {...defaultProps} onMouseLeave={onMouseLeave} />
            );

            const drawer = document.querySelector('.MuiDrawer-paper');
            if (drawer) {
                fireEvent.mouseLeave(drawer);
                expect(onMouseLeave).toHaveBeenCalledTimes(1);
            }
        });
    });

    describe('US Customer Footer', () => {
        it('should show "Made with aroha" for US customers', () => {
            renderWithTheme(<SideNav {...defaultProps} isUsCustomer={true} />);
            expect(screen.getByText(/Made with aroha/)).toBeInTheDocument();
        });

        it('should not show "Made with aroha" for non-US customers', () => {
            renderWithTheme(<SideNav {...defaultProps} isUsCustomer={false} />);
            expect(screen.queryByText(/Made with aroha/)).not.toBeInTheDocument();
        });
    });
});
