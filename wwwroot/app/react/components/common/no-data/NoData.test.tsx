/**
 * NoData Component Tests
 */

import React from 'react';
import { screen, fireEvent } from '@testing-library/react';
import {Briefcase} from 'lucide-react';
import {renderWithMantine} from '../../../__testUtils__';
import {Icon} from '../icon/Icon';
import { NoData } from './NoData';
import type { NoDataProps } from './types';

const renderWithProviders = (ui: React.ReactElement) => renderWithMantine(ui);

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

        it('renders a passed React icon element', () => {
            const props = createDefaultProps({ icon: <Icon lucide={Briefcase} aria-label="Work"/> });
            renderWithProviders(<NoData {...props} />);

            expect(screen.getByLabelText('Work')).toBeInTheDocument();
        });

        it('renders a string icon via the Material Symbols font (AngularJS bridge)', () => {
            const props = createDefaultProps({ icon: 'warning' });
            renderWithProviders(<NoData {...props} />);

            expect(screen.getByText('warning')).toBeInTheDocument();
        });

        it('renders default icon when not specified', () => {
            renderWithProviders(<NoData />);

            expect(document.querySelector('.mantine-Text-root svg')).toBeTruthy();
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

    /**
     * `isUsCustomer` is inert — it always has been, in the MUI version too. The action
     * is a plain Mantine `Button`, so its colour comes from the tenant's brand primary
     * via the provider rather than from anything this component decides. The pair of
     * tests that used to assert `MuiButton-contained` on both tenants is one test that
     * says the button is Mantine's and the prop changes nothing.
     */
    describe('Action button styling', () => {
        it('renders the theme default button regardless of isUsCustomer', () => {
            renderWithProviders(<NoData {...createDefaultProps({showAction: true})} />);
            const nzButton = screen.getByRole('button');
            expect(nzButton).toHaveClass('mantine-Button-root');

            renderWithProviders(<NoData {...createDefaultProps({showAction: true, isUsCustomer: true})} />);
            expect(screen.getAllByRole('button')[1].className).toBe(nzButton.className);
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
