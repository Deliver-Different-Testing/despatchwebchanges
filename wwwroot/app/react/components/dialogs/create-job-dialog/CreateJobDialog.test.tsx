/**
 * CreateJobDialog Component Tests
 */

import React from 'react';
import {fireEvent, screen, waitFor, within} from '@testing-library/react';
import {CreateJobDialog, CreateJobDialogProps} from './CreateJobDialog';
import { createProps, renderWithMantine } from '../../../__testUtils__';

// Mantine outside, MUI inside: the form is still MUI but its date field is Mantine.
// The MUI LocalizationProvider is gone with the MUI picker.
const renderWithAllProviders = (ui: React.ReactElement) =>
    renderWithMantine(ui, {withQueryClient: true});
import { setupUser } from '../../../__testUtils__/setupUser';
import {addressApi} from '../../../services/addressApi';
import {jobApi} from '../../../services/jobApi';
import type {HereMapsLookupResponse} from '../../../interfaces';

// Mock the hooks - must match the import paths used by the component
const mockUseClientSearch = jest.fn(() => ({data: [] as any[], isFetching: false}));
const mockUseVehicleSizes = jest.fn(() => ({
    data: [
        {id: 1, text: 'Car'},
        {id: 2, text: 'Van'},
    ],
}));
const mockUseCourierSearch = jest.fn(() => ({data: [] as any[], isFetching: false}));
const mockUseAddressSearch = jest.fn(() => ({data: [] as any[], isFetching: false}));
const mockUseSpeedList = jest.fn(() => ({
    data: [
        {id: 1, text: 'Standard'},
        {id: 2, text: 'Express'},
    ],
}));

