/** @jest-environment jest-environment-jsdom */
/**
 * NoData Component Tests
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import {ThemeProvider, createTheme} from '@mui/material/styles';
import { NoData } from './NoData';
import type { NoDataProps } from './types';

const theme = createTheme();

const renderWithProviders = (ui: React.ReactElement) => {
    return render(
        <ThemeProvider theme={theme}>
            {ui}
        </ThemeProvider>
    );
};

const createDefaultProps = (overrides?: Partial<NoDataProps>): NoDataProps => ({
    ...overrides,
});

describe('NoData', () => {
    describe('Rendering', () => {
        it('renders with default props', () => {
            renderWithProviders(<NoData />);

            expect(screen.getByText('No Data')).toBeInTheDocument();
            expect(screen.getByText('No items to display.')).toBeInTheDocument();
        });

        it('renders custom title', () => {
            const props = createDefaultProps({ title: 'Custom Title' });
            renderWithProviders(<NoData {...props} />);

            expect(screen.getByText('Custom Title')).toBeInTheDocument();
        });

        it('renders custom message', () => {
            const props = createDefaultProps({ message: 'Custom message text' });
            renderWithProviders(<NoData {...props} />);

            expect(screen.getByText('Custom message text')).toBeInTheDocument();
        });

        it('renders custom icon', () => {
            const props = createDefaultProps({ icon: 'warning' });
            renderWithProviders(<NoData {...props} />);

            expect(screen.getByText('warning')).toBeInTheDocument();
        });

        it('renders default icon when not specified', () => {
            renderWithProviders(<NoData />);

            expect(screen.getByText('info')).toBeInTheDocument();
        });
    });

    describe('Action Button', () => {
        it('does not show action button by default', () => {
            renderWithProviders(<NoData />);

            expect(screen.queryByRole('button')).not.toBeInTheDocument();
        });

        it('shows action button when showAction is true', () => {
            const props = createDefaultProps({ showAction: true });
            renderWithProviders(<NoData {...props} />);

            expect(screen.getByRole('button', { name: 'Refresh' })).toBeInTheDocument();
        });

        it('shows custom action text', () => {
            const props = createDefaultProps({ showAction: true, actionText: 'Try Again' });
            renderWithProviders(<NoData {...props} />);

            expect(screen.getByRole('button', { name: 'Try Again' })).toBeInTheDocument();
        });

        it('calls onAction when action button is clicked', () => {
            const onAction = jest.fn();
            const props = createDefaultProps({ showAction: true, onAction });
            renderWithProviders(<NoData {...props} />);

            fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
            expect(onAction).toHaveBeenCalledTimes(1);
        });

        it('does not throw when action button clicked without onAction', () => {
            const props = createDefaultProps({ showAction: true });
            renderWithProviders(<NoData {...props} />);

            expect(() => {
                fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
            }).not.toThrow();
        });
    });

    describe('Theme Styling', () => {
        it('renders with NZ customer styling by default', () => {
            const props = createDefaultProps({ showAction: true });
            renderWithProviders(<NoData {...props} />);

            const button = screen.getByRole('button');
            // We verify the button exists and has MuiButton class
            expect(button).toHaveClass('MuiButton-contained');
        });

        it('renders with US customer styling when isUsCustomer is true', () => {
            const props = createDefaultProps({ showAction: true, isUsCustomer: true });
            renderWithProviders(<NoData {...props} />);

            const button = screen.getByRole('button');
            expect(button).toHaveClass('MuiButton-contained');
        });
    });

    describe('Full Configuration', () => {
        it('renders with all props configured', () => {
            const onAction = jest.fn();
            const props = createDefaultProps({
                title: 'No Results Found',
                message: 'Try adjusting your search criteria.',
                icon: 'search_off',
                showAction: true,
                actionText: 'Clear Filters',
                onAction,
                isUsCustomer: true,
            });
            renderWithProviders(<NoData {...props} />);

            expect(screen.getByText('No Results Found')).toBeInTheDocument();
            expect(screen.getByText('Try adjusting your search criteria.')).toBeInTheDocument();
            expect(screen.getByText('search_off')).toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'Clear Filters' })).toBeInTheDocument();

            fireEvent.click(screen.getByRole('button', { name: 'Clear Filters' }));
            expect(onAction).toHaveBeenCalledTimes(1);
        });
    });
});
