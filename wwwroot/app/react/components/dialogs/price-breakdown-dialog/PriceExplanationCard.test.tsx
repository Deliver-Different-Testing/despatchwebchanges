/**
 * PriceExplanationCard tests.
 *
 * The behaviour that matters: nothing is spent until the dispatcher opens the
 * card, and what comes back is the sentence they say to the customer.
 */

import React from 'react';
import {screen} from '@testing-library/react';
import {PriceExplanationCard} from './PriceExplanationCard';
import {renderWithMantine} from '../../../__testUtils__';
import {setupUser} from '../../../__testUtils__/setupUser';
import {explainPrice} from '../../../services/aiAssistantApi';
import {PriceExplanationResponse} from '../../../interfaces/ai';
import {disableAiCategory, disableAutoMate, enableAutoMate, resetAiPreferences} from '../../../__testUtils__/aiPreferences';

jest.mock('../../../services/aiAssistantApi', () => ({
    explainPrice: jest.fn(),
}));


jest.mock('../../../utils/currencyUtils', () => ({
    formatCurrency: (value: number) => `$${value.toFixed(2)}`,
}));

const mockExplain = explainPrice as jest.MockedFunction<typeof explainPrice>;

const explanation: PriceExplanationResponse = {
    headline: '$145.50 NZD — a 42 km urgent run, with waiting time the largest add-on',
    lines: [
        {name: 'Base rate', amount: 100, explanation: 'The standard charge for the distance.'},
        {name: 'Waiting time', amount: 45.5, explanation: 'The driver waited 45 minutes on site.'},
    ],
    queryRisks: [{component: 'Waiting time', evidence: 'on site 10:05, signed 10:50'}],
    caveats: [],
    usage: {inputTokens: 60, outputTokens: 40},
};

const props = {jobId: 7, isPrebook: false};

describe('PriceExplanationCard', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        resetAiPreferences();
        mockExplain.mockResolvedValue(explanation);
    });

    it('renders nothing when the user has not opted into Auto-mate', () => {
        disableAutoMate();

        renderWithMantine(<PriceExplanationCard {...props} />);

        expect(screen.queryByText(/explain this price/i)).not.toBeInTheDocument();
    });

    it('disappears when pricing help alone is switched off', () => {
        disableAiCategory('pricing');

        renderWithMantine(<PriceExplanationCard {...props} />);

        expect(screen.queryByText(/explain this price/i)).not.toBeInTheDocument();
    });

    it('spends nothing until the dispatcher opens it', () => {
        renderWithMantine(<PriceExplanationCard {...props} />);

        expect(screen.getByText(/explain this price/i)).toBeInTheDocument();
        expect(mockExplain).not.toHaveBeenCalled();
    });

    it('fetches once on open and renders the headline, the lines and the query risk', async () => {
        renderWithMantine(<PriceExplanationCard {...props} />);
        const user = setupUser();

        const toggle = screen.getByRole('button', {name: /explain this price/i});
        await user.click(toggle);

        expect(await screen.findByText(explanation.headline)).toBeInTheDocument();
        expect(screen.getByText('Base rate')).toBeInTheDocument();
        expect(screen.getByText('The driver waited 45 minutes on site.')).toBeInTheDocument();
        expect(screen.getByText('on site 10:05, signed 10:50', {exact: false})).toBeInTheDocument();
        expect(mockExplain).toHaveBeenCalledWith(7, false, false, expect.objectContaining({signal: expect.anything()}));

        // Closing and re-opening reuses what it already has.
        await user.click(toggle);
        await user.click(toggle);
        expect(mockExplain).toHaveBeenCalledTimes(1);
    });

    it('passes the archived and prebook flags through', async () => {
        renderWithMantine(<PriceExplanationCard jobId={9} isPrebook isArchived/>);
        const user = setupUser();

        await user.click(screen.getByRole('button', {name: /explain this price/i}));

        expect(mockExplain).toHaveBeenCalledWith(9, true, true, expect.objectContaining({signal: expect.anything()}));
    });

    it('shows the failure instead of an empty card', async () => {
        mockExplain.mockRejectedValue(new Error('The AI service is busy.'));
        renderWithMantine(<PriceExplanationCard {...props} />);
        const user = setupUser();

        await user.click(screen.getByRole('button', {name: /explain this price/i}));

        expect(await screen.findByText('The AI service is busy.')).toBeInTheDocument();
    });
});
