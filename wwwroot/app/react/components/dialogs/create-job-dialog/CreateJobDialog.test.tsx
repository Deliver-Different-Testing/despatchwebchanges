/** @jest-environment jest-environment-jsdom */
/**
 * CreateJobDialog Component Tests
 */

import React from 'react';
import {fireEvent, screen, waitFor} from '@testing-library/react';
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
    describe('Rendering and Form Fields', () => {
        it('renders dialog with all sections, fields, and action buttons when open', () => {
            const props = createMockProps();
            renderWithAllProviders(<CreateJobDialog {...props} />);

            // Dialog and title
            expect(screen.getByRole('dialog')).toBeInTheDocument();
            expect(screen.getByText('Add New Job')).toBeInTheDocument();

            // Section titles
            expect(screen.getByText('Job Details')).toBeInTheDocument();
            expect(screen.getByText('Addresses')).toBeInTheDocument();
            expect(screen.getByText('Contacts')).toBeInTheDocument();
            expect(screen.getByText('Vehicle & Speed')).toBeInTheDocument();
            expect(screen.getByText('References')).toBeInTheDocument();
            expect(screen.getByText('Notes')).toBeInTheDocument();

            // Action buttons
            expect(screen.getByRole('button', {name: /cancel/i})).toBeInTheDocument();
            expect(screen.getByRole('button', {name: /create job/i})).toBeInTheDocument();

            // Form fields
            expect(screen.getByLabelText(/client/i)).toBeInTheDocument();
            expect(screen.getByLabelText(/charge amount/i)).toBeInTheDocument();
            expect(screen.getByLabelText(/courier/i)).toBeInTheDocument();
            expect(screen.getByLabelText(/job date/i)).toBeInTheDocument();
            expect(screen.getByLabelText(/from address/i)).toBeInTheDocument();
            expect(screen.getByLabelText(/to address/i)).toBeInTheDocument();
            expect(screen.getByLabelText(/pickup contact/i)).toBeInTheDocument();
            expect(screen.getByLabelText(/delivery contact/i)).toBeInTheDocument();
            expect(screen.getByLabelText(/pod name/i)).toBeInTheDocument();
            expect(screen.getByLabelText(/vehicle/i)).toBeInTheDocument();
            expect(screen.getByLabelText(/speed/i)).toBeInTheDocument();
            expect(screen.getByLabelText(/reference a/i)).toBeInTheDocument();
            expect(screen.getByLabelText(/reference b/i)).toBeInTheDocument();
            expect(screen.getByLabelText(/job notes/i)).toBeInTheDocument();
            expect(screen.getByLabelText(/pickup notes/i)).toBeInTheDocument();
            expect(screen.getByLabelText(/delivery notes/i)).toBeInTheDocument();
        });

        it('does not render dialog when open is false', () => {
            const props = createMockProps({open: false});
            renderWithAllProviders(<CreateJobDialog {...props} />);

            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        });
    });

    describe('Close Functionality', () => {
        it('calls onClose via close icon and cancel button', async () => {
            const user = userEvent.setup();
            const onClose = jest.fn();
            const props = createMockProps({onClose});
            renderWithAllProviders(<CreateJobDialog {...props} />);

            // Close icon
            const closeIcon = screen.getByTestId('CloseIcon');
            await user.click(closeIcon.closest('button')!);
            expect(onClose).toHaveBeenCalledTimes(1);

            // Cancel button
            await user.click(screen.getByRole('button', {name: /cancel/i}));
            expect(onClose).toHaveBeenCalledTimes(2);
        });
    });

    describe('Validation', () => {
        it('shows all validation errors, toast, and blocks submit on empty form', async () => {
            const user = userEvent.setup();
            const showToast = jest.fn();
            const onSubmit = jest.fn();
            const props = createMockProps({showToast, onSubmit});
            renderWithAllProviders(<CreateJobDialog {...props} />);

            await user.click(screen.getByRole('button', {name: /create job/i}));

            // Toast
            expect(showToast).toHaveBeenCalledWith('Please select a client.', 'warning');

            // All validation errors
            await waitFor(() => {
                expect(screen.getByText('Client is required.')).toBeInTheDocument();
                expect(screen.getByText('Charge must be greater than 0.')).toBeInTheDocument();
                expect(screen.getByText('Pickup address is required.')).toBeInTheDocument();
                expect(screen.getByText('Delivery address is required.')).toBeInTheDocument();
                expect(screen.getByText('Pickup contact is required.')).toBeInTheDocument();
                expect(screen.getByText('Delivery contact is required.')).toBeInTheDocument();
                expect(screen.getByText('POD name is required.')).toBeInTheDocument();
                expect(screen.getByText('Vehicle is required.')).toBeInTheDocument();
                expect(screen.getByText('Speed is required.')).toBeInTheDocument();
            });

            // onSubmit not called
            expect(onSubmit).not.toHaveBeenCalled();
        });
    });

    describe('Text Input', () => {
        it('allows typing in all form fields', () => {
            const props = createMockProps();
            renderWithAllProviders(<CreateJobDialog {...props} />);

            const chargeInput = screen.getByLabelText(/charge amount/i);
            fireEvent.change(chargeInput, {target: {value: '25.50'}});
            expect(chargeInput).toHaveValue(25.5);

            const pickupContact = screen.getByLabelText(/pickup contact/i);
            fireEvent.change(pickupContact, {target: {value: 'John Smith'}});
            expect(pickupContact).toHaveValue('John Smith');

            const deliveryContact = screen.getByLabelText(/delivery contact/i);
            fireEvent.change(deliveryContact, {target: {value: 'Jane Doe'}});
            expect(deliveryContact).toHaveValue('Jane Doe');

            const podName = screen.getByLabelText(/pod name/i);
            fireEvent.change(podName, {target: {value: 'Reception'}});
            expect(podName).toHaveValue('Reception');

            const refA = screen.getByLabelText(/reference a/i);
            const refB = screen.getByLabelText(/reference b/i);
            fireEvent.change(refA, {target: {value: 'REF-001'}});
            fireEvent.change(refB, {target: {value: 'PO-123'}});
            expect(refA).toHaveValue('REF-001');
            expect(refB).toHaveValue('PO-123');

            const jobNotes = screen.getByLabelText(/job notes/i);
            fireEvent.change(jobNotes, {target: {value: 'Handle with care'}});
            expect(jobNotes).toHaveValue('Handle with care');
        });
    });

    describe('State Reset', () => {
        it('resets form fields when dialog is reopened', async () => {
            const user = userEvent.setup();
            const props = createMockProps();
            const {rerender} = renderWithAllProviders(<CreateJobDialog {...props} />);

            const chargeInput = screen.getByLabelText(/charge amount/i);
            await user.click(chargeInput);
            await user.paste('50');
            expect(chargeInput).toHaveValue(50);

            // Close and reopen
            rerender(<CreateJobDialog {...{...props, open: false}} />);
            rerender(<CreateJobDialog {...{...props, open: true}} />);

            const resetChargeInput = screen.getByLabelText(/charge amount/i);
            expect(resetChargeInput).toHaveValue(null);
        });
    });

    describe('Field Max Lengths', () => {
        it('enforces maxLength on reference and notes fields', () => {
            const props = createMockProps();
            renderWithAllProviders(<CreateJobDialog {...props} />);

            // References: maxLength 20
            expect(screen.getByLabelText(/reference a/i)).toHaveAttribute('maxlength', '20');
            expect(screen.getByLabelText(/reference b/i)).toHaveAttribute('maxlength', '20');

            // Notes: maxLength 150
            expect(screen.getByLabelText(/job notes/i)).toHaveAttribute('maxlength', '150');
            expect(screen.getByLabelText(/pickup notes/i)).toHaveAttribute('maxlength', '150');
            expect(screen.getByLabelText(/delivery notes/i)).toHaveAttribute('maxlength', '150');
        });
    });
});
