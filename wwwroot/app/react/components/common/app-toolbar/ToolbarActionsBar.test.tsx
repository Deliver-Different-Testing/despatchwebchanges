import React from 'react';
import {fireEvent, render, screen} from '@testing-library/react';
import {ThemeProvider, createTheme} from '@mui/material/styles';
import {ToolbarActionsBar, ToolbarActionItem} from './ToolbarActionsBar';

const theme = createTheme();

const renderBar = (props: {actions: ToolbarActionItem[]; compact?: boolean}) =>
    render(
        <ThemeProvider theme={theme}>
            <ToolbarActionsBar {...props} />
        </ThemeProvider>,
    );

const makeActions = (onRefresh = jest.fn()): ToolbarActionItem[] => [
    {key: 'views', node: <button>Views</button>},
    {
        key: 'refresh',
        node: <button>Refresh</button>,
        overflow: {label: 'Refresh', onSelect: onRefresh},
    },
];

describe('ToolbarActionsBar', () => {
    it('renders every action inline and no overflow button when not compact', () => {
        renderBar({actions: makeActions(), compact: false});

        expect(screen.getByText('Views')).toBeInTheDocument();
        expect(screen.getByText('Refresh')).toBeInTheDocument();
        expect(screen.queryByLabelText('More actions')).not.toBeInTheDocument();
    });

    it('collapses actions with an overflow descriptor into the More menu when compact', () => {
        renderBar({actions: makeActions(), compact: true});

        // Non-collapsible action stays inline.
        expect(screen.getByText('Views')).toBeInTheDocument();
        // Collapsible action is removed from the inline row.
        expect(screen.queryByText('Refresh')).not.toBeInTheDocument();

        // It appears in the overflow menu instead.
        fireEvent.click(screen.getByLabelText('More actions'));
        expect(screen.getByRole('menuitem', {name: 'Refresh'})).toBeInTheDocument();
    });

    it('invokes the overflow onSelect and closes the menu', () => {
        const onRefresh = jest.fn();
        renderBar({actions: makeActions(onRefresh), compact: true});

        fireEvent.click(screen.getByLabelText('More actions'));
        fireEvent.click(screen.getByRole('menuitem', {name: 'Refresh'}));

        expect(onRefresh).toHaveBeenCalledTimes(1);
    });

    it('does not render a More button in compact mode when nothing is collapsible', () => {
        renderBar({
            actions: [{key: 'views', node: <button>Views</button>}],
            compact: true,
        });

        expect(screen.getByText('Views')).toBeInTheDocument();
        expect(screen.queryByLabelText('More actions')).not.toBeInTheDocument();
    });
});
