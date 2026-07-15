/**
 * EventGroupDialog Component Tests
 */

import React from 'react';
import {render, screen} from '@testing-library/react';
import {ThemeProvider} from '@mui/material/styles';
import {EventGroupDialog, EventGroupDialogProps} from './EventGroupDialog';
import {EventGroupViewModel} from '../../../interfaces';
import {testTheme} from '../../../__testUtils__';

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

const renderDialog = (props: Partial<EventGroupDialogProps> = {}) =>
    render(
        <ThemeProvider theme={testTheme}>
            <EventGroupDialog
                open
                events={mockEvents}
                users={[]}
                onClose={jest.fn()}
                onSave={jest.fn()}
                onOpenAdminManager={jest.fn()}
                showToast={jest.fn()}
                timezone="America/New_York"
                {...props}
            />
        </ThemeProvider>
    );

describe('EventGroupDialog timezone display', () => {
    it('shows the abbreviated timezone in the Due Date header, not the raw IANA name', () => {
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
