/**
 * EventGroupDialog Component Tests
 */

import React from 'react';
import {screen} from '@testing-library/react';
import {EventGroupDialog, EventGroupDialogProps} from './EventGroupDialog';
import {EventGroupViewModel} from '../../../types';
import {renderWithMantine} from '../../../test/utils';
import {setupUser} from '../../../test/utils/setupUser';

const mockEvents: EventGroupViewModel[] = [
    {
        eventTypeGroupTypeGroupId: 1,
        eventType: {id: 10, text: 'Collection'},
        group: 'Group A',
        date: new Date('2026-07-15T10:00:00Z'),
        sequence: 1,
        dueTime: new Date('2026-07-15T12:00:00Z'),
        notes: '',
        active: true,
    },
];

const twoEvents: EventGroupViewModel[] = [
    mockEvents[0],
    {...mockEvents[0], eventTypeGroupTypeGroupId: 2, eventType: {id: 2, text: 'Late Delivery'}, sequence: 2},
];

const baseProps: EventGroupDialogProps = {
    open: true,
    events: mockEvents,
    users: [],
    onClose: vi.fn(),
    onSave: vi.fn(),
    onOpenAdminManager: vi.fn(),
    timezone: 'America/New_York',
};

const renderDialog = (props: Partial<EventGroupDialogProps> = {}) =>
    renderWithMantine(<EventGroupDialog {...baseProps} {...props}/>);

describe('EventGroupDialog timezone display', () => {
    it('shows the abbreviated timezone in the Due date header, not the raw IANA name', () => {
        renderDialog();

        expect(screen.getByText(/\(E[SD]T\)/)).toBeInTheDocument();
        expect(screen.queryByText(/America\/New_York/)).not.toBeInTheDocument();
    });

    it('shows no timezone suffix for New Zealand tenants', () => {
        renderDialog({timezone: 'Pacific/Auckland'});

        expect(screen.queryByText(/Pacific\/Auckland/)).not.toBeInTheDocument();
        expect(screen.queryByText(/\(NZ[SD]T\)/)).not.toBeInTheDocument();
    });
});

describe('EventGroupDialog layout', () => {
    it('names the group and the job, and shows each task once without a repeated group column', () => {
        renderDialog({events: twoEvents, jobNumber: 'E50CRT'});

        expect(screen.getByRole('heading', {name: 'Add tasks from "Group A"'})).toBeInTheDocument();
        expect(screen.getByText('Job E50CRT')).toBeInTheDocument();
        expect(screen.queryByRole('columnheader', {name: /group/i})).not.toBeInTheDocument();
        expect(screen.getByText('Late Delivery')).toBeInTheDocument();
    });
});

describe('EventGroupDialog selection', () => {
    it('select-all ticks and unticks every task, and is indeterminate when only some are ticked', async () => {
        const user = setupUser();
        renderDialog({events: twoEvents});
        const selectAll = screen.getByRole('checkbox', {name: 'Include all tasks'});

        await user.click(screen.getByRole('checkbox', {name: 'Include Late Delivery'}));
        expect(selectAll).toHaveAttribute('data-indeterminate', 'true');

        await user.click(selectAll);
        expect(screen.getByRole('checkbox', {name: 'Include Collection'})).toBeChecked();
        expect(screen.getByRole('checkbox', {name: 'Include Late Delivery'})).toBeChecked();

        await user.click(selectAll);
        expect(screen.getByRole('checkbox', {name: 'Include Collection'})).not.toBeChecked();
        expect(screen.getByRole('checkbox', {name: 'Include Late Delivery'})).not.toBeChecked();
    });

    it('disables an unticked task\'s due date and assignee and counts only ticked tasks on the button', async () => {
        const user = setupUser();
        renderDialog({events: twoEvents});
        expect(screen.getByRole('button', {name: 'Add 2 tasks'})).toBeInTheDocument();

        await user.click(screen.getByRole('checkbox', {name: 'Include Late Delivery'}));

        expect(screen.getByRole('button', {name: 'Due date for Late Delivery'})).toBeDisabled();
        expect(screen.getByRole('combobox', {name: 'Assign Late Delivery to'})).toBeDisabled();
        expect(screen.getByRole('button', {name: 'Due date for Collection'})).toBeEnabled();
        expect(screen.getByRole('button', {name: 'Add 1 task'})).toBeInTheDocument();
    });

    it('explains inline, without saving, when nothing is ticked', async () => {
        const onSave = vi.fn();
        const user = setupUser();
        renderDialog({onSave});

        await user.click(screen.getByRole('checkbox', {name: 'Include Collection'}));
        await user.click(screen.getByRole('button', {name: 'Add 0 tasks'}));

        expect(screen.getByText('Select at least one task to add.')).toBeInTheDocument();
        expect(onSave).not.toHaveBeenCalled();

        await user.click(screen.getByRole('checkbox', {name: 'Include Collection'}));
        expect(screen.queryByText('Select at least one task to add.')).not.toBeInTheDocument();
    });
});

describe('EventGroupDialog save', () => {
    it('labels the picked due time with the tenant zone, not the browser zone', async () => {
        const onSave = vi.fn().mockResolvedValue(undefined);
        const pickedAtTwo = new Date(2026, 6, 15, 14, 0, 0);
        const user = setupUser();
        renderDialog({onSave, events: [{...mockEvents[0], dueTime: pickedAtTwo}]});

        await user.click(screen.getByRole('button', {name: 'Add 1 task'}));

        expect(onSave.mock.calls[0][0][0].dueTime).toBe('2026-07-15T14:00:00-04:00');
    });

    it('opens ready to save again after a successful save, since the dialog host keeps it mounted', async () => {
        const onSave = vi.fn().mockResolvedValue(undefined);
        const user = setupUser();
        const {rerender} = renderDialog({onSave});

        await user.click(screen.getByRole('button', {name: 'Add 1 task'}));
        rerender(<EventGroupDialog {...baseProps} onSave={onSave} open={false}/>);
        rerender(<EventGroupDialog {...baseProps} onSave={onSave} open/>);

        expect(screen.getByRole('button', {name: 'Add 1 task'})).toBeEnabled();
        expect(screen.getByRole('button', {name: 'Cancel'})).toBeEnabled();
        expect(screen.getByRole('button', {name: 'Close dialog'})).toBeEnabled();
    });
});
