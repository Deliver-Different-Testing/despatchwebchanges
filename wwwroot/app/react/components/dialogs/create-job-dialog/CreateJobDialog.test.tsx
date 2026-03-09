/**
 * CreateJobDialog Component Tests
 */

import React from 'react';
import {screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {CreateJobDialog, CreateJobDialogProps} from './CreateJobDialog';
import {createProps, renderWithAllProviders} from '../../../__testUtils__';

// Mock the hooks to avoid React Query dependencies
jest.mock('../../../hooks', () => ({
    useClientSearch: jest.fn(() => ({data: [], isFetching: false})),
    useCourierSearch: jest.fn(() => ({data: [], isFetching: false})),
    useAddressSearch: jest.fn(() => ({data: [], isFetching: false})),
    useVehicleSizes: jest.fn(() => ({
        data: [
            {id: 1, text: 'Car'},
            {id: 2, text: 'Van'},
        ],
    })),
    useSpeedList: jest.fn(() => ({
        data: [
            {id: 1, text: 'Standard'},
            {id: 2, text: 'Express'},
        ],
    })),
}));

// Mock the API services (for submit flow)
jest.mock('../../../services/addressApi', () => ({
    addressApi: {
        getLocationDetailsById: jest.fn(),
    },
}));

jest.mock('../../../services/jobApi', () => ({
    jobApi: {
        quickCreateJob: jest.fn(),
        allocateJobToCourier: jest.fn(),
    },
}));

// Mock date utils — dayjs needs tz plugin to work in the component
jest.mock('../../../utils/dateUtils', () => {
    const actualDayjs = jest.requireActual('dayjs');
    const utc = jest.requireActual('dayjs/plugin/utc');
    const timezone = jest.requireActual('dayjs/plugin/timezone');
    actualDayjs.extend(utc);
    actualDayjs.extend(timezone);
    return {
        formatDateForApi: jest.fn(() => '2026-03-05T00:00:00-05:00'),
        getIanaTimezone: jest.fn(() => 'America/New_York'),
        dayjs: actualDayjs,
    };
});

const defaultProps: CreateJobDialogProps = {
    open: true,
    isUsTenant: true,
    onClose: jest.fn(),
    onSubmit: jest.fn(),
    showToast: jest.fn(),
};

const createMockProps = (overrides?: Partial<CreateJobDialogProps>) =>
    createProps(defaultProps, overrides);

describe('CreateJobDialog', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('Rendering', () => {
        it('renders dialog when open is true', () => {
            const props = createMockProps();
            renderWithAllProviders(<CreateJobDialog {...props} />);

            expect(screen.getByRole('dialog')).toBeInTheDocument();
        });

        it('does not render dialog when open is false', () => {
            const props = createMockProps({open: false});
            renderWithAllProviders(<CreateJobDialog {...props} />);

            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        });

        it('displays "Add New Job" title in header', () => {
            const props = createMockProps();
            renderWithAllProviders(<CreateJobDialog {...props} />);

            expect(screen.getByText('Add New Job')).toBeInTheDocument();
        });

        it('displays all section titles', () => {
            const props = createMockProps();
            renderWithAllProviders(<CreateJobDialog {...props} />);

            expect(screen.getByText('Job Details')).toBeInTheDocument();
            expect(screen.getByText('Addresses')).toBeInTheDocument();
            expect(screen.getByText('Contacts')).toBeInTheDocument();
            expect(screen.getByText('Vehicle & Speed')).toBeInTheDocument();
            expect(screen.getByText('References')).toBeInTheDocument();
            expect(screen.getByText('Notes')).toBeInTheDocument();
        });

        it('displays Cancel and Create Job buttons', () => {
            const props = createMockProps();
            renderWithAllProviders(<CreateJobDialog {...props} />);

            expect(screen.getByRole('button', {name: /cancel/i})).toBeInTheDocument();
            expect(screen.getByRole('button', {name: /create job/i})).toBeInTheDocument();
        });
    });

    describe('Form Fields', () => {
        it('renders Client autocomplete field', () => {
            const props = createMockProps();
            renderWithAllProviders(<CreateJobDialog {...props} />);

            expect(screen.getByLabelText(/client/i)).toBeInTheDocument();
        });

        it('renders Charge Amount field', () => {
            const props = createMockProps();
            renderWithAllProviders(<CreateJobDialog {...props} />);

            expect(screen.getByLabelText(/charge amount/i)).toBeInTheDocument();
        });

        it('renders Courier autocomplete field', () => {
            const props = createMockProps();
            renderWithAllProviders(<CreateJobDialog {...props} />);

            expect(screen.getByLabelText(/courier/i)).toBeInTheDocument();
        });

        it('renders Job Date field', () => {
            const props = createMockProps();
            renderWithAllProviders(<CreateJobDialog {...props} />);

            expect(screen.getByLabelText(/job date/i)).toBeInTheDocument();
        });

        it('renders From Address and To Address fields', () => {
            const props = createMockProps();
            renderWithAllProviders(<CreateJobDialog {...props} />);

            expect(screen.getByLabelText(/from address/i)).toBeInTheDocument();
            expect(screen.getByLabelText(/to address/i)).toBeInTheDocument();
        });

        it('renders contact fields', () => {
            const props = createMockProps();
            renderWithAllProviders(<CreateJobDialog {...props} />);

            expect(screen.getByLabelText(/pickup contact/i)).toBeInTheDocument();
            expect(screen.getByLabelText(/delivery contact/i)).toBeInTheDocument();
            expect(screen.getByLabelText(/pod name/i)).toBeInTheDocument();
        });

        it('renders Vehicle and Speed autocomplete fields', () => {
            const props = createMockProps();
            renderWithAllProviders(<CreateJobDialog {...props} />);

            expect(screen.getByLabelText(/vehicle/i)).toBeInTheDocument();
            expect(screen.getByLabelText(/speed/i)).toBeInTheDocument();
        });

        it('renders reference fields', () => {
            const props = createMockProps();
            renderWithAllProviders(<CreateJobDialog {...props} />);

            expect(screen.getByLabelText(/reference a/i)).toBeInTheDocument();
            expect(screen.getByLabelText(/reference b/i)).toBeInTheDocument();
        });

        it('renders notes fields', () => {
            const props = createMockProps();
            renderWithAllProviders(<CreateJobDialog {...props} />);

            expect(screen.getByLabelText(/job notes/i)).toBeInTheDocument();
            expect(screen.getByLabelText(/pickup notes/i)).toBeInTheDocument();
            expect(screen.getByLabelText(/delivery notes/i)).toBeInTheDocument();
        });
    });

    describe('Close Functionality', () => {
        it('calls onClose when close icon is clicked', async () => {
            const user = userEvent.setup();
            const onClose = jest.fn();
            const props = createMockProps({onClose});
            renderWithAllProviders(<CreateJobDialog {...props} />);

            const closeIcon = screen.getByTestId('CloseIcon');
            const closeButton = closeIcon.closest('button');
            await user.click(closeButton!);

            expect(onClose).toHaveBeenCalled();
        });

        it('calls onClose when Cancel button is clicked', async () => {
            const user = userEvent.setup();
            const onClose = jest.fn();
            const props = createMockProps({onClose});
            renderWithAllProviders(<CreateJobDialog {...props} />);

            await user.click(screen.getByRole('button', {name: /cancel/i}));

            expect(onClose).toHaveBeenCalled();
        });
    });

    describe('Validation', () => {
        it('shows validation toast when submitting without client', async () => {
            const user = userEvent.setup();
            const showToast = jest.fn();
            const props = createMockProps({showToast});
            renderWithAllProviders(<CreateJobDialog {...props} />);

            await user.click(screen.getByRole('button', {name: /create job/i}));

            expect(showToast).toHaveBeenCalledWith('Please select a client.', 'warning');
        });

        it('shows client required error after submit attempt', async () => {
            const user = userEvent.setup();
            const props = createMockProps();
            renderWithAllProviders(<CreateJobDialog {...props} />);

            await user.click(screen.getByRole('button', {name: /create job/i}));

            expect(await screen.findByText('Client is required.')).toBeInTheDocument();
        });

        it('shows charge validation error after submit attempt', async () => {
            const user = userEvent.setup();
            const props = createMockProps();
            renderWithAllProviders(<CreateJobDialog {...props} />);

            await user.click(screen.getByRole('button', {name: /create job/i}));

            expect(await screen.findByText('Charge must be greater than 0.')).toBeInTheDocument();
        });

        it('shows address required errors after submit attempt', async () => {
            const user = userEvent.setup();
            const props = createMockProps();
            renderWithAllProviders(<CreateJobDialog {...props} />);

            await user.click(screen.getByRole('button', {name: /create job/i}));

            await waitFor(() => {
                expect(screen.getByText('Pickup address is required.')).toBeInTheDocument();
                expect(screen.getByText('Delivery address is required.')).toBeInTheDocument();
            });
        });

        it('shows contact required errors after submit attempt', async () => {
            const user = userEvent.setup();
            const props = createMockProps();
            renderWithAllProviders(<CreateJobDialog {...props} />);

            await user.click(screen.getByRole('button', {name: /create job/i}));

            await waitFor(() => {
                expect(screen.getByText('Pickup contact is required.')).toBeInTheDocument();
                expect(screen.getByText('Delivery contact is required.')).toBeInTheDocument();
                expect(screen.getByText('POD name is required.')).toBeInTheDocument();
            });
        });

        it('shows vehicle and speed required errors after submit attempt', async () => {
            const user = userEvent.setup();
            const props = createMockProps();
            renderWithAllProviders(<CreateJobDialog {...props} />);

            await user.click(screen.getByRole('button', {name: /create job/i}));

            await waitFor(() => {
                expect(screen.getByText('Vehicle is required.')).toBeInTheDocument();
                expect(screen.getByText('Speed is required.')).toBeInTheDocument();
            });
        });

        it('does not call onSubmit when form is invalid', async () => {
            const user = userEvent.setup();
            const onSubmit = jest.fn();
            const props = createMockProps({onSubmit});
            renderWithAllProviders(<CreateJobDialog {...props} />);

            await user.click(screen.getByRole('button', {name: /create job/i}));

            expect(onSubmit).not.toHaveBeenCalled();
        });
    });

    describe('Text Input', () => {
        it('allows typing in charge amount', async () => {
            const user = userEvent.setup();
            const props = createMockProps();
            renderWithAllProviders(<CreateJobDialog {...props} />);

            const chargeInput = screen.getByLabelText(/charge amount/i);
            await user.type(chargeInput, '25.50');

            expect(chargeInput).toHaveValue(25.5);
        });

        it('allows typing in pickup contact', async () => {
            const user = userEvent.setup();
            const props = createMockProps();
            renderWithAllProviders(<CreateJobDialog {...props} />);

            const input = screen.getByLabelText(/pickup contact/i);
            await user.type(input, 'John Smith');

            expect(input).toHaveValue('John Smith');
        }, 30000);

        it('allows typing in delivery contact', async () => {
            const user = userEvent.setup();
            const props = createMockProps();
            renderWithAllProviders(<CreateJobDialog {...props} />);

            const input = screen.getByLabelText(/delivery contact/i);
            await user.type(input, 'Jane Doe');

            expect(input).toHaveValue('Jane Doe');
        }, 30000);

        it('allows typing in POD name', async () => {
            const user = userEvent.setup();
            const props = createMockProps();
            renderWithAllProviders(<CreateJobDialog {...props} />);

            const input = screen.getByLabelText(/pod name/i);
            await user.type(input, 'Reception');

            expect(input).toHaveValue('Reception');
        }, 30000);

        it('allows typing in reference fields', async () => {
            const user = userEvent.setup();
            const props = createMockProps();
            renderWithAllProviders(<CreateJobDialog {...props} />);

            const refA = screen.getByLabelText(/reference a/i);
            const refB = screen.getByLabelText(/reference b/i);
            await user.type(refA, 'REF-001');
            await user.type(refB, 'PO-123');

            expect(refA).toHaveValue('REF-001');
            expect(refB).toHaveValue('PO-123');
        });

        it('allows typing in notes fields', async () => {
            const user = userEvent.setup();
            const props = createMockProps();
            renderWithAllProviders(<CreateJobDialog {...props} />);

            const jobNotes = screen.getByLabelText(/job notes/i);
            await user.type(jobNotes, 'Handle with care');

            expect(jobNotes).toHaveValue('Handle with care');
        }, 30000);
    });

    describe('State Reset', () => {
        it('resets form fields when dialog is reopened', async () => {
            const user = userEvent.setup();
            const props = createMockProps();
            const {rerender} = renderWithAllProviders(<CreateJobDialog {...props} />);

            // Type into a field
            const chargeInput = screen.getByLabelText(/charge amount/i);
            await user.type(chargeInput, '50');
            expect(chargeInput).toHaveValue(50);

            // Close and reopen
            rerender(<CreateJobDialog {...{...props, open: false}} />);
            rerender(<CreateJobDialog {...{...props, open: true}} />);

            // Field should be reset
            const resetChargeInput = screen.getByLabelText(/charge amount/i);
            expect(resetChargeInput).toHaveValue(null);
        });
    });

    describe('Reference field max length', () => {
        it('reference A has maxLength of 20', () => {
            const props = createMockProps();
            renderWithAllProviders(<CreateJobDialog {...props} />);

            const refA = screen.getByLabelText(/reference a/i);
            expect(refA).toHaveAttribute('maxlength', '20');
        });

        it('reference B has maxLength of 20', () => {
            const props = createMockProps();
            renderWithAllProviders(<CreateJobDialog {...props} />);

            const refB = screen.getByLabelText(/reference b/i);
            expect(refB).toHaveAttribute('maxlength', '20');
        });
    });

    describe('Notes field max length', () => {
        it('notes fields have maxLength of 150', () => {
            const props = createMockProps();
            renderWithAllProviders(<CreateJobDialog {...props} />);

            const jobNotes = screen.getByLabelText(/job notes/i);
            const pickupNotes = screen.getByLabelText(/pickup notes/i);
            const deliveryNotes = screen.getByLabelText(/delivery notes/i);

            expect(jobNotes).toHaveAttribute('maxlength', '150');
            expect(pickupNotes).toHaveAttribute('maxlength', '150');
            expect(deliveryNotes).toHaveAttribute('maxlength', '150');
        });
    });
});
