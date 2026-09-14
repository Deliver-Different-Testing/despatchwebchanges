import React from 'react';
import {screen} from '@testing-library/react';
import {SendPodDialog, SendPodJobData} from './SendPodDialog';
import { renderWithMantine } from '../../../__testUtils__';
import { setupUser } from '../../../__testUtils__/setupUser';
import {draftPodEmail} from '../../../services/aiAssistantApi';
import {disableAutoMate, enableAutoMate, resetAiPreferences} from '../../../__testUtils__/aiPreferences';

// Shared fast userEvent instance (see setupUser).
const userEvent = setupUser();

jest.mock('../../../services/aiAssistantApi', () => ({draftPodEmail: jest.fn()}));

const mockDraftPodEmail = draftPodEmail as jest.Mock;

const jobData: SendPodJobData = {
    jobId: 1,
    jobNo: 'J123',
    clientName: 'Acme',
    driverName: 'Dave',
    deliveryAddress: '1 Queen St',
    deliveryDateTime: '2026-06-30 10:00',
};

const defaultProps = {
    open: true,
    jobData,
    onClose: jest.fn(),
    onSend: jest.fn(),
    sending: false,
    sent: false,
};

const renderDialog = (props: Partial<typeof defaultProps> = {}) =>
    renderWithMantine(<SendPodDialog {...defaultProps} {...props} />);

describe('SendPodDialog — AI draft', () => {
    beforeEach(() => jest.clearAllMocks());

    it('seeds an editable body from the template', () => {
        disableAutoMate();

        renderDialog();

        expect(screen.getByLabelText<HTMLTextAreaElement>('Email body').value).toContain('Booking reference: J123');
    });

    it('hides the Draft button when AI is disabled', () => {
        disableAutoMate();

        renderDialog();

        expect(screen.queryByRole('button', {name: /^draft$/i})).not.toBeInTheDocument();
    });

    it('replaces subject and body with the AI draft', async () => {
        enableAutoMate();
        mockDraftPodEmail.mockResolvedValueOnce({
            subject: 'POD delivered J123',
            body: 'Your shipment was delivered.',
            usage: {inputTokens: 1, outputTokens: 1},
        });
        renderDialog();

        await userEvent.click(screen.getByRole('button', {name: /^draft$/i}));

        expect(await screen.findByDisplayValue('Your shipment was delivered.')).toBeInTheDocument();
        expect(await screen.findByDisplayValue('POD delivered J123')).toBeInTheDocument();
        expect(mockDraftPodEmail).toHaveBeenCalledWith(1, expect.anything());
    });
});

describe('SendPodDialog — recipients and sending', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        disableAutoMate();
    });

    it('closes via the shared header close button', async () => {
        const onClose = jest.fn();
        renderDialog({onClose});

        await userEvent.click(screen.getByRole('button', {name: /close dialog/i}));

        expect(onClose).toHaveBeenCalled();
    });

    it('disables Send until a recipient is added, then sends subject and body', async () => {
        const onSend = jest.fn();
        renderDialog({onSend});

        const sendButton = screen.getByRole('button', {name: /send pod pdf/i});
        expect(sendButton).toBeDisabled();

        await userEvent.type(screen.getByPlaceholderText(/add another email address/i), 'ops@acme.test');
        await userEvent.click(screen.getByRole('button', {name: /^add$/i}));

        expect(screen.getByText('ops@acme.test')).toBeInTheDocument();
        expect(sendButton).toBeEnabled();

        await userEvent.click(sendButton);

        expect(onSend).toHaveBeenCalledWith(expect.objectContaining({
            jobId: 1,
            recipients: ['ops@acme.test'],
            subject: expect.stringContaining('J123'),
            body: expect.stringContaining('Booking reference: J123'),
        }));
    });

    it('adds booking recipients from the checkbox', async () => {
        renderDialog({jobData: {...jobData, bookingContactEmail: 'book@acme.test'}});

        expect(screen.getByRole('button', {name: /send pod pdf/i})).toBeDisabled();

        await userEvent.click(screen.getByRole('checkbox'));

        expect(screen.getByText(/sending to \(1\)/i)).toBeInTheDocument();
        expect(screen.getByRole('button', {name: /send pod pdf/i})).toBeEnabled();
    });

    it('reports the send as queued rather than sent', () => {
        // Delivery is handed to the outbox, so the dialog must not claim the mail has gone out.
        renderDialog({sent: true});

        expect(screen.getByRole('button', {name: /queued/i})).toBeInTheDocument();
    });
});

describe('SendPodDialog — send failures', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        disableAutoMate();
    });

    it('shows the server error and keeps the entered recipients so the send can be retried', async () => {
        // The old behaviour was a window.alert reading "Failed to send POD report. Please try
        // again", which hid the real cause and told the user nothing actionable.
        const {rerender} = renderDialog();

        await userEvent.type(screen.getByPlaceholderText(/add another email address/i), 'ops@acme.test');
        await userEvent.click(screen.getByRole('button', {name: /^add$/i}));

        rerender(
            <SendPodDialog
                {...defaultProps}
                errorMessage="POD emailing is not configured on this server."
            />
        );

        expect(screen.getByRole('alert')).toHaveTextContent('POD emailing is not configured on this server.');
        expect(screen.getByText('ops@acme.test')).toBeInTheDocument();
        expect(screen.getByRole('button', {name: /send pod pdf/i})).toBeEnabled();
    });

    it('shows no alert before a send is attempted', () => {
        renderDialog();

        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
});
