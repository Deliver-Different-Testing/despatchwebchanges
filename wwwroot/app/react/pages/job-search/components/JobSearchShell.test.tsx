import React from 'react';
import {fireEvent, render, screen} from '@testing-library/react';
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
    renderBoxContent: (name) => <div>{`content-${name}`}</div>,
    onRefreshBox: jest.fn(),
};

const renderShell = (props: Partial<JobSearchShellProps> = {}) =>
    render(
        <ThemeProvider theme={theme}>
            <JobSearchShell {...baseProps} {...props} />
        </ThemeProvider>,
    );

const twoBoxLayout = (name: string): ILayout => ({
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
const twoBoxBoxes = {
    jobList: {name: 'jobList', title: 'Live Job Data', visible: true},
    map: {name: 'map', title: 'Map', visible: false},
};

describe('JobSearchShell layout affordances', () => {
    it.each(['Default', 'My Layout'])('offers reorder on the %s layout', (name) => {
        renderShell({layout: {...layout, name}, onMoveBox: jest.fn()});

        expect(screen.getByRole('button', {name: /Reorder/})).toBeInTheDocument();
        expect(screen.getByText('Live Job Data')).toBeInTheDocument();
    });

    it('has no collapse control', () => {
        renderShell({layout: {...layout, name: 'My Layout'}, onMoveBox: jest.fn()});

        expect(screen.queryByRole('button', {name: /Collapse|Expand/})).not.toBeInTheDocument();
    });

    it('hides the columns bar until "Edit columns" mode is on', () => {
        renderShell({layout: {...layout, name: 'My Layout'}, onMoveBox: jest.fn()});

        expect(screen.queryByText('Editing columns')).not.toBeInTheDocument();
        expect(screen.queryByRole('group', {name: /number of columns/i})).not.toBeInTheDocument();
    });

    it.each(['Default', 'My Layout'])('honours hidden panels on the %s layout', (name) => {
        renderShell({layout: twoBoxLayout(name), boxes: twoBoxBoxes});

        expect(screen.getByText('Live Job Data')).toBeInTheDocument();
        expect(screen.queryByText('Map')).not.toBeInTheDocument();
    });
});

describe('JobSearchShell columns bar', () => {
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

    const editing = (props: Partial<JobSearchShellProps> = {}) => renderShell({
        columnEditMode: true,
        layout: multiCol('My Layout', 2),
        onAddColumn: jest.fn(),
        onRemoveColumn: jest.fn(),
        ...props,
    });

    it.each(['Default', 'My Layout'])('shows the stepper on the %s layout', (name) => {
        editing({layout: multiCol(name, 2)});

        expect(screen.getByText('Editing columns')).toBeInTheDocument();
        expect(screen.getByRole('group', {name: /number of columns/i})).toHaveTextContent('2');
    });

    it('adds and removes columns', () => {
        const onAddColumn = jest.fn();
        const onRemoveColumn = jest.fn();
        editing({onAddColumn, onRemoveColumn});

        fireEvent.click(screen.getByRole('button', {name: /add column/i}));
        fireEvent.click(screen.getByRole('button', {name: /remove column/i}));

        expect(onAddColumn).toHaveBeenCalledTimes(1);
        expect(onRemoveColumn).toHaveBeenCalledTimes(1);
    });

    it('stops at one column and at the six-column maximum', () => {
        const {unmount} = editing({layout: multiCol('My Layout', 1)});
        expect(screen.getByRole('button', {name: /remove column/i})).toBeDisabled();
        expect(screen.getByRole('button', {name: /add column/i})).toBeEnabled();
        unmount();

        editing({layout: multiCol('My Layout', 6)});
        expect(screen.getByRole('button', {name: /add column/i})).toBeDisabled();
        expect(screen.getByRole('button', {name: /remove column/i})).toBeEnabled();
    });

    it('leaves the mode from Done', () => {
        const onExitColumnEditMode = jest.fn();
        editing({onExitColumnEditMode});

        fireEvent.click(screen.getByRole('button', {name: /^done$/i}));
        expect(onExitColumnEditMode).toHaveBeenCalledTimes(1);
    });
});

describe('JobSearchShell resize persistence', () => {
    const resized = (name: string, first: string, second: string): ILayout => ({
        name,
        layout: {
            columns: [
                {id: 'col1', width: first, boxes: [{name: 'jobList', title: 'Live Job Data', visible: true}]},
                {id: 'col2', width: second, boxes: [{name: 'map', title: 'Map', visible: true}]},
            ],
        },
    });
    const multiCol = (name: string): ILayout => resized(name, '50%', '50%');
    const multiColBoxes = {
        jobList: {name: 'jobList', title: 'Live Job Data', visible: true},
        map: {name: 'map', title: 'Map', visible: true},
    };

    it.each(['Default', 'My Layout'])('renders a resize gutter between columns on the %s layout', (name) => {
        const {container} = renderShell({layout: multiCol(name), boxes: multiColBoxes});

        expect(container.querySelectorAll('[data-panel-resize-handle]')).toHaveLength(1);
    });

    it('ignores the layout emitted on mount so a fresh load persists nothing', () => {
        const onColumnSizes = jest.fn();
        renderShell({layout: multiCol('Default'), boxes: multiColBoxes, onColumnSizes});

        expect(onColumnSizes).not.toHaveBeenCalled();
    });

    it('persists a genuine resize once the group has settled', () => {
        const onColumnSizes = jest.fn();
        const {rerender} = renderShell({
            layout: multiCol('Default'),
            boxes: multiColBoxes,
            onColumnSizes,
        });

        // A drag re-lays-out the same (un-remounted) group with new sizes.
        rerender(
            <ThemeProvider theme={theme}>
                <JobSearchShell
                    {...baseProps}
                    layout={resized('Default', '70%', '30%')}
                    boxes={multiColBoxes}
                    onColumnSizes={onColumnSizes}
                />
            </ThemeProvider>,
        );

        expect(onColumnSizes).toHaveBeenCalledTimes(1);
        expect(onColumnSizes).toHaveBeenCalledWith([70, 30]);
    });
});
