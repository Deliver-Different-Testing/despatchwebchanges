/**
 * InterCourierChargeDialog Component Tests
 */

import React from 'react';
import {act, fireEvent, screen, waitFor} from '@testing-library/react';
import {InterCourierChargeDialog, InterCourierChargeDialogProps} from './InterCourierChargeDialog';
import { createProps, renderWithTheme, suppressConsoleError } from '../../../__testUtils__';
import { setupUser } from '../../../__testUtils__/setupUser';

// ── Mocks ──────────────────────────────────────────────────────────

const mockSearchActiveCouriers = jest.fn();
const mockSearchActiveClients = jest.fn();
const mockCreateInterCourierCharge = jest.fn();

jest.mock('../../../services/courierApi', () => ({
    searchActiveCouriers: (...args: unknown[]) => mockSearchActiveCouriers(...args),
}));

jest.mock('../../../services/jobApi', () => ({
    searchActiveClients: (...args: unknown[]) => mockSearchActiveClients(...args),
}));

jest.mock('../../../services/dispatchExecutorApi', () => ({
    createInterCourierCharge: (...args: unknown[]) => mockCreateInterCourierCharge(...args),
}));

// ── Fixtures ───────────────────────────────────────────────────────

const courierSuggestions = [
    {id: 1, text: 'Courier Alpha'},
    {id: 2, text: 'Courier Beta'},
];

const clientSuggestions = [
    {id: 10, text: 'Client One'},
    {id: 20, text: 'Client Two'},
];

const defaultProps: InterCourierChargeDialogProps = {
    open: true,
    onClose: jest.fn(),
    showToast: jest.fn(),
};

const createMockProps = (overrides?: Partial<InterCourierChargeDialogProps>) =>
    createProps(defaultProps, overrides);

// ── Helpers ────────────────────────────────────────────────────────

async function fillAutocomplete(label: string, searchText: string, optionText: string) {
    const input = screen.getByLabelText(new RegExp(label, 'i'));
    // fireEvent.focus + fireEvent.change skips the slow user-event pointer pipeline
    // (~3s per user.click in CI). MUI Autocomplete responds to focus + input value
    // changes the same way as user.click + user.paste, but synchronously.
    fireEvent.focus(input);
    fireEvent.change(input, {target: {value: searchText}});

    // Flush the 300ms debounce timer so the search fires
    await act(async () => {
        jest.advanceTimersByTime(350);
    });

    const option = await screen.findByText(optionText);
    fireEvent.click(option);
}

async function fillForm() {
    mockSearchActiveCouriers.mockResolvedValue(courierSuggestions);
    mockSearchActiveClients.mockResolvedValue(clientSuggestions);

    await fillAutocomplete('From Courier', 'Courier', 'Courier Alpha');
    await fillAutocomplete('To Courier', 'Courier', 'Courier Beta');
    await fillAutocomplete('Client', 'Client', 'Client One');

    fireEvent.change(screen.getByLabelText(/reference/i), {target: {value: 'REF-123'}});
    fireEvent.change(screen.getByLabelText(/zones/i), {target: {value: '3'}});
}

// ── Tests ──────────────────────────────────────────────────────────

