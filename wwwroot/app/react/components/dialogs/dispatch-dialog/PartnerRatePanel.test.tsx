/**
 * PartnerRatePanel tests
 *
 * Carries the rate-mode assertions migrated from the deleted
 * SendToPartnerDialog.test.tsx so we don't lose coverage when the panel was
 * extracted out of that dialog.
 */

import React from 'react';
import {screen, waitFor} from '@testing-library/react';
import {PartnerRatePanel, type PartnerRatePanelProps} from './PartnerRatePanel';
import { renderWithTheme } from '../../../__testUtils__';
import { setupUser } from '../../../__testUtils__/setupUser';
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

const percentageResponse: PartnerRateForJobResponse = {
    rateCardRate: null,
    liveQuotes: [],
    source: 'percentage',
    percentageOfClientCharge: 60,
    derivedRate: 60.00,
};

const costPlusResponse: PartnerRateForJobResponse = {
    rateCardRate: null,
    liveQuotes: [
        {serviceCode: 'STD', serviceName: 'Standard', totalCharge: 80.00, currency: 'NZD', transitDays: 2},
    ],
    source: 'cost_plus',
    marginPercent: 25,
    derivedRevenue: 100.00,
};

function renderPanel(overrides: Partial<PartnerRatePanelProps> = {}) {
    const defaultProps: PartnerRatePanelProps = {
        partnerId: 1,
        jobId: 42,
        fetchRate: jest.fn().mockResolvedValue(rateCardResponse),
        onRateChange: jest.fn(),
        ...overrides,
    };
    renderWithTheme(<PartnerRatePanel {...defaultProps} />);
    return defaultProps;
}

