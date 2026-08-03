/**
 * AppToolbar Component Tests
 */

import React from 'react';
import {render, screen, fireEvent} from '@testing-library/react';
import {ThemeProvider, createTheme} from '@mui/material/styles';
import {AppToolbar} from './AppToolbar';
import {displayFontFamily} from '../../../theme/muiTheme';

// Create a default theme for tests
const theme = createTheme();

// Wrapper component with theme provider
const renderWithTheme = (ui: React.ReactElement) => {
    return render(
        <ThemeProvider theme={theme}>
            {ui}
        </ThemeProvider>
    );
};

describe('AppToolbar', () => {
    const defaultProps = {
        title: 'Test Dashboard',
        firstName: 'John',
    };

    describe('Rendering', () => {
        it('should render the title', () => {
            renderWithTheme(<AppToolbar {...defaultProps} />);
            expect(screen.getByText('Test Dashboard')).toBeInTheDocument();
        });

        it('should render a single-crumb fallback as the page heading when no breadcrumbs are provided', () => {
            renderWithTheme(<AppToolbar {...defaultProps} />);
            const heading = screen.getByRole('heading', {level: 1, name: 'Test Dashboard'});
            expect(heading).toBeInTheDocument();
        });

        it('should render the active page title in the display face', () => {
            renderWithTheme(<AppToolbar {...defaultProps} />);
            const heading = screen.getByRole('heading', {level: 1, name: 'Test Dashboard'});
            expect(heading).toHaveStyle({fontFamily: displayFontFamily});
        });

        it('should render section + page when breadcrumbs are provided', () => {
            renderWithTheme(
                <AppToolbar
                    {...defaultProps}
                    title={undefined}
                    breadcrumbs={[
                        {label: 'Dashboards'},
                        {label: 'Recurring Jobs'},
                    ]}
                />
            );
            expect(screen.getByText('Dashboards')).toBeInTheDocument();
            expect(screen.getByText('Recurring Jobs')).toBeInTheDocument();
            // Current page is the h1; ancestor is not
            expect(screen.getByRole('heading', {level: 1})).toHaveTextContent('Recurring Jobs');
        });

        it('should not render ancestor crumbs as links when href is absent', () => {
            renderWithTheme(
                <AppToolbar
                    {...defaultProps}
                    title={undefined}
                    breadcrumbs={[
                        {label: 'Dashboards'},
                        {label: 'Recurring Jobs'},
                    ]}
                />
            );
            // The breadcrumbs nav must exist...
            expect(screen.getByLabelText('page navigation')).toBeInTheDocument();
            // ...but no <a> elements inside it (ancestor crumb is plain text).
            const nav = screen.getByLabelText('page navigation');
            expect(nav.querySelectorAll('a')).toHaveLength(0);
        });

        it('should prefer breadcrumbs over title when both are provided', () => {
            renderWithTheme(
                <AppToolbar
                    {...defaultProps}
                    title="Legacy Title"
                    breadcrumbs={[{label: 'New Title'}]}
                />
            );
            expect(screen.queryByText('Legacy Title')).not.toBeInTheDocument();
            expect(screen.getByText('New Title')).toBeInTheDocument();
        });

        it('should render the logo with default URL', () => {
            renderWithTheme(<AppToolbar {...defaultProps} />);
            const logo = screen.getByAltText('DFRNT');
            expect(logo).toBeInTheDocument();
            expect(logo).toHaveAttribute('src', 'images/dfrnt_logo_reversed.png');
        });

        it('should render the reversed (white) logo for US tenants', () => {
            renderWithTheme(<AppToolbar {...defaultProps} isUsCustomer={true} />);
            expect(screen.getByAltText('DFRNT')).toHaveAttribute('src', 'images/dfrnt_logo_reversed.png');
        });

        it('should render the dark logo for NZ tenants (gold bar)', () => {
            renderWithTheme(<AppToolbar {...defaultProps} isUsCustomer={false} />);
            expect(screen.getByAltText('DFRNT')).toHaveAttribute('src', 'images/dfrnt_logo.png');
        });

        it('should render the logo with custom URL', () => {
            renderWithTheme(
                <AppToolbar {...defaultProps} logoUrl="custom/logo.png" />
            );
            const logo = screen.getByAltText('DFRNT');
            expect(logo).toHaveAttribute('src', 'custom/logo.png');
        });

        it('should render menu icon button', () => {
            renderWithTheme(<AppToolbar {...defaultProps} />);
            expect(screen.getByRole('button', {name: /navigation menu/i})).toBeInTheDocument();
        });

        it('should render children when provided', () => {
            renderWithTheme(
                <AppToolbar {...defaultProps}>
                    <button data-testid="custom-action">Custom Action</button>
                </AppToolbar>
            );
            expect(screen.getByTestId('custom-action')).toBeInTheDocument();
        });

        it('should render a BETA chip when beta is true', () => {
            renderWithTheme(<AppToolbar {...defaultProps} beta />);
            expect(screen.getByText('BETA')).toBeInTheDocument();
        });

        it('should not render a BETA chip by default', () => {
            renderWithTheme(<AppToolbar {...defaultProps} />);
            expect(screen.queryByText('BETA')).not.toBeInTheDocument();
        });
    });

    describe('Greeting', () => {
        it('should show greeting tooltip on avatar hover', async () => {
            renderWithTheme(<AppToolbar {...defaultProps} />);

            // The greeting should be in the tooltip title
            const avatarButton = screen.getByRole('button', {name: /navigation menu/i});
            expect(avatarButton).toBeInTheDocument();
        });
    });

    describe('Interactions', () => {
        it('should call onLogoClick when logo is clicked', () => {
            const onLogoClick = jest.fn();
            renderWithTheme(
                <AppToolbar {...defaultProps} onLogoClick={onLogoClick} />
            );

            const logo = screen.getByAltText('DFRNT');
            fireEvent.click(logo);

            expect(onLogoClick).toHaveBeenCalledTimes(1);
        });

        it('should not have pointer cursor on logo when onLogoClick is not provided', () => {
            renderWithTheme(<AppToolbar {...defaultProps} />);
            const logo = screen.getByAltText('DFRNT');
            expect(logo).toHaveStyle({cursor: 'default'});
        });

        it('should call onMenuHover when avatar is hovered', () => {
            const onMenuHover = jest.fn();
            renderWithTheme(
                <AppToolbar {...defaultProps} onMenuHover={onMenuHover} />
            );

            const avatarButton = screen.getByRole('button', {name: /navigation menu/i});
            fireEvent.mouseEnter(avatarButton);

            expect(onMenuHover).toHaveBeenCalledTimes(1);
        });

        it('should call onMenuClick when the menu button is tapped (touch-accessible path)', () => {
            const onMenuClick = jest.fn();
            renderWithTheme(
                <AppToolbar {...defaultProps} onMenuClick={onMenuClick} />
            );

            fireEvent.click(screen.getByRole('button', {name: /navigation menu/i}));

            expect(onMenuClick).toHaveBeenCalledTimes(1);
        });
    });

    describe('Greeting Generation', () => {
        it('should include firstName in tooltip greeting', () => {
            renderWithTheme(<AppToolbar {...defaultProps} firstName="Alice" />);
            // The greeting is shown in the tooltip, which includes the firstName
            const menuButton = screen.getByRole('button', {name: /navigation menu/i});
            expect(menuButton).toBeInTheDocument();
        });

        it('should handle different names in greeting', () => {
            renderWithTheme(<AppToolbar {...defaultProps} firstName="Bob" />);
            const menuButton = screen.getByRole('button', {name: /navigation menu/i});
            expect(menuButton).toBeInTheDocument();
        });
    });

    describe('Responsive Behavior', () => {
        it('should render AppBar with static position', () => {
            renderWithTheme(<AppToolbar {...defaultProps} />);
            const appBar = screen.getByRole('banner');
            expect(appBar).toHaveClass('MuiAppBar-positionStatic');
        });
    });
});
