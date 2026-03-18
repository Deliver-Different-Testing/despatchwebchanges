/**
 * JobListToolbar Tests
 */

import React from 'react';
import {screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {renderWithTheme} from '../../__testUtils__';
import {JobListToolbar} from './JobListToolbar';
import type {JobCategory, DensityMode} from '../../interfaces/dispatchJob';

function createDefaultProps(overrides?: Partial<{
    selectedCategory: JobCategory;
    onCategoryChange: jest.Mock;
    searchQuery: string;
    onSearchChange: jest.Mock;
    loggedInCouriersOnly: boolean;
    onLoggedInCouriersOnlyChange: jest.Mock;
    densityMode: DensityMode;
    onDensityModeChange: jest.Mock;
    onResetColumns: jest.Mock;
}>) {
    return {
        selectedCategory: 'all' as JobCategory,
        onCategoryChange: jest.fn(),
        searchQuery: '',
        onSearchChange: jest.fn(),
        loggedInCouriersOnly: false,
        onLoggedInCouriersOnlyChange: jest.fn(),
        densityMode: 'dense' as DensityMode,
        onDensityModeChange: jest.fn(),
        onResetColumns: jest.fn(),
        ...overrides,
    };
}

describe('JobListToolbar', () => {
    describe('Category Tabs', () => {
        it('renders all category buttons', () => {
            renderWithTheme(<JobListToolbar {...createDefaultProps()}/>);

            expect(screen.getByText('Unassigned')).toBeInTheDocument();
            expect(screen.getByText('Active')).toBeInTheDocument();
            expect(screen.getByText('Done')).toBeInTheDocument();
            expect(screen.getByText('All')).toBeInTheDocument();
        });

        it('fires onCategoryChange when a category is clicked', async () => {
            const user = userEvent.setup();
            const props = createDefaultProps();
            renderWithTheme(<JobListToolbar {...props}/>);

            await user.click(screen.getByText('Unassigned'));

            expect(props.onCategoryChange).toHaveBeenCalledWith('needs-dispatch');
        });
    });

    describe('Search', () => {
        it('renders search input', () => {
            renderWithTheme(<JobListToolbar {...createDefaultProps()}/>);

            expect(screen.getByPlaceholderText('Search jobs...')).toBeInTheDocument();
        });
    });

    describe('Density Toggle', () => {
        it('renders density toggle buttons', () => {
            renderWithTheme(<JobListToolbar {...createDefaultProps()}/>);

            // The toggle group contains Normal, Dense, Ultra Dense tooltips
            const buttons = screen.getAllByRole('button');
            // At least: 3 density buttons + 1 reset button = 4
            expect(buttons.length).toBeGreaterThanOrEqual(4);
        });
    });

    describe('Reset Columns', () => {
        it('fires onResetColumns when reset button is clicked', async () => {
            const user = userEvent.setup();
            const props = createDefaultProps();
            renderWithTheme(<JobListToolbar {...props}/>);

            // Find the reset button by tooltip title
            const resetButton = screen.getByRole('button', {name: /reset column widths/i});
            await user.click(resetButton);

            expect(props.onResetColumns).toHaveBeenCalledTimes(1);
        });
    });
});
