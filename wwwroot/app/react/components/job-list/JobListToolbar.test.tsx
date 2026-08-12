/**
 * JobListToolbar Tests
 */

import React from 'react';
import {screen} from '@testing-library/react';
import { renderWithMantine } from '../../__testUtils__';
import { setupUser } from '../../__testUtils__/setupUser';
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
    it('renders the category radio group, the search input, and the density toggle', () => {
        renderWithMantine(<JobListToolbar {...createDefaultProps()}/>);

        // Categories are mutually exclusive, so they are one radio group.
        expect(screen.getByRole('radio', {name: 'Unassigned'})).toBeInTheDocument();
        expect(screen.getByRole('radio', {name: 'Active'})).toBeInTheDocument();
        expect(screen.getByRole('radio', {name: 'Done'})).toBeInTheDocument();
        expect(screen.getByRole('radio', {name: 'All'})).toBeChecked();
        expect(screen.getByPlaceholderText('Search jobs...')).toBeInTheDocument();
        expect(screen.getByRole('radiogroup', {name: 'Row density'})).toBeInTheDocument();
    });

    it('fires onCategoryChange when a category is clicked', async () => {
        const user = setupUser();
        const props = createDefaultProps();
        renderWithMantine(<JobListToolbar {...props}/>);

        await user.click(screen.getByText('Unassigned'));

        expect(props.onCategoryChange).toHaveBeenCalledWith('needs-dispatch');
    });

    it('shows logged-in only toggle when dispatching is enabled', () => {
        renderWithMantine(<JobListToolbar {...createDefaultProps({appPage: AppPage.Dispatch})}/>);
        expect(screen.getByText('Logged-in only')).toBeInTheDocument();
    });

    it('omits the view options (density / logged-in) when they are relocated to the header', () => {
        renderWithMantine(<JobListToolbar {...createDefaultProps()} renderViewOptions={false}/>);
        // Category tabs + search stay; view options move to the panel header.
        expect(screen.getByPlaceholderText('Search jobs...')).toBeInTheDocument();
        expect(screen.queryByText('Logged-in only')).not.toBeInTheDocument();
        expect(screen.queryByLabelText('Row density')).not.toBeInTheDocument();
    });

    it('shows logged-in only toggle on job search page', () => {
        renderWithMantine(<JobListToolbar {...createDefaultProps({appPage: AppPage.JobSearch})}/>);
        expect(screen.getByText('Logged-in only')).toBeInTheDocument();
    });

    it('hides logged-in only toggle when dispatching is not enabled', () => {
        renderWithMantine(<JobListToolbar {...createDefaultProps({appPage: AppPage.Domestic})}/>);
        expect(screen.queryByText('Logged-in only')).not.toBeInTheDocument();
    });

    it('hides logged-in only toggle when hideLoggedInSwitch is true', () => {
        renderWithMantine(<JobListToolbar {...createDefaultProps({appPage: AppPage.Dispatch})} hideLoggedInSwitch/>);
        expect(screen.queryByText('Logged-in only')).not.toBeInTheDocument();
    });

    it('fires onResetColumns when reset button is clicked', async () => {
        const user = setupUser();
        const props = createDefaultProps();
        renderWithMantine(<JobListToolbar {...props}/>);

        const resetButton = screen.getByRole('button', {name: /reset columns/i});
        await user.click(resetButton);

        expect(props.onResetColumns).toHaveBeenCalledTimes(1);
    });
});
