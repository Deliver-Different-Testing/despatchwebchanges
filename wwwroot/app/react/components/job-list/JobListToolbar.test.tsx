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
    showLoggedInSwitch: boolean;
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
        showLoggedInSwitch: true,
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

    it('shows the logged-in only toggle only when the panel enables it', () => {
        const {unmount} = renderWithMantine(<JobListToolbar {...createDefaultProps()}/>);
        expect(screen.getByText('Logged-in only')).toBeInTheDocument();
        unmount();

        renderWithMantine(<JobListToolbar {...createDefaultProps({showLoggedInSwitch: false})}/>);
        expect(screen.queryByText('Logged-in only')).not.toBeInTheDocument();
    });

    it('omits the view options (density / logged-in) when they are relocated to the header', () => {
        renderWithMantine(<JobListToolbar {...createDefaultProps()} renderViewOptions={false}/>);
        // Category tabs + search stay; view options move to the panel header.
        expect(screen.getByPlaceholderText('Search jobs...')).toBeInTheDocument();
        expect(screen.queryByText('Logged-in only')).not.toBeInTheDocument();
        expect(screen.queryByLabelText('Row density')).not.toBeInTheDocument();
    });

    it('ranks Dispatch as the selection bar\'s only primary action', () => {
        renderWithMantine(<JobListToolbar {...createDefaultProps()} selectedCount={3}/>);

        // The gear is only reachable as an attribute — CSS modules mock to `{}`.
        expect(screen.getByRole('button', {name: 'Dispatch'})).toHaveAttribute('data-ab-variant', 'filled');
        for (const name of ['Restore', 'Mark Read', 'Mark Unread']) {
            expect(screen.getByRole('button', {name})).toHaveAttribute('data-ab-variant', 'chip');
        }
    });

    it('offers the bulk Dispatch and Restore actions on every operational page', () => {
        // Nationwide (Domestic) used to be excluded, which left the page with no bulk
        // assignment affordance at all.
        for (const appPage of [AppPage.JobSearch, AppPage.Dispatch, AppPage.Domestic]) {
            const {unmount} = renderWithMantine(
                <JobListToolbar {...createDefaultProps({appPage})} selectedCount={2}/>
            );
            expect(screen.getByRole('button', {name: 'Dispatch'})).toBeInTheDocument();
            expect(screen.getByRole('button', {name: 'Restore'})).toBeInTheDocument();
            expect(screen.getByRole('button', {name: 'Mark Read'})).toBeInTheDocument();
            unmount();
        }
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
