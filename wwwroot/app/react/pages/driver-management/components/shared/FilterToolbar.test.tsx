import React from 'react';
import {fireEvent, render, screen} from '@testing-library/react';
import {MantineTestProvider} from '../../../../__testUtils__';
import {FilterToolbar} from './FilterToolbar';


const renderFilterToolbar = (props: {
    actions?: React.ReactNode;
    children?: React.ReactNode;
    activeFilterCount?: number;
    onClearAll?: () => void;
} = {}) =>
    render(
        <MantineTestProvider>
            <FilterToolbar
                actions={props.actions}
                activeFilterCount={props.activeFilterCount}
                onClearAll={props.onClearAll}
            >
                {props.children ?? <div>Filter content</div>}
            </FilterToolbar>
        </MantineTestProvider>
    );

describe('FilterToolbar', () => {
    it('should render Filters heading', () => {
        renderFilterToolbar();

        expect(screen.getByText('Filters')).toBeInTheDocument();
    });

    it('should render children', () => {
        renderFilterToolbar({children: <div>Custom filter</div>});

        expect(screen.getByText('Custom filter')).toBeInTheDocument();
    });

    it('should render actions', () => {
        renderFilterToolbar({
            actions: <button>Export</button>,
        });

        expect(screen.getByText('Export')).toBeInTheDocument();
    });

    it('should render multiple children', () => {
        renderFilterToolbar({
            children: (
                <>
                    <div>Filter A</div>
                    <div>Filter B</div>
                </>
            ),
        });

        expect(screen.getByText('Filter A')).toBeInTheDocument();
        expect(screen.getByText('Filter B')).toBeInTheDocument();
    });

    /*
     * The toolbar owns the separation so no tab can forget it — a rule between
     * groups, never inside one.
     */
    it('rules between filter groups, but not before the first', () => {
        renderFilterToolbar({
            children: (
                <>
                    <div>Filter A</div>
                    <div>Filter B</div>
                    <div>Filter C</div>
                </>
            ),
        });

        expect(screen.getAllByRole('separator')).toHaveLength(2);
    });

    it('draws no rule for a single filter group', () => {
        renderFilterToolbar({children: <div>Only filter</div>});

        expect(screen.queryByRole('separator')).not.toBeInTheDocument();
    });

    describe('Clear all', () => {
        it('is absent on a tab that passes no reset', () => {
            renderFilterToolbar();

            expect(screen.queryByRole('button', {name: /Clear all/})).not.toBeInTheDocument();
        });

        it('stays in place but is disabled when nothing is applied', () => {
            renderFilterToolbar({activeFilterCount: 0, onClearAll: jest.fn()});

            expect(screen.getByRole('button', {name: 'Clear all'})).toBeDisabled();
        });

        it('counts what it would clear, and clears it', () => {
            const onClearAll = jest.fn();
            renderFilterToolbar({activeFilterCount: 3, onClearAll});

            const clearAll = screen.getByRole('button', {name: 'Clear all (3)'});
            expect(clearAll).toBeEnabled();

            fireEvent.click(clearAll);
            expect(onClearAll).toHaveBeenCalledTimes(1);
        });
    });
});
