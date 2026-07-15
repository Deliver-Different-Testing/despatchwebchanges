/**
 * SideNav Component Tests
 */

import React from 'react';
import {fireEvent, render, screen} from '@testing-library/react';
import {createTheme, ThemeProvider} from '@mui/material/styles';
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

    describe('Rendering', () => {
        it('renders the user name, default company name, and copyright', () => {
            renderWithTheme(<SideNav {...defaultProps} />);
            expect(screen.getByText('John Doe')).toBeInTheDocument();
            expect(screen.getByText('DFRNT')).toBeInTheDocument();
            expect(screen.getByText(/Deliver DFRNT/)).toBeInTheDocument();
        });

        it('should render a custom user name', () => {
            renderWithTheme(<SideNav {...defaultProps} userName="Jane Smith" />);
            expect(screen.getByText('Jane Smith')).toBeInTheDocument();
        });

        it('should render a custom company name', () => {
            renderWithTheme(
                <SideNav {...defaultProps} companyName="Test Company" />
            );
            expect(screen.getByText('Test Company')).toBeInTheDocument();
        });
    });

    describe('Navigation Items', () => {
        it('renders the standard navigation items for non-US customers', () => {
            renderWithTheme(<SideNav {...defaultProps} isUsCustomer={false} />);
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
            renderWithTheme(<SideNav {...defaultProps} isUsCustomer={true} />);
            expect(screen.getByText('Domestic')).toBeInTheDocument();
            expect(screen.queryByText('Driver Management')).not.toBeInTheDocument();
        });
    });

    describe('Active State', () => {
        it('should highlight the current navigation item', () => {
            renderWithTheme(<SideNav {...defaultProps} currentState="home" />);
            const dashboardButton = screen.getByText('Dashboard').closest('div[role="button"]');
            expect(dashboardButton).toHaveClass('Mui-selected');
        });

        it('should highlight Dashboard on the v2 dispatch state', () => {
            renderWithTheme(<SideNav {...defaultProps} currentState="dispatchV2" />);
            const dashboardButton = screen.getByText('Dashboard').closest('div[role="button"]');
            expect(dashboardButton).toHaveClass('Mui-selected');
        });

        it('should highlight Job Search on the v2 job search state', () => {
            renderWithTheme(<SideNav {...defaultProps} currentState="jobSearchV2" />);
            const jobSearchButton = screen.getByText('Job Search').closest('div[role="button"]');
            expect(jobSearchButton).toHaveClass('Mui-selected');
        });

        it('should not highlight unrelated items on the v2 job search state', () => {
            renderWithTheme(<SideNav {...defaultProps} currentState="jobSearchV2" />);
            const dashboardButton = screen.getByText('Dashboard').closest('div[role="button"]');
            expect(dashboardButton).not.toHaveClass('Mui-selected');
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
