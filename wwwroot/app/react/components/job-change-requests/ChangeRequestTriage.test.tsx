import React from 'react';
import {render, screen} from '@testing-library/react';
import { setupUser } from '../../__testUtils__/setupUser';
import {ChangeRequestTriage} from './ChangeRequestTriage';
import {triageChangeRequest} from '../../services/aiAssistantApi';
import {isAiEnabled} from '../../../functions/aiSettings';

// Shared fast userEvent instance (see setupUser).
const userEvent = setupUser();

jest.mock('../../services/aiAssistantApi', () => ({triageChangeRequest: jest.fn()}));
jest.mock('../../../functions/aiSettings', () => ({isAiEnabled: jest.fn()}));

const mockTriage = triageChangeRequest as jest.Mock;
const mockIsAiEnabled = isAiEnabled as jest.Mock;

describe('ChangeRequestTriage', () => {
    beforeEach(() => jest.clearAllMocks());

    it('renders no trigger when AI is disabled', () => {
        mockIsAiEnabled.mockReturnValue(false);

        render(<ChangeRequestTriage requestId={42} jobId={7} />);

        expect(screen.queryByRole('button', {name: /recommendation/i})).not.toBeInTheDocument();
    });

    it('shows the advisory recommendation after clicking', async () => {
        mockIsAiEnabled.mockReturnValue(true);
        mockTriage.mockResolvedValueOnce({
            recommendedAction: 'approve',
            confidence: 0.8,
            rationale: 'Rate change aligns with volume.',
            riskFactors: ['3% below rate card'],
            usage: {inputTokens: 1, outputTokens: 1},
        });

        render(<ChangeRequestTriage requestId={42} jobId={7} />);
        await userEvent.click(screen.getByRole('button', {name: /recommendation/i}));

        expect(await screen.findByText('Rate change aligns with volume.')).toBeInTheDocument();
        expect(screen.getByText('AI: APPROVE')).toBeInTheDocument();
        expect(screen.getByText('3% below rate card')).toBeInTheDocument();
        expect(mockTriage).toHaveBeenCalledWith(42, 7, expect.anything());
    });
});
