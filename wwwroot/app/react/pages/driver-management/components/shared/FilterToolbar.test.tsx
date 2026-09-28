/** @jest-environment jest-environment-jsdom */
import React from 'react';
import {render, screen} from '@testing-library/react';
import {createTheme, ThemeProvider} from '@mui/material/styles';
import {FilterToolbar} from './FilterToolbar';

const theme = createTheme();

const renderFilterToolbar = (props: {actions?: React.ReactNode; children?: React.ReactNode} = {}) =>
    render(
        <ThemeProvider theme={theme}>
            <FilterToolbar actions={props.actions}>
                {props.children ?? <div>Filter content</div>}
            </FilterToolbar>
        </ThemeProvider>
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
});
