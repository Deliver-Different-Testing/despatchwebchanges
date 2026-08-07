import React from 'react';
import {render, screen} from '@testing-library/react';
import {ThemeProvider, createTheme} from '@mui/material/styles';
import {setupUser} from '../../../__testUtils__/setupUser';
import {ViewsRail} from './ViewsRail';
import type {DfrntPageViewModel} from '../../../../interfaces/dfrnt-page-view-model.interface';

const userEvent = setupUser();

const view = (id: number, name: string): DfrntPageViewModel => ({
    id,
    name,
    centerLatitude: -36.8,
    centerLongitude: 174.7,
    selected: false,
});

const views = [view(11, 'Auckland'), view(22, 'North Shore'), view(33, 'Airport')];

function renderRail(props: Partial<React.ComponentProps<typeof ViewsRail>> = {}) {
    const onToggle = jest.fn();
    const onClearAll = jest.fn();
    render(
        <ThemeProvider theme={createTheme()}>
            <ViewsRail
                views={views}
                selectedIds={[11]}
                isUsCustomer={false}
                onToggle={onToggle}
                onClearAll={onClearAll}
                {...props}
            />
        </ThemeProvider>,
    );
    return {onToggle, onClearAll};
}

describe('ViewsRail', () => {
    it('renders a pill per view, marks the selected ones, and toggles on click', async () => {
        const {onToggle} = renderRail();

        const pills = screen.getAllByRole('button', {pressed: false});
        expect(screen.getByRole('group', {name: 'Job list views'})).toBeInTheDocument();
        expect(pills.map(p => p.textContent)).toEqual(['North Shore', 'Airport']);
        expect(screen.getByRole('button', {name: 'Auckland', pressed: true})).toBeInTheDocument();

        await userEvent.click(screen.getByRole('button', {name: 'Airport'}));
        expect(onToggle).toHaveBeenCalledWith(33);
    });

    it('offers Clear only while something is selected, and clears on click', async () => {
        const {onClearAll} = renderRail();

        await userEvent.click(screen.getByRole('button', {name: 'Clear'}));
        expect(onClearAll).toHaveBeenCalledTimes(1);
    });

    it('replaces Clear with a tenant-specific hint when nothing is selected', () => {
        const {rerender} = render(
            <ThemeProvider theme={createTheme()}>
                <ViewsRail views={views} selectedIds={[]} isUsCustomer={false} onToggle={jest.fn()} onClearAll={jest.fn()}/>
            </ThemeProvider>,
        );

        expect(screen.queryByRole('button', {name: 'Clear'})).not.toBeInTheDocument();
        expect(screen.getByText('Select a view to load jobs.')).toBeInTheDocument();

        rerender(
            <ThemeProvider theme={createTheme()}>
                <ViewsRail views={views} selectedIds={[]} isUsCustomer onToggle={jest.fn()} onClearAll={jest.fn()}/>
            </ThemeProvider>,
        );
        expect(screen.getByText('No view selected — showing all jobs.')).toBeInTheDocument();
    });

    it('shows placeholder pills while the views load', () => {
        renderRail({views: [], selectedIds: [], loading: true});

        expect(screen.getByTestId('views-rail-loading')).toBeInTheDocument();
        expect(screen.queryByRole('group', {name: 'Job list views'})).not.toBeInTheDocument();
    });

    it('renders nothing when the tenant has no views configured', () => {
        const {container} = render(
            <ThemeProvider theme={createTheme()}>
                <ViewsRail views={[]} selectedIds={[]} isUsCustomer={false} onToggle={jest.fn()} onClearAll={jest.fn()}/>
            </ThemeProvider>,
        );

        expect(container).toBeEmptyDOMElement();
    });
});
