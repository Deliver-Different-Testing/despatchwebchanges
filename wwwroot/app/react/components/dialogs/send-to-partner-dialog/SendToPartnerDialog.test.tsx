/** @jest-environment jest-environment-jsdom */
/**
 * SendToPartnerDialog Tests
 */

import React from 'react';
import {screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {SendToPartnerDialog, SendToPartnerDialogProps} from './SendToPartnerDialog';
import {renderWithTheme} from '../../../__testUtils__';
import type {PartnerRateForJobResponse} from '../../../services/jobListApi';

const rateCardResponse: PartnerRateForJobResponse = {
    rateCardRate: 85.00,
    liveQuotes: [],
    source: 'rate_card',
};

const liveQuoteResponse: PartnerRateForJobResponse = {
    rateCardRate: null,
    liveQuotes: [
        {serviceCode: 'STANDARD', serviceName: 'Standard Delivery', totalCharge: 60.00, currency: 'NZD', transitDays: 2},
        {serviceCode: 'EXPRESS', serviceName: 'Express Delivery', totalCharge: 95.00, currency: 'NZD', transitDays: 1},
    ],
    source: 'live_quote',
};

const noRateResponse: PartnerRateForJobResponse = {
    rateCardRate: null,
    liveQuotes: [],
    source: 'none',
};

function renderDialog(overrides: Partial<SendToPartnerDialogProps> = {}) {
    const defaultProps: SendToPartnerDialogProps = {
        open: true,
        partnerId: 1,
        partnerName: 'Acme Logistics',
        jobId: 42,
        jobNo: 'JOB-100',
        onClose: jest.fn(),
        onConfirm: jest.fn().mockResolvedValue(undefined),
        fetchRate: jest.fn().mockResolvedValue(rateCardResponse),
        ...overrides,
    };

    renderWithTheme(<SendToPartnerDialog {...defaultProps} />);
    return defaultProps;
}

describe('SendToPartnerDialog', () => {
    it('shows partner name and job number', async () => {
        renderDialog();

        expect(screen.getByText(/JOB-100/)).toBeInTheDocument();
        expect(screen.getByText(/Acme Logistics/)).toBeInTheDocument();
    });

    it('shows loading state while fetching rate', () => {
        renderDialog({
            fetchRate: jest.fn().mockReturnValue(new Promise(() => {})), // never resolves
        });

        expect(screen.getByText(/Looking up rate/)).toBeInTheDocument();
    });

    it('shows rate card rate and pre-fills the input', async () => {
        renderDialog();

        await waitFor(() => {
            expect(screen.getByText(/Rate Card/)).toBeInTheDocument();
            expect(screen.getByText(/85\.00/)).toBeInTheDocument();
        });

        const input = screen.getByLabelText(/Agreed Rate/) as HTMLInputElement;
        expect(input.value).toBe('85.00');
    });

    it('shows live quotes when no rate card', async () => {
        renderDialog({
            fetchRate: jest.fn().mockResolvedValue(liveQuoteResponse),
        });

        await waitFor(() => {
            expect(screen.getByText(/Live Quote/)).toBeInTheDocument();
            expect(screen.getByText(/Standard Delivery/)).toBeInTheDocument();
            expect(screen.getByText(/Express Delivery/)).toBeInTheDocument();
        });

        const input = screen.getByLabelText(/Agreed Rate/) as HTMLInputElement;
        expect(input.value).toBe('60.00'); // first quote pre-selected
    });

    it('shows manual entry message when no rate available', async () => {
        renderDialog({
            fetchRate: jest.fn().mockResolvedValue(noRateResponse),
        });

        await waitFor(() => {
            expect(screen.getByText(/No pre-agreed rate/)).toBeInTheDocument();
        });
    });

    it('calls onConfirm with the entered rate', async () => {
        const user = userEvent.setup();
        const props = renderDialog();

        await waitFor(() => {
            expect(screen.getByLabelText(/Agreed Rate/)).toBeInTheDocument();
        });

        await user.click(screen.getByRole('button', {name: /Confirm & Send/}));

        expect(props.onConfirm).toHaveBeenCalledWith(85.00);
    });

    it('allows manual rate override', async () => {
        const user = userEvent.setup();
        const props = renderDialog();

        await waitFor(() => {
            expect(screen.getByLabelText(/Agreed Rate/)).toBeInTheDocument();
        });

        const input = screen.getByLabelText(/Agreed Rate/);
        await user.clear(input);
        await user.type(input, '120.50');

        await user.click(screen.getByRole('button', {name: /Confirm & Send/}));

        expect(props.onConfirm).toHaveBeenCalledWith(120.50);
    });

    it('disables confirm button when rate is zero', async () => {
        const user = userEvent.setup();
        renderDialog({
            fetchRate: jest.fn().mockResolvedValue(noRateResponse),
        });

        await waitFor(() => {
            expect(screen.getByLabelText(/Agreed Rate/)).toBeInTheDocument();
        });

        const input = screen.getByLabelText(/Agreed Rate/);
        await user.type(input, '0');

        const confirmButton = screen.getByRole('button', {name: /Confirm & Send/});
        expect(confirmButton).toBeDisabled();
    });

    it('disables confirm button while loading', () => {
        renderDialog({
            fetchRate: jest.fn().mockReturnValue(new Promise(() => {})),
        });

        const confirmButton = screen.getByRole('button', {name: /Confirm & Send/});
        expect(confirmButton).toBeDisabled();
    });

    it('calls onClose when cancel clicked', async () => {
        const user = userEvent.setup();
        const props = renderDialog();

        await user.click(screen.getByRole('button', {name: /Cancel/}));

        expect(props.onClose).toHaveBeenCalled();
    });

    it('shows the server error message below the rate input without flagging the rate field', async () => {
        const user = userEvent.setup();
        const serverMessage = "Fedex speed not found. A job speed with 'Fedex' in its name must be set up before Fedex bookings can be made.";
        renderDialog({
            onConfirm: jest.fn().mockRejectedValue(new Error(serverMessage)),
        });

        await waitFor(() => {
            expect(screen.getByLabelText(/Agreed Rate/)).toBeInTheDocument();
        });

        await user.click(screen.getByRole('button', {name: /Confirm & Send/}));

        // Server message renders verbatim
        expect(await screen.findByText(serverMessage)).toBeInTheDocument();

        // Rate input is NOT marked invalid for a submission failure
        const input = screen.getByLabelText(/Agreed Rate/);
        expect(input).not.toHaveAttribute('aria-invalid', 'true');
    });
});