jest.mock('../../../hooks/useJobApi', () => ({
    useClientSearch: (...args: any[]) => mockUseClientSearch(...(args as [])),
    useVehicleSizes: (...args: any[]) => mockUseVehicleSizes(...(args as [])),
}));
jest.mock('../../../hooks/useCourierApi', () => ({
    useCourierSearch: (...args: any[]) => mockUseCourierSearch(...(args as [])),
}));
jest.mock('../../../hooks/useAddressApi', () => ({
    useAddressSearch: (...args: any[]) => mockUseAddressSearch(...(args as [])),
}));
jest.mock('../../../hooks/useRecurringJobsApi', () => ({
    useSpeedList: (...args: any[]) => mockUseSpeedList(...(args as [])),
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
        // The Mantine date field asks for the tenant's input order.
        getInputDateFormat: jest.fn(() => 'MM/DD/YYYY'),
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

            // Four sections, grouped by what the operator is deciding
            expect(screen.getByText('Job')).toBeInTheDocument();
            expect(screen.getByText('Route')).toBeInTheDocument();
            expect(screen.getByText('Service')).toBeInTheDocument();
            expect(screen.getByText('References & notes')).toBeInTheDocument();

            // The route section splits into the two legs of the journey
            expect(screen.getByText('Pickup')).toBeInTheDocument();
            expect(screen.getByText('Delivery')).toBeInTheDocument();

            // References and notes are the only wholly optional section
            expect(screen.getByText('Optional')).toBeInTheDocument();

            // Action buttons
            expect(screen.getByRole('button', {name: /cancel/i})).toBeInTheDocument();
            expect(screen.getByRole('button', {name: /create job/i})).toBeInTheDocument();

            // Form fields
            expect(screen.getByRole('combobox', {name: /client/i})).toBeInTheDocument();
            expect(screen.getByLabelText(/charge amount/i)).toBeInTheDocument();
            // isUsTenant=true in defaultProps -> weight label is "Weight (lbs)"
            expect(screen.getByLabelText(/weight \(lbs\)/i)).toBeInTheDocument();
            expect(screen.getByRole('combobox', {name: /courier/i})).toBeInTheDocument();
            expect(screen.getByLabelText(/job date/i)).toBeInTheDocument();
            expect(screen.getByRole('combobox', {name: /pickup address/i})).toBeInTheDocument();
            expect(screen.getByRole('combobox', {name: /delivery address/i})).toBeInTheDocument();
            expect(screen.getByLabelText(/pickup contact/i)).toBeInTheDocument();
            expect(screen.getByLabelText(/delivery contact/i)).toBeInTheDocument();
            expect(screen.getByLabelText(/pod name/i)).toBeInTheDocument();
            expect(screen.getByRole('combobox', {name: /vehicle/i})).toBeInTheDocument();
            expect(screen.getByRole('combobox', {name: /speed/i})).toBeInTheDocument();
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
            const user = setupUser();
            const onClose = jest.fn();
            const props = createMockProps({onClose});
            renderWithAllProviders(<CreateJobDialog {...props} />);

            // Close icon
            const closeIcon = screen.getByRole('button', {name: /close dialog/i});
            await user.click(closeIcon.closest('button')!);
            expect(onClose).toHaveBeenCalledTimes(1);

            // Cancel button
            await user.click(screen.getByRole('button', {name: /cancel/i}));
            expect(onClose).toHaveBeenCalledTimes(2);
        });
    });

    describe('Validation', () => {
        it('summarises every incomplete field, marks them inline, and blocks submit', async () => {
            const user = setupUser();
            const showToast = jest.fn();
            const onSubmit = jest.fn();
            const props = createMockProps({showToast, onSubmit});
            renderWithAllProviders(<CreateJobDialog {...props} />);

            await user.click(screen.getByRole('button', {name: /create job/i}));

            // One summary naming the count, in place of a toast per failure
            const summary = await screen.findByRole('alert');
            expect(summary).toHaveTextContent('Complete 10 fields to create this job');
            expect(showToast).not.toHaveBeenCalled();

            // Every incomplete field is listed in the summary as a shortcut to itself
            ['Client', 'Charge Amount', 'Weight (lbs)', 'Pickup Address', 'Pickup Contact',
                'Delivery Address', 'Delivery Contact', 'POD Name', 'Vehicle', 'Speed']
                .forEach(label => {
                    expect(within(summary).getByRole('button', {name: label})).toBeInTheDocument();
                });

            // ...and still flagged inline, against the input itself
            expect(screen.getByText('Client is required.')).toBeInTheDocument();
            expect(screen.getByText('Charge must be greater than 0.')).toBeInTheDocument();
            expect(screen.getByText('Weight must be greater than 0.')).toBeInTheDocument();
            expect(screen.getByText('Pickup address is required.')).toBeInTheDocument();
            expect(screen.getByText('Delivery address is required.')).toBeInTheDocument();
            expect(screen.getByText('Pickup contact is required.')).toBeInTheDocument();
            expect(screen.getByText('Delivery contact is required.')).toBeInTheDocument();
            expect(screen.getByText('POD name is required.')).toBeInTheDocument();
            expect(screen.getByText('Vehicle is required.')).toBeInTheDocument();
            expect(screen.getByText('Speed is required.')).toBeInTheDocument();

            expect(onSubmit).not.toHaveBeenCalled();

            // A summary entry moves focus to its field
            await user.click(within(summary).getByRole('button', {name: 'POD Name'}));
            expect(screen.getByLabelText(/pod name/i)).toHaveFocus();

            // Filling a field drops it from the summary
            fireEvent.change(screen.getByLabelText(/pod name/i), {target: {value: 'Reception'}});
            expect(screen.getByRole('alert')).toHaveTextContent('Complete 9 fields to create this job');
            expect(within(screen.getByRole('alert')).queryByRole('button', {name: 'POD Name'}))
                .not.toBeInTheDocument();
        });
    });

    describe('Field Affordances', () => {
        it('marks charge with the tenant currency and counts notes only near the limit', () => {
            const props = createMockProps();
            renderWithAllProviders(<CreateJobDialog {...props} />);

            // The currency marker rides in the input rather than the label
            expect(screen.getByText('$')).toBeInTheDocument();

            // The counter stays out of the way until the cap is within reach
            expect(screen.queryByText(/\/150$/)).not.toBeInTheDocument();

            fireEvent.change(screen.getByLabelText(/job notes/i), {target: {value: 'x'.repeat(120)}});
            expect(screen.getByText('120/150')).toBeInTheDocument();
        });
    });

    describe('Text Input', () => {
        it('allows typing in all form fields', () => {
            const props = createMockProps();
            renderWithAllProviders(<CreateJobDialog {...props} />);

            const chargeInput = screen.getByLabelText(/charge amount/i);
            fireEvent.change(chargeInput, {target: {value: '25.50'}});
            expect(chargeInput).toHaveValue('25.50');

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
        it('resets form fields when dialog is reopened', () => {
            const props = createMockProps();
            const {rerender} = renderWithAllProviders(<CreateJobDialog {...props} />);

            const chargeInput = screen.getByLabelText(/charge amount/i);
            fireEvent.change(chargeInput, {target: {value: '50'}});
            expect(chargeInput).toHaveValue('50');

            // Close and reopen
            rerender(<CreateJobDialog {...{...props, open: false}} />);
            rerender(<CreateJobDialog {...{...props, open: true}} />);

            const resetChargeInput = screen.getByLabelText(/charge amount/i);
            expect(resetChargeInput).toHaveValue('');
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

    describe('Submit Flow', () => {
        const mockLookupResponse: HereMapsLookupResponse = {
            id: 'here:af:street:abc123',
            title: '123 Main Street',
            resultType: 'houseNumber',
            address: {
                label: '123 Main Street, New York, NY 10001, United States',
                city: 'New York',
                stateCode: 'NY',
                state: 'New York',
                postalCode: '10001',
                countryCode: 'USA',
                countryName: 'United States',
                street: 'Main Street',
                houseNumber: '123',
            },
            position: {lat: 40.7128, lng: -74.006},
        };

        const mockAddressOption = {
            id: 'here:af:street:abc123',
            title: '123 Main Street',
            resultType: 'houseNumber',
            address: mockLookupResponse.address,
            position: {lat: 40.7128, lng: -74.006},
            access: [{lat: 40.7128, lng: -74.006}],
        };

        /**
         * Pick an option from a combobox by typing and clicking the match.
         *
         * fireEvent rather than userEvent: the pointer-event pipeline
         * (pointerover → pointerdown → mousedown → focus → click) burns ~3s per
         * call in CI. The option lookup is scoped to this input's own dropdown
         * via aria-controls, because both address fields search the same list
         * and an unscoped query matches the other field's copy of the option.
         *
         * Pass an empty `typeText` for a Mantine `Select`: it filters a list it
         * already holds, and typing an option's exact label re-matches it as the
         * dropdown closes, which `allowDeselect` then toggles straight back off.
         */
        async function selectAutocomplete(input: HTMLElement, typeText: string, optionText: string | RegExp) {
            fireEvent.focus(input);
            if (typeText) {
                fireEvent.change(input, {target: {value: typeText}});
            }
            // Focus alone no longer opens a Mantine Select (it needs `openOnFocus`),
            // so click to open. Every field here maps click to `openDropdown`,
            // never a toggle, so re-clicking is safe.
            fireEvent.click(input);

            // Wait for the option rather than the dropdown: Mantine keeps the list
            // mounted and its click handler live even while `aria-expanded` is
            // false, and under worker contention the expanded flag can lag. Scope
            // to this input's own list whenever it exposes one, because both
            // address fields carry the same option text.
            const option = await waitFor(() => {
                const dropdownId = input.getAttribute('aria-controls');
                const scope = dropdownId ? document.getElementById(dropdownId) : null;
                const match = (scope ? within(scope) : screen)
                    .queryAllByText(optionText)
                    .map(node => node.closest('[role="option"]'))
                    .find((node): node is HTMLElement => node instanceof HTMLElement);
                if (!match) {
                    fireEvent.click(input);
                    throw new Error(`no option ${String(optionText)}`);
                }
                return match;
            });
            fireEvent.click(option);
        }

        /** Fill every required field so the Create Job button will submit. */
        async function fillRequiredFields(weightLabel: RegExp) {
            await selectAutocomplete(screen.getByRole('combobox', {name: /client/i}), 'Test', 'Test Client');
            fireEvent.change(screen.getByLabelText(/charge amount/i), {target: {value: '10'}});
            fireEvent.change(screen.getByLabelText(weightLabel), {target: {value: '12'}});
            await selectAutocomplete(screen.getByRole('combobox', {name: /pickup address/i}), '123', /123 Main Street/);
            await selectAutocomplete(screen.getByRole('combobox', {name: /delivery address/i}), '123', /123 Main Street/);
            fireEvent.change(screen.getByLabelText(/pickup contact/i), {target: {value: 'John'}});
            fireEvent.change(screen.getByLabelText(/delivery contact/i), {target: {value: 'Jane'}});
            fireEvent.change(screen.getByLabelText(/pod name/i), {target: {value: 'Reception'}});
            await selectAutocomplete(screen.getByRole('combobox', {name: /vehicle/i}), '', 'Car');
            await selectAutocomplete(screen.getByRole('combobox', {name: /speed/i}), '', /Standard/);
        }

        function mockClipboard(writeText: jest.Mock) {
            Object.defineProperty(navigator, 'clipboard', {value: {writeText}, configurable: true});
        }

        it('submits with US-tenant Lb weight, copies the job number and names it in the toast', async () => {
            const onSubmit = jest.fn();
            const showToast = jest.fn();

            // Configure mocks to return selectable options
            mockUseClientSearch.mockReturnValue({
                data: [{id: 1, text: 'Test Client'}],
                isFetching: false,
            });
            mockUseAddressSearch.mockReturnValue({
                data: [mockAddressOption],
                isFetching: false,
            });

            (addressApi.getLocationDetailsById as jest.Mock).mockResolvedValue(mockLookupResponse);
            (jobApi.quickCreateJob as jest.Mock).mockResolvedValue({jobId: 999, jobNumber: 'ABC123'});
            const writeText = jest.fn().mockResolvedValue(undefined);
            mockClipboard(writeText);

            const props = createMockProps({onSubmit, showToast, isUsTenant: true});
            renderWithAllProviders(<CreateJobDialog {...props} />);

            await fillRequiredFields(/weight \(lbs\)/i);

            // Submit — use fireEvent.click to avoid the slow user-event pointer pipeline
            // (the rest of the test already uses fireEvent for the same reason)
            fireEvent.click(screen.getByRole('button', {name: /create job/i}));

            await waitFor(() => {
                expect(jobApi.quickCreateJob).toHaveBeenCalledTimes(1);
            }, {timeout: 3000});

            const submittedJob = (jobApi.quickCreateJob as jest.Mock).mock.calls[0][0];
            expect(submittedJob.pickUpAddress.addressLine8).toBe('United States');
            expect(submittedJob.deliveryAddress.addressLine8).toBe('United States');
            expect(submittedJob.weightLb).toBe(12);
            expect(submittedJob.weightKg).toBeNull();

            // The operator gets the job number on the clipboard and named in the toast,
            // while the host still receives the id so it can open the job.
            expect(writeText).toHaveBeenCalledWith('ABC123');
            await waitFor(() => {
                expect(showToast).toHaveBeenCalledWith(
                    expect.stringContaining('ABC123'),
                    'success',
                );
            });
            expect(showToast).toHaveBeenCalledWith(
                expect.stringContaining('job number copied'),
                'success',
            );
            expect(onSubmit).toHaveBeenCalledWith(999);
        }, 30000);

        it('still creates the job when the clipboard copy is refused', async () => {
            const onSubmit = jest.fn();
            const showToast = jest.fn();

            mockUseClientSearch.mockReturnValue({data: [{id: 1, text: 'Test Client'}], isFetching: false});
            mockUseAddressSearch.mockReturnValue({data: [mockAddressOption], isFetching: false});
            (addressApi.getLocationDetailsById as jest.Mock).mockResolvedValue(mockLookupResponse);
            (jobApi.quickCreateJob as jest.Mock).mockResolvedValue({jobId: 999, jobNumber: 'ABC123'});
            mockClipboard(jest.fn().mockRejectedValue(new Error('not allowed')));

            const props = createMockProps({onSubmit, showToast, isUsTenant: true});
            renderWithAllProviders(<CreateJobDialog {...props} />);

            await fillRequiredFields(/weight \(lbs\)/i);
            fireEvent.click(screen.getByRole('button', {name: /create job/i}));

            await waitFor(() => {
                expect(onSubmit).toHaveBeenCalledWith(999);
            }, {timeout: 3000});
            expect(showToast).toHaveBeenCalledWith(
                expect.not.stringContaining('copied'),
                'success',
            );
        }, 30000);

        it('submits with NZ-tenant Kg weight (label switches to Weight (kg))', async () => {
            mockUseClientSearch.mockReturnValue({
                data: [{id: 1, text: 'Test Client'}],
                isFetching: false,
            });
            mockUseAddressSearch.mockReturnValue({
                data: [mockAddressOption],
                isFetching: false,
            });

            (addressApi.getLocationDetailsById as jest.Mock).mockResolvedValue(mockLookupResponse);
            (jobApi.quickCreateJob as jest.Mock).mockResolvedValue({jobId: 999, jobNumber: 'ABC123'});
            mockClipboard(jest.fn().mockResolvedValue(undefined));

            const props = createMockProps({isUsTenant: false});
            renderWithAllProviders(<CreateJobDialog {...props} />);

            // Label flips to kg for non-US tenants
            expect(screen.getByLabelText(/weight \(kg\)/i)).toBeInTheDocument();

            await fillRequiredFields(/weight \(kg\)/i);

            fireEvent.click(screen.getByRole('button', {name: /create job/i}));

            await waitFor(() => {
                expect(jobApi.quickCreateJob).toHaveBeenCalledTimes(1);
            }, {timeout: 3000});

            const submittedJob = (jobApi.quickCreateJob as jest.Mock).mock.calls[0][0];
            expect(submittedJob.weightKg).toBe(12);
            expect(submittedJob.weightLb).toBeNull();
        }, 30000);
    });
});
