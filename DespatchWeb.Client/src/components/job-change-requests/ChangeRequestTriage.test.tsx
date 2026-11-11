import type {Mock} from 'vitest';
import React from 'react';
import {screen} from '@testing-library/react';
import { setupUser } from '../../test/utils/setupUser';
import {renderWithMantine as render} from '../../test/utils';
import {ChangeRequestTriage} from './ChangeRequestTriage';
import {triageChangeRequest} from '../../api/aiAssistantApi';
import {isAiEnabled} from '../../utils/aiSettings';

// Shared fast userEvent instance (see setupUser).
const userEvent = setupUser();

vi.mock('../../api/aiAssistantApi', () => ({triageChangeRequest: vi.fn()}));
vi.mock('../../utils/aiSettings', () => ({isAiEnabled: vi.fn()}));

const mockTriage = triageChangeRequest as Mock;
const mockIsAiEnabled = isAiEnabled as Mock;

describe('ChangeRequestTriage', () => {
    beforeEach(() => vi.clearAllMocks());

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