describe('PartnerRatePanel', () => {
    it('shows loading state while fetching rate', () => {
        renderPanel({fetchRate: jest.fn().mockReturnValue(new Promise(() => {}))});
        expect(screen.getByText(/Looking up rate/)).toBeInTheDocument();
    });

    it('shows rate card and pre-fills the input with the rate-card rate', async () => {
        renderPanel();

        expect(await screen.findByText(/Rate Card/)).toBeInTheDocument();
        expect(screen.getByText(/85\.00/)).toBeInTheDocument();

        const input = screen.getByLabelText(/Agreed Rate/) as HTMLInputElement;
        expect(input.value).toBe('85.00');
    });

    it('emits the parsed rate + validity through onRateChange after pre-fill', async () => {
        const onRateChange = jest.fn();
        renderPanel({onRateChange});

        await waitFor(() => {
            expect(onRateChange).toHaveBeenCalledWith(85, true);
        });
    });

    it('shows live quotes as a radio group with the first quote pre-selected', async () => {
        renderPanel({fetchRate: jest.fn().mockResolvedValue(liveQuoteResponse)});

        expect(await screen.findByText(/Live Quote/)).toBeInTheDocument();
        expect(screen.getByText(/Standard Delivery/)).toBeInTheDocument();
        expect(screen.getByText(/Express Delivery/)).toBeInTheDocument();

        const input = screen.getByLabelText(/Agreed Rate/) as HTMLInputElement;
        expect(input.value).toBe('60.00');
    });

    it('lets the operator switch live quotes by clicking another row', async () => {
        const user = setupUser();
        renderPanel({fetchRate: jest.fn().mockResolvedValue(liveQuoteResponse)});

        expect(await screen.findByText(/Express Delivery/)).toBeInTheDocument();
        await user.click(screen.getByText(/Express Delivery/));

        const input = screen.getByLabelText(/Agreed Rate/) as HTMLInputElement;
        expect(input.value).toBe('95.00');
    });

    it('shows the percentage hint and pre-fills with the derived rate (Mode 2)', async () => {
        renderPanel({fetchRate: jest.fn().mockResolvedValue(percentageResponse)});

        expect(await screen.findByText(/Percentage/)).toBeInTheDocument();
        expect(screen.getByText(/60% of the job amount/)).toBeInTheDocument();

        const input = screen.getByLabelText(/Agreed Rate/) as HTMLInputElement;
        expect(input.value).toBe('60.00');
        expect(screen.getByText(/substitutes this rate at dispatch/i)).toBeInTheDocument();
    });

    it('shows the cost-plus hint and pre-fills with the partner quote (Mode 3)', async () => {
        renderPanel({fetchRate: jest.fn().mockResolvedValue(costPlusResponse)});

        expect(await screen.findByText(/Cost Plus/)).toBeInTheDocument();
        expect(screen.getByText(/margin 25%/)).toBeInTheDocument();

        const input = screen.getByLabelText(/Agreed Rate/) as HTMLInputElement;
        expect(input.value).toBe('80.00');
        expect(screen.getByText(/rewrite the job amount/i)).toBeInTheDocument();
    });

    it('shows the manual-entry message when source is none', async () => {
        renderPanel({fetchRate: jest.fn().mockResolvedValue(noRateResponse)});

        expect(await screen.findByText(/No pre-agreed rate/)).toBeInTheDocument();
    });

    it('renders the server message verbatim when source is none and a message was provided', async () => {
        renderPanel({
            fetchRate: jest.fn().mockResolvedValue({
                rateCardRate: null,
                liveQuotes: [],
                source: 'none',
                message: 'No active service mapping for this pairing and job type (JobTypeId=42)',
            } satisfies PartnerRateForJobResponse),
        });

        expect(await screen.findByText(/No active service mapping/)).toBeInTheDocument();
    });

    it('reports rate=0/valid=false when the input is cleared', async () => {
        const onRateChange = jest.fn();
        const user = setupUser();
        renderPanel({onRateChange});

        expect(await screen.findByLabelText(/Agreed Rate/)).toBeInTheDocument();

        const input = screen.getByLabelText(/Agreed Rate/) as HTMLInputElement;
        await user.clear(input);

        await waitFor(() => {
            expect(onRateChange).toHaveBeenLastCalledWith(0, false);
        });
    });

    it('falls back to a "none" response when fetchRate rejects', async () => {
        renderPanel({fetchRate: jest.fn().mockRejectedValue(new Error('network down'))});

        expect(await screen.findByText(/No pre-agreed rate/)).toBeInTheDocument();
    });
    describe('lane serviceability', () => {
        const unserviceable: PartnerRateForJobResponse = {
            rateCardRate: null,
            liveQuotes: [],
            source: 'percentage',
            percentageOfClientCharge: 60,
            derivedRate: 60.00,
            serviceAvailable: false,
            serviceabilityMessage: "Partner reports service 'STD' is not available on this route.",
            alternatives: [
                {jobTypeId: 11, partnerServiceCode: 'OVERNIGHT', serviceName: 'Overnight', totalCharge: 24.50, currency: 'NZD', transitDays: 1},
                {jobTypeId: 12, partnerServiceCode: 'ECONOMY', serviceName: 'Economy', totalCharge: 18.00, currency: 'NZD', transitDays: 2},
            ],
        };

        it('warns and lists what the partner can carry when the lane is unserviceable', async () => {
            renderPanel({fetchRate: jest.fn().mockResolvedValue(unserviceable)});

            expect(await screen.findByText(/not available on this route/i)).toBeInTheDocument();
            expect(screen.getByText(/OVERNIGHT/)).toBeInTheDocument();
            expect(screen.getByText(/ECONOMY/)).toBeInTheDocument();
        });

        it('still shows the derived pricing alongside the warning', async () => {
            renderPanel({fetchRate: jest.fn().mockResolvedValue(unserviceable)});

            await screen.findByText(/not available on this route/i);
            expect(screen.getByDisplayValue('60.00')).toBeInTheDocument();
        });

        it('says nothing when the partner could not be asked', async () => {
            renderPanel({
                fetchRate: jest.fn().mockResolvedValue({
                    ...unserviceable,
                    serviceAvailable: null,
                    serviceabilityMessage: 'Partner API error: ServiceUnavailable',
                    alternatives: [],
                }),
            });

            await screen.findByDisplayValue('60.00');
            // null is "we don't know" — warning it would train operators to ignore a real one.
            expect(screen.queryByText(/not available on this route/i)).not.toBeInTheDocument();
        });

        it('says nothing when the lane is serviceable', async () => {
            renderPanel({
                fetchRate: jest.fn().mockResolvedValue({...unserviceable, serviceAvailable: true, alternatives: []}),
            });

            await screen.findByDisplayValue('60.00');
            expect(screen.queryByText(/not available on this route/i)).not.toBeInTheDocument();
        });
    });
});
