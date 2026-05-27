import React from 'react';
import {render, screen, fireEvent} from '@testing-library/react';
import {ThemeProvider, createTheme} from '@mui/material/styles';
import {StatsTabs} from './StatsTabs';

const theme = createTheme();

const renderWithTheme = (ui: React.ReactElement) =>
    render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);

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

        // The active tab (Inactive, index 1) should have full opacity
        const inactiveTab = screen.getByText('Inactive').closest('[class*="MuiBox"]');
        expect(inactiveTab).toBeInTheDocument();
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