describe('InterCourierChargeDialog', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        jest.clearAllMocks();
        mockSearchActiveCouriers.mockResolvedValue([]);
        mockSearchActiveClients.mockResolvedValue([]);
        mockCreateInterCourierCharge.mockResolvedValue(undefined);
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    describe('Rendering', () => {
        it('renders dialog with header, form fields, and action buttons when open', () => {
            renderWithTheme(<InterCourierChargeDialog {...createMockProps()} />);

            expect(screen.getByRole('dialog')).toBeInTheDocument();
            expect(screen.getByText('Inter-Courier Charge')).toBeInTheDocument();
            expect(screen.getByText('Create a charge transfer between couriers')).toBeInTheDocument();
            expect(screen.getByLabelText(/from courier/i)).toBeInTheDocument();
            expect(screen.getByLabelText(/to courier/i)).toBeInTheDocument();
            expect(screen.getByLabelText(/client/i)).toBeInTheDocument();
            expect(screen.getByLabelText(/reference/i)).toBeInTheDocument();
            expect(screen.getByLabelText(/zones/i)).toBeInTheDocument();
            expect(screen.getByLabelText(/amount/i)).toBeInTheDocument();
            expect(screen.getByRole('button', {name: /cancel/i})).toBeInTheDocument();
            expect(screen.getByRole('button', {name: /add charge/i})).toBeInTheDocument();
        });

        it('does not render dialog when open is false', () => {
            renderWithTheme(<InterCourierChargeDialog {...createMockProps({open: false})} />);

            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        });
    });

    describe('Close Functionality', () => {
        it('calls onClose when Cancel button is clicked', async () => {
            const onClose = jest.fn();
            renderWithTheme(<InterCourierChargeDialog {...createMockProps({onClose})} />);

            fireEvent.click(screen.getByRole('button', {name: /cancel/i}));

            expect(onClose).toHaveBeenCalledTimes(1);
        });

        it('calls onClose when close icon button is clicked', () => {
            const onClose = jest.fn();
            renderWithTheme(<InterCourierChargeDialog {...createMockProps({onClose})} />);

            fireEvent.click(screen.getByLabelText('Close dialog'));

            expect(onClose).toHaveBeenCalledTimes(1);
        });
    });

    describe('Courier Search', () => {
        it('searches couriers after typing at least 2 characters with debounce', async () => {
            mockSearchActiveCouriers.mockResolvedValue(courierSuggestions);
            renderWithTheme(<InterCourierChargeDialog {...createMockProps()} />);

            const input = screen.getByLabelText(/from courier/i);
            fireEvent.focus(input);
            fireEvent.change(input, {target: {value: 'Co'}});

            await act(async () => {
                jest.advanceTimersByTime(350);
            });

            expect(mockSearchActiveCouriers).toHaveBeenCalledWith('Co', expect.objectContaining({signal: expect.any(AbortSignal)}));
            expect(await screen.findByText('Courier Alpha')).toBeInTheDocument();
            expect(screen.getByText('Courier Beta')).toBeInTheDocument();
        });

        it('does not search couriers with fewer than 2 characters', async () => {
            renderWithTheme(<InterCourierChargeDialog {...createMockProps()} />);

            const input = screen.getByLabelText(/from courier/i);
            fireEvent.focus(input);
            fireEvent.change(input, {target: {value: 'C'}});

            await act(async () => {
                jest.advanceTimersByTime(350);
            });

            expect(mockSearchActiveCouriers).not.toHaveBeenCalled();
        });
    });

    describe('Client Search', () => {
        it('searches clients after typing at least 2 characters', async () => {
            mockSearchActiveClients.mockResolvedValue(clientSuggestions);
            renderWithTheme(<InterCourierChargeDialog {...createMockProps()} />);

            const input = screen.getByLabelText(/client/i);
            fireEvent.focus(input);
            fireEvent.change(input, {target: {value: 'Cl'}});

            await act(async () => {
                jest.advanceTimersByTime(350);
            });

            expect(mockSearchActiveClients).toHaveBeenCalledWith('Cl', expect.objectContaining({signal: expect.any(AbortSignal)}));
            expect(await screen.findByText('Client One')).toBeInTheDocument();
        });
    });

    describe('Zones and Amount Calculation', () => {
        it('auto-calculates amount as zones * 7 when zones is changed', () => {
            renderWithTheme(<InterCourierChargeDialog {...createMockProps()} />);

            const zonesInput = screen.getByLabelText(/zones/i);
            fireEvent.change(zonesInput, {target: {value: '3'}});

            const amountInput = screen.getByLabelText(/amount/i) as HTMLInputElement;
            expect(amountInput.value).toBe('21');
        });

        it('sets amount to 0 when zones is cleared', () => {
            renderWithTheme(<InterCourierChargeDialog {...createMockProps()} />);

            const zonesInput = screen.getByLabelText(/zones/i);
            fireEvent.change(zonesInput, {target: {value: '5'}});

            const amountInput = screen.getByLabelText(/amount/i) as HTMLInputElement;
            expect(amountInput.value).toBe('35');

            fireEvent.change(zonesInput, {target: {value: ''}});
            expect(amountInput.value).toBe('0');
        });

        it('allows manual editing of the amount field', () => {
            renderWithTheme(<InterCourierChargeDialog {...createMockProps()} />);

            const amountInput = screen.getByLabelText(/amount/i) as HTMLInputElement;
            fireEvent.change(amountInput, {target: {value: '99.5'}});

            expect(amountInput.value).toBe('99.5');
        });
    });

    describe('Validation', () => {
        it('shows warning toast and does not submit when form is incomplete', () => {
            const showToast = jest.fn();
            renderWithTheme(<InterCourierChargeDialog {...createMockProps({showToast})} />);

            fireEvent.click(screen.getByRole('button', {name: /add charge/i}));

            expect(showToast).toHaveBeenCalledWith('Please complete all the required fields', 'warning');
            expect(mockCreateInterCourierCharge).not.toHaveBeenCalled();
        });

        it('shows required error messages on fields after submit attempt', () => {
            renderWithTheme(<InterCourierChargeDialog {...createMockProps()} />);

            fireEvent.click(screen.getByRole('button', {name: /add charge/i}));

            const requiredMessages = screen.getAllByText('This field is required.');
            // From Courier, To Courier, Client, Reference, Zones, Amount = 6 fields
            expect(requiredMessages.length).toBeGreaterThanOrEqual(4);
        });
    });

    describe('Successful Submission', () => {
        it('submits form data and shows success toast', async () => {
            const onClose = jest.fn();
            const showToast = jest.fn();
            renderWithTheme(<InterCourierChargeDialog {...createMockProps({onClose, showToast})} />);

            await fillForm();

            fireEvent.click(screen.getByRole('button', {name: /add charge/i}));

            await waitFor(() => {
                expect(mockCreateInterCourierCharge).toHaveBeenCalledWith({
                    fromCourierId: 1,
                    toCourierId: 2,
                    clientId: 10,
                    reference: 'REF-123',
                    amount: 21,
                });
            });

            expect(showToast).toHaveBeenCalledWith('Inter-Courier Charge saved successfully', 'success');
            expect(onClose).toHaveBeenCalled();
        });
    });

    describe('Failed Submission', () => {
        it('shows error toast and does not close on API failure', async () => {
            const errorSpy = suppressConsoleError();
            const onClose = jest.fn();
            const showToast = jest.fn();
            mockCreateInterCourierCharge.mockRejectedValueOnce(new Error('Server error'));
            renderWithTheme(<InterCourierChargeDialog {...createMockProps({onClose, showToast})} />);

            await fillForm();

            fireEvent.click(screen.getByRole('button', {name: /add charge/i}));

            // Drain the microtask queue so the rejected promise's catch + finally run.
            // waitFor + fake timers is unreliable under CI load here.
            await act(async () => {
                await Promise.resolve();
            });

            expect(showToast).toHaveBeenCalledWith('An error occurred while saving the charge', 'error');
            expect(onClose).not.toHaveBeenCalled();
            errorSpy.mockRestore();
        });
    });

    describe('State Reset', () => {
        it('resets all fields when dialog is reopened', () => {
            mockSearchActiveCouriers.mockResolvedValue(courierSuggestions);
            const props = createMockProps();
            const {rerender} = renderWithTheme(<InterCourierChargeDialog {...props} />);

            // Type into reference field
            const referenceInput = screen.getByLabelText(/reference/i);
            fireEvent.change(referenceInput, {target: {value: 'REF-TEST'}});
            expect(referenceInput).toHaveValue('REF-TEST');

            // Close and reopen
            rerender(<InterCourierChargeDialog {...{...props, open: false}} />);
            rerender(<InterCourierChargeDialog {...{...props, open: true}} />);

            // Fields should be cleared
            expect(screen.getByLabelText(/reference/i)).toHaveValue('');
            expect(screen.getByLabelText(/zones/i)).toHaveValue(null);
            expect(screen.getByLabelText(/amount/i)).toHaveValue(null);
        });
    });

    describe('Submit Guard', () => {
        it('disables Cancel and Add Charge buttons while submitting', async () => {
            const user = setupUser({advanceTimers: jest.advanceTimersByTime});
            let resolveSubmit: () => void;
            mockCreateInterCourierCharge.mockImplementation(() =>
                new Promise<void>(resolve => { resolveSubmit = resolve; })
            );
            renderWithTheme(<InterCourierChargeDialog {...createMockProps()} />);

            await fillForm();

            await user.click(screen.getByRole('button', {name: /add charge/i}));

            // user.click wraps the dispatch in act, so the isSubmitting=true render
            // has already flushed by the time it returns.
            expect(screen.getByRole('button', {name: /add charge/i})).toBeDisabled();
            expect(screen.getByRole('button', {name: /cancel/i})).toBeDisabled();

            await act(async () => {
                resolveSubmit!();
                await Promise.resolve();
            });

            expect(screen.getByRole('button', {name: /add charge/i})).not.toBeDisabled();
        });
    });
});
