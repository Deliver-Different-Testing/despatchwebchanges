import React from 'react';
import {render, screen, fireEvent} from '@testing-library/react';
import {ThemeProvider, createTheme} from '@mui/material/styles';
import {JobSearchShell, JobSearchShellProps} from './JobSearchShell';
import {ILayout} from '../../../../interfaces/layout.interfaces';

const theme = createTheme();

const layout: ILayout = {
    name: 'Default',
    layout: {
        columns: [
            {id: 'col1', width: '100%', boxes: [{name: 'jobList', title: 'Live Job Data', visible: true}]},
        ],
    },
};

const baseProps: JobSearchShellProps = {
    layout,
    layoutVersion: 0,
    boxes: {jobList: {name: 'jobList', title: 'Live Job Data', visible: true}},
    isDefaultLayout: true,
    renderBoxContent: (name) => <div>{`content-${name}`}</div>,
    onRefreshBox: jest.fn(),
    onToggleCollapse: jest.fn(),
};

const renderShell = (props: Partial<JobSearchShellProps> = {}) =>
    render(
        <ThemeProvider theme={theme}>
            <JobSearchShell {...baseProps} {...props} />
        </ThemeProvider>,
    );

describe('JobSearchShell edit-mode signal', () => {
    it('shows no edit-mode chip on the read-only Default layout', () => {
        renderShell({isDefaultLayout: true});
        expect(screen.queryByText(/Editing:/)).not.toBeInTheDocument();
        expect(screen.queryByText('Live Job Data')).toBeInTheDocument();
    });

    it('shows an editing chip naming the layout when custom', () => {
        const customLayout: ILayout = {...layout, name: 'My Layout'};
        renderShell({isDefaultLayout: false, layout: customLayout});
        expect(screen.getByText('Editing: My Layout')).toBeInTheDocument();
    });
});

describe('JobSearchShell panel visibility', () => {
    const twoColLayout = (name: string): ILayout => ({
        name,
        layout: {
            columns: [{
                id: 'col1',
                width: '100%',
                boxes: [
                    {name: 'jobList', title: 'Live Job Data', visible: true},
                    {name: 'map', title: 'Map', visible: false},
                ],
            }],
        },
    });
    const twoColBoxes = {
        jobList: {name: 'jobList', title: 'Live Job Data', visible: true},
        map: {name: 'map', title: 'Map', visible: false},
    };

    it('always shows every panel on the Default layout, ignoring stored visibility', () => {
        renderShell({isDefaultLayout: true, layout: twoColLayout('Default'), boxes: twoColBoxes});
        expect(screen.getByText('Live Job Data')).toBeInTheDocument();
        expect(screen.getByText('Map')).toBeInTheDocument();
    });

    it('honours hidden panels on a custom layout', () => {
        renderShell({isDefaultLayout: false, layout: twoColLayout('My Layout'), boxes: twoColBoxes});
        expect(screen.getByText('Live Job Data')).toBeInTheDocument();
        expect(screen.queryByText('Map')).not.toBeInTheDocument();
    });
});

describe('JobSearchShell editMode', () => {
    const customLayout: ILayout = {...layout, name: 'My Layout'};

    it('shows the drag handle, collapse button and editing chip in edit mode (default)', () => {
        renderShell({isDefaultLayout: false, layout: customLayout, onMoveBox: jest.fn()});
        expect(screen.getByRole('button', {name: /Reorder/})).toBeInTheDocument();
        expect(screen.getByRole('button', {name: /Collapse|Expand/})).toBeInTheDocument();
        expect(screen.getByText('Editing: My Layout')).toBeInTheDocument();
    });

    it('shows a "Done editing" button that calls onExitEditMode', () => {
        const onExitEditMode = jest.fn();
        renderShell({isDefaultLayout: false, layout: customLayout, onMoveBox: jest.fn(), onExitEditMode});
        const done = screen.getByRole('button', {name: /done editing/i});
        fireEvent.click(done);
        expect(onExitEditMode).toHaveBeenCalledTimes(1);
    });

    it('hides the drag handle, collapse button and editing chip when not in edit mode', () => {
        renderShell({
            isDefaultLayout: false,
            layout: customLayout,
            onMoveBox: jest.fn(),
            editMode: false,
        });
        expect(screen.queryByRole('button', {name: /Reorder/})).not.toBeInTheDocument();
        expect(screen.queryByRole('button', {name: /Collapse|Expand/})).not.toBeInTheDocument();
        expect(screen.queryByText('Editing: My Layout')).not.toBeInTheDocument();
        // The panel content still renders — only the edit affordances are gone.
        expect(screen.getByText('Live Job Data')).toBeInTheDocument();
    });
});

describe('JobSearchShell column stepper', () => {
    const multiCol = (name: string, count: number): ILayout => ({
        name,
        layout: {
            columns: Array.from({length: count}, (_, i) => ({
                id: `col${i + 1}`,
                width: `${100 / count}%`,
                boxes: i === 0 ? [{name: 'jobList', title: 'Live Job Data', visible: true}] : [],
            })),
        },
    });

    it('renders the column count and calls the handlers', () => {
        const onAddColumn = jest.fn();
        const onRemoveColumn = jest.fn();
        renderShell({
            isDefaultLayout: false,
            layout: multiCol('My Layout', 2),
            onAddColumn,
            onRemoveColumn,
        });
        const group = screen.getByRole('group', {name: /number of columns/i});
        expect(group).toHaveTextContent('2');

        fireEvent.click(screen.getByRole('button', {name: /add column/i}));
        expect(onAddColumn).toHaveBeenCalledTimes(1);

        fireEvent.click(screen.getByRole('button', {name: /remove column/i}));
        expect(onRemoveColumn).toHaveBeenCalledTimes(1);
    });

    it('disables remove at one column and add at maxColumns', () => {
        const {rerender} = renderShell({
            isDefaultLayout: false,
            layout: multiCol('My Layout', 1),
            onAddColumn: jest.fn(),
            onRemoveColumn: jest.fn(),
        });
        expect(screen.getByRole('button', {name: /remove column/i})).toBeDisabled();
        expect(screen.getByRole('button', {name: /add column/i})).toBeEnabled();

        rerender(
            <ThemeProvider theme={theme}>
                <JobSearchShell
                    {...baseProps}
                    isDefaultLayout={false}
                    layout={multiCol('My Layout', 3)}
                    maxColumns={3}
                    onAddColumn={jest.fn()}
                    onRemoveColumn={jest.fn()}
                />
            </ThemeProvider>,
        );
        expect(screen.getByRole('button', {name: /add column/i})).toBeDisabled();
        expect(screen.getByRole('button', {name: /remove column/i})).toBeEnabled();
    });

    it('hides the stepper on the Default layout and when not in edit mode', () => {
        const {rerender} = renderShell({
            isDefaultLayout: true,
            layout: multiCol('Default', 2),
            onAddColumn: jest.fn(),
            onRemoveColumn: jest.fn(),
        });
        expect(screen.queryByRole('group', {name: /number of columns/i})).not.toBeInTheDocument();

        rerender(
            <ThemeProvider theme={theme}>
                <JobSearchShell
                    {...baseProps}
                    isDefaultLayout={false}
                    layout={multiCol('My Layout', 2)}
                    editMode={false}
                    onAddColumn={jest.fn()}
                    onRemoveColumn={jest.fn()}
                />
            </ThemeProvider>,
        );
        expect(screen.queryByRole('group', {name: /number of columns/i})).not.toBeInTheDocument();
    });
});
