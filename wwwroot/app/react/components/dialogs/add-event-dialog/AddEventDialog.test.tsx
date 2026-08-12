/**
 * AddEventDialog Component Tests
 * Optimised: read-only tests consolidated to reduce render count.
 */

import React from 'react';
import {screen, waitFor} from '@testing-library/react';
import {fireEvent} from '@testing-library/react';
import {AddEventDialog, AddEventJob, EventType} from './AddEventDialog';
import {renderWithMantine} from '../../../__testUtils__';

const mockJob: AddEventJob = {
    id: 123,
    jobNo: 'JOB-001',
    client: 'Test Client',
    clientId: 456,
};

const mockEventTypes: EventType[] = [
    { id: 66, text: 'Other' },
    { id: 7, text: 'Compliment' },
    { id: 92, text: 'Complaint' },
    { id: 48, text: 'Closed' },
    { id: 6, text: 'Cancel Job' },
];

const createMockProps = (overrides = {}) => ({
    open: true,
    job: mockJob,
    onClose: jest.fn(),
    onSubmit: jest.fn().mockResolvedValue(undefined),
    onLoadEventTypes: jest.fn().mockResolvedValue(mockEventTypes),
    showToast: jest.fn(),
    timezone: 'Pacific/Auckland',
    ...overrides,
});

/** Never resolves, so the loading state is guaranteed for as long as the test needs it. */
const neverResolves = () => jest.fn().mockImplementation(() => new Promise(() => {}));

describe('AddEventDialog', () => {
    describe('Rendering', () => {
        it('renders dialog with title, job number, client field, and action buttons when open', async () => {
            const props = createMockProps();
            renderWithMantine(<AddEventDialog {...props} />);

            expect(await screen.findByRole('dialog')).toBeInTheDocument();
            expect(screen.getByText('Add Task')).toBeInTheDocument();
            expect(await screen.findByDisplayValue('JOB-001')).toBeInTheDocument();
            expect(screen.getByDisplayValue('Test Client')).toBeInTheDocument();
            expect(screen.getByRole('button', {name: /cancel/i})).toBeInTheDocument();
            expect(screen.getByRole('button', {name: /save/i})).toBeInTheDocument();
        });

        it('does not render dialog when open is false', () => {
            const props = createMockProps({ open: false });
            renderWithMantine(<AddEventDialog {...props} />);

            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        });

        it('returns null when job is null', () => {
            const props = createMockProps({ job: null });
            renderWithMantine(<AddEventDialog {...props} />);

            // The provider injects its own <style> nodes, so absence is asserted on the
            // dialog itself rather than on an empty container.
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        });
    });

    describe('Loading Event Types', () => {
        // Re-rendered *without* the provider wrapper: re-wrapping remounts the subtree,
        // which would re-run the open effect.
        const openDialog = (props: ReturnType<typeof createMockProps>) => {
            const { rerender } = renderWithMantine(<AddEventDialog {...props} />);
            rerender(<AddEventDialog {...props} open={true} />);
        };

        it('shows loading state while fetching event types after dialog opens', () => {
            openDialog(createMockProps({ open: false, onLoadEventTypes: neverResolves() }));

            expect(screen.getByLabelText('Loading task types')).toBeInTheDocument();
        });

        it('calls onLoadEventTypes when dialog opens', async () => {
            const props = createMockProps({ open: false });
            openDialog(props);

            await waitFor(() => {
                expect(props.onLoadEventTypes).toHaveBeenCalled();
            });
        });

        it('renders task type select after loading', async () => {
            const props = createMockProps({ open: false });
            openDialog(props);

            expect(await screen.findByRole('combobox', {name: /Task Type/})).toBeInTheDocument();
        });
    });

    describe('Form Validation', () => {
        it('disables save button while loading', () => {
            const props = createMockProps({ open: false, onLoadEventTypes: neverResolves() });
            const { rerender } = renderWithMantine(<AddEventDialog {...props} />);
            rerender(<AddEventDialog {...props} open={true} />);

            expect(screen.getByRole('button', { name: /save/i })).toBeDisabled();
        });
    });

    describe('Cancel and Close', () => {
        it('calls onClose when Cancel button is clicked', async () => {
            const props = createMockProps();
            renderWithMantine(<AddEventDialog {...props} />);

            fireEvent.click(await screen.findByRole('button', {name: /cancel/i}));

            expect(props.onClose).toHaveBeenCalled();
        });
    });

    describe('Disabled Fields', () => {
        it('has job number and client fields disabled', async () => {
            const props = createMockProps();
            renderWithMantine(<AddEventDialog {...props} />);

            await waitFor(() => {
                expect(screen.getByDisplayValue('JOB-001')).toBeDisabled();
                expect(screen.getByDisplayValue('Test Client')).toBeDisabled();
            });
        });
    });
});
