import React from 'react';
import {render, screen, fireEvent} from '@testing-library/react';
import {MantineTestProvider} from '../../../__testUtils__';
import {StatsTabs} from './StatsTabs';


const renderWithTheme = (ui: React.ReactElement) =>
    render(<MantineTestProvider>{ui}</MantineTestProvider>);

describe('StatsTabs', () => {
    const defaultProps = {
        statistics: {active: 10, inactive: 3, completed: 42},
        activeTab: 0,
        onTabChange: jest.fn(),
    };

    it('renders all three tabs with correct labels', () => {
        renderWithTheme(<StatsTabs {...defaultProps} />);

        expect(screen.getByText('Active')).toBeInTheDocument();
        expect(screen.getByText('Inactive')).toBeInTheDocument();
        expect(screen.getByText('Completed')).toBeInTheDocument();
    });

    it('displays correct stat values', () => {
        renderWithTheme(<StatsTabs {...defaultProps} />);

        expect(screen.getByText('10')).toBeInTheDocument();
        expect(screen.getByText('3')).toBeInTheDocument();
        expect(screen.getByText('42')).toBeInTheDocument();
    });

    it('calls onTabChange when a tab is clicked', () => {
        renderWithTheme(<StatsTabs {...defaultProps} />);

        fireEvent.click(screen.getByText('Inactive'));
        expect(defaultProps.onTabChange).toHaveBeenCalledWith(1);

        fireEvent.click(screen.getByText('Completed'));
        expect(defaultProps.onTabChange).toHaveBeenCalledWith(2);
    });

    it('shows active indicator for the selected tab', () => {
        renderWithTheme(<StatsTabs {...defaultProps} activeTab={1} />);

        // The old assertion only proved a Box existed. data-active is what actually
        // drives the indicator, so assert the selected tab carries it and the others
        // do not.
        expect(screen.getByText('Inactive').closest('[data-active]')).toHaveAttribute('data-active', 'true');
        expect(screen.getByText('Active').closest('[data-active]')).toHaveAttribute('data-active', 'false');
        expect(screen.getByText('Completed').closest('[data-active]')).toHaveAttribute('data-active', 'false');
    });

    it('renders with zero stats', () => {
        renderWithTheme(
            <StatsTabs
                {...defaultProps}
                statistics={{active: 0, inactive: 0, completed: 0}}
            />,
        );

        const zeros = screen.getAllByText('0');
        expect(zeros).toHaveLength(3);
    });
});
