/**
 * RateAcceptanceBanner tests.
 */
import React from 'react';
import { setupUser } from '../../../../__testUtils__/setupUser';
import {render, screen, waitFor, within} from '@testing-library/react';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {RateAcceptanceBanner} from './RateAcceptanceBanner';
import type {
    PartnerInboundJobAcceptanceState,
    PartnerInboundJobActionResponse,
} from '../../../../services/jobListApi';

jest.mock('../../../../services/jobListApi', () => ({
    __esModule: true,
    getPartnerInboundRateAcceptance: jest.fn(),
    acceptPartnerRate: jest.fn(),
    rejectPartnerRate: jest.fn(),
}));

const api = jest.requireMock('../../../../services/jobListApi') as {
    getPartnerInboundRateAcceptance: jest.MockedFunction<
        (jobId: number) => Promise<PartnerInboundJobAcceptanceState>
    >;
    acceptPartnerRate: jest.MockedFunction<(jobId: number) => Promise<PartnerInboundJobActionResponse>>;
    rejectPartnerRate: jest.MockedFunction<
        (jobId: number, reason: string) => Promise<PartnerInboundJobActionResponse>
    >;
};

function renderBanner(jobId = 42) {
    const client = new QueryClient({defaultOptions: {queries: {retry: false}}});
    return render(
        <QueryClientProvider client={client}>
            <RateAcceptanceBanner jobId={jobId}/>
        </QueryClientProvider>,
    );
}

afterEach(() => {
    jest.clearAllMocks();
});

describe('RateAcceptanceBanner', () => {
    it('renders nothing when status is Allowed', async () => {
        api.getPartnerInboundRateAcceptance.mockResolvedValue({
            status: 'Allowed',
            proposedAgreedRate: null,
            rejectionReason: null,
            actionedAtUtc: null,
            partnerJobGuid: null,
        });

        const {container} = renderBanner();

        await waitFor(() => expect(api.getPartnerInboundRateAcceptance).toHaveBeenCalled());
        // Banner renders no visible content for Allowed.
        expect(container.textContent).toBe('');
    });

    it('renders the offered rate and accept / reject buttons when PendingAcceptance', async () => {
        api.getPartnerInboundRateAcceptance.mockResolvedValue({
            status: 'PendingAcceptance',
            proposedAgreedRate: 42.5,
            rejectionReason: null,
            actionedAtUtc: null,
            partnerJobGuid: null,
        });

        renderBanner();

        expect(await screen.findByText(/Partner rate needs review/i)).toBeInTheDocument();
        expect(screen.getByText(/\$42\.5/)).toBeInTheDocument();
        expect(screen.getByRole('button', {name: /Accept/})).toBeInTheDocument();
        expect(screen.getByRole('button', {name: /^Reject$/})).toBeInTheDocument();
    });

    it('invokes the accept API when Accept is clicked', async () => {
        const user = setupUser();
        api.getPartnerInboundRateAcceptance.mockResolvedValue({
            status: 'PendingAcceptance',
            proposedAgreedRate: 42.5,
            rejectionReason: null,
            actionedAtUtc: null,
            partnerJobGuid: null,
        });
        api.acceptPartnerRate.mockResolvedValue({success: true, errorMessage: null, newState: null});

        renderBanner(123);

        await user.click(await screen.findByRole('button', {name: /Accept/}));

        await waitFor(() => expect(api.acceptPartnerRate).toHaveBeenCalledWith(123));
    });

    it('opens the reject dialog, requires a reason, and posts it', async () => {
        const user = setupUser();
        api.getPartnerInboundRateAcceptance.mockResolvedValue({
            status: 'PendingAcceptance',
            proposedAgreedRate: 10,
            rejectionReason: null,
            actionedAtUtc: null,
            partnerJobGuid: null,
        });
        api.rejectPartnerRate.mockResolvedValue({success: true, errorMessage: null, newState: null});

        renderBanner(99);

        await user.click(await screen.findByRole('button', {name: /^Reject$/}));

        const dialog = await screen.findByRole('dialog');
        const submit = within(dialog).getByRole('button', {name: /Reject Rate/});
        expect(submit).toBeDisabled();

        const reasonInput = within(dialog).getByLabelText('Reason');
        await user.click(reasonInput);
        await user.paste('Rate too low');
        expect(submit).not.toBeDisabled();

        await user.click(submit);

        await waitFor(() => expect(api.rejectPartnerRate).toHaveBeenCalledWith(99, 'Rate too low'));
    });

    it('shows the rejection reason when status is Rejected', async () => {
        api.getPartnerInboundRateAcceptance.mockResolvedValue({
            status: 'Rejected',
            proposedAgreedRate: 25,
            rejectionReason: 'Customer cancelled',
            actionedAtUtc: '2026-05-27T10:00:00Z',
            partnerJobGuid: null,
        });

        renderBanner();

        expect(await screen.findByText(/Partner rate rejected/i)).toBeInTheDocument();
        expect(screen.getByText(/Customer cancelled/)).toBeInTheDocument();
    });
});
