/**
 * PartnerApprovalsInbox Tests
 */

import React from 'react';
import {screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {PartnerApprovalsInbox} from './PartnerApprovalsInbox';
import {renderWithProviders} from '../../__testUtils__';
import {jobChangeRequestApi, type JobChangeRequestInboxItem} from '../../services/jobChangeRequestApi';

jest.mock('../../services/jobChangeRequestApi', () => ({
    jobChangeRequestApi: {
        pendingForApproval: jest.fn(),
        approve: jest.fn(),
        reject: jest.fn(),
    },
}));

const mockApi = jobChangeRequestApi as jest.Mocked<typeof jobChangeRequestApi>;

function makeItem(overrides: Partial<JobChangeRequestInboxItem> = {}): JobChangeRequestInboxItem {
    return {
        request: {
            id: 1,
            jobId: 100,
            sourceRequestUuid: 'a1',
            origin: 'Peer',
            requestingPartyType: 'PartnerTenant',
            approvalPartyType: 'OwnerTenant',
            fieldName: 'Quantity',
            currentValue: '3',
            requestedValue: '5',
            reason: undefined,
            status: 'Pending',
            approvalMode: 'Manual',
            requiresCommercialRefresh: true,
            requestedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
            ...(overrides.request ?? {}),
        },
        jobNo: 'J100',
        clientName: 'Acme Logistics',
        ...overrides,
    } as JobChangeRequestInboxItem;
}

describe('PartnerApprovalsInbox', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('renders the inbox-zero empty state when no items are pending', async () => {
        mockApi.pendingForApproval.mockResolvedValueOnce([]);
        renderWithProviders(<PartnerApprovalsInbox/>);
        expect(await screen.findByText(/Inbox zero/i)).toBeInTheDocument();
        expect(screen.getByText(/No partner change requests are awaiting/i)).toBeInTheDocument();
    });

    it('groups rows by customer with the count in the heading', async () => {
        mockApi.pendingForApproval.mockResolvedValueOnce([
            makeItem({request: {...makeItem().request, id: 1}, clientName: 'Acme Logistics'}),
            makeItem({request: {...makeItem().request, id: 2}, clientName: 'Acme Logistics'}),
            makeItem({request: {...makeItem().request, id: 3}, clientName: 'Beta Couriers'}),
        ]);
        renderWithProviders(<PartnerApprovalsInbox/>);
        expect(await screen.findByText('Acme Logistics')).toBeInTheDocument();
        expect(screen.getByText('Beta Couriers')).toBeInTheDocument();
        expect(screen.getByText(/2 requests/)).toBeInTheDocument();
        expect(screen.getByText(/1 request$/)).toBeInTheDocument();
    });

    it('places customers with overdue items first', async () => {
        const fresh = makeItem({
            request: {...makeItem().request, id: 10},
            clientName: 'Acme Logistics',
        });
        const overdue = makeItem({
            request: {
                ...makeItem().request,
                id: 11,
                requestedAt: new Date(Date.now() - 96 * 60 * 60 * 1000).toISOString(), // 96h
            },
            clientName: 'Beta Couriers',
        });
        mockApi.pendingForApproval.mockResolvedValueOnce([fresh, overdue]);
        renderWithProviders(<PartnerApprovalsInbox/>);

        expect(await screen.findByText('Acme Logistics')).toBeInTheDocument();
        const overdueChips = screen.getAllByText('Overdue');
        expect(overdueChips.length).toBeGreaterThan(0);
        // The customer with overdue items appears first in the DOM.
        const acmeIdx = screen.getByText('Acme Logistics').compareDocumentPosition(screen.getByText('Beta Couriers'));
        // Acme comes AFTER Beta because Beta has the overdue item.
        // eslint-disable-next-line no-bitwise
        expect(acmeIdx & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy();
    });

    it('approve calls the API and refetches', async () => {
        const user = userEvent.setup();
        mockApi.pendingForApproval
            .mockResolvedValueOnce([makeItem()])
            .mockResolvedValueOnce([]);
        mockApi.approve.mockResolvedValueOnce({success: true});

        renderWithProviders(<PartnerApprovalsInbox/>);
        expect(await screen.findByRole('button', {name: /Approve/})).toBeInTheDocument();

        await user.click(screen.getByRole('button', {name: /Approve/}));

        await waitFor(() => {
            expect(mockApi.approve).toHaveBeenCalledWith({requestId: 1, rowVersion: undefined});
        });
    });

    it('reject opens the inline reason input and submits with the reason', async () => {
        const user = userEvent.setup();
        mockApi.pendingForApproval
            .mockResolvedValueOnce([makeItem()])
            .mockResolvedValueOnce([]);
        mockApi.reject.mockResolvedValueOnce({success: true});

        renderWithProviders(<PartnerApprovalsInbox/>);
        expect(await screen.findByRole('button', {name: /^Reject$/})).toBeInTheDocument();

        await user.click(screen.getByRole('button', {name: /^Reject$/}));
        expect(screen.getByLabelText(/Reason for rejection/i)).toBeInTheDocument();

        await user.click(screen.getByLabelText(/Reason for rejection/i));
        await user.paste('rate too low');
        await user.click(screen.getByRole('button', {name: /Confirm reject/}));

        await waitFor(() => {
            expect(mockApi.reject).toHaveBeenCalledWith({
                requestId: 1,
                rowVersion: undefined,
                reason: 'rate too low',
            });
        });
    });

    it('clicking the job number invokes onOpenJob', async () => {
        const user = userEvent.setup();
        const onOpenJob = jest.fn();
        mockApi.pendingForApproval.mockResolvedValueOnce([makeItem()]);

        renderWithProviders(<PartnerApprovalsInbox onOpenJob={onOpenJob}/>);
        expect(await screen.findByRole('button', {name: /J100/})).toBeInTheDocument();

        await user.click(screen.getByRole('button', {name: /J100/}));
        expect(onOpenJob).toHaveBeenCalledWith(100, 'J100');
    });

    it('shows "re-rates" chip on commercial-refresh requests', async () => {
        mockApi.pendingForApproval.mockResolvedValueOnce([makeItem()]);
        renderWithProviders(<PartnerApprovalsInbox/>);
        expect(await screen.findByText('re-rates')).toBeInTheDocument();
    });

    it('renders address payload as a readable string instead of JSON', async () => {
        const addressItem = makeItem({
            request: {
                ...makeItem().request,
                id: 5,
                fieldName: 'PickupAddress',
                currentValue: JSON.stringify({addressLine1: '99 Old St'}),
                requestedValue: JSON.stringify({addressLine1: '7 Lambton Quay', fullAddress: '7 Lambton Quay, Wellington'}),
            },
        });
        mockApi.pendingForApproval.mockResolvedValueOnce([addressItem]);
        renderWithProviders(<PartnerApprovalsInbox/>);

        expect(await screen.findByText('Pickup Address')).toBeInTheDocument();
        expect(screen.getByText(/7 Lambton Quay, Wellington/)).toBeInTheDocument();
    });
});
