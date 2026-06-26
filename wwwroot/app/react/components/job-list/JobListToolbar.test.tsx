/**
 * JobListToolbar Tests
 */

import React from 'react';
import {screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {renderWithTheme} from '../../__testUtils__';
import {JobListToolbar} from './JobListToolbar';
import type {JobCategory, DensityMode} from '../../interfaces/dispatchJob';
import {AppPage} from '../../interfaces/dispatchJob';

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
    appPage: number;
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
        appPage: AppPage.Dispatch,
        ...overrides,
    };
}

describe('JobListToolbar', () => {
    it('renders category buttons, search input, and density toggle buttons', () => {
        renderWithTheme(<JobListToolbar {...createDefaultProps()}/>);

        expect(screen.getByText('Unassigned')).toBeInTheDocument();
        expect(screen.getByText('Active')).toBeInTheDocument();
        expect(screen.getByText('Done')).toBeInTheDocument();
        expect(screen.getByText('All')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('Search jobs...')).toBeInTheDocument();
        const buttons = screen.getAllByRole('button');
        expect(buttons.length).toBeGreaterThanOrEqual(4);
    });

    it('fires onCategoryChange when a category is clicked', async () => {
        const user = userEvent.setup();
        const props = createDefaultProps();
        renderWithTheme(<JobListToolbar {...props}/>);

        await user.click(screen.getByText('Unassigned'));

        expect(props.onCategoryChange).toHaveBeenCalledWith('needs-dispatch');
    });

    it('shows logged-in only toggle when dispatching is enabled', () => {
        renderWithTheme(<JobListToolbar {...createDefaultProps({appPage: AppPage.Dispatch})}/>);
        expect(screen.getByText('Logged-in only')).toBeInTheDocument();
    });

    it('omits the view options (density / logged-in) when they are relocated to the header', () => {
        renderWithTheme(<JobListToolbar {...createDefaultProps()} renderViewOptions={false}/>);
        // Category tabs + search stay; view options move to the panel header.
        expect(screen.getByPlaceholderText('Search jobs...')).toBeInTheDocument();
        expect(screen.queryByText('Logged-in only')).not.toBeInTheDocument();
        expect(screen.queryByLabelText('Row density')).not.toBeInTheDocument();
    });

    it('shows logged-in only toggle on job search page', () => {
        renderWithTheme(<JobListToolbar {...createDefaultProps({appPage: AppPage.JobSearch})}/>);
        expect(screen.getByText('Logged-in only')).toBeInTheDocument();
    });

    it('hides logged-in only toggle when dispatching is not enabled', () => {
        renderWithTheme(<JobListToolbar {...createDefaultProps({appPage: AppPage.Domestic})}/>);
        expect(screen.queryByText('Logged-in only')).not.toBeInTheDocument();
    });

    it('hides logged-in only toggle when hideLoggedInSwitch is true', () => {
        renderWithTheme(<JobListToolbar {...createDefaultProps({appPage: AppPage.Dispatch})} hideLoggedInSwitch/>);
        expect(screen.queryByText('Logged-in only')).not.toBeInTheDocument();
    });

    it('fires onResetColumns when reset button is clicked', async () => {
        const user = userEvent.setup();
        const props = createDefaultProps();
        renderWithTheme(<JobListToolbar {...props}/>);

        const resetButton = screen.getByRole('button', {name: /reset column widths/i});
        await user.click(resetButton);

        expect(props.onResetColumns).toHaveBeenCalledTimes(1);
    });
});
