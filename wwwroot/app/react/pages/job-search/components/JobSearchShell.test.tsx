import React from 'react';
import {render, screen} from '@testing-library/react';
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
