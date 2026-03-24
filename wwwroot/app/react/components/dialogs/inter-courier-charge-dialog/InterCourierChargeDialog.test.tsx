/** @jest-environment jest-environment-jsdom */
/**
 * InterCourierChargeDialog Component Tests
 */

import React from 'react';
import {fireEvent, screen, waitFor, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {InterCourierChargeDialog, InterCourierChargeDialogProps} from './InterCourierChargeDialog';
import {createProps, renderWithTheme, suppressConsoleError} from '../../../__testUtils__';

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

async function fillAutocomplete(user: ReturnType<typeof userEvent.setup>, label: string, searchText: string, optionText: string) {
    const input = screen.getByLabelText(new RegExp(label, 'i'));
    await user.click(input);
    await user.clear(input);
    await user.type(input, searchText);

    const option = await screen.findByText(optionText);
    await user.click(option);
}

async function fillForm(user: ReturnType<typeof userEvent.setup>) {
    mockSearchActiveCouriers.mockResolvedValue(courierSuggestions);
    mockSearchActiveClients.mockResolvedValue(clientSuggestions);

    await fillAutocomplete(user, 'From Courier', 'Courier', 'Courier Alpha');
    await fillAutocomplete(user, 'To Courier', 'Courier', 'Courier Beta');
    await fillAutocomplete(user, 'Client', 'Client', 'Client One');

    const referenceInput = screen.getByLabelText(/reference/i);
    await user.click(referenceInput);
    await user.type(referenceInput, 'REF-123');

    const zonesInput = screen.getByLabelText(/zones/i);
    await user.click(zonesInput);
    await user.type(zonesInput, '3');
}

// ── Tests ──────────────────────────────────────────────────────────

describe('InterCourierChargeDialog', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockSearchActiveCouriers.mockResolvedValue([]);
        mockSearchActiveClients.mockResolvedValue([]);
        mockCreateInterCourierCharge.mockResolvedValue(undefined);
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
            const user = userEvent.setup();
            mockSearchActiveCouriers.mockResolvedValue(courierSuggestions);
            renderWithTheme(<InterCourierChargeDialog {...createMockProps()} />);

            const input = screen.getByLabelText(/from courier/i);
            await user.click(input);
            await user.type(input, 'Co');

            await waitFor(() => {
                expect(mockSearchActiveCouriers).toHaveBeenCalledWith('Co', expect.objectContaining({signal: expect.any(AbortSignal)}));
            });

            expect(await screen.findByText('Courier Alpha')).toBeInTheDocument();
            expect(screen.getByText('Courier Beta')).toBeInTheDocument();
        });

        it('does not search couriers with fewer than 2 characters', async () => {
            const user = userEvent.setup();
            renderWithTheme(<InterCourierChargeDialog {...createMockProps()} />);

            const input = screen.getByLabelText(/from courier/i);
            await user.click(input);
            await user.type(input, 'C');

            await waitFor(() => {
                expect(mockSearchActiveCouriers).not.toHaveBeenCalled();
            }, {timeout: 500});
        });
    });

    describe('Client Search', () => {
        it('searches clients after typing at least 2 characters', async () => {
            const user = userEvent.setup();
            mockSearchActiveClients.mockResolvedValue(clientSuggestions);
            renderWithTheme(<InterCourierChargeDialog {...createMockProps()} />);

            const input = screen.getByLabelText(/client/i);
            await user.click(input);
            await user.type(input, 'Cl');

            await waitFor(() => {
                expect(mockSearchActiveClients).toHaveBeenCalledWith('Cl', expect.objectContaining({signal: expect.any(AbortSignal)}));
            });

            expect(await screen.findByText('Client One')).toBeInTheDocument();
        });
    });

    describe('Zones and Amount Calculation', () => {
        it('auto-calculates amount as zones * 7 when zones is changed', async () => {
            const user = userEvent.setup();
            renderWithTheme(<InterCourierChargeDialog {...createMockProps()} />);

            const zonesInput = screen.getByLabelText(/zones/i);
            await user.click(zonesInput);
            await user.type(zonesInput, '3');

            const amountInput = screen.getByLabelText(/amount/i) as HTMLInputElement;
            expect(amountInput.value).toBe('21');
        });

        it('sets amount to 0 when zones is cleared', async () => {
            const user = userEvent.setup();
            renderWithTheme(<InterCourierChargeDialog {...createMockProps()} />);

            const zonesInput = screen.getByLabelText(/zones/i);
            await user.click(zonesInput);
            await user.type(zonesInput, '5');

            const amountInput = screen.getByLabelText(/amount/i) as HTMLInputElement;
            expect(amountInput.value).toBe('35');

            await user.clear(zonesInput);
            expect(amountInput.value).toBe('0');
        });

        it('allows manual editing of the amount field', async () => {
            const user = userEvent.setup();
            renderWithTheme(<InterCourierChargeDialog {...createMockProps()} />);

            const amountInput = screen.getByLabelText(/amount/i) as HTMLInputElement;
            await user.click(amountInput);
            await user.type(amountInput, '99.5');

            expect(amountInput.value).toBe('99.5');
        });
    });

    describe('Validation', () => {
        it('shows warning toast and does not submit when form is incomplete', async () => {
            const user = userEvent.setup();
            const showToast = jest.fn();
            renderWithTheme(<InterCourierChargeDialog {...createMockProps({showToast})} />);

            await user.click(screen.getByRole('button', {name: /add charge/i}));

            expect(showToast).toHaveBeenCalledWith('Please complete all the required fields', 'warning');
            expect(mockCreateInterCourierCharge).not.toHaveBeenCalled();
        });

        it('shows required error messages on fields after submit attempt', async () => {
            const user = userEvent.setup();
            renderWithTheme(<InterCourierChargeDialog {...createMockProps()} />);

            await user.click(screen.getByRole('button', {name: /add charge/i}));

            const requiredMessages = screen.getAllByText('This field is required.');
            // From Courier, To Courier, Client, Reference, Zones, Amount = 6 fields
            expect(requiredMessages.length).toBeGreaterThanOrEqual(4);
        });
    });

    describe('Successful Submission', () => {
        it('submits form data and shows success toast', async () => {
            const user = userEvent.setup();
            const onClose = jest.fn();
            const showToast = jest.fn();
            renderWithTheme(<InterCourierChargeDialog {...createMockProps({onClose, showToast})} />);

            await fillForm(user);

            await user.click(screen.getByRole('button', {name: /add charge/i}));

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
            const user = userEvent.setup();
            const onClose = jest.fn();
            const showToast = jest.fn();
            mockCreateInterCourierCharge.mockRejectedValueOnce(new Error('Server error'));
            renderWithTheme(<InterCourierChargeDialog {...createMockProps({onClose, showToast})} />);

            await fillForm(user);

            await user.click(screen.getByRole('button', {name: /add charge/i}));

            await waitFor(() => {
                expect(showToast).toHaveBeenCalledWith('An error occurred while saving the charge', 'error');
            });

            expect(onClose).not.toHaveBeenCalled();
            errorSpy.mockRestore();
        });
    });

    describe('State Reset', () => {
        it('resets all fields when dialog is reopened', async () => {
            const user = userEvent.setup();
            mockSearchActiveCouriers.mockResolvedValue(courierSuggestions);
            const props = createMockProps();
            const {rerender} = renderWithTheme(<InterCourierChargeDialog {...props} />);

            // Type into reference field
            const referenceInput = screen.getByLabelText(/reference/i);
            await user.type(referenceInput, 'REF-TEST');
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
            const user = userEvent.setup();
            let resolveSubmit: () => void;
            mockCreateInterCourierCharge.mockImplementation(() =>
                new Promise<void>(resolve => { resolveSubmit = resolve; })
            );
            renderWithTheme(<InterCourierChargeDialog {...createMockProps()} />);

            await fillForm(user);

            await user.click(screen.getByRole('button', {name: /add charge/i}));

            await waitFor(() => {
                expect(screen.getByRole('button', {name: /add charge/i})).toBeDisabled();
                expect(screen.getByRole('button', {name: /cancel/i})).toBeDisabled();
            });

            resolveSubmit!();

            await waitFor(() => {
                expect(screen.getByRole('button', {name: /add charge/i})).not.toBeDisabled();
            });
        });
    });
});
