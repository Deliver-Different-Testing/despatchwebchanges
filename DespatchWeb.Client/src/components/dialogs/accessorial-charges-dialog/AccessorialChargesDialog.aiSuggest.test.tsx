import React from 'react';
import {screen, within} from '@testing-library/react';
import {renderWithMantine} from '../../../test/utils';
import { setupUser } from '../../../test/utils/setupUser';
import {AccessorialChargesDialog} from './AccessorialChargesDialog';
import {accessorialChargesApi} from '../../../api/accessorialChargesApi';
import {analyzePricing, recordPricingOutcome} from '../../../api/aiAssistantApi';
import {isAiEnabled} from '../../../utils/aiSettings';

// Shared fast userEvent instance (see setupUser).
const userEvent = setupUser();

jest.mock('../../../api/accessorialChargesApi', () => ({
    accessorialChargesApi: {
        getAvailableCharges: jest.fn(),
        getAppliedCharges: jest.fn(),
        getJobAmount: jest.fn(),
        addCharges: jest.fn(),
        updateCharge: jest.fn(),
        deleteCharge: jest.fn(),
    },
}));
jest.mock('../../../api/aiAssistantApi', () => ({analyzePricing: jest.fn(), recordPricingOutcome: jest.fn()}));
jest.mock('../../../utils/aiSettings', () => ({isAiEnabled: jest.fn()}));

const api = accessorialChargesApi as jest.Mocked<typeof accessorialChargesApi>;
const mockAnalyze = analyzePricing as jest.Mock;
const mockRecordOutcome = recordPricingOutcome as jest.Mock;
const mockIsAiEnabled = isAiEnabled as jest.Mock;

const job = {id: 123, accessorialChargeGroupId: 5, amount: 100, weight: 10, quantity: 1};

function renderDialog() {
    return renderWithMantine(
        <AccessorialChargesDialog open job={job as never} onClose={jest.fn()} showToast={jest.fn()} />,
    );
}

describe('AccessorialChargesDialog — Auto-Mate suggest', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (api.getAvailableCharges as jest.Mock).mockResolvedValue([
            {accessorialChargeId: 5, name: 'Tail-lift', description: 'Tail lift', chargeType: 'flat', baseRate: 25, calculationOrder: 1, alreadyApplied: false},
        ]);
        (api.getAppliedCharges as jest.Mock).mockResolvedValue([]);
        (api.getJobAmount as jest.Mock).mockResolvedValue(100);
    });

    it('hides the Suggest button when AI is disabled', async () => {
        mockIsAiEnabled.mockReturnValue(false);

        renderDialog();

        // wait for the dialog to finish loading
        expect(await screen.findByText('Add charges')).toBeInTheDocument();
        expect(screen.queryByRole('button', {name: /suggest charges/i})).not.toBeInTheDocument();
    });

    it('shows the anomaly alert and pre-selects suggested charges', async () => {
        mockIsAiEnabled.mockReturnValue(true);
        mockAnalyze.mockResolvedValueOnce({
            anomaly: {storedCharge: 95, recomputedRate: 145, deltaPercent: -34.5, isOutlier: true},
            suggestions: [{accessorialChargeId: 5, name: 'Tail-lift', reason: 'tail-lift flag', suggestedInputValue: null}],
            usage: {inputTokens: 1, outputTokens: 1},
        });

        renderDialog();
        await userEvent.click(await screen.findByRole('button', {name: /suggest charges/i}));

        expect(await screen.findByText(/review before invoicing/i)).toBeInTheDocument();
        expect(screen.getByText(/Suggested 1 charge/i)).toBeInTheDocument();
        expect(mockAnalyze).toHaveBeenCalledWith(123, 5, expect.anything());

        // The suggested charge row checkbox should now be checked.
        const checkbox = screen.getByRole('checkbox', {checked: true});
        expect(checkbox).toBeInTheDocument();
    });

    it('records which suggested charges the dispatcher actually added', async () => {
        mockIsAiEnabled.mockReturnValue(true);
        mockAnalyze.mockResolvedValueOnce({
            anomaly: null,
            suggestions: [{accessorialChargeId: 5, name: 'Tail-lift', reason: 'tail-lift flag', suggestedInputValue: null}],
            usage: {inputTokens: 1, outputTokens: 1},
        });
        (api.addCharges as jest.Mock).mockResolvedValue([]);
        mockRecordOutcome.mockResolvedValue({recorded: true});

        renderDialog();
        await userEvent.click(await screen.findByRole('button', {name: /suggest charges/i}));
        await userEvent.click(await screen.findByRole('button', {name: /add selected charges/i}));

        expect(mockRecordOutcome).toHaveBeenCalledWith({jobId: 123, suggestedChargeIds: [5], acceptedChargeIds: [5]});
    });

    it('says the suggestion pass failed instead of reporting nothing to suggest', async () => {
        mockIsAiEnabled.mockReturnValue(true);
        mockAnalyze.mockResolvedValueOnce({
            anomaly: null,
            suggestions: [],
            incomplete: true,
            usage: {inputTokens: 1, outputTokens: 1},
        });

        renderDialog();
        await userEvent.click(await screen.findByRole('button', {name: /suggest charges/i}));

        expect(await screen.findByText(/couldn't analyse this job/i)).toBeInTheDocument();
    });
});
