/**
 * AddEventDialog Component Tests
 */

import React from 'react';
import {render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {createTheme, ThemeProvider} from '@mui/material/styles';
import {LocalizationProvider} from '@mui/x-date-pickers/LocalizationProvider';
import {AdapterDayjs} from '@mui/x-date-pickers/AdapterDayjs';
import {AddEventDialog, AddEventJob, EventType} from './AddEventDialog';

const theme = createTheme();

const renderWithTheme = (ui: React.ReactElement) => {
    return render(
        <ThemeProvider theme={theme}>
            <LocalizationProvider dateAdapter={AdapterDayjs}>
                {ui}
            </LocalizationProvider>
        </ThemeProvider>
    );
};

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

describe('AddEventDialog', () => {
    describe('Rendering', () => {
        it('renders dialog when open is true', async () => {
            const props = createMockProps();
            renderWithTheme(<AddEventDialog {...props} />);

            expect(await screen.findByRole('dialog')).toBeInTheDocument();
            expect(screen.getByText('Add Task')).toBeInTheDocument();
        });

        it('does not render dialog when open is false', () => {
            const props = createMockProps({ open: false });
            renderWithTheme(<AddEventDialog {...props} />);

            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        });

        it('returns null when job is null', () => {
            const props = createMockProps({ job: null });
            const { container } = renderWithTheme(<AddEventDialog {...props} />);

            expect(container.firstChild).toBeNull();
        });

        it('displays job number field', async () => {
            const props = createMockProps();
            renderWithTheme(<AddEventDialog {...props} />);

            expect(await screen.findByDisplayValue('JOB-001')).toBeInTheDocument();
        });

        it('displays client field', async () => {
            const props = createMockProps();
            renderWithTheme(<AddEventDialog {...props} />);

            expect(await screen.findByDisplayValue('Test Client')).toBeInTheDocument();
        });

        it('displays Cancel and Save buttons', async () => {
            const props = createMockProps();
            renderWithTheme(<AddEventDialog {...props} />);

            expect(await screen.findByRole('button', {name: /cancel/i})).toBeInTheDocument();
            expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
        });
    });

    describe('Loading Event Types', () => {
        it('shows loading state while fetching event types after dialog opens', async () => {
            const props = createMockProps({
                open: false,
                onLoadEventTypes: jest.fn().mockImplementation(
                    () => new Promise(resolve => setTimeout(() => resolve(mockEventTypes), 100))
                ),
            });
            const { rerender } = renderWithTheme(<AddEventDialog {...props} />);

            // Open the dialog
            rerender(
                <ThemeProvider theme={theme}>
                    <LocalizationProvider dateAdapter={AdapterDayjs}>
                        <AddEventDialog {...props} open={true} />
                    </LocalizationProvider>
                </ThemeProvider>
            );

            expect(screen.getByRole('progressbar')).toBeInTheDocument();
        });

        it('calls onLoadEventTypes when dialog opens', async () => {
            const props = createMockProps({ open: false });
            const { rerender } = renderWithTheme(<AddEventDialog {...props} />);

            // Open the dialog
            rerender(
                <ThemeProvider theme={theme}>
                    <LocalizationProvider dateAdapter={AdapterDayjs}>
                        <AddEventDialog {...props} open={true} />
                    </LocalizationProvider>
                </ThemeProvider>
            );

            await waitFor(() => {
                expect(props.onLoadEventTypes).toHaveBeenCalled();
            });
        });
    });

    describe('Form Validation', () => {
        it('disables save button while loading', async () => {
            const props = createMockProps({
                open: false,
                onLoadEventTypes: jest.fn().mockImplementation(
                    () => new Promise(resolve => setTimeout(() => resolve(mockEventTypes), 100))
                ),
            });
            const { rerender } = renderWithTheme(<AddEventDialog {...props} />);

            // Open the dialog
            rerender(
                <ThemeProvider theme={theme}>
                    <LocalizationProvider dateAdapter={AdapterDayjs}>
                        <AddEventDialog {...props} open={true} />
                    </LocalizationProvider>
                </ThemeProvider>
            );

            const saveButton = screen.getByRole('button', { name: /save/i });
            expect(saveButton).toBeDisabled();
        });
    });

    describe('Cancel and Close', () => {
        it('calls onClose when Cancel button is clicked', async () => {
            const user = userEvent.setup();
            const props = createMockProps();
            renderWithTheme(<AddEventDialog {...props} />);

            expect(await screen.findByRole('button', {name: /cancel/i})).toBeInTheDocument();

            await user.click(screen.getByRole('button', { name: /cancel/i }));

            expect(props.onClose).toHaveBeenCalled();
        });
    });

    describe('Disabled Fields', () => {
        it('has job number field disabled', async () => {
            const props = createMockProps();
            renderWithTheme(<AddEventDialog {...props} />);

            await waitFor(() => {
                const jobNoField = screen.getByDisplayValue('JOB-001');
                expect(jobNoField).toBeDisabled();
            });
        });

        it('has client field disabled', async () => {
            const props = createMockProps();
            renderWithTheme(<AddEventDialog {...props} />);

            await waitFor(() => {
                const clientField = screen.getByDisplayValue('Test Client');
                expect(clientField).toBeDisabled();
            });
        });
    });

    describe('Event Type Selection', () => {
        it('renders task type select after loading', async () => {
            const props = createMockProps({ open: false });
            const { rerender } = renderWithTheme(<AddEventDialog {...props} />);

            // Open the dialog
            rerender(
                <ThemeProvider theme={theme}>
                    <LocalizationProvider dateAdapter={AdapterDayjs}>
                        <AddEventDialog {...props} open={true} />
                    </LocalizationProvider>
                </ThemeProvider>
            );

            expect(await screen.findByRole('combobox')).toBeInTheDocument();
        });
    });
});
