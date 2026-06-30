import React from 'react';
import {screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {SendPodDialog, SendPodJobData} from './SendPodDialog';
import {renderWithTheme} from '../../../__testUtils__';
import {draftPodEmail} from '../../../services/aiAssistantApi';
import {isAiEnabled} from '../../../../functions/aiSettings';

jest.mock('../../../services/aiAssistantApi', () => ({draftPodEmail: jest.fn()}));
jest.mock('../../../../functions/aiSettings', () => ({isAiEnabled: jest.fn()}));

const mockDraftPodEmail = draftPodEmail as jest.Mock;
const mockIsAiEnabled = isAiEnabled as jest.Mock;

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
    renderWithTheme(<SendPodDialog {...defaultProps} {...props} />);

describe('SendPodDialog — AI draft', () => {
    beforeEach(() => jest.clearAllMocks());

    it('seeds an editable body from the template', () => {
        mockIsAiEnabled.mockReturnValue(false);

        renderDialog();

        expect(screen.getByLabelText<HTMLTextAreaElement>('Email body').value).toContain('Booking reference: J123');
    });

    it('hides the Draft button when AI is disabled', () => {
        mockIsAiEnabled.mockReturnValue(false);

        renderDialog();

        expect(screen.queryByRole('button', {name: /^draft$/i})).not.toBeInTheDocument();
    });

    it('replaces subject and body with the AI draft', async () => {
        mockIsAiEnabled.mockReturnValue(true);
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
