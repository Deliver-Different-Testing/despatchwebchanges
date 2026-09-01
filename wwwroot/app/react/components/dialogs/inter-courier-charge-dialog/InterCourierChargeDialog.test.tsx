/**
 * InterCourierChargeDialog Component Tests
 */

import React from 'react';
import {act, fireEvent, screen, waitFor, within} from '@testing-library/react';
import {InterCourierChargeDialog, InterCourierChargeDialogProps} from './InterCourierChargeDialog';
import { createProps, renderWithMantine, suppressConsoleError } from '../../../__testUtils__';
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
    // (~3s per user.click in CI). The Combobox responds to focus + input value
    // changes the same way as user.click + user.paste, but synchronously.
    fireEvent.focus(input);
    fireEvent.change(input, {target: {value: searchText}});

    // Flush the 300ms debounce timer so the search fires
    await act(async () => {
        jest.advanceTimersByTime(350);
    });

    // Several fields search the same list, so scope the option lookup to this
    // field's own dropdown rather than matching by text across the dialog.
    const dropdownId = input.getAttribute('aria-controls');
    const dropdown = dropdownId ? document.getElementById(dropdownId) : null;
    const option = dropdown
        ? await within(dropdown).findByText(optionText)
        : await screen.findByText(optionText);
    fireEvent.click(option);
    fireEvent.blur(input);
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
            renderWithMantine(<InterCourierChargeDialog {...createMockProps()} />);

            expect(screen.getByRole('dialog')).toBeInTheDocument();
            expect(screen.getByText('Inter-Courier Charge')).toBeInTheDocument();
            expect(screen.getByText('Charge one courier and credit another')).toBeInTheDocument();
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
            renderWithMantine(<InterCourierChargeDialog {...createMockProps({open: false})} />);

            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        });
    });

    describe('Close Functionality', () => {
        it('calls onClose when Cancel button is clicked', async () => {
            const onClose = jest.fn();
            renderWithMantine(<InterCourierChargeDialog {...createMockProps({onClose})} />);

            fireEvent.click(screen.getByRole('button', {name: /cancel/i}));

            expect(onClose).toHaveBeenCalledTimes(1);
        });

        it('calls onClose when close icon button is clicked', () => {
            const onClose = jest.fn();
            renderWithMantine(<InterCourierChargeDialog {...createMockProps({onClose})} />);

            fireEvent.click(screen.getByLabelText('Close dialog'));

            expect(onClose).toHaveBeenCalledTimes(1);
        });
    });

    describe('Courier Search', () => {
        it('searches couriers after typing at least 2 characters with debounce', async () => {
            mockSearchActiveCouriers.mockResolvedValue(courierSuggestions);
            renderWithMantine(<InterCourierChargeDialog {...createMockProps()} />);

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
            renderWithMantine(<InterCourierChargeDialog {...createMockProps()} />);

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
            renderWithMantine(<InterCourierChargeDialog {...createMockProps()} />);

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
            renderWithMantine(<InterCourierChargeDialog {...createMockProps()} />);

            const zonesInput = screen.getByLabelText(/zones/i);
            fireEvent.change(zonesInput, {target: {value: '3'}});

            const amountInput = screen.getByLabelText(/amount/i) as HTMLInputElement;
            expect(amountInput.value).toBe('21');
        });

        it('sets amount to 0 when zones is cleared', () => {
            renderWithMantine(<InterCourierChargeDialog {...createMockProps()} />);

            const zonesInput = screen.getByLabelText(/zones/i);
            fireEvent.change(zonesInput, {target: {value: '5'}});

            const amountInput = screen.getByLabelText(/amount/i) as HTMLInputElement;
            expect(amountInput.value).toBe('35');

            fireEvent.change(zonesInput, {target: {value: ''}});
            expect(amountInput.value).toBe('0');
        });

        it('allows manual editing of the amount field', () => {
            renderWithMantine(<InterCourierChargeDialog {...createMockProps()} />);

            const amountInput = screen.getByLabelText(/amount/i) as HTMLInputElement;
            fireEvent.change(amountInput, {target: {value: '99.5'}});

            expect(amountInput.value).toBe('99.5');
        });
    });

    describe('Validation', () => {
        it('names each gap inline, moves focus to the first, and blocks submit', () => {
            const showToast = jest.fn();
            renderWithMantine(<InterCourierChargeDialog {...createMockProps({showToast})} />);

            fireEvent.click(screen.getByRole('button', {name: /add charge/i}));

            // Every field is on screen at once, so inline errors carry it - no toast
            expect(showToast).not.toHaveBeenCalled();
            expect(mockCreateInterCourierCharge).not.toHaveBeenCalled();

            expect(screen.getByText('Choose the courier being charged.')).toBeInTheDocument();
            expect(screen.getByText('Choose the courier being credited.')).toBeInTheDocument();
            expect(screen.getByText('Choose the client to bill.')).toBeInTheDocument();
            expect(screen.getByText('Enter a reference for this charge.')).toBeInTheDocument();
            expect(screen.getByText('Enter the number of zones.')).toBeInTheDocument();

            // Focus goes to the first thing that needs attention
            expect(screen.getByLabelText(/from courier/i)).toHaveFocus();
        });

        it('refuses a charge that goes to and from the same courier', async () => {
            renderWithMantine(<InterCourierChargeDialog {...createMockProps()} />);

            mockSearchActiveCouriers.mockResolvedValue(courierSuggestions);
            await fillAutocomplete('From Courier', 'Courier', 'Courier Alpha');
            await fillAutocomplete('To Courier', 'Courier', 'Courier Alpha');

            expect(screen.getByText("Pick a different courier. A charge can't go to and from the same one."))
                .toBeInTheDocument();

            fireEvent.click(screen.getByRole('button', {name: /add charge/i}));
            expect(mockCreateInterCourierCharge).not.toHaveBeenCalled();
        });

        it('caps the reference at the 20 characters the ledger stores', () => {
            renderWithMantine(<InterCourierChargeDialog {...createMockProps()} />);

            expect(screen.getByLabelText(/reference/i)).toHaveAttribute('maxlength', '20');
        });
    });

    describe('Ledger Preview', () => {
        it('shows both sides of the entry, empty on open and signed once filled', async () => {
            renderWithMantine(<InterCourierChargeDialog {...createMockProps()} />);

            const ledger = () => within(screen.getByRole('group', {name: 'What gets recorded'}));

            // The shape of the entry is visible before anything is chosen
            expect(ledger().getByText('Charged')).toBeInTheDocument();
            expect(ledger().getByText('Credited')).toBeInTheDocument();

            await fillForm();

            // Zones 3 x $7.00 = $21.00, debited from one courier and credited to the other
            expect(ledger().getByText('Courier Alpha')).toBeInTheDocument();
            expect(ledger().getByText('Courier Beta')).toBeInTheDocument();
            expect(ledger().getByText('\u2212$21.00')).toBeInTheDocument();
            expect(ledger().getByText('+$21.00')).toBeInTheDocument();
        });
    });

    describe('Zones and Amount Alignment', () => {
        it('keeps the zone-rate hint below the input so both fields start on one line', () => {
            renderWithMantine(<InterCourierChargeDialog {...createMockProps()} />);

            const zonesInput = screen.getByLabelText(/zones/i);
            const hint = screen.getByText('$7.00 a zone');

            // DOCUMENT_POSITION_FOLLOWING: the hint comes after the input, so nothing
            // sits between the label and the input to push Zones below Amount.
            expect(zonesInput.compareDocumentPosition(hint) & Node.DOCUMENT_POSITION_FOLLOWING)
                .toBeTruthy();
        });
    });

    describe('Amount Override', () => {
        it('flags an amount that has left the zone rate and offers it back', () => {
            renderWithMantine(<InterCourierChargeDialog {...createMockProps()} />);

            fireEvent.change(screen.getByLabelText(/zones/i), {target: {value: '3'}});
            expect(screen.queryByText('Overridden')).not.toBeInTheDocument();

            fireEvent.change(screen.getByLabelText(/amount/i), {target: {value: '99.5'}});
            expect(screen.getByText('Overridden')).toBeInTheDocument();

            fireEvent.click(screen.getByRole('button', {name: 'Reset to $21.00'}));
            expect(screen.getByLabelText(/amount/i)).toHaveValue('21');
            expect(screen.queryByText('Overridden')).not.toBeInTheDocument();
        });
    });

    describe('Successful Submission', () => {
        it('submits form data and shows success toast', async () => {
            const onClose = jest.fn();
            const showToast = jest.fn();
            renderWithMantine(<InterCourierChargeDialog {...createMockProps({onClose, showToast})} />);

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

            expect(showToast).toHaveBeenCalledWith('Charge added', 'success');
            expect(onClose).toHaveBeenCalled();
        });
    });

    describe('Failed Submission', () => {
        it('shows error toast and does not close on API failure', async () => {
            const errorSpy = suppressConsoleError();
            const onClose = jest.fn();
            const showToast = jest.fn();
            mockCreateInterCourierCharge.mockRejectedValueOnce(new Error('Server error'));
            renderWithMantine(<InterCourierChargeDialog {...createMockProps({onClose, showToast})} />);

            await fillForm();

            fireEvent.click(screen.getByRole('button', {name: /add charge/i}));

            // Drain the microtask queue so the rejected promise's catch + finally run.
            // waitFor + fake timers is unreliable under CI load here.
            await act(async () => {
                await Promise.resolve();
            });

            expect(showToast).toHaveBeenCalledWith("Couldn't add the charge. Try again.", 'error');
            expect(onClose).not.toHaveBeenCalled();
            errorSpy.mockRestore();
        });
    });

    describe('State Reset', () => {
        it('resets all fields when dialog is reopened', () => {
            mockSearchActiveCouriers.mockResolvedValue(courierSuggestions);
            const props = createMockProps();
            const {rerender} = renderWithMantine(<InterCourierChargeDialog {...props} />);

            // Type into reference field
            const referenceInput = screen.getByLabelText(/reference/i);
            fireEvent.change(referenceInput, {target: {value: 'REF-TEST'}});
            expect(referenceInput).toHaveValue('REF-TEST');

            // Close and reopen
            rerender(<InterCourierChargeDialog {...{...props, open: false}} />);
            rerender(<InterCourierChargeDialog {...{...props, open: true}} />);

            // Fields should be cleared
            expect(screen.getByLabelText(/reference/i)).toHaveValue('');
            expect(screen.getByLabelText(/zones/i)).toHaveValue('');
            expect(screen.getByLabelText(/amount/i)).toHaveValue('');
        });
    });

    describe('Submit Guard', () => {
        it('disables Cancel and Add Charge buttons while submitting', async () => {
            const user = setupUser({advanceTimers: jest.advanceTimersByTime});
            let resolveSubmit: () => void;
            mockCreateInterCourierCharge.mockImplementation(() =>
                new Promise<void>(resolve => { resolveSubmit = resolve; })
            );
            renderWithMantine(<InterCourierChargeDialog {...createMockProps()} />);

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
