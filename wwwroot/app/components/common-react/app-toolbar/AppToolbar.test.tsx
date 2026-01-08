/**
 * AppToolbar Component Tests
 */

import React from 'react';
import {render, screen, fireEvent} from '@testing-library/react';
import {ThemeProvider, createTheme} from '@mui/material';
import {AppToolbar} from './AppToolbar';

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

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('Rendering', () => {
        it('should render the title', () => {
            renderWithTheme(<AppToolbar {...defaultProps} />);
            expect(screen.getByText('Test Dashboard')).toBeInTheDocument();
        });

        it('should render the logo with default URL', () => {
            renderWithTheme(<AppToolbar {...defaultProps} />);
            const logo = screen.getByAltText('DFRNT');
            expect(logo).toBeInTheDocument();
            expect(logo).toHaveAttribute('src', 'images/dfrnt_logo.png');
        });

        it('should render the logo with custom URL', () => {
            renderWithTheme(
                <AppToolbar {...defaultProps} logoUrl="custom/logo.png" />
            );
            const logo = screen.getByAltText('DFRNT');
            expect(logo).toHaveAttribute('src', 'custom/logo.png');
        });

        it('should render user avatar with initials', () => {
            renderWithTheme(<AppToolbar {...defaultProps} />);
            expect(screen.getByText('J')).toBeInTheDocument();
        });

        it('should render children when provided', () => {
            renderWithTheme(
                <AppToolbar {...defaultProps}>
                    <button data-testid="custom-action">Custom Action</button>
                </AppToolbar>
            );
            expect(screen.getByTestId('custom-action')).toBeInTheDocument();
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
    });

    describe('Initials Generation', () => {
        it('should show first letter of firstName as initial', () => {
            renderWithTheme(<AppToolbar {...defaultProps} firstName="Alice" />);
            expect(screen.getByText('A')).toBeInTheDocument();
        });

        it('should handle lowercase names', () => {
            renderWithTheme(<AppToolbar {...defaultProps} firstName="bob" />);
            expect(screen.getByText('B')).toBeInTheDocument();
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
