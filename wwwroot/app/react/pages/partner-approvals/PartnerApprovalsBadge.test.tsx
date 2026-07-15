/**
 * PartnerApprovalsBadge Tests
 */

import React from 'react';
import {screen, waitFor} from '@testing-library/react';
import {PartnerApprovalsBadge} from './PartnerApprovalsBadge';
import { renderWithProviders } from '../../__testUtils__';
import { setupUser } from '../../__testUtils__/setupUser';
import {jobChangeRequestApi, type JobChangeRequestInboxItem} from '../../services/jobChangeRequestApi';

jest.mock('../../services/jobChangeRequestApi', () => ({
    jobChangeRequestApi: {
        pendingForApproval: jest.fn(),
        hasActivePartners: jest.fn(),
        approve: jest.fn(),
        reject: jest.fn(),
    },
}));

const mockApi = jobChangeRequestApi as jest.Mocked<typeof jobChangeRequestApi>;

function makeItem(hoursOld: number, id: number): JobChangeRequestInboxItem {
    return {
        request: {
            id,
            jobId: 100 + id,
            sourceRequestUuid: `u${id}`,
            origin: 'Peer',
            requestingPartyType: 'PartnerTenant',
            approvalPartyType: 'OwnerTenant',
            fieldName: 'Quantity',
            currentValue: '3',
            requestedValue: '5',
            status: 'Pending',
            approvalMode: 'Manual',
            requiresCommercialRefresh: true,
            requestedAt: new Date(Date.now() - hoursOld * 60 * 60 * 1000).toISOString(),
        },
        jobNo: `J${100 + id}`,
        clientName: 'Acme',
    } as JobChangeRequestInboxItem;
}

describe('PartnerApprovalsBadge', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        // Default: tenant has active partners. Individual tests override.
        mockApi.hasActivePartners.mockResolvedValue(true);
    });

    it('shows no badge content when the inbox is empty', async () => {
        mockApi.pendingForApproval.mockResolvedValueOnce([]);
        renderWithProviders(<PartnerApprovalsBadge/>);
        // The button is always rendered, but the Badge content is hidden when invisible.
        const button = await screen.findByRole('button', {name: /Open partner approvals/i});
        expect(button).toBeInTheDocument();
        // No numeric badge text.
        expect(button.textContent).not.toMatch(/\d/);
    });

    it('shows the pending count', async () => {
        mockApi.pendingForApproval.mockResolvedValueOnce([
            makeItem(1, 1),
            makeItem(2, 2),
            makeItem(3, 3),
        ]);
        renderWithProviders(<PartnerApprovalsBadge/>);
        expect(await screen.findByText('3')).toBeInTheDocument();
    });

    it('caps the displayed count at 99+', async () => {
        const many = Array.from({length: 120}, (_, i) => makeItem(1, i + 1));
        mockApi.pendingForApproval.mockResolvedValueOnce(many);
        renderWithProviders(<PartnerApprovalsBadge/>);
        expect(await screen.findByText(/99\+/)).toBeInTheDocument();
    });

    it('clicking the badge opens the drawer with the inbox', async () => {
        const user = setupUser();
        mockApi.pendingForApproval.mockResolvedValue([makeItem(1, 1)]);
        renderWithProviders(<PartnerApprovalsBadge/>);
        expect(await screen.findByText('1')).toBeInTheDocument();

        await user.click(screen.getByRole('button', {name: /Open partner approvals/i}));

        expect(await screen.findByText(/Partner Approvals/i)).toBeInTheDocument();
        expect(screen.getByText('Acme')).toBeInTheDocument();
    });

    it('renders nothing and skips the inbox poll when the tenant has no active partners', async () => {
        mockApi.hasActivePartners.mockResolvedValue(false);
        mockApi.pendingForApproval.mockResolvedValue([makeItem(1, 1)]);
        renderWithProviders(<PartnerApprovalsBadge/>);

        await waitFor(() => {
            expect(mockApi.hasActivePartners).toHaveBeenCalled();
        });

        expect(screen.queryByRole('button', {name: /Open partner approvals/i})).not.toBeInTheDocument();
        expect(mockApi.pendingForApproval).not.toHaveBeenCalled();
    });
});
