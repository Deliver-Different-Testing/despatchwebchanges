import React from 'react';
import {fireEvent, screen} from '@testing-library/react';
import {renderWithMantine} from '../../../../test/utils';
import {ListEmptyState, ListEmptyStateProps} from './ListEmptyState';

const baseProps = (overrides: Partial<ListEmptyStateProps> = {}): ListEmptyStateProps => ({
    noun: 'drivers',
    isError: false,
    onRetry: jest.fn(),
    isFiltered: false,
    onClearFilters: jest.fn(),
    emptyTitle: 'No drivers',
    emptyMessage: 'Nothing here yet.',
    emptyIcon: <span/>,
    ...overrides,
});

describe('ListEmptyState', () => {
    it('shows the load-failed state with a retry that wins over filtered', () => {
        const props = baseProps({isError: true, isFiltered: true});
        renderWithMantine(<ListEmptyState {...props}/>);

        expect(screen.getByText("Couldn't load drivers")).toBeInTheDocument();
        expect(screen.getByText('Check your connection, then try again.')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', {name: 'Try again'}));
        expect(props.onRetry).toHaveBeenCalledTimes(1);
    });

    it('shows the filtered-empty state with a clear action', () => {
        const props = baseProps({isFiltered: true});
        renderWithMantine(<ListEmptyState {...props}/>);

        expect(screen.getByText('No drivers match these filters')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', {name: 'Clear filters'}));
        expect(props.onClearFilters).toHaveBeenCalledTimes(1);
    });

    it('shows the true-empty copy with no action', () => {
        renderWithMantine(<ListEmptyState {...baseProps()}/>);

        expect(screen.getByText('No drivers')).toBeInTheDocument();
        expect(screen.getByText('Nothing here yet.')).toBeInTheDocument();
        expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });
});
