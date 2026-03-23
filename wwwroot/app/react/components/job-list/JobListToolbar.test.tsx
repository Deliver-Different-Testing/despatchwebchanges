/** @jest-environment jest-environment-jsdom */
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
    it('renders all elements and fires callbacks on interaction', async () => {
        const user = userEvent.setup();
        const props = createDefaultProps();
        renderWithTheme(<JobListToolbar {...props}/>);

        // Category buttons and search input present
        expect(screen.getByText('Unassigned')).toBeInTheDocument();
        expect(screen.getByText('Active')).toBeInTheDocument();
        expect(screen.getByText('Done')).toBeInTheDocument();
        expect(screen.getByText('All')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('Search jobs...')).toBeInTheDocument();
        expect(screen.getAllByRole('button').length).toBeGreaterThanOrEqual(4);

        // Category change callback
        await user.click(screen.getByText('Unassigned'));
        expect(props.onCategoryChange).toHaveBeenCalledWith('needs-dispatch');

        // Reset columns callback
        await user.click(screen.getByRole('button', {name: /reset column widths/i}));
        expect(props.onResetColumns).toHaveBeenCalledTimes(1);
    });

    it('shows logged-in only toggle on Dispatch and JobSearch pages but not Domestic', () => {
        // Dispatch
        const {unmount: u1} = renderWithTheme(<JobListToolbar {...createDefaultProps({appPage: AppPage.Dispatch})}/>);
        expect(screen.getByText('Logged-in only')).toBeInTheDocument();
        u1();

        // JobSearch
        const {unmount: u2} = renderWithTheme(<JobListToolbar {...createDefaultProps({appPage: AppPage.JobSearch})}/>);
        expect(screen.getByText('Logged-in only')).toBeInTheDocument();
        u2();

        // Domestic
        renderWithTheme(<JobListToolbar {...createDefaultProps({appPage: AppPage.Domestic})}/>);
        expect(screen.queryByText('Logged-in only')).not.toBeInTheDocument();
    });
});
