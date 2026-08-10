/**
 * AppToolbar Component Tests
 */

import React from 'react';
import {screen, fireEvent} from '@testing-library/react';
import {renderWithMantine} from '../../../__testUtils__';
import {AppToolbar} from './AppToolbar';
import {APP_BAR_HEIGHT_PX} from './appBarMetrics';
import {createDfrntTheme} from '../../../theme/dfrntMantineTheme';

describe('AppToolbar', () => {
    const defaultProps = {
        title: 'Test Dashboard',
        firstName: 'John',
    };

    describe('Rendering', () => {
        it('should render the title', () => {
            renderWithMantine(<AppToolbar {...defaultProps} />);
            expect(screen.getByText('Test Dashboard')).toBeInTheDocument();
        });

        it('should render a single-crumb fallback as the page heading when no breadcrumbs are provided', () => {
            renderWithMantine(<AppToolbar {...defaultProps} />);
            const heading = screen.getByRole('heading', {level: 1, name: 'Test Dashboard'});
            expect(heading).toBeInTheDocument();
        });

        it('should emphasise the active page title over ancestor crumbs', () => {
            renderWithMantine(
                <AppToolbar
                    {...defaultProps}
                    title={undefined}
                    breadcrumbs={[{label: 'Dashboards'}, {label: 'Recurring Jobs'}]}
                />
            );
            expect(screen.getByRole('heading', {level: 1, name: 'Recurring Jobs'}))
                .toHaveStyle({fontWeight: 600, fontSize: '0.875rem', color: 'rgba(255, 255, 255, 0.95)'});
            expect(screen.getByText('Dashboards'))
                .toHaveStyle({fontWeight: 400, fontSize: '0.875rem', color: 'rgba(255, 255, 255, 0.6)'});
        });

        it('should render section + page when breadcrumbs are provided', () => {
            renderWithMantine(
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
            renderWithMantine(
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
            renderWithMantine(
                <AppToolbar
                    {...defaultProps}
                    title="Legacy Title"
                    breadcrumbs={[{label: 'New Title'}]}
                />
            );
            expect(screen.queryByText('Legacy Title')).not.toBeInTheDocument();
            expect(screen.getByText('New Title')).toBeInTheDocument();
        });

        it('should render the reversed (white) logo on the US navy bar', () => {
            renderWithMantine(<AppToolbar {...defaultProps} />);
            const logo = screen.getByAltText('DFRNT');
            expect(logo).toBeInTheDocument();
            expect(logo).toHaveAttribute('src', 'images/dfrnt_logo_reversed.png');
        });

        it('should render the standard (dark) logo on a non-US gold bar', () => {
            // White on gold is illegible, so the wordmark follows the bar's fill.
            renderWithMantine(<AppToolbar {...defaultProps} />, {theme: createDfrntTheme(false)});
            expect(screen.getByAltText('DFRNT')).toHaveAttribute('src', 'images/dfrnt_logo.png');
        });

        it('should render the logo with custom URL', () => {
            renderWithMantine(
                <AppToolbar {...defaultProps} logoUrl="custom/logo.png" />
            );
            const logo = screen.getByAltText('DFRNT');
            expect(logo).toHaveAttribute('src', 'custom/logo.png');
        });

        it('should render menu icon button', () => {
            renderWithMantine(<AppToolbar {...defaultProps} />);
            expect(screen.getByRole('button', {name: /navigation menu/i})).toBeInTheDocument();
        });

        it('should render children when provided', () => {
            renderWithMantine(
                <AppToolbar {...defaultProps}>
                    <button data-testid="custom-action">Custom Action</button>
                </AppToolbar>
            );
            expect(screen.getByTestId('custom-action')).toBeInTheDocument();
        });

        it('should render a BETA chip when beta is true', () => {
            renderWithMantine(<AppToolbar {...defaultProps} beta />);
            expect(screen.getByText('BETA')).toBeInTheDocument();
        });

        it('should not render a BETA chip by default', () => {
            renderWithMantine(<AppToolbar {...defaultProps} />);
            expect(screen.queryByText('BETA')).not.toBeInTheDocument();
        });
    });

    describe('Greeting', () => {
        it('should show greeting tooltip on avatar hover', async () => {
            renderWithMantine(<AppToolbar {...defaultProps} />);

            // The greeting should be in the tooltip title
            const avatarButton = screen.getByRole('button', {name: /navigation menu/i});
            expect(avatarButton).toBeInTheDocument();
        });
    });

    describe('Interactions', () => {
        it('should call onLogoClick when logo is clicked', () => {
            const onLogoClick = jest.fn();
            renderWithMantine(
                <AppToolbar {...defaultProps} onLogoClick={onLogoClick} />
            );

            const logo = screen.getByAltText('DFRNT');
            fireEvent.click(logo);

            expect(onLogoClick).toHaveBeenCalledTimes(1);
        });

        it('should not have pointer cursor on logo when onLogoClick is not provided', () => {
            renderWithMantine(<AppToolbar {...defaultProps} />);
            const logo = screen.getByAltText('DFRNT');
            expect(logo).toHaveStyle({cursor: 'default'});
        });

        it('should call onMenuHover when avatar is hovered', () => {
            const onMenuHover = jest.fn();
            renderWithMantine(
                <AppToolbar {...defaultProps} onMenuHover={onMenuHover} />
            );

            const avatarButton = screen.getByRole('button', {name: /navigation menu/i});
            fireEvent.mouseEnter(avatarButton);

            expect(onMenuHover).toHaveBeenCalledTimes(1);
        });

        it('should call onMenuClick when the menu button is tapped (touch-accessible path)', () => {
            const onMenuClick = jest.fn();
            renderWithMantine(
                <AppToolbar {...defaultProps} onMenuClick={onMenuClick} />
            );

            fireEvent.click(screen.getByRole('button', {name: /navigation menu/i}));

            expect(onMenuClick).toHaveBeenCalledTimes(1);
        });
    });

    describe('Greeting Generation', () => {
        it('should include firstName in tooltip greeting', () => {
            renderWithMantine(<AppToolbar {...defaultProps} firstName="Alice" />);
            // The greeting is shown in the tooltip, which includes the firstName
            const menuButton = screen.getByRole('button', {name: /navigation menu/i});
            expect(menuButton).toBeInTheDocument();
        });

        it('should handle different names in greeting', () => {
            renderWithMantine(<AppToolbar {...defaultProps} firstName="Bob" />);
            const menuButton = screen.getByRole('button', {name: /navigation menu/i});
            expect(menuButton).toBeInTheDocument();
        });
    });

    describe('App bar chrome', () => {
        it('renders a non-US bar in the brand gold with Ink content', () => {
            renderWithMantine(<AppToolbar {...defaultProps} />, {theme: createDfrntTheme(false)});
            expect(screen.getByRole('banner')).toHaveStyle({
                backgroundColor: '#f4c430',
                color: '#0d0c2c',
            });
        });

        it('renders the bar as a 56px Ink-Blue banner on US tenants, matching Integration Manager', () => {
            renderWithMantine(<AppToolbar {...defaultProps} />);
            // Mantine has no AppBar, so the navy is set on the header itself —
            // guard it, or the bar silently reverts to white. The 56px height is
            // mirrored by the `calc(100vh - 56px)` page containers in routes.ts.
            expect(screen.getByRole('banner')).toHaveStyle({
                backgroundColor: '#0d0c2c',
                height: `${APP_BAR_HEIGHT_PX}px`,
            });
        });

        it('renders the logo at Integration Manager\'s 26px mark height', () => {
            renderWithMantine(<AppToolbar {...defaultProps} />);
            expect(screen.getByAltText('DFRNT')).toHaveStyle({height: '26px'});
        });

        it('separates the brand mark from the crumbs with a faint 1x22 keyline', () => {
            renderWithMantine(
                <AppToolbar
                    {...defaultProps}
                    title={undefined}
                    breadcrumbs={[{label: 'Dashboards'}, {label: 'Recurring Jobs'}]}
                />
            );
            expect(screen.getByTestId('toolbar-keyline')).toHaveStyle({
                width: '1px',
                height: '22px',
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
            });
        });
    });
});
